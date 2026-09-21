import { describe, it, expect } from 'vitest';
import { ConsumptionModel } from './ConsumptionModel';

describe('ConsumptionModel', () => {
  const baseLoad = 2.0; // kW

  describe('time-of-day patterns', () => {
    it('should have lower consumption at night', () => {
      const night = new Date('2024-01-01T02:00:00');
      let nightTotal = 0;
      for (let i = 0; i < 50; i++) {
        nightTotal += ConsumptionModel.compute(night, baseLoad);
      }
      const avgNight = nightTotal / 50;
      // Night consumption should be reduced (factor 0.4)
      expect(avgNight).toBeLessThan(baseLoad * 2);
    });

    it('should peak in the evening', () => {
      const evening = new Date('2024-01-01T19:00:00');
      const midday = new Date('2024-01-01T14:00:00');

      let eveningTotal = 0;
      let middayTotal = 0;
      for (let i = 0; i < 50; i++) {
        eveningTotal += ConsumptionModel.compute(evening, baseLoad);
        middayTotal += ConsumptionModel.compute(midday, baseLoad);
      }
      // Evening peak should be higher than midday
      expect(eveningTotal / 50).toBeGreaterThan(middayTotal / 50);
    });
  });

  describe('bounds', () => {
    it('should always return positive consumption', () => {
      for (let hour = 0; hour < 24; hour++) {
        const time = new Date(`2024-01-01T${hour.toString().padStart(2, '0')}:00:00`);
        for (let i = 0; i < 10; i++) {
          const result = ConsumptionModel.compute(time, baseLoad);
          expect(result).toBeGreaterThan(0);
        }
      }
    });

    it('should not exceed upper bound', () => {
      for (let i = 0; i < 100; i++) {
        const time = new Date(`2024-01-01T19:00:00`);
        const result = ConsumptionModel.compute(time, baseLoad, 2.0);
        expect(result).toBeLessThanOrEqual(baseLoad * 5);
      }
    });
  });

  describe('temperature modifier', () => {
    it('should increase consumption with higher temperature', () => {
      const time = new Date('2024-01-01T14:00:00');
      let normalTotal = 0;
      let hotTotal = 0;
      for (let i = 0; i < 50; i++) {
        normalTotal += ConsumptionModel.compute(time, baseLoad, 1.0);
        hotTotal += ConsumptionModel.compute(time, baseLoad, 1.5);
      }
      expect(hotTotal / 50).toBeGreaterThan(normalTotal / 50);
    });
  });
});
