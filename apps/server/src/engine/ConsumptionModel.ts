import { CONSUMPTION } from '@gridpulse/shared';
import { gaussian, addNoise, clamp, getHourFraction } from '../utils/math';

/**
 * Household consumption model using a double-peaked Gaussian.
 * Morning peak ~8am (routines), evening peak ~7pm (cooking/entertainment).
 */
export class ConsumptionModel {
  /**
   * Compute household consumption at a given time.
   * @param time - The simulation time
   * @param baseLoadKw - Base continuous load in kW
   * @param temperatureModifier - Heat modifier (>1.0 = hotter = more AC)
   * @returns Consumption in kW
   */
  static compute(time: Date, baseLoadKw: number, temperatureModifier: number = 1.0): number {
    const hour = getHourFraction(time);

    // Morning peak (getting ready, breakfast)
    const morningPeak = gaussian(
      hour,
      CONSUMPTION.MORNING_PEAK_HOUR,
      CONSUMPTION.MORNING_SIGMA,
      baseLoadKw * CONSUMPTION.MORNING_PEAK_MULTIPLIER
    );

    // Evening peak (cooking, entertainment, lighting)
    const eveningPeak = gaussian(
      hour,
      CONSUMPTION.EVENING_PEAK_HOUR,
      CONSUMPTION.EVENING_SIGMA,
      baseLoadKw * CONSUMPTION.EVENING_PEAK_MULTIPLIER
    );

    // Night reduction (sleeping, minimal load)
    const nightFactor = (hour >= 23 || hour <= 5) ? 0.4 : 1.0;

    // Total consumption
    let consumption = (baseLoadKw + morningPeak + eveningPeak) * nightFactor * temperatureModifier;
    consumption = addNoise(consumption, CONSUMPTION.NOISE_SIGMA);

    return clamp(consumption, baseLoadKw * 0.2, baseLoadKw * 5); // Bounded
  }
}
