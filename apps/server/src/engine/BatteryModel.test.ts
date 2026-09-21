import { describe, it, expect } from 'vitest';
import { BatteryModel } from './BatteryModel';

describe('BatteryModel', () => {
  const capacity = 10.0; // kWh
  const tickDuration = 1 / 60; // 1 minute in hours

  describe('charging (surplus energy)', () => {
    it('should charge battery from surplus', () => {
      const result = BatteryModel.update(3.0, 5.0, capacity, tickDuration);
      expect(result.newChargeKwh).toBeGreaterThan(5.0);
      expect(result.newChargeKwh).toBeLessThanOrEqual(capacity);
    });

    it('should not exceed battery capacity', () => {
      const result = BatteryModel.update(10.0, 9.9, capacity, tickDuration);
      expect(result.newChargeKwh).toBeLessThanOrEqual(capacity);
    });

    it('should pass through remaining surplus after charging', () => {
      // With a full battery, all surplus should pass through
      const result = BatteryModel.update(5.0, capacity, capacity, tickDuration);
      expect(result.adjustedNetKw).toBeGreaterThanOrEqual(0);
      expect(result.newChargeKwh).toBe(capacity);
    });

    it('should respect max charge rate', () => {
      // 3kW max rate * tickDuration hours = max energy per tick
      const maxRate = 3.0;
      const maxEnergy = maxRate * tickDuration;
      const result = BatteryModel.update(100.0, 0, capacity, tickDuration, maxRate);
      expect(result.newChargeKwh).toBeLessThanOrEqual(maxEnergy + 0.001);
    });
  });

  describe('discharging (energy deficit)', () => {
    it('should discharge battery to cover deficit', () => {
      const result = BatteryModel.update(-2.0, 5.0, capacity, tickDuration);
      expect(result.newChargeKwh).toBeLessThan(5.0);
      expect(result.newChargeKwh).toBeGreaterThanOrEqual(0);
    });

    it('should not go below zero', () => {
      const result = BatteryModel.update(-100.0, 0.01, capacity, tickDuration);
      expect(result.newChargeKwh).toBeGreaterThanOrEqual(0);
    });

    it('should pass through remaining deficit', () => {
      // With an empty battery, all deficit should pass through
      const result = BatteryModel.update(-5.0, 0, capacity, tickDuration);
      expect(result.adjustedNetKw).toBeLessThanOrEqual(0);
      expect(result.newChargeKwh).toBe(0);
    });

    it('should respect max discharge rate', () => {
      const maxRate = 3.0;
      const maxEnergy = maxRate * tickDuration;
      const result = BatteryModel.update(-100.0, capacity, capacity, tickDuration, maxRate);
      expect(capacity - result.newChargeKwh).toBeLessThanOrEqual(maxEnergy + 0.001);
    });
  });

  describe('edge cases', () => {
    it('should handle zero net energy', () => {
      const result = BatteryModel.update(0, 5.0, capacity, tickDuration);
      // Zero net → no change (boundary: might get very small rounding)
      expect(result.newChargeKwh).toBeCloseTo(5.0, 5);
    });

    it('should handle zero battery capacity', () => {
      const result = BatteryModel.update(3.0, 0, 0, tickDuration);
      expect(result.newChargeKwh).toBe(0);
      expect(result.adjustedNetKw).toBeGreaterThanOrEqual(0);
    });
  });
});
