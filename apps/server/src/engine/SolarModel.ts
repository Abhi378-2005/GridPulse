import { SOLAR } from '@gridpulse/shared';
import { gaussian, addNoise, clamp, getHourFraction } from '../utils/math';

/**
 * Solar generation model using sun-position formulas.
 *
 * IMPROVEMENT: Instead of a fixed sunrise=6AM / sunset=8PM bell curve,
 * this now computes the actual sunrise and sunset times for Pune's
 * latitude (18.52°N) using the solar declination equation.
 * Output varies by day of year — shorter winter days, longer summer days.
 */
export class SolarModel {
  /**
   * Compute solar generation at a given time.
   * @param time - The simulation time
   * @param solarCapacityKw - Maximum panel capacity in kW
   * @param weatherFactor - 0.0 to 1.0+ multiplier (1.0 = clear sky)
   * @param latitude - Location latitude (default: Pune 18.52°N)
   * @returns Generation in kW
   */
  static compute(
    time: Date,
    solarCapacityKw: number,
    weatherFactor: number = 1.0,
    latitude: number = SOLAR.LATITUDE
  ): number {
    const hour = getHourFraction(time);
    const { sunrise, sunset, solarNoon } = this.getSunTimes(time, latitude);

    // No generation at night
    if (hour < sunrise || hour > sunset) {
      return 0;
    }

    // Day length affects total energy yield
    const dayLength = sunset - sunrise;
    const sigma = dayLength / 6; // Tighter curve for shorter days

    // Gaussian bell curve peaking at solar noon
    const rawGeneration = gaussian(hour, solarNoon, sigma, solarCapacityKw);

    // Apply weather factor and add noise
    let generation = rawGeneration * weatherFactor;
    generation = addNoise(generation, SOLAR.NOISE_SIGMA);

    return clamp(generation, 0, solarCapacityKw * 1.1); // Allow slight over-peak with clear sky
  }

  /**
   * Calculate sunrise, sunset, and solar noon for a given date and latitude.
   * Uses the simplified solar position equation.
   *
   * Reference: NOAA Solar Calculator (simplified)
   * https://gml.noaa.gov/grad/solcalc/
   */
  static getSunTimes(
    date: Date,
    latitude: number = SOLAR.LATITUDE
  ): { sunrise: number; sunset: number; solarNoon: number } {
    // Day of year (1-366)
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));

    // Solar declination angle (degrees)
    // δ = 23.45° × sin(360/365 × (dayOfYear - 81))
    const declination = 23.45 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81));

    // Convert to radians
    const latRad = (latitude * Math.PI) / 180;
    const decRad = (declination * Math.PI) / 180;

    // Hour angle at sunrise/sunset
    // cos(ωs) = -tan(φ) × tan(δ)
    const cosHourAngle = -Math.tan(latRad) * Math.tan(decRad);

    // Clamp for polar regions (shouldn't matter for Pune but good practice)
    const clampedCos = clamp(cosHourAngle, -1, 1);
    const hourAngle = Math.acos(clampedCos);

    // Convert hour angle to hours
    const daylightHours = (2 * hourAngle * 180) / (Math.PI * 15);

    // Solar noon is approximately 12:00 (ignoring equation of time and longitude correction)
    const solarNoon = 12.0;

    const sunrise = solarNoon - daylightHours / 2;
    const sunset = solarNoon + daylightHours / 2;

    return {
      sunrise: Math.max(4.5, sunrise), // Clamp to reasonable bounds
      sunset: Math.min(19.5, sunset),
      solarNoon,
    };
  }
}
