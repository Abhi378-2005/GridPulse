import Decimal from 'decimal.js';
import { prisma } from '../config/database';
import { OrderBook } from './OrderBook';
import { LedgerService } from '../ledger/LedgerService';
import type { TradeData, OrderBookSnapshot } from '@gridpulse/shared';

interface MatchResult {
  trades: TradeData[];
  orderBookSnapshot: OrderBookSnapshot;
}

/**
 * Continuous Double Auction (CDA) Matching Engine.
 * Processes incoming orders against the order book using price-time priority.
 * Executes trades atomically with double-entry ledger settlement.
 */
export class MatchingEngine {
  private orderBook: OrderBook;
  private ledgerService: LedgerService;
  private nodeNames: Map<string, { name: string; emoji: string }> = new Map();

  constructor() {
    this.orderBook = new OrderBook();
    this.ledgerService = new LedgerService();
  }

  setNodeInfo(nodeId: string, name: string, emoji: string): void {
    this.nodeNames.set(nodeId, { name, emoji });
  }

  /**
   * Submit a new order and attempt matching.
   * Returns executed trades and updated order book.
   */
  async submitOrder(
    nodeId: string,
    side: 'BID' | 'ASK',
    pricePerKwh: number,
    quantityKwh: number
  ): Promise<MatchResult> {
    const trades: TradeData[] = [];

    // Create the order in the database
    const order = await prisma.order.create({
      data: {
        nodeId,
        side,
        pricePerKwh: new Decimal(pricePerKwh).toFixed(4),
        quantityKwh: new Decimal(quantityKwh).toFixed(4),
        filledKwh: '0',
        status: 'OPEN',
      },
    });

    const orderPrice = new Decimal(pricePerKwh);
    let remainingQty = new Decimal(quantityKwh);

    if (side === 'BID') {
      // Match against asks (lowest first)
      let bestAsk = this.orderBook.getBestAsk();

      while (remainingQty.gt(0) && bestAsk && orderPrice.gte(bestAsk.price)) {
        const askRemaining = bestAsk.quantity.minus(bestAsk.filled);
        const tradeQty = Decimal.min(remainingQty, askRemaining);
        const clearingPrice = bestAsk.price; // Resting order's price

        // Execute trade
        const trade = await this.executeTrade(
          order.id, bestAsk.id,
          nodeId, bestAsk.nodeId,
          clearingPrice, tradeQty
        );

        if (trade) trades.push(trade);

        // Update quantities
        bestAsk.filled = bestAsk.filled.plus(tradeQty);
        remainingQty = remainingQty.minus(tradeQty);

        // Update DB order for the ask
        const askNewFilled = bestAsk.filled;
        await prisma.order.update({
          where: { id: bestAsk.id },
          data: {
            filledKwh: askNewFilled.toFixed(4),
            status: askNewFilled.gte(bestAsk.quantity) ? 'FILLED' : 'PARTIALLY_FILLED',
          },
        });

        this.orderBook.cleanup();
        bestAsk = this.orderBook.getBestAsk();
      }

      // Update the bid order status
      const filled = new Decimal(quantityKwh).minus(remainingQty);
      await prisma.order.update({
        where: { id: order.id },
        data: {
          filledKwh: filled.toFixed(4),
          status: remainingQty.lte(0) ? 'FILLED' : filled.gt(0) ? 'PARTIALLY_FILLED' : 'OPEN',
        },
      });

      // Add remaining to book
      if (remainingQty.gt(0)) {
        this.orderBook.addBid({
          id: order.id,
          nodeId,
          nodeName: this.nodeNames.get(nodeId)?.name || 'Unknown',
          price: orderPrice,
          quantity: new Decimal(quantityKwh),
          filled: new Decimal(quantityKwh).minus(remainingQty),
          timestamp: Date.now(),
        });
      }
    } else {
      // ASK side — match against bids (highest first)
      let bestBid = this.orderBook.getBestBid();

      while (remainingQty.gt(0) && bestBid && bestBid.price.gte(orderPrice)) {
        const bidRemaining = bestBid.quantity.minus(bestBid.filled);
        const tradeQty = Decimal.min(remainingQty, bidRemaining);
        const clearingPrice = orderPrice; // Resting-equivalent: ask's price

        const trade = await this.executeTrade(
          bestBid.id, order.id,
          bestBid.nodeId, nodeId,
          clearingPrice, tradeQty
        );

        if (trade) trades.push(trade);

        bestBid.filled = bestBid.filled.plus(tradeQty);
        remainingQty = remainingQty.minus(tradeQty);

        await prisma.order.update({
          where: { id: bestBid.id },
          data: {
            filledKwh: bestBid.filled.toFixed(4),
            status: bestBid.filled.gte(bestBid.quantity) ? 'FILLED' : 'PARTIALLY_FILLED',
          },
        });

        this.orderBook.cleanup();
        bestBid = this.orderBook.getBestBid();
      }

      const filled = new Decimal(quantityKwh).minus(remainingQty);
      await prisma.order.update({
        where: { id: order.id },
        data: {
          filledKwh: filled.toFixed(4),
          status: remainingQty.lte(0) ? 'FILLED' : filled.gt(0) ? 'PARTIALLY_FILLED' : 'OPEN',
        },
      });

      if (remainingQty.gt(0)) {
        this.orderBook.addAsk({
          id: order.id,
          nodeId,
          nodeName: this.nodeNames.get(nodeId)?.name || 'Unknown',
          price: orderPrice,
          quantity: new Decimal(quantityKwh),
          filled: new Decimal(quantityKwh).minus(remainingQty),
          timestamp: Date.now(),
        });
      }
    }

    return {
      trades,
      orderBookSnapshot: this.getOrderBookSnapshot(),
    };
  }

