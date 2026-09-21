import { describe, it, expect } from 'vitest';
import {
  gaussian,
  addNoise,
  clamp,
  lerp,
  getHourFraction,
  randomBetween,
  roundTo,
} from './math';

describe('math utilities', () => {
  describe('gaussian', () => {
    it('should peak at the mean', () => {
      const peak = gaussian(12, 12, 3, 1);
      const offPeak = gaussian(6, 12, 3, 1);
      expect(peak).toBeGreaterThan(offPeak);
      expect(peak).toBeCloseTo(1, 5);
    });

    it('should return 0 far from mean', () => {
      const far = gaussian(100, 12, 3, 1);
      expect(far).toBeCloseTo(0, 10);
    });

    it('should scale with amplitude', () => {
      const low = gaussian(12, 12, 3, 1);
      const high = gaussian(12, 12, 3, 5);
      expect(high).toBeCloseTo(low * 5, 5);
    });
  });

  describe('clamp', () => {
    it('should clamp below min', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('should clamp above max', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should pass through values in range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it('should handle equal min and max', () => {
      expect(clamp(5, 5, 5)).toBe(5);
    });
  });

  describe('lerp', () => {
    it('should return a at t=0', () => {
      expect(lerp(10, 20, 0)).toBe(10);
    });

    it('should return b at t=1', () => {
      expect(lerp(10, 20, 1)).toBe(20);
    });

    it('should return midpoint at t=0.5', () => {
      expect(lerp(10, 20, 0.5)).toBe(15);
    });

    it('should clamp t to [0, 1]', () => {
      expect(lerp(10, 20, -1)).toBe(10);
      expect(lerp(10, 20, 2)).toBe(20);
    });
  });

  describe('getHourFraction', () => {
    it('should return 0 at midnight', () => {
      const midnight = new Date('2024-01-01T00:00:00');
      expect(getHourFraction(midnight)).toBe(0);
    });

    it('should return 12 at noon', () => {
      const noon = new Date('2024-01-01T12:00:00');
      expect(getHourFraction(noon)).toBe(12);
    });

    it('should return 14.5 at 2:30 PM', () => {
      const time = new Date('2024-01-01T14:30:00');
      expect(getHourFraction(time)).toBe(14.5);
    });
  });

  describe('randomBetween', () => {
    it('should return values in range', () => {
      for (let i = 0; i < 100; i++) {
        const value = randomBetween(5, 10);
        expect(value).toBeGreaterThanOrEqual(5);
        expect(value).toBeLessThanOrEqual(10);
      }
    });
  });

  describe('roundTo', () => {
    it('should round to specified decimals', () => {
      expect(roundTo(3.14159, 2)).toBe(3.14);
      expect(roundTo(3.14159, 4)).toBe(3.1416);
      expect(roundTo(3.14159, 0)).toBe(3);
    });
  });

  describe('addNoise', () => {
    it('should return values near the original', () => {
      // Average of many noisy values should converge to original
      let total = 0;
      const original = 100;
      const samples = 1000;
      for (let i = 0; i < samples; i++) {
        total += addNoise(original, 0.05);
      }
      const avg = total / samples;
      expect(avg).toBeCloseTo(original, 0);
    });
  });
});
