import { clamp } from '../utils/math';

/**
 * Battery charge/discharge model.
 * Charges from solar surplus, discharges to cover deficit.
 */
export class BatteryModel {
  /**
   * Update battery state based on net energy.
   * @param netEnergyKw - Net energy (positive = surplus, negative = deficit)
   * @param currentChargeKwh - Current battery level
   * @param capacityKwh - Maximum battery capacity
   * @param tickDurationHours - Duration of one tick in hours
   * @param maxChargeRateKw - Maximum charge/discharge rate (default: 3kW)
   * @returns New battery charge level and adjusted net energy
   */
  static update(
    netEnergyKw: number,
    currentChargeKwh: number,
    capacityKwh: number,
    tickDurationHours: number,
    maxChargeRateKw: number = 3.0
  ): { newChargeKwh: number; adjustedNetKw: number } {
    // Limit charge/discharge rate
    const maxEnergyTransfer = maxChargeRateKw * tickDurationHours;

    if (netEnergyKw > 0) {
      // Surplus → charge battery
      const chargeAmount = Math.min(
        netEnergyKw * tickDurationHours,
        maxEnergyTransfer,
        capacityKwh - currentChargeKwh
      );
      const newCharge = clamp(currentChargeKwh + chargeAmount, 0, capacityKwh);
      // Remaining surplus after charging goes to grid/trading
      const remainingSurplus = netEnergyKw - (chargeAmount / tickDurationHours);
      return {
        newChargeKwh: newCharge,
        adjustedNetKw: Math.max(0, remainingSurplus),
      };
    } else {
      // Deficit → discharge battery
      const dischargeAmount = Math.min(
        Math.abs(netEnergyKw) * tickDurationHours,
        maxEnergyTransfer,
        currentChargeKwh
      );
      const newCharge = clamp(currentChargeKwh - dischargeAmount, 0, capacityKwh);
      // Remaining deficit after discharge needs to be purchased
      const remainingDeficit = netEnergyKw + (dischargeAmount / tickDurationHours);
      return {
        newChargeKwh: newCharge,
        adjustedNetKw: Math.min(0, remainingDeficit),
      };
    }
  }
}
