import axios from 'axios';
import { API_CONFIG, FINANCE } from '@gridpulse/shared';

/**
 * Carbon Intensity API service — FREE, no API key required.
 * Fetches real-time grid carbon intensity (gCO2/kWh) from the UK National Grid.
 */
export class CarbonIntensityService {
  private cache: { co2GramsPerKwh: number; expiresAt: number } | null = null;

  /**
   * Get current grid carbon intensity in gCO2/kWh.
   */
  async getCurrent(): Promise<number> {
    const now = Date.now();

    // Return cache if still valid
    if (this.cache && now < this.cache.expiresAt) {
      return this.cache.co2GramsPerKwh;
    }

    try {
      const url = `${API_CONFIG.CARBON_INTENSITY_BASE}/intensity`;
      const response = await axios.get(url, { timeout: 5000 });

      const intensity = response.data.data?.[0]?.intensity;
      const co2 = intensity?.actual || intensity?.forecast || FINANCE.CO2_GRID_DEFAULT;

      this.cache = {
        co2GramsPerKwh: co2,
        expiresAt: now + API_CONFIG.CARBON_CACHE_TTL_MS,
      };

      console.log(`🌍 Carbon Intensity: ${co2} gCO2/kWh`);
      return co2;
    } catch (error) {
      console.warn('⚠️  Carbon Intensity API unavailable, using default');
      if (this.cache) return this.cache.co2GramsPerKwh;
      return FINANCE.CO2_GRID_DEFAULT;
    }
  }

  /**
   * Calculate CO2 avoided by trading P2P instead of from grid.
   * @param kwhTraded - Energy traded peer-to-peer
   * @param co2GramsPerKwh - Grid carbon intensity
   * @returns CO2 avoided in kilograms
   */
  static calculateCO2Avoided(kwhTraded: number, co2GramsPerKwh: number): number {
    // P2P solar energy avoids grid carbon emissions
    return (kwhTraded * co2GramsPerKwh) / 1000;
  }
}
