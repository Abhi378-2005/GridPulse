import { WEATHER_EVENTS } from '@gridpulse/shared';
import type { WeatherEventData, DataSource } from '@gridpulse/shared';
import { randomBetween } from '../utils/math';

interface ActiveWeatherEvent {
  event: WeatherEventData;
  expiresAt: number;
}

/**
 * Simulated weather engine that generates random weather events
 * and manual triggers (heatwave button, cloud burst, etc.).
 */
export class WeatherEngine {
  private activeEvents: ActiveWeatherEvent[] = [];
  private lastEventTime: number = 0;
  private minEventGapMs: number = 30000; // Minimum 30s between random events

  /**
   * Randomly generate weather events based on probability.
   * Called every simulation tick.
   */
  tick(virtualTime: Date): WeatherEventData | null {
    const now = Date.now();

    // Clean up expired events
    this.activeEvents = this.activeEvents.filter(e => now < e.expiresAt);

    // Random event generation (5% chance per tick, with cooldown)
    if (now - this.lastEventTime > this.minEventGapMs && Math.random() < 0.05) {
      const eventTypes = Object.keys(WEATHER_EVENTS) as Array<keyof typeof WEATHER_EVENTS>;
      const randomType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const config = WEATHER_EVENTS[randomType];

      const event = this.createEvent(randomType, config, virtualTime, 'SIMULATION');
      this.lastEventTime = now;
      return event;
    }

    return null;
  }

  /**
   * Manually trigger a weather event (e.g., from the Heatwave button).
   */
  triggerEvent(type: string, virtualTime: Date): WeatherEventData {
    const config = WEATHER_EVENTS[type as keyof typeof WEATHER_EVENTS] || WEATHER_EVENTS.CLOUD_COVER;
    return this.createEvent(type, config, virtualTime, 'SIMULATION');
  }

  /**
   * Get the current combined weather factor for solar generation.
   * Multiplied against solar output.
   */
  getSolarFactor(): number {
    const now = Date.now();
    let factor = 1.0;

    for (const active of this.activeEvents) {
      if (now < active.expiresAt) {
        const eventType = active.event.type;
        // Cloud cover, storm → reduce solar
        if (eventType === 'CLOUD_COVER' || eventType === 'STORM') {
          factor *= active.event.impactFactor;
        }
        // Clear sky → boost solar
        if (eventType === 'CLEAR_SKY') {
          factor *= active.event.impactFactor;
        }
      }
    }

    return factor;
  }

  /**
   * Get the current combined weather factor for consumption.
   * Multiplied against consumption (heatwave increases demand).
   */
  getConsumptionFactor(): number {
    const now = Date.now();
    let factor = 1.0;

    for (const active of this.activeEvents) {
      if (now < active.expiresAt) {
        if (active.event.type === 'HEATWAVE') {
          factor *= active.event.impactFactor;
        }
      }
    }

    return factor;
  }

  getActiveEvents(): WeatherEventData[] {
    const now = Date.now();
    return this.activeEvents
      .filter(e => now < e.expiresAt)
      .map(e => e.event);
  }

  private createEvent(
    type: string,
    config: { factor: number; durationMs: number; desc: string },
    virtualTime: Date,
    source: DataSource
  ): WeatherEventData {
    const event: WeatherEventData = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: type as WeatherEventData['type'],
      description: config.desc,
      source,
      impactFactor: config.factor,
      startTime: virtualTime.toISOString(),
      durationMs: config.durationMs,
    };

    this.activeEvents.push({
      event,
      expiresAt: Date.now() + config.durationMs,
    });

    return event;
  }
}
