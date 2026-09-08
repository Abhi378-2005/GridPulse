// ─── Simulation Parameters ─────────────────────────────────
export const SIM_DEFAULTS = {
  TICK_INTERVAL_MS: 3000,
  DEFAULT_SPEED: 1,
  MAX_SPEED: 1440,
  MIN_SPEED: 1,
} as const;

// ─── Solar Model Parameters ────────────────────────────────
export const SOLAR = {
  PEAK_HOUR: 12,       // Solar noon
  SIGMA: 3,            // Bell curve width
  SUNRISE_HOUR: 6,
  SUNSET_HOUR: 20,
  NOISE_SIGMA: 0.05,   // 5% random noise
} as const;

// ─── Consumption Model Parameters ──────────────────────────
export const CONSUMPTION = {
  MORNING_PEAK_HOUR: 8,
  MORNING_SIGMA: 1.5,
  EVENING_PEAK_HOUR: 19,
  EVENING_SIGMA: 2.0,
  MORNING_PEAK_MULTIPLIER: 1.5,
  EVENING_PEAK_MULTIPLIER: 2.0,
  NOISE_SIGMA: 0.08,
} as const;

// ─── Trading Parameters ────────────────────────────────────
export const TRADING = {
  GRID_PRICE_PER_KWH: 0.15,       // Reference grid price ($)
  MIN_PRICE: 0.01,                 // Minimum bid/ask price
  MAX_PRICE: 0.50,                 // Maximum bid/ask price
  PRICE_JITTER: 0.02,             // AutoTrader price randomization
  MIN_ORDER_QTY: 0.01,            // Minimum order quantity (kWh)
} as const;

// ─── Financial Parameters ──────────────────────────────────
export const FINANCE = {
  INITIAL_WALLET_BALANCE: 100.00,  // Starting balance ($)
  CO2_GRID_DEFAULT: 450,          // gCO2/kWh grid average fallback
} as const;

// ─── Weather Event Types ───────────────────────────────────
export const WEATHER_EVENTS = {
  CLOUD_COVER: { factor: 0.6, durationMs: 120000, desc: '☁️ Cloud cover reduces solar generation by 40%' },
  HEATWAVE: { factor: 1.5, durationMs: 180000, desc: '🌡️ Heatwave! AC demand surges 50%' },
  CLEAR_SKY: { factor: 1.1, durationMs: 120000, desc: '☀️ Clear skies boost solar by 10%' },
  STORM: { factor: 0.2, durationMs: 60000, desc: '⛈️ Storm! Solar drops to 20%' },
} as const;

// ─── Node Definitions ──────────────────────────────────────
export const HOUSE_CONFIGS = [
  { name: 'Alpha',   emoji: '🏠', solarCapacity: 6.0, batteryCapacity: 12.0, baseLoad: 1.5, posX: 300, posY: 100 },
  { name: 'Beta',    emoji: '🏡', solarCapacity: 4.5, batteryCapacity: 8.0,  baseLoad: 2.0, posX: 550, posY: 80 },
  { name: 'Gamma',   emoji: '🏘️', solarCapacity: 8.0, batteryCapacity: 15.0, baseLoad: 1.2, posX: 700, posY: 250 },
  { name: 'Delta',   emoji: '🏗️', solarCapacity: 3.0, batteryCapacity: 6.0,  baseLoad: 2.5, posX: 650, posY: 450 },
  { name: 'Epsilon', emoji: '🏢', solarCapacity: 5.5, batteryCapacity: 10.0, baseLoad: 3.0, posX: 400, posY: 500 },
  { name: 'Zeta',    emoji: '🏛️', solarCapacity: 7.0, batteryCapacity: 14.0, baseLoad: 1.8, posX: 150, posY: 450 },
  { name: 'Eta',     emoji: '🏠', solarCapacity: 4.0, batteryCapacity: 7.0,  baseLoad: 1.0, posX: 100, posY: 250 },
  { name: 'Theta',   emoji: '🏡', solarCapacity: 5.0, batteryCapacity: 10.0, baseLoad: 2.2, posX: 400, posY: 300 },
] as const;

// ─── API Configuration ─────────────────────────────────────
export const API_CONFIG = {
  OPEN_METEO_BASE: 'https://api.open-meteo.com/v1/forecast',
  CARBON_INTENSITY_BASE: 'https://api.carbonintensity.org.uk',
  WEATHER_CACHE_TTL_MS: 15 * 60 * 1000,    // 15 minutes
  CARBON_CACHE_TTL_MS: 30 * 60 * 1000,     // 30 minutes
  DEFAULT_LATITUDE: 18.52,                   // Pune, India
  DEFAULT_LONGITUDE: 73.85,
} as const;
