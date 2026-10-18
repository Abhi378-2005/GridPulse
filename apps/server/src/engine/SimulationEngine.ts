import { connectDB } from '../config/database';
import { GridNode, Wallet, Transaction, Posting, MeterReading } from '../models';
import { SIM_DEFAULTS, TRADING, FINANCE } from '@gridpulse/shared';
import type { DataMode, SimulationState, SimulationTickPayload, GridNodeState, AggregateMetrics, TradeData, WeatherEventData, NodeConfigUpdate, AddNodeRequest } from '@gridpulse/shared';
import { DataFusionEngine } from './DataFusionEngine';
import { MatchingEngine, type MatchResult } from '../trading/MatchingEngine';
import { AutoTrader } from '../trading/AutoTrader';
import { GridFallback } from '../trading/GridFallback';
import { roundTo } from '../utils/math';
import { LedgerService, type GridSettlement } from '../ledger/LedgerService';
import { Server as SocketServer } from 'socket.io';
import mongoose from 'mongoose';

/**
 * Main Simulation Engine — the orchestrator.
 * Ticks every N seconds, driving the entire system:
 * DataFusion → MeterReadings → AutoTrader → MatchingEngine → GridFallback → Ledger → Broadcast
 */
export class SimulationEngine {
  private dataFusion: DataFusionEngine;
  private matchingEngine: MatchingEngine;
  private autoTrader: AutoTrader;
  private gridFallback: GridFallback;
  private ledger: LedgerService = new LedgerService();
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
  private totalGridImportKwh: number = 0;
  private totalGridExportKwh: number = 0;
  private totalGridImportCost: number = 0;
  private totalGridExportRevenue: number = 0;
  private recentTrades: TradeData[] = [];

  // Energy each node traded P2P during the current tick (used to find what's left for the grid)
  private tickTraded: Map<string, { soldKwh: number; receivedKwh: number }> = new Map();

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
    this.gridFallback = new GridFallback();

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
    let dbNodes = await GridNode.find({}).lean();
    if (dbNodes.length === 0) {
      console.log('🌱 Database is empty. Auto-seeding initial microgrid topology...');
      const { seedDatabase } = await import('../scripts/seed');
      await seedDatabase({ clearExisting: false });
      dbNodes = await GridNode.find({}).lean();
    }

