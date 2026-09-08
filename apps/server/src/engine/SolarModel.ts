import { SOLAR } from '@gridpulse/shared';
import { gaussian, addNoise, clamp, getHourFraction } from '../utils/math';

/**
 * Mathematical solar generation model using a Gaussian bell curve.
 * Produces realistic solar output: zero at night, peak at noon.
 */
export class SolarModel {
  /**
   * Compute solar generation at a given time.
   * @param time - The simulation time
   * @param solarCapacityKw - Maximum panel capacity in kW
   * @param weatherFactor - 0.0 to 1.0+ multiplier (1.0 = clear sky)
   * @returns Generation in kW
   */
  static compute(time: Date, solarCapacityKw: number, weatherFactor: number = 1.0): number {
    const hour = getHourFraction(time);

    // No generation at night
    if (hour < SOLAR.SUNRISE_HOUR || hour > SOLAR.SUNSET_HOUR) {
      return 0;
    }

    // Gaussian bell curve peaking at noon
    const rawGeneration = gaussian(hour, SOLAR.PEAK_HOUR, SOLAR.SIGMA, solarCapacityKw);

    // Apply weather factor and add noise
    let generation = rawGeneration * weatherFactor;
    generation = addNoise(generation, SOLAR.NOISE_SIGMA);

    return clamp(generation, 0, solarCapacityKw * 1.1); // Allow slight over-peak with clear sky
  }
}
