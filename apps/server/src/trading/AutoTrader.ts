import { TRADING } from '@gridpulse/shared';
import type { TradeData } from '@gridpulse/shared';
import { randomBetween, roundTo, getHourFraction, clamp } from '../utils/math';
import { MatchingEngine } from './MatchingEngine';

/** Callback invoked for each executed trade so the engine can track metrics. */
export type OnTradeCallback = (trade: TradeData) => void;

/**
 * AutoTrader — Smart AI agent that automatically places orders for each node.
 * Prosumers with surplus → ASK orders. Consumers with deficit → BID orders.
 *
 * IMPROVEMENT: Pricing is no longer random jitter. It now depends on:
 * 1. Battery state-of-charge (SOC) — full battery → sell cheap, empty → bid high
 * 2. Time of day — evening peak demand → higher willingness to buy
 * 3. Grid tariff — P2P price should be between export rate and import rate
 *
 * This makes the market behave more like real prosumer decision-making.
 */
export class AutoTrader {
  private matchingEngine: MatchingEngine;
  private onTrade: OnTradeCallback | null = null;

  constructor(matchingEngine: MatchingEngine) {
    this.matchingEngine = matchingEngine;
  }

  /** Register a callback to be notified of every executed trade. */
  setOnTrade(callback: OnTradeCallback): void {
    this.onTrade = callback;
  }

  /**
   * Decide and place orders for a node based on its current net energy.
   * @param nodeId - The node's ID
   * @param netEnergyKw - Positive = surplus, Negative = deficit
   * @param tickDurationHours - Duration of this tick in hours
   * @param time - Current simulation (virtual) time, used for time-of-day pricing
   * @param batteryKwh - Current battery charge level
   * @param batteryCapacityKwh - Maximum battery capacity
   */
  async placeOrders(
    nodeId: string,
    netEnergyKw: number,
    tickDurationHours: number,
    time: Date,
    batteryKwh: number = 5,
    batteryCapacityKwh: number = 10
  ): Promise<void> {
    // Cancel previous open orders for this node (fresh orders each tick).
    // Done before the size check so a node with ~zero net energy doesn't keep a stale order.
    await this.matchingEngine.cancelNodeOrders(nodeId);

    // Don't trade negligible amounts
    const energyKwh = Math.abs(netEnergyKw) * tickDurationHours;
    if (energyKwh < TRADING.MIN_ORDER_QTY) return;

    const lastPrice = this.matchingEngine.getLastClearingPrice() || TRADING.GRID_PRICE_PER_KWH;
    const soc = batteryCapacityKwh > 0 ? batteryKwh / batteryCapacityKwh : 0.5;
    const hour = getHourFraction(time); // Simulated time, not the wall clock

    if (netEnergyKw > 0) {
      // Node has surplus → SELL (place ASK)
      const askPrice = this.computeAskPrice(lastPrice, soc, hour);

      try {
        const result = await this.matchingEngine.submitOrder(nodeId, 'ASK', askPrice, roundTo(energyKwh, 4));
        for (const trade of result.trades) {
          this.onTrade?.(trade);
        }
      } catch (e) {
        console.warn(`⚠️  AutoTrader ASK failed for ${nodeId}:`, (e as Error).message);
      }
    } else if (netEnergyKw < 0) {
      // Node has deficit → BUY (place BID)
      const bidPrice = this.computeBidPrice(lastPrice, soc, hour);

      try {
        const result = await this.matchingEngine.submitOrder(nodeId, 'BID', bidPrice, roundTo(energyKwh, 4));
        for (const trade of result.trades) {
          this.onTrade?.(trade);
        }
      } catch (e) {
        console.warn(`⚠️  AutoTrader BID failed for ${nodeId}:`, (e as Error).message);
      }
    }
  }

  /**
   * Compute ASK (sell) price based on battery SOC and time of day.
   *
   * Strategy:
   * - Full battery (SOC > 80%) → sell cheap to offload surplus quickly
   * - Half-full → sell around the last clearing price
   * - Low battery → sell at premium (reluctant to part with stored energy)
   * - P2P ask should be between grid export rate and grid import rate
   */
  private computeAskPrice(lastPrice: number, soc: number, hour: number): number {
    // Base: midpoint between export and import rate
    const exportRate = TRADING.GRID_EXPORT_RATE;
    const importRate = this.getGridImportRate(hour);
    const midpoint = (exportRate + importRate) / 2;

    let price: number;

    if (soc > 0.80) {
      // Battery full — eager to sell, price low (closer to export rate)
      price = exportRate + (midpoint - exportRate) * 0.3;
    } else if (soc > 0.50) {
      // Comfortable — sell around market price
      price = midpoint * randomBetween(0.90, 1.05);
    } else if (soc > 0.20) {
      // Getting low — want a premium
      price = midpoint * randomBetween(1.05, 1.20);
    } else {
      // Very low — only sell if price is really good
      price = importRate * randomBetween(0.90, 1.0);
    }

    // Add small noise for realistic market dynamics
    price += randomBetween(-0.20, 0.20);

    // Never sell below what the grid pays for exported solar
    price = Math.max(price, exportRate);

    return roundTo(clamp(price, TRADING.MIN_PRICE, TRADING.MAX_PRICE), 4);
  }

  /**
   * Compute BID (buy) price based on battery SOC and time of day.
   *
   * Strategy:
   * - Empty battery at night → urgent, bid high (close to grid import rate)
   * - Half-full during day → moderate bid (solar might help soon)
   * - Full battery → probably shouldn't be buying, bid very low
   * - P2P bid should be below grid import rate (else just buy from grid)
   */
  private computeBidPrice(lastPrice: number, soc: number, hour: number): number {
    const exportRate = TRADING.GRID_EXPORT_RATE;
    const importRate = this.getGridImportRate(hour);
    const midpoint = (exportRate + importRate) / 2;

    let price: number;

    if (soc < 0.15) {
      // Battery nearly empty — desperate, bid high
      price = importRate * randomBetween(0.85, 0.95);
    } else if (soc < 0.40) {
      // Getting low — willing to pay market price
      price = midpoint * randomBetween(1.0, 1.15);
    } else if (soc < 0.70) {
      // Comfortable — moderate bid
      price = midpoint * randomBetween(0.85, 1.0);
    } else {
      // Battery mostly full — only buy if cheap
      price = exportRate + (midpoint - exportRate) * 0.4;
    }

    // Night-time urgency: higher bids during peak evening hours
    if (hour >= 18 && hour < 22) {
      price *= 1.10; // 10% premium during peak
    } else if (hour >= 22 || hour < 6) {
      price *= 0.90; // 10% discount at night (less urgency)
    }

    price += randomBetween(-0.20, 0.20);

    // A rational buyer never pays more than the grid: after line losses and the
    // wheeling charge, P2P energy must still be cheaper than importing it.
    const breakEven = importRate * (1 - TRADING.TRANSMISSION_LOSS_PCT) - TRADING.WHEELING_CHARGE_PER_KWH;
    price = Math.min(price, breakEven);

    return roundTo(clamp(price, TRADING.MIN_PRICE, TRADING.MAX_PRICE), 4);
  }

  /**
   * Get the appropriate grid import rate for ToD comparison.
   */
  private getGridImportRate(hour: number): number {
    if (hour >= 18 && hour < 22) {
      return TRADING.GRID_IMPORT_RATE_PEAK;
    } else if (hour >= 6 && hour < 18) {
      return TRADING.GRID_IMPORT_RATE_NORMAL;
    } else {
      return TRADING.GRID_IMPORT_RATE_OFFPEAK;
    }
  }
}
