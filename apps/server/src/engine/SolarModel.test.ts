import { describe, it, expect } from 'vitest';
import { SolarModel } from './SolarModel';

describe('SolarModel', () => {
  describe('time-of-day behavior', () => {
    it('should generate zero at night (before sunrise)', () => {
      const midnight = new Date('2024-01-01T03:00:00');
      const result = SolarModel.compute(midnight, 5.0);
      expect(result).toBe(0);
    });

    it('should generate zero at night (after sunset)', () => {
      const night = new Date('2024-01-01T22:00:00');
      const result = SolarModel.compute(night, 5.0);
      expect(result).toBe(0);
    });

    it('should generate peak around noon', () => {
      const noon = new Date('2024-01-01T12:00:00');
      const morning = new Date('2024-01-01T08:00:00');

      const noonGen = SolarModel.compute(noon, 5.0, 1.0);
      const morningGen = SolarModel.compute(morning, 5.0, 1.0);

      // Noon should produce more than early morning (with some noise tolerance)
      // Run multiple times to reduce noise impact
      let noonTotal = 0;
      let morningTotal = 0;
      for (let i = 0; i < 50; i++) {
        noonTotal += SolarModel.compute(noon, 5.0, 1.0);
        morningTotal += SolarModel.compute(morning, 5.0, 1.0);
      }
      expect(noonTotal / 50).toBeGreaterThan(morningTotal / 50);
    });

    it('should generate positive during daytime', () => {
      const midday = new Date('2024-01-01T12:00:00');
      // Average over multiple samples to smooth noise
      let total = 0;
      for (let i = 0; i < 20; i++) {
        total += SolarModel.compute(midday, 5.0);
      }
      expect(total / 20).toBeGreaterThan(0);
    });
  });

  describe('weather factor', () => {
    it('should reduce output with low weather factor', () => {
      const noon = new Date('2024-01-01T12:00:00');
      let clearTotal = 0;
      let cloudyTotal = 0;
      for (let i = 0; i < 50; i++) {
        clearTotal += SolarModel.compute(noon, 5.0, 1.0);
        cloudyTotal += SolarModel.compute(noon, 5.0, 0.3);
      }
      expect(cloudyTotal / 50).toBeLessThan(clearTotal / 50);
    });

    it('should respect capacity ceiling', () => {
      const noon = new Date('2024-01-01T12:00:00');
      const capacity = 5.0;
      // Even with boost, should not exceed capacity * 1.1
      for (let i = 0; i < 20; i++) {
        const result = SolarModel.compute(noon, capacity, 2.0);
        expect(result).toBeLessThanOrEqual(capacity * 1.1);
      }
    });
  });

  describe('capacity scaling', () => {
    it('should scale with solar capacity', () => {
      const noon = new Date('2024-01-01T12:00:00');
      let smallTotal = 0;
      let largeTotal = 0;
      for (let i = 0; i < 50; i++) {
        smallTotal += SolarModel.compute(noon, 2.0, 1.0);
        largeTotal += SolarModel.compute(noon, 8.0, 1.0);
      }
      expect(largeTotal / 50).toBeGreaterThan(smallTotal / 50);
    });
  });
});
