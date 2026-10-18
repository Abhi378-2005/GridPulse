import { FINANCE } from '@gridpulse/shared';

/**
 * Carbon Intensity Service for India.
 *
 * CHANGE: Removed the UK National Grid API (api.carbonintensity.org.uk)
 * which has nothing to do with Pune. India's grid carbon intensity is
 * ~708 gCO₂/kWh according to the Central Electricity Authority (CEA)
 * CO₂ Baseline Database v19.0.
 *
 * In the future, this could fetch from India-specific APIs or
 * Power System Operation Corporation (POSOCO) data.
 */
export class CarbonIntensityService {
  private cache: { co2GramsPerKwh: number; expiresAt: number } | null = null;

  /**
   * Get current grid carbon intensity in gCO₂/kWh.
   * Uses the CEA published figure for India's grid.
   */
  async getCurrent(): Promise<number> {
    // India's grid emission factor from CEA (Central Electricity Authority)
    // Source: CO₂ Baseline Database v19.0 (2023)
    // Combined Margin: 0.708 tCO₂/MWh ≈ 708 gCO₂/kWh
    //
    // Note: This is a national average. Maharashtra's Western Grid
    // has a slightly lower figure (~680 gCO₂/kWh) due to higher
    // renewable penetration, but we use the national figure for simplicity.
    return FINANCE.CO2_GRID_DEFAULT; // 708 gCO₂/kWh
  }

  /**
   * Calculate CO₂ avoided by trading P2P instead of from grid.
   * @param kwhTraded - Energy traded peer-to-peer
   * @param co2GramsPerKwh - Grid carbon intensity (default: India CEA figure)
   * @returns CO₂ avoided in kilograms
   */
  static calculateCO2Avoided(kwhTraded: number, co2GramsPerKwh: number = FINANCE.CO2_GRID_DEFAULT): number {
    // P2P solar energy avoids grid carbon emissions
    return (kwhTraded * co2GramsPerKwh) / 1000;
  }
}