  /**
   * Execute a single trade atomically with ledger settlement.
   */
  private async executeTrade(
    bidOrderId: string,
    askOrderId: string,
    buyerNodeId: string,
    sellerNodeId: string,
    clearingPrice: Decimal,
    quantityKwh: Decimal
  ): Promise<TradeData | null> {
    try {
      const totalCost = clearingPrice.mul(quantityKwh);
      const co2Avoided = quantityKwh.mul(0.45); // ~450g CO2/kWh = 0.45 kg/kWh

      // Atomic transaction: trade + ledger settlement
      const result = await this.ledgerService.settleTrade({
        bidOrderId,
        askOrderId,
        buyerNodeId,
        sellerNodeId,
        clearingPrice,
        quantityKwh,
        totalCost,
        co2AvoidedKg: co2Avoided,
      });

      if (result) {
        this.orderBook.setLastClearingPrice(clearingPrice);

        const buyerInfo = this.nodeNames.get(buyerNodeId) || { name: 'Unknown', emoji: '🏠' };
        const sellerInfo = this.nodeNames.get(sellerNodeId) || { name: 'Unknown', emoji: '🏠' };

        return {
          id: result.tradeId,
          buyerNodeId,
          buyerName: buyerInfo.name,
          buyerEmoji: buyerInfo.emoji,
          sellerNodeId,
          sellerName: sellerInfo.name,
          sellerEmoji: sellerInfo.emoji,
          clearingPrice: clearingPrice.toNumber(),
          quantityKwh: quantityKwh.toNumber(),
          totalCost: totalCost.toNumber(),
          co2AvoidedKg: co2Avoided.toNumber(),
          createdAt: new Date().toISOString(),
        };
      }
    } catch (error) {
      console.error('❌ Trade execution failed:', error);
    }
    return null;
  }

  getOrderBookSnapshot(): OrderBookSnapshot {
    const depth = this.orderBook.getDepth();
    return {
      bids: depth.bids.map(b => ({ price: b.price, quantity: b.quantity, orderCount: b.count })),
      asks: depth.asks.map(a => ({ price: a.price, quantity: a.quantity, orderCount: a.count })),
      spread: this.orderBook.getSpread(),
      lastPrice: this.orderBook.getLastClearingPrice().toNumber(),
    };
  }

  getLastClearingPrice(): number {
    return this.orderBook.getLastClearingPrice().toNumber();
  }

  /**
   * Cancel all orders for a node (called before placing new orders each tick).
   */
  cancelNodeOrders(nodeId: string): void {
    this.orderBook.cancelNodeOrders(nodeId);
  }
}
