import { prisma } from '../config/database';
import { SIM_DEFAULTS, TRADING } from '@gridpulse/shared';
import type { DataMode, SimulationState, SimulationTickPayload, GridNodeState, AggregateMetrics, TradeData, WeatherEventData } from '@gridpulse/shared';
import { DataFusionEngine } from './DataFusionEngine';
import { MatchingEngine } from '../trading/MatchingEngine';
import { AutoTrader } from '../trading/AutoTrader';
import { roundTo } from '../utils/math';
import { Server as SocketServer } from 'socket.io';

/**
 * Main Simulation Engine — the orchestrator.
 * Ticks every N seconds, driving the entire system:
 * DataFusion → MeterReadings → AutoTrader → MatchingEngine → Ledger → Broadcast
 */
export class SimulationEngine {
  private dataFusion: DataFusionEngine;
  private matchingEngine: MatchingEngine;
  private autoTrader: AutoTrader;
  private io: SocketServer | null = null;

  private isRunning: boolean = false;
  private virtualTime: Date;
  private speed: number = SIM_DEFAULTS.DEFAULT_SPEED;
  private mode: DataMode = 'DEMO';
  private tickCount: number = 0;
  private tickInterval: NodeJS.Timeout | null = null;

  // Aggregate metrics
  private totalCO2AvoidedKg: number = 0;
  private totalMoneySaved: number = 0;
  private totalKwhTraded: number = 0;
  private totalTradesCount: number = 0;
  private recentTrades: TradeData[] = [];

  // Node configs (loaded from DB)
  private nodes: Array<{
    id: string;
    name: string;
    emoji: string;
    solarCapacityKw: number;
    batteryCapacityKwh: number;
    batteryChargeKwh: number;
    baseLoadKw: number;
    datasetProfileId: string;
  }> = [];

  constructor() {
    this.dataFusion = new DataFusionEngine();
    this.matchingEngine = new MatchingEngine();
    this.autoTrader = new AutoTrader(this.matchingEngine);

    // Start at 6:00 AM for a nice sunrise experience
    this.virtualTime = new Date();
    this.virtualTime.setHours(6, 0, 0, 0);
  }

  /**
   * Initialize the engine — load nodes from DB, init data fusion.
   */
  async initialize(io: SocketServer): Promise<void> {
    this.io = io;

    // Load nodes from database
    const dbNodes = await prisma.gridNode.findMany({
      include: { wallet: true },
    });

    this.nodes = dbNodes.map(n => ({
      id: n.id,
      name: n.name,
      emoji: n.emoji,
      solarCapacityKw: n.solarCapacityKw,
      batteryCapacityKwh: n.batteryCapacityKwh,
      batteryChargeKwh: n.batteryChargeKwh,
      baseLoadKw: n.baseLoadKw,
      datasetProfileId: n.datasetProfileId,
    }));

    // Register node names in matching engine
    for (const node of this.nodes) {
      this.matchingEngine.setNodeInfo(node.id, node.name, node.emoji);
    }

    // Initialize data fusion engine
    await this.dataFusion.initialize(this.nodes);

    console.log(`⚡ SimulationEngine initialized with ${this.nodes.length} nodes`);
  }

  /**
   * Start the simulation tick loop.
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.tickInterval = setInterval(() => {
      this.tick().catch(err => console.error('Tick error:', err));
    }, SIM_DEFAULTS.TICK_INTERVAL_MS);

    console.log('▶️  Simulation started');
  }

  /**
   * Pause the simulation.
   */
  pause(): void {
    this.isRunning = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    console.log('⏸️  Simulation paused');
  }

  /**
   * Set simulation speed (1x to 1440x).
   */
  setSpeed(speed: number): void {
    this.speed = Math.max(SIM_DEFAULTS.MIN_SPEED, Math.min(SIM_DEFAULTS.MAX_SPEED, speed));
    console.log(`⏩ Speed set to ${this.speed}x`);
  }

  /**
   * Set data mode (LIVE, REPLAY, DEMO).
   */
  setMode(mode: DataMode): void {
    this.mode = mode;
    console.log(`📡 Mode set to ${mode}`);
  }

  /**
   * Trigger a weather event (e.g., heatwave button).
   */
  triggerEvent(eventType: string): void {
    const event = this.dataFusion.triggerWeatherEvent(eventType, this.virtualTime);
    if (this.io) {
      this.io.emit('weather:event', event);
    }
    console.log(`⚡ Triggered: ${event.description}`);
  }

