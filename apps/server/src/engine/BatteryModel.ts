import { BATTERY } from '@gridpulse/shared';
import { clamp } from '../utils/math';

/**
 * Realistic battery charge/discharge model.
 *
 * IMPROVEMENTS over the original:
 * 1. Round-trip efficiency (~92% for Li-ion) — charging loses some energy
 * 2. Minimum SOC (10%) — don't drain below threshold (preserves battery lifespan)
 * 3. Maximum SOC (95%) — don't overcharge
 * 4. C-rate limit — max charge/discharge rate relative to capacity
 * 5. Self-discharge — tiny energy loss over time (~0.01%/hour)
 */
export class BatteryModel {
  /**
   * Update battery state based on net energy.
   * @param netEnergyKw - Net energy (positive = surplus, negative = deficit)
   * @param currentChargeKwh - Current battery level
   * @param capacityKwh - Maximum battery capacity
   * @param tickDurationHours - Duration of one tick in hours
   * @returns New battery charge level and adjusted net energy
   */
  static update(
    netEnergyKw: number,
    currentChargeKwh: number,
    capacityKwh: number,
    tickDurationHours: number
  ): { newChargeKwh: number; adjustedNetKw: number } {
    // Battery limits
    const minCharge = capacityKwh * BATTERY.MIN_SOC_PCT;      // Don't go below 10%
    const maxCharge = capacityKwh * BATTERY.MAX_SOC_PCT;      // Don't go above 95%
    const maxChargeRateKw = capacityKwh * BATTERY.DEFAULT_C_RATE; // 0.5C rate
    const maxEnergyTransfer = maxChargeRateKw * tickDurationHours;

    // Apply self-discharge first
    const selfDischargeLoss = currentChargeKwh * BATTERY.SELF_DISCHARGE_PCT_PER_HOUR * tickDurationHours;
    let charge = Math.max(0, currentChargeKwh - selfDischargeLoss);

    if (netEnergyKw > 0) {
      // Surplus → charge battery (with efficiency losses)
      const rawChargeEnergy = netEnergyKw * tickDurationHours;
      const limitedCharge = Math.min(rawChargeEnergy, maxEnergyTransfer);

      // Apply charging efficiency — some energy is lost as heat
      const effectiveCharge = limitedCharge * Math.sqrt(BATTERY.ROUND_TRIP_EFFICIENCY);

      const headroom = maxCharge - charge;
      const actualCharge = Math.min(effectiveCharge, Math.max(0, headroom));

      charge = clamp(charge + actualCharge, 0, capacityKwh);

      // Remaining surplus after charging goes to grid/trading
      // Account for the efficiency loss (we consumed more from the surplus than went into battery)
      const consumedFromSurplus = actualCharge / Math.sqrt(BATTERY.ROUND_TRIP_EFFICIENCY);
      const remainingSurplus = netEnergyKw - (consumedFromSurplus / tickDurationHours);

      return {
        newChargeKwh: charge,
        adjustedNetKw: Math.max(0, remainingSurplus),
      };
    } else {
      // Deficit → discharge battery (with efficiency losses)
      const rawDischargeEnergy = Math.abs(netEnergyKw) * tickDurationHours;
      const limitedDischarge = Math.min(rawDischargeEnergy, maxEnergyTransfer);

      // Available energy above minimum SOC
      const available = Math.max(0, charge - minCharge);
      const actualDischarge = Math.min(limitedDischarge, available);

      charge = clamp(charge - actualDischarge, 0, capacityKwh);

      // Energy delivered is less than energy taken from battery (discharge efficiency)
      const deliveredEnergy = actualDischarge * Math.sqrt(BATTERY.ROUND_TRIP_EFFICIENCY);
      const remainingDeficit = netEnergyKw + (deliveredEnergy / tickDurationHours);

      return {
        newChargeKwh: charge,
        adjustedNetKw: Math.min(0, remainingDeficit),
      };
    }
  }
}
