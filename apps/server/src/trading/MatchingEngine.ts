import Decimal from 'decimal.js';
import mongoose from 'mongoose';
import { Order } from '../models';
import { OrderBook } from './OrderBook';
import { LedgerService } from '../ledger/LedgerService';
import { TRADING, FINANCE } from '@gridpulse/shared';
import type { TradeData, OrderBookSnapshot } from '@gridpulse/shared';

export interface MatchResult {
  trades: TradeData[];
  orderBookSnapshot: OrderBookSnapshot;
}

/**
 * Continuous Double Auction (CDA) Matching Engine.
 * Processes incoming orders against the order book using price-time priority.
 * Executes trades atomically with double-entry ledger settlement.
 *
 * BUG FIX: Orders are only marked filled when the trade actually succeeds.
 * Previously, the seller's order was marked filled even if the buyer had
 * insufficient funds — like handing over goods when the card is declined.
 *
 * BUG FIX: Cancelled orders are now marked CANCELLED in the database,
 * not left as OPEN forever.
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
    quantityKwh: number,
    source: 'AUTO' | 'MANUAL' = 'AUTO'
  ): Promise<MatchResult> {
    const trades: TradeData[] = [];

    // Create the order in the database
    const dbNodeId = mongoose.Types.ObjectId.isValid(nodeId)
      ? new mongoose.Types.ObjectId(nodeId)
      : new mongoose.Types.ObjectId();

    const order = await Order.create({
      nodeId: dbNodeId,
      side,
      pricePerKwh: mongoose.Types.Decimal128.fromString(new Decimal(pricePerKwh).toFixed(4)),
      quantityKwh: mongoose.Types.Decimal128.fromString(new Decimal(quantityKwh).toFixed(4)),
      filledKwh: mongoose.Types.Decimal128.fromString('0'),
      status: 'OPEN',
      source,
    });

    const orderPrice = new Decimal(pricePerKwh);
    let remainingQty = new Decimal(quantityKwh);

    if (side === 'BID') {
      // Match against asks (lowest first). A house never trades with itself.
      for (const ask of this.orderBook.getOpenAsks()) {
        if (remainingQty.lte(0) || orderPrice.lt(ask.price)) break;
        if (ask.nodeId === nodeId) continue;

        const askRemaining = ask.quantity.minus(ask.filled);
        const tradeQty = Decimal.min(remainingQty, askRemaining);
        const clearingPrice = ask.price; // Resting order's price

        // Execute trade — may return null if buyer can't afford it
        const trade = await this.executeTrade(
          order._id.toString(), ask.id,
          nodeId, ask.nodeId,
          clearingPrice, tradeQty
        );

        if (!trade) {
          // Trade failed — the incoming buyer can't afford it, so stop matching this bid.
          // The ask's filled amount is untouched since no energy was actually traded.
          break;
        }

        // ✅ FIX: Only update filled quantities when trade actually succeeds
        trades.push(trade);

        ask.filled = ask.filled.plus(tradeQty);
        remainingQty = remainingQty.minus(tradeQty);

        await Order.findByIdAndUpdate(ask.id, {
          filledKwh: mongoose.Types.Decimal128.fromString(ask.filled.toFixed(4)),
          status: ask.filled.gte(ask.quantity) ? 'FILLED' : 'PARTIALLY_FILLED',
        });
      }
      this.orderBook.cleanup();

      // Update the bid order status
      const filled = new Decimal(quantityKwh).minus(remainingQty);
      await Order.findByIdAndUpdate(order._id, {
        filledKwh: mongoose.Types.Decimal128.fromString(filled.toFixed(4)),
        status: remainingQty.lte(0) ? 'FILLED' : filled.gt(0) ? 'PARTIALLY_FILLED' : 'OPEN',
      });

      // Add remaining to book
      if (remainingQty.gt(0)) {
        this.orderBook.addBid({
          id: order._id.toString(),
          nodeId,
          nodeName: this.nodeNames.get(nodeId)?.name || 'Unknown',
          price: orderPrice,
          quantity: new Decimal(quantityKwh),
          filled: new Decimal(quantityKwh).minus(remainingQty),
          timestamp: Date.now(),
          source,
        });
      }
    } else {
      // ASK side — match against bids (highest first).
      // A bidder who can't pay is skipped so they don't block cheaper-paying bidders behind them.
      for (const bid of this.orderBook.getOpenBids()) {
        if (remainingQty.lte(0) || bid.price.lt(orderPrice)) break;
        if (bid.nodeId === nodeId) continue; // A house never trades with itself

        const bidRemaining = bid.quantity.minus(bid.filled);
        const tradeQty = Decimal.min(remainingQty, bidRemaining);
        const clearingPrice = orderPrice; // Resting-equivalent: ask's price

        const trade = await this.executeTrade(
          bid.id, order._id.toString(),
          bid.nodeId, nodeId,
          clearingPrice, tradeQty
        );

        if (!trade) continue; // Bidder couldn't afford it — try the next bid

        // ✅ FIX: Only update when trade succeeds
        trades.push(trade);

        bid.filled = bid.filled.plus(tradeQty);
        remainingQty = remainingQty.minus(tradeQty);

        await Order.findByIdAndUpdate(bid.id, {
          filledKwh: mongoose.Types.Decimal128.fromString(bid.filled.toFixed(4)),
          status: bid.filled.gte(bid.quantity) ? 'FILLED' : 'PARTIALLY_FILLED',
        });
      }
      this.orderBook.cleanup();

      const filled = new Decimal(quantityKwh).minus(remainingQty);
      await Order.findByIdAndUpdate(order._id, {
        filledKwh: mongoose.Types.Decimal128.fromString(filled.toFixed(4)),
        status: remainingQty.lte(0) ? 'FILLED' : filled.gt(0) ? 'PARTIALLY_FILLED' : 'OPEN',
      });

      if (remainingQty.gt(0)) {
        this.orderBook.addAsk({
          id: order._id.toString(),
          nodeId,
          nodeName: this.nodeNames.get(nodeId)?.name || 'Unknown',
          price: orderPrice,
          quantity: new Decimal(quantityKwh),
          filled: new Decimal(quantityKwh).minus(remainingQty),
          timestamp: Date.now(),
          source,
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
   * Includes transmission losses and wheeling charges for realism.
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
      // Apply transmission losses — buyer receives less energy than seller sends
      const deliveredKwh = quantityKwh.mul(1 - TRADING.TRANSMISSION_LOSS_PCT);

      // Total cost = energy cost + wheeling charge
      const energyCost = clearingPrice.mul(quantityKwh);
      const wheelingCharge = new Decimal(TRADING.WHEELING_CHARGE_PER_KWH).mul(quantityKwh);
      const totalCost = energyCost.plus(wheelingCharge);

      // CO₂ avoided by using P2P solar instead of grid power
      // India grid emission factor: ~708 gCO₂/kWh = 0.708 kg/kWh (CEA)
      const co2Avoided = deliveredKwh.mul(FINANCE.CO2_GRID_DEFAULT / 1000);

      // Atomic transaction: trade + ledger settlement
      const result = await this.ledgerService.settleTrade({
        bidOrderId,
        askOrderId,
        buyerNodeId,
        sellerNodeId,
        clearingPrice,
        quantityKwh,
        energyCost,
        wheelingCharge,
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
   * Cancel a node's AutoTrader orders (called before placing new orders each tick).
   * Manual orders placed by the house owner are left alone.
   * ✅ FIX: Also marks them as CANCELLED in the database (Bug #2).
   */
  async cancelNodeOrders(nodeId: string): Promise<void> {
    // Get the IDs of orders being cancelled from the in-memory book
    const cancelledIds = this.orderBook.cancelNodeOrders(nodeId, true);

    // Mark them CANCELLED in the database (non-blocking batch update)
    if (cancelledIds.length > 0) {
      const validObjectIds = cancelledIds
        .map(id => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null)
        .filter(Boolean);

      if (validObjectIds.length > 0) {
        Order.updateMany(
          { _id: { $in: validObjectIds } },
          { status: 'CANCELLED' }
        ).catch(err => console.error('Failed to cancel orders in DB:', err));
      }
    }
  }

  /**
   * Cancel one order: removes it from the in-memory book (so it can no longer match)
   * and marks it CANCELLED in the database. Returns false if it can't be cancelled.
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(orderId)) return false;
    this.orderBook.removeOrder(orderId);
    const updated = await Order.findOneAndUpdate(
      { _id: orderId, status: { $in: ['OPEN', 'PARTIALLY_FILLED'] } },
      { status: 'CANCELLED' }
    );
    return !!updated;
  }

  /**
   * Rebuild the in-memory order book from OPEN orders in the database.
   * Called on server restart so we don't lose the order book.
   */
  async rebuildFromDB(): Promise<void> {
    const openOrders = await Order.find({ status: { $in: ['OPEN', 'PARTIALLY_FILLED'] } }).lean();
    const orphanIds: unknown[] = [];

    for (const order of openOrders) {
      const nodeId = order.nodeId?.toString();
      // Orders for houses that no longer exist can never settle — cancel them
      if (!nodeId || !this.nodeNames.has(nodeId)) {
        orphanIds.push(order._id);
        continue;
      }
      const bookOrder = {
        id: order._id.toString(),
        nodeId,
        nodeName: this.nodeNames.get(nodeId)?.name || 'Unknown',
        price: new Decimal(order.pricePerKwh.toString()),
        quantity: new Decimal(order.quantityKwh.toString()),
        filled: new Decimal(order.filledKwh.toString()),
        timestamp: order.createdAt.getTime(),
        source: order.source ?? 'AUTO',
      };

      if (order.side === 'BID') {
        this.orderBook.addBid(bookOrder);
      } else {
        this.orderBook.addAsk(bookOrder);
      }
    }

    if (orphanIds.length > 0) {
      await Order.updateMany({ _id: { $in: orphanIds } }, { status: 'CANCELLED' });
    }

    const bidCount = this.orderBook.getBidCount();
    const askCount = this.orderBook.getAskCount();
    if (bidCount > 0 || askCount > 0) {
      console.log(`📖 Rebuilt order book from DB: ${bidCount} bids, ${askCount} asks`);
    }
  }
}
