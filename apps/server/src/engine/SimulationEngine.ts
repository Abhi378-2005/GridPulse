import { prisma } from '../config/database';
import { SIM_DEFAULTS, TRADING, FINANCE } from '@gridpulse/shared';
import type { DataMode, SimulationState, SimulationTickPayload, GridNodeState, AggregateMetrics, TradeData, WeatherEventData, NodeConfigUpdate, AddNodeRequest } from '@gridpulse/shared';
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

  // Node overrides (stress-test toggles)
  private overrides: Map<string, { forceZeroGeneration: boolean; forceMaxLoad: boolean }> = new Map();

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

    // Wire up trade callback so metrics accumulate
    this.autoTrader.setOnTrade((trade) => this.recordTrade(trade));

    // Start at 8:00 AM so the sun is up and there's a good solar surplus for demos
    this.virtualTime = new Date();
    this.virtualTime.setHours(8, 0, 0, 0);
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
   * Update a node's name in real-time.
   */
  async updateNodeName(nodeId: string, name: string): Promise<void> {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Update in memory
    node.name = name;
    
    // Update matching engine node info
    this.matchingEngine.setNodeInfo(node.id, node.name, node.emoji);

    console.log(`🏷️  Node renamed to ${name}`);

    // Update in database (non-blocking)
    prisma.gridNode.update({
      where: { id: nodeId },
      data: { name },
    }).catch(err => console.error('Failed to save node name to DB:', err));

    // Broadcast update to all clients
    if (this.io) {
      this.io.emit('node:nameUpdated', { nodeId, name });
    }
  }

  /**
   * Update a node's configuration in real-time (from interactive sliders).
   */
  updateNodeConfig(update: NodeConfigUpdate): void {
    const node = this.nodes.find(n => n.id === update.nodeId);
    if (!node) return;

    switch (update.field) {
      case 'baseLoadKw':
        node.baseLoadKw = Math.max(0.1, Math.min(10, update.value));
        console.log(`🔧 ${node.name} base load → ${node.baseLoadKw} kW`);
        break;
      case 'solarCapacityKw':
        node.solarCapacityKw = Math.max(0, Math.min(20, update.value));
        console.log(`☀️ ${node.name} solar capacity → ${node.solarCapacityKw} kW`);
        break;
      case 'forceZeroGeneration': {
        const overrides = this.overrides.get(update.nodeId) || { forceZeroGeneration: false, forceMaxLoad: false };
        overrides.forceZeroGeneration = update.value === 1;
        this.overrides.set(update.nodeId, overrides);
        console.log(`⚡ ${node.name} forceZeroGeneration → ${overrides.forceZeroGeneration}`);
        break;
      }
      case 'forceMaxLoad': {
        const overrides = this.overrides.get(update.nodeId) || { forceZeroGeneration: false, forceMaxLoad: false };
        overrides.forceMaxLoad = update.value === 1;
        this.overrides.set(update.nodeId, overrides);
        console.log(`🔥 ${node.name} forceMaxLoad → ${overrides.forceMaxLoad}`);
        break;
      }
    }

    // Broadcast update to all clients
    if (this.io) {
      this.io.emit('node:configUpdated', { nodeId: update.nodeId, field: update.field, value: update.value });
    }
  }

  /**
   * Dynamically add a new node to the running simulation.
   */
  async addNode(request: AddNodeRequest): Promise<GridNodeState | null> {
    try {
      // Create in database
      const dbNode = await prisma.gridNode.create({
        data: {
          name: request.name,
          emoji: request.emoji,
          solarCapacityKw: request.solarCapacity,
          batteryCapacityKwh: request.batteryCapacity,
          batteryChargeKwh: request.batteryCapacity * 0.5,
          baseLoadKw: request.baseLoad,
          datasetProfileId: request.name.toLowerCase(),
          posX: 200 + Math.random() * 400,
          posY: 100 + Math.random() * 400,
        },
      });

      // Create wallet
      await prisma.wallet.create({ data: { nodeId: dbNode.id } });

      // Seed initial balance
      const wallet = await prisma.wallet.findUnique({ where: { nodeId: dbNode.id } });
      if (wallet) {
        await prisma.transaction.create({
          data: {
            description: `Initial deposit for ${request.name}`,
            postings: { create: { amount: FINANCE.INITIAL_WALLET_BALANCE, type: 'CREDIT', walletId: wallet.id } },
          },
        });
      }

      // Add to in-memory simulation
      const newNode = {
        id: dbNode.id,
        name: dbNode.name,
        emoji: dbNode.emoji,
        solarCapacityKw: dbNode.solarCapacityKw,
        batteryCapacityKwh: dbNode.batteryCapacityKwh,
        batteryChargeKwh: dbNode.batteryChargeKwh,
        baseLoadKw: dbNode.baseLoadKw,
        datasetProfileId: dbNode.datasetProfileId,
      };
      this.nodes.push(newNode);
      this.matchingEngine.setNodeInfo(newNode.id, newNode.name, newNode.emoji);

      console.log(`➕ Added node: ${request.emoji} ${request.name}`);

      // Return as a GridNodeState for broadcasting
      const nodeState: GridNodeState = {
        id: dbNode.id,
        name: dbNode.name,
        emoji: dbNode.emoji,
        solarCapacityKw: dbNode.solarCapacityKw,
        batteryCapacityKwh: dbNode.batteryCapacityKwh,
        batteryChargeKwh: dbNode.batteryChargeKwh,
        baseLoadKw: dbNode.baseLoadKw,
        posX: dbNode.posX,
        posY: dbNode.posY,
        generationKw: 0,
        consumptionKw: 0,
        netEnergyKw: 0,
        weatherFactor: 1,
        dataSource: 'SIMULATION',
      };

      if (this.io) {
        this.io.emit('node:added', nodeState);
      }

      return nodeState;
    } catch (error) {
      console.error('Failed to add node:', error);
      return null;
    }
  }

  /**
   * Set the location for LIVE mode weather API calls.
   */
  setLocation(latitude: number, longitude: number, label: string): void {
    this.dataFusion.setLocation(latitude, longitude);
    console.log(`📍 Location set to ${label} (${latitude}, ${longitude})`);
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
      // Apply overrides
      const nodeOverrides = this.overrides.get(node.id);
      let genKw = reading.generationKw;
      let conKw = reading.consumptionKw;
      if (nodeOverrides?.forceZeroGeneration) genKw = 0;
      if (nodeOverrides?.forceMaxLoad) conKw = node.baseLoadKw * 4;
      const netKw = nodeOverrides ? (genKw - conKw) : reading.netEnergyKw;

      nodeStates.push({
        id: node.id,
        name: node.name,
        emoji: node.emoji,
        solarCapacityKw: node.solarCapacityKw,
        batteryCapacityKwh: node.batteryCapacityKwh,
        batteryChargeKwh: reading.batteryKwh,
        baseLoadKw: node.baseLoadKw,
        posX: 0, posY: 0, // Frontend handles positioning
        generationKw: genKw,
        consumptionKw: conKw,
        netEnergyKw: netKw,
        weatherFactor: reading.weatherFactor,
        dataSource: reading.dataSource,
      });

      // 3. AutoTrader places orders based on net energy
      await this.autoTrader.placeOrders(node.id, netKw, tickDurationHours);
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
