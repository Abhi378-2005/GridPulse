import axios from 'axios';
import { API_CONFIG } from '@gridpulse/shared';
import type { LiveWeatherData } from '@gridpulse/shared';

/**
 * Open-Meteo API service — FREE, no API key required.
 * Fetches real-time cloud cover, solar radiation, and temperature.
 */
export class OpenMeteoService {
  private cache: { data: LiveWeatherData; expiresAt: number } | null = null;
  private latitude: number;
  private longitude: number;

  constructor(latitude?: number, longitude?: number) {
    this.latitude = latitude || API_CONFIG.DEFAULT_LATITUDE;
    this.longitude = longitude || API_CONFIG.DEFAULT_LONGITUDE;
  }

  /**
   * Get current weather data. Returns cached data if fresh.
   */
  async getCurrent(): Promise<LiveWeatherData | null> {
    const now = Date.now();

    // Return cache if still valid
    if (this.cache && now < this.cache.expiresAt) {
      return this.cache.data;
    }

    try {
      const url = `${API_CONFIG.OPEN_METEO_BASE}?` +
        `latitude=${this.latitude}&longitude=${this.longitude}` +
        `&current=temperature_2m,relative_humidity_2m,cloud_cover,direct_radiation`;

      const response = await axios.get(url, { timeout: 5000 });
      const current = response.data.current;

      const data: LiveWeatherData = {
        cloudCoverPct: current.cloud_cover ?? 0,
        solarRadiationWm2: current.direct_radiation ?? 0,
        temperatureC: current.temperature_2m ?? 25,
        humidity: current.relative_humidity_2m,
        provider: 'Open-Meteo',
        fetchedAt: new Date().toISOString(),
      };

      this.cache = {
        data,
        expiresAt: now + API_CONFIG.WEATHER_CACHE_TTL_MS,
      };

      console.log(`☁️  Open-Meteo: ${data.cloudCoverPct}% clouds, ${data.temperatureC}°C, ${data.solarRadiationWm2} W/m²`);
      return data;
    } catch (error) {
      console.warn('⚠️  Open-Meteo API unavailable, using fallback');
      // Return stale cache if available
      if (this.cache) return this.cache.data;
      return null;
    }
  }

  /**
   * Compute a weather modifier (0.0–1.0+) from live cloud cover.
   * 0% clouds → 1.0, 100% clouds → 0.2
   */
  getWeatherModifier(data: LiveWeatherData): number {
    return 1.0 - (data.cloudCoverPct / 100) * 0.8;
  }

  /**
   * Compute a temperature modifier for consumption.
   * Hotter → more AC → higher consumption.
   * >25°C: +2% per degree above 25.
   * <15°C: +1.5% per degree below 15 (heating).
   */
  getTemperatureModifier(data: LiveWeatherData): number {
    const temp = data.temperatureC;
    if (temp > 25) {
      return 1.0 + (temp - 25) * 0.02;
    } else if (temp < 15) {
      return 1.0 + (15 - temp) * 0.015;
    }
    return 1.0;
  }
}
