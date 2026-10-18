export const SIM_DEFAULTS = {
  TICK_INTERVAL_MS: 3000,
  DEFAULT_SPEED: 120,      // 120x speed so a full day takes ~12 minutes (great for demos)
  MAX_SPEED: 1440,
  MIN_SPEED: 1,
} as const;

// ─── Solar Model Parameters ────────────────────────────────
// Sunrise/sunset now computed dynamically by SolarModel using
// sun-position formulas for the configured latitude/longitude.
// These constants serve as fallback defaults.
export const SOLAR = {
  PEAK_HOUR: 12,       // Solar noon
  SIGMA: 3,            // Bell curve width
  SUNRISE_HOUR: 6,     // Fallback — overridden by sun-position calc
  SUNSET_HOUR: 18.5,   // Fallback — overridden by sun-position calc
  NOISE_SIGMA: 0.05,   // 5% random noise
  // Pune coordinates for sun-position calculations
  LATITUDE: 18.52,
  LONGITUDE: 73.85,
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
  // Weekend and seasonal modifiers
  WEEKEND_MULTIPLIER: 1.15,         // 15% higher usage on weekends
  SUMMER_AC_MULTIPLIER: 1.40,       // 40% increase during hot months (Apr–Jun)
  MONSOON_MULTIPLIER: 1.05,         // Slight increase during monsoon humidity
} as const;

// ─── Trading Parameters (₹ / Rupees) ──────────────────────
// Based on Maharashtra Electricity Regulatory Commission (MERC) tariffs
// for residential LT consumers in Pune (MSEDCL).
export const TRADING = {
  // MSEDCL tariff slabs (₹/kWh) — simplified residential rates (2024-25)
  GRID_IMPORT_RATE_PEAK: 9.50,      // Peak hours (18:00–22:00)
  GRID_IMPORT_RATE_NORMAL: 7.50,    // Normal hours (06:00–18:00)
  GRID_IMPORT_RATE_OFFPEAK: 5.50,   // Off-peak hours (22:00–06:00)
  GRID_EXPORT_RATE: 3.50,           // MSEDCL net-metering buyback rate
  GRID_PRICE_PER_KWH: 7.50,        // Reference grid price (₹) — normal rate
  MIN_PRICE: 1.00,                  // Minimum bid/ask price (₹/kWh)
  MAX_PRICE: 15.00,                 // Maximum bid/ask price (₹/kWh)
  PRICE_JITTER: 0.50,              // AutoTrader price randomization (₹)
  MIN_ORDER_QTY: 0.01,             // Minimum order quantity (kWh)
  // Transmission & distribution
  TRANSMISSION_LOSS_PCT: 0.04,     // 4% energy lost in local distribution
  WHEELING_CHARGE_PER_KWH: 1.50,  // ₹/kWh wheeling + cross-subsidy surcharge
  CURRENCY_SYMBOL: '₹',
  CURRENCY_CODE: 'INR',
} as const;

// ─── Financial Parameters (₹) ─────────────────────────────
export const FINANCE = {
  INITIAL_WALLET_BALANCE: 5000.00,  // Starting balance (₹)
  // India's grid emission factor (Central Electricity Authority, 2023)
  // Source: CEA CO2 Baseline Database v19.0
  // India's weighted average grid emission factor ≈ 0.708 tCO2/MWh = 708 gCO2/kWh
  CO2_GRID_DEFAULT: 708,           // gCO2/kWh — India grid average (CEA)
} as const;

// ─── Battery Parameters ───────────────────────────────────
export const BATTERY = {
  ROUND_TRIP_EFFICIENCY: 0.92,     // 92% round-trip efficiency (Li-ion)
  MIN_SOC_PCT: 0.10,              // Don't discharge below 10% (preserve lifespan)
  MAX_SOC_PCT: 0.95,              // Don't charge above 95%
  DEFAULT_C_RATE: 0.5,            // Max charge/discharge = 0.5 × capacity per hour
  SELF_DISCHARGE_PCT_PER_HOUR: 0.0001, // 0.01% per hour (~0.24%/day)
} as const;

// ─── Weather Event Types ───────────────────────────────────
export const WEATHER_EVENTS = {
  CLOUD_COVER: { factor: 0.6, durationMs: 120000, desc: '☁️ Cloud cover reduces solar generation by 40%' },
  HEATWAVE: { factor: 1.5, durationMs: 180000, desc: '🌡️ Heatwave! AC demand surges 50%' },
  CLEAR_SKY: { factor: 1.1, durationMs: 120000, desc: '☀️ Clear skies boost solar by 10%' },
  STORM: { factor: 0.2, durationMs: 60000, desc: '⛈️ Storm! Solar drops to 20%' },
} as const;

// ─── Node Definitions ──────────────────────────────────────
// Named after real Pune neighborhoods for flavor
export const HOUSE_CONFIGS = [
  { name: 'Koregaon',  emoji: '🏠', solarCapacity: 9.0, batteryCapacity: 12.0, baseLoad: 1.5, posX: 300, posY: 100 },
  { name: 'Baner',     emoji: '🏡', solarCapacity: 7.0, batteryCapacity: 8.0,  baseLoad: 2.0, posX: 550, posY: 80 },
  { name: 'Hinjewadi', emoji: '🏘️', solarCapacity: 12.0, batteryCapacity: 15.0, baseLoad: 1.2, posX: 700, posY: 250 },
  { name: 'Kothrud',   emoji: '🏗️', solarCapacity: 4.5, batteryCapacity: 6.0,  baseLoad: 2.5, posX: 650, posY: 450 },
  { name: 'Viman',     emoji: '🏢', solarCapacity: 8.0, batteryCapacity: 10.0, baseLoad: 3.0, posX: 400, posY: 500 },
  { name: 'Aundh',     emoji: '🏛️', solarCapacity: 10.5, batteryCapacity: 14.0, baseLoad: 1.8, posX: 150, posY: 450 },
  { name: 'Wakad',     emoji: '🏠', solarCapacity: 6.0, batteryCapacity: 7.0,  baseLoad: 1.0, posX: 100, posY: 250 },
  { name: 'Hadapsar',  emoji: '🏡', solarCapacity: 7.5, batteryCapacity: 10.0, baseLoad: 2.2, posX: 400, posY: 300 },
] as const;

// ─── API Configuration ─────────────────────────────────────
export const API_CONFIG = {
  OPEN_METEO_BASE: 'https://api.open-meteo.com/v1/forecast',
  // Removed UK Carbon Intensity API — using CEA static figure for India
  WEATHER_CACHE_TTL_MS: 15 * 60 * 1000,    // 15 minutes
  CARBON_CACHE_TTL_MS: 30 * 60 * 1000,     // 30 minutes
  DEFAULT_LATITUDE: 18.52,                   // Pune, India
  DEFAULT_LONGITUDE: 73.85,
} as const;
