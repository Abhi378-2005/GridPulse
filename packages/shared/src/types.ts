// ─── Data Source Modes ─────────────────────────────────────
export type DataMode = 'LIVE' | 'REPLAY' | 'DEMO';
export type DataSource = 'LIVE_API' | 'DATASET' | 'SIMULATION' | 'HYBRID';

// ─── Grid Node ─────────────────────────────────────────────
export interface GridNodeState {
  id: string;
  name: string;
  emoji: string;
  solarCapacityKw: number;
  batteryCapacityKwh: number;
  batteryChargeKwh: number;
  baseLoadKw: number;
  posX: number;
  posY: number;
  // Live state
  generationKw: number;
  consumptionKw: number;
  netEnergyKw: number;
  weatherFactor: number;
  dataSource: DataSource;
}

// ─── Meter Reading ─────────────────────────────────────────
export interface MeterReadingData {
  nodeId: string;
  simulationTime: string;
  generationKw: number;
  consumptionKw: number;
  netEnergyKw: number;
  batteryKwh: number;
  dataSource: DataSource;
  weatherFactor: number;
  cloudCoverPct?: number;
  solarRadiation?: number;
  temperatureC?: number;
  co2Intensity?: number;
}

// ─── Orders ────────────────────────────────────────────────
export type OrderSide = 'BID' | 'ASK';
export type OrderStatus = 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED';

export interface OrderData {
  id: string;
  nodeId: string;
  nodeName: string;
  side: OrderSide;
  pricePerKwh: number;
  quantityKwh: number;
  filledKwh: number;
  status: OrderStatus;
  createdAt: string;
}

// ─── Trades ────────────────────────────────────────────────
export interface TradeData {
  id: string;
  buyerNodeId: string;
  buyerName: string;
  buyerEmoji: string;
  sellerNodeId: string;
  sellerName: string;
  sellerEmoji: string;
  clearingPrice: number;
  quantityKwh: number;
  totalCost: number;
  co2AvoidedKg: number;
  createdAt: string;
}

// ─── Order Book ────────────────────────────────────────────
export interface OrderBookLevel {
  price: number;
  quantity: number;
  orderCount: number;
}

export interface OrderBookSnapshot {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  lastPrice?: number;
}

// ─── Weather ───────────────────────────────────────────────
export interface WeatherEventData {
  id: string;
  type: 'CLOUD_COVER' | 'HEATWAVE' | 'CLEAR_SKY' | 'STORM' | 'CUSTOM';
  description: string;
  source: DataSource;
  impactFactor: number;
  startTime: string;
  durationMs: number;
}

export interface LiveWeatherData {
  cloudCoverPct: number;
  solarRadiationWm2: number;
  temperatureC: number;
  humidity?: number;
  provider: string;
  fetchedAt: string;
}

// ─── Aggregate Metrics ─────────────────────────────────────
export interface AggregateMetrics {
  totalCO2AvoidedKg: number;
  totalMoneySaved: number;
  totalKwhTraded: number;
  totalTradesCount: number;
  nodesOnline: number;
  currentGridPrice: number;
  avgP2PPrice: number;
}

// ─── Simulation Control ────────────────────────────────────
export interface SimulationState {
  isRunning: boolean;
  virtualTime: string;
  speed: number;
  mode: DataMode;
  tickCount: number;
}

export interface SimulationTickPayload {
  state: SimulationState;
  nodes: GridNodeState[];
  weather?: LiveWeatherData;
}

// ─── Socket Events ─────────────────────────────────────────
export interface ServerToClientEvents {
  'simulation:tick': (payload: SimulationTickPayload) => void;
  'trade:executed': (trade: TradeData) => void;
  'orderbook:update': (book: OrderBookSnapshot) => void;
  'weather:event': (event: WeatherEventData) => void;
  'weather:live': (data: LiveWeatherData) => void;
  'metrics:update': (metrics: AggregateMetrics) => void;
  'node:added': (node: GridNodeState) => void;
  'node:configUpdated': (update: { nodeId: string; field: string; value: number }) => void;
  'simulation:state': (state: SimulationState) => void;
  'error': (error: { message: string }) => void;
}

export interface ClientToServerEvents {
  'simulation:control': (action: SimControlAction) => void;
  'node:updateConfig': (update: NodeConfigUpdate) => void;
  'node:add': (request: AddNodeRequest) => void;
  'location:set': (location: { latitude: number; longitude: number; label: string }) => void;
}

// ─── Node Interactivity ────────────────────────────────────
export interface NodeConfigUpdate {
  nodeId: string;
  field: 'baseLoadKw' | 'solarCapacityKw' | 'forceZeroGeneration' | 'forceMaxLoad';
  value: number; // For sliders: the new numeric value. For toggles: 1 = on, 0 = off
}

export interface AddNodeRequest {
  name: string;
  emoji: string;
  solarCapacity: number;
  batteryCapacity: number;
  baseLoad: number;
}

export type SimControlAction =
  | { type: 'setSpeed'; speed: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'setMode'; mode: DataMode }
  | { type: 'triggerEvent'; eventType: string };