  /**
   * Get current simulation state.
   */
  getState(): SimulationState {
    return {
      isRunning: this.isRunning,
      virtualTime: this.virtualTime.toISOString(),
      speed: this.speed,
      mode: this.mode,
      tickCount: this.tickCount,
    };
  }

  getMetrics(): AggregateMetrics {
    return {
      totalCO2AvoidedKg: roundTo(this.totalCO2AvoidedKg, 2),
      totalMoneySaved: roundTo(this.totalMoneySaved, 2),
      totalKwhTraded: roundTo(this.totalKwhTraded, 2),
      totalTradesCount: this.totalTradesCount,
      nodesOnline: this.nodes.length,
      currentGridPrice: TRADING.GRID_PRICE_PER_KWH,
      avgP2PPrice: this.matchingEngine.getLastClearingPrice(),
    };
  }

  getRecentTrades(): TradeData[] {
    return this.recentTrades.slice(-50);
  }

  /**
   * Core simulation tick — called every TICK_INTERVAL_MS.
   */
  private async tick(): Promise<void> {
    if (!this.isRunning) return;
    this.tickCount++;

    // Advance virtual time based on speed
    const virtualSecondsPerTick = (SIM_DEFAULTS.TICK_INTERVAL_MS / 1000) * this.speed;
    this.virtualTime = new Date(this.virtualTime.getTime() + virtualSecondsPerTick * 1000);

    // Wrap around at midnight
    if (this.virtualTime.getHours() === 0 && this.virtualTime.getMinutes() === 0) {
      // Reset to next day but keep the date advancing
    }

    const tickDurationHours = virtualSecondsPerTick / 3600;

    // 1. Check for weather events
    const weatherEvent = this.dataFusion.tickWeather(this.virtualTime);
    if (weatherEvent && this.io) {
      this.io.emit('weather:event', weatherEvent);
    }

    // 2. Compute meter readings for all nodes
    const nodeStates: GridNodeState[] = [];
    const tickTrades: TradeData[] = [];

    for (const node of this.nodes) {
      const reading = await this.dataFusion.computeReading(
        node, this.virtualTime, this.mode, tickDurationHours
      );

      // Build node state for frontend
      nodeStates.push({
        id: node.id,
        name: node.name,
        emoji: node.emoji,
        solarCapacityKw: node.solarCapacityKw,
        batteryCapacityKwh: node.batteryCapacityKwh,
        batteryChargeKwh: reading.batteryKwh,
        baseLoadKw: node.baseLoadKw,
        posX: 0, posY: 0, // Frontend handles positioning
        generationKw: reading.generationKw,
        consumptionKw: reading.consumptionKw,
        netEnergyKw: reading.netEnergyKw,
        weatherFactor: reading.weatherFactor,
        dataSource: reading.dataSource,
      });

      // 3. AutoTrader places orders based on net energy
      await this.autoTrader.placeOrders(node.id, reading.netEnergyKw, tickDurationHours);
    }

    // 4. Collect trades that happened during matching
    // (trades are executed inside submitOrder → matchingEngine)
    // We check the order book snapshot
    const bookSnapshot = this.matchingEngine.getOrderBookSnapshot();

    // 5. Get live weather data for display
    const liveWeather = this.mode === 'LIVE' ? await this.dataFusion.getLiveWeather() : null;

    // 6. Broadcast to all connected clients
    if (this.io) {
      const tickPayload: SimulationTickPayload = {
        state: this.getState(),
        nodes: nodeStates,
        weather: liveWeather || undefined,
      };

      this.io.emit('simulation:tick', tickPayload);
      this.io.emit('orderbook:update', bookSnapshot);
      this.io.emit('metrics:update', this.getMetrics());

      if (liveWeather) {
        this.io.emit('weather:live', liveWeather);
      }
    }
  }

  /**
   * Record a trade in metrics (called by matching engine via events).
   */
  recordTrade(trade: TradeData): void {
    this.totalCO2AvoidedKg += trade.co2AvoidedKg;
    this.totalKwhTraded += trade.quantityKwh;
    this.totalTradesCount++;

    // Money saved = (grid price - P2P price) × quantity
    const savings = (TRADING.GRID_PRICE_PER_KWH - trade.clearingPrice) * trade.quantityKwh;
    this.totalMoneySaved += Math.max(0, savings);

    this.recentTrades.push(trade);
    if (this.recentTrades.length > 100) {
      this.recentTrades = this.recentTrades.slice(-50);
    }

    // Broadcast trade
    if (this.io) {
      this.io.emit('trade:executed', trade);
    }
  }
}