    this.nodes = dbNodes.map(n => ({
      id: n._id.toString(),
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

    // Grid operator's wallet (receives import payments and wheeling charges)
    await LedgerService.ensureGridWallet();

    // ✅ FIX: Rebuild order book from database (Bug #4 — survives restart)
    await this.matchingEngine.rebuildFromDB();

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
    GridNode.findByIdAndUpdate(nodeId, { name })
      .catch(err => console.error('Failed to save node name to DB:', err));

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
      const dbNode = await GridNode.create({
        name: request.name,
        emoji: request.emoji,
        solarCapacityKw: request.solarCapacity,
        batteryCapacityKwh: request.batteryCapacity,
        batteryChargeKwh: request.batteryCapacity * 0.5,
        baseLoadKw: request.baseLoad,
        datasetProfileId: request.name.toLowerCase(),
        posX: 200 + Math.random() * 400,
        posY: 100 + Math.random() * 400,
      });

      // Create wallet
      const wallet = await Wallet.create({ nodeId: dbNode._id });

      // Seed initial balance
      const tx = await Transaction.create({
        kind: 'DEPOSIT',
        description: `Initial deposit for ${request.name}`,
      });

      await Posting.create({
        amount: mongoose.Types.Decimal128.fromString(FINANCE.INITIAL_WALLET_BALANCE.toFixed(4)),
        type: 'CREDIT',
        walletId: wallet._id,
        transactionId: tx._id,
      });

      // Add to in-memory simulation
      const newNode = {
        id: dbNode._id.toString(),
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
        id: dbNode._id.toString(),
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
      currentGridPrice: this.gridFallback.getCurrentImportRate(this.virtualTime),
      avgP2PPrice: this.matchingEngine.getLastClearingPrice(),
      gridImportKwh: roundTo(this.totalGridImportKwh, 2),
      gridExportKwh: roundTo(this.totalGridExportKwh, 2),
      gridImportCost: roundTo(this.totalGridImportCost, 2),
      gridExportRevenue: roundTo(this.totalGridExportRevenue, 2),
    };
  }

  getRecentTrades(): TradeData[] {
    return this.recentTrades.slice(-50);
  }

  getMatchingEngine(): MatchingEngine {
    return this.matchingEngine;
  }

  async submitManualOrder(
    nodeId: string,
    side: 'BID' | 'ASK',
    pricePerKwh: number,
    quantityKwh: number
  ): Promise<MatchResult> {
    const result = await this.matchingEngine.submitOrder(nodeId, side, pricePerKwh, quantityKwh, 'MANUAL');
    for (const trade of result.trades) {
      this.recordTrade(trade);
    }
    if (this.io) {
      this.io.emit('orderbook:update', result.orderBookSnapshot);
    }
    return result;
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
    this.tickTraded.clear();

    // 1. Check for weather events
    const weatherEvent = this.dataFusion.tickWeather(this.virtualTime);
    if (weatherEvent && this.io) {
      this.io.emit('weather:event', weatherEvent);
    }

    // 2. Compute meter readings for all nodes
    const nodeStates: GridNodeState[] = [];
    const meterReadingDocs: any[] = []; // Batch for DB insert

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

      // ✅ FIX: Save meter readings every tick (Bug #3 — charts now have data)
      meterReadingDocs.push({
        nodeId: new mongoose.Types.ObjectId(node.id),
        simulationTime: new Date(this.virtualTime),
        generationKw: genKw,
        consumptionKw: conKw,
        netEnergyKw: netKw,
        batteryKwh: reading.batteryKwh,
        dataSource: reading.dataSource,
        weatherFactor: reading.weatherFactor,
        cloudCoverPct: reading.cloudCoverPct,
        solarRadiation: reading.solarRadiation,
        temperatureC: reading.temperatureC,
        co2Intensity: reading.co2Intensity,
      });

      // 3. AutoTrader places orders based on net energy
      await this.autoTrader.placeOrders(
        node.id, netKw, tickDurationHours, this.virtualTime,
        reading.batteryKwh, node.batteryCapacityKwh
      );
    }

    // Batch insert meter readings (non-blocking)
    if (meterReadingDocs.length > 0) {
      MeterReading.insertMany(meterReadingDocs).catch(err =>
        console.error('Failed to save meter readings:', err)
      );
    }

    // 4. Grid fallback — whatever wasn't matched P2P is bought from / sold to MSEDCL.
    // Subtract what each node actually traded this tick so P2P energy isn't counted twice.
    const gridSettlements: GridSettlement[] = [];
    for (const nodeState of nodeStates) {
      const traded = this.tickTraded.get(nodeState.id) || { soldKwh: 0, receivedKwh: 0 };
      const unmatchedNetKw = nodeState.netEnergyKw > 0
        ? Math.max(0, nodeState.netEnergyKw - traded.soldKwh / tickDurationHours)
        : Math.min(0, nodeState.netEnergyKw + traded.receivedKwh / tickDurationHours);

      const gridResult = this.gridFallback.handleUnmatchedEnergy(
        unmatchedNetKw, tickDurationHours, this.virtualTime
      );
      if (!gridResult) continue;

      this.totalGridImportKwh += gridResult.importKwh;
      this.totalGridExportKwh += gridResult.exportKwh;
      this.totalGridImportCost += gridResult.importCost;
      this.totalGridExportRevenue += gridResult.exportRevenue;

      gridSettlements.push(gridResult.importKwh > 0
        ? { nodeId: nodeState.id, direction: 'IMPORT', kwh: gridResult.importKwh, amount: gridResult.importCost }
        : { nodeId: nodeState.id, direction: 'EXPORT', kwh: gridResult.exportKwh, amount: gridResult.exportRevenue });
    }
    // Charge / pay the wallets in the ledger
    await this.ledger.settleGridTransfers(gridSettlements);

    // 5. Get live weather data for display
    const liveWeather = this.mode === 'LIVE' ? await this.dataFusion.getLiveWeather() : null;

    // 6. Broadcast to all connected clients
    if (this.io) {
      const bookSnapshot = this.matchingEngine.getOrderBookSnapshot();

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

    // Energy delivered to the buyer after line losses
    const deliveredKwh = trade.quantityKwh * (1 - TRADING.TRANSMISSION_LOSS_PCT);

    // Track per-node P2P volume for this tick's grid fallback
    const seller = this.tickTraded.get(trade.sellerNodeId) || { soldKwh: 0, receivedKwh: 0 };
    seller.soldKwh += trade.quantityKwh;
    this.tickTraded.set(trade.sellerNodeId, seller);
    const buyer = this.tickTraded.get(trade.buyerNodeId) || { soldKwh: 0, receivedKwh: 0 };
    buyer.receivedKwh += deliveredKwh;
    this.tickTraded.set(trade.buyerNodeId, buyer);

    // Money saved = what the delivered energy would have cost from the grid
    //               − what the buyer actually paid (energy + wheeling charge)
    const gridRate = this.gridFallback.getCurrentImportRate(this.virtualTime);
    const savings = gridRate * deliveredKwh - trade.totalCost;
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
