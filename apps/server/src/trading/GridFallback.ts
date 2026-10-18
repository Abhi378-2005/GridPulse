import { TRADING } from '@gridpulse/shared';
import { getHourFraction } from '../utils/math';

interface GridTransaction {
  importKwh: number;
  exportKwh: number;
  importCost: number;
  exportRevenue: number;
}

/**
 * Grid Fallback — MSEDCL (Maharashtra State Electricity Distribution Co. Ltd.)
 *
 * In real life, if no neighbour sells you power, you buy from the electricity
 * company. If nobody buys your extra solar, the company buys it back at a
 * lower rate (net metering).
 *
 * This ensures unmatched energy doesn't just "disappear" — it flows to/from
 * the main grid at regulated tariff rates.
 *
 * Uses Maharashtra time-of-day (ToD) tariffs:
 * - Peak hours (18:00–22:00): ₹9.50/kWh
 * - Normal hours (06:00–18:00): ₹7.50/kWh
 * - Off-peak hours (22:00–06:00): ₹5.50/kWh
 * - Export/buyback rate: ₹3.50/kWh (net metering)
 */
export class GridFallback {

  /**
   * Get the current MSEDCL import rate based on time-of-day.
   */
  getCurrentImportRate(time: Date): number {
    const hour = getHourFraction(time);

    if (hour >= 18 && hour < 22) {
      return TRADING.GRID_IMPORT_RATE_PEAK;     // ₹9.50 — peak evening
    } else if (hour >= 6 && hour < 18) {
      return TRADING.GRID_IMPORT_RATE_NORMAL;    // ₹7.50 — daytime
    } else {
      return TRADING.GRID_IMPORT_RATE_OFFPEAK;   // ₹5.50 — night
    }
  }

  /**
   * Get the MSEDCL export/buyback rate (net metering).
   * This is always lower than the import rate — the utility pays less for
   * surplus solar fed back into the grid.
   */
  getExportRate(): number {
    return TRADING.GRID_EXPORT_RATE; // ₹3.50/kWh
  }

  /**
   * Handle energy that wasn't matched in the P2P market.
   *
   * @param unmatchedNetKw - Positive = surplus to export, Negative = deficit to import
   * @param tickDurationHours - Duration of the current tick
   * @param time - Current simulation time (for ToD pricing)
   * @returns Grid transaction details, or null if nothing to trade
   */
  handleUnmatchedEnergy(
    unmatchedNetKw: number,
    tickDurationHours: number,
    time: Date
  ): GridTransaction | null {
    const energyKwh = Math.abs(unmatchedNetKw) * tickDurationHours;

    if (energyKwh < 0.001) return null; // Negligible

    if (unmatchedNetKw > 0) {
      // Surplus — sell to grid at export rate
      const exportRevenue = energyKwh * this.getExportRate();
      return {
        importKwh: 0,
        exportKwh: energyKwh,
        importCost: 0,
        exportRevenue,
      };
    } else {
      // Deficit — buy from grid at ToD import rate
      const importCost = energyKwh * this.getCurrentImportRate(time);
      return {
        importKwh: energyKwh,
        exportKwh: 0,
        importCost,
        exportRevenue: 0,
      };
    }
  }
}
