import { TRADING } from '@gridpulse/shared';
import type { TradeData } from '@gridpulse/shared';
import { randomBetween, roundTo } from '../utils/math';
import { MatchingEngine } from './MatchingEngine';

/** Callback invoked for each executed trade so the engine can track metrics. */
export type OnTradeCallback = (trade: TradeData) => void;

/**
 * AutoTrader — AI agent that automatically places orders for each node.
 * Prosumers with surplus → ASK orders. Consumers with deficit → BID orders.
 * Pricing based on recent clearing price ± jitter for realistic market dynamics.
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
   */
  async placeOrders(nodeId: string, netEnergyKw: number, tickDurationHours: number): Promise<void> {
    // Don't trade negligible amounts
    const energyKwh = Math.abs(netEnergyKw) * tickDurationHours;
    if (energyKwh < TRADING.MIN_ORDER_QTY) return;

    // Cancel previous open orders for this node (fresh orders each tick)
    this.matchingEngine.cancelNodeOrders(nodeId);

    const lastPrice = this.matchingEngine.getLastClearingPrice() || TRADING.GRID_PRICE_PER_KWH;

    if (netEnergyKw > 0) {
      // Node has surplus → SELL (place ASK)
      // Price slightly below grid price to attract buyers
      const askPrice = roundTo(
        Math.max(
          TRADING.MIN_PRICE,
          lastPrice * randomBetween(0.85, 1.0) - randomBetween(0, TRADING.PRICE_JITTER)
        ),
        4
      );

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
      // Price slightly below grid price (P2P should be cheaper than grid)
      const bidPrice = roundTo(
        Math.min(
          TRADING.MAX_PRICE,
          lastPrice * randomBetween(1.0, 1.15) + randomBetween(0, TRADING.PRICE_JITTER)
        ),
        4
      );

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
}
