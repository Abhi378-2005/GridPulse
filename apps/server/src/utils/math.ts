/**
 * Mathematical utility functions for simulation models.
 */

/**
 * Gaussian function: f(x) = amplitude * exp(-0.5 * ((x - mean) / sigma)^2)
 */
export function gaussian(x: number, mean: number, sigma: number, amplitude: number = 1): number {
  return amplitude * Math.exp(-0.5 * Math.pow((x - mean) / sigma, 2));
}

/**
 * Add Gaussian noise to a value.
 * @param value Base value
 * @param sigma Standard deviation of noise (as fraction of value, e.g. 0.05 = 5%)
 */
export function addNoise(value: number, sigma: number): number {
  // Box-Muller transform for Gaussian random
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return value + value * sigma * z;
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between two values.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Get the fractional hour from a Date (e.g., 14:30 → 14.5).
 */
export function getHourFraction(date: Date): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

/**
 * Generate a random number between min and max.
 */
export function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Round to N decimal places.
 */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
