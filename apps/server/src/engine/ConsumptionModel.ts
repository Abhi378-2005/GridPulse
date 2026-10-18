import { CONSUMPTION } from '@gridpulse/shared';
import { gaussian, addNoise, clamp, getHourFraction } from '../utils/math';

/**
 * Household consumption model using a double-peaked Gaussian.
 * Morning peak ~8am (routines), evening peak ~7pm (cooking/entertainment).
 *
 * IMPROVEMENTS:
 * - Weekend multiplier (15% higher — people are home all day)
 * - Seasonal AC factor (40% increase during Apr–Jun in Pune)
 * - Monsoon adjustment (slight increase during Jul–Sep)
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

    // Weekend factor — people are home all day
    const dayOfWeek = time.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weekendFactor = isWeekend ? CONSUMPTION.WEEKEND_MULTIPLIER : 1.0;

    // Seasonal factor for Pune, Maharashtra
    const month = time.getMonth(); // 0-indexed
    let seasonalFactor = 1.0;
    if (month >= 3 && month <= 5) {
      // April–June: peak summer in Pune, heavy AC usage
      seasonalFactor = CONSUMPTION.SUMMER_AC_MULTIPLIER;
    } else if (month >= 6 && month <= 8) {
      // July–September: monsoon — high humidity means some AC/fan usage
      seasonalFactor = CONSUMPTION.MONSOON_MULTIPLIER;
    }

    // Total consumption
    let consumption = (baseLoadKw + morningPeak + eveningPeak) *
      nightFactor * temperatureModifier * weekendFactor * seasonalFactor;
    consumption = addNoise(consumption, CONSUMPTION.NOISE_SIGMA);

    return clamp(consumption, baseLoadKw * 0.2, baseLoadKw * 5); // Bounded
  }
}
