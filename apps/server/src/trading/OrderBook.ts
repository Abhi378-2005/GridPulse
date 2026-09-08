import Decimal from 'decimal.js';

interface BookOrder {
  id: string;
  nodeId: string;
  nodeName: string;
  price: Decimal;
  quantity: Decimal;
  filled: Decimal;
  timestamp: number;
}

/**
 * Price-Time Priority Order Book.
 * Bids sorted descending (highest first), Asks sorted ascending (lowest first).
 * At the same price level, earlier orders are matched first (FIFO).
 */
export class OrderBook {
  private bids: BookOrder[] = [];
  private asks: BookOrder[] = [];
  private lastClearingPrice: Decimal = new Decimal(0.12); // Default starting price

  /**
   * Add a bid (buy order) to the book.
   */
  addBid(order: BookOrder): void {
    this.bids.push(order);
    // Sort: highest price first, then earliest timestamp
    this.bids.sort((a, b) => {
      const priceDiff = b.price.minus(a.price).toNumber();
      return priceDiff !== 0 ? priceDiff : a.timestamp - b.timestamp;
    });
  }

  /**
   * Add an ask (sell order) to the book.
   */
  addAsk(order: BookOrder): void {
    this.asks.push(order);
    // Sort: lowest price first, then earliest timestamp
    this.asks.sort((a, b) => {
      const priceDiff = a.price.minus(b.price).toNumber();
      return priceDiff !== 0 ? priceDiff : a.timestamp - b.timestamp;
    });
  }

  /**
   * Get the best (highest) bid.
   */
  getBestBid(): BookOrder | undefined {
    return this.bids.find(b => b.quantity.minus(b.filled).gt(0));
  }

  /**
   * Get the best (lowest) ask.
   */
  getBestAsk(): BookOrder | undefined {
    return this.asks.find(a => a.quantity.minus(a.filled).gt(0));
  }

  /**
   * Get the bid-ask spread.
   */
  getSpread(): number {
    const bestBid = this.getBestBid();
    const bestAsk = this.getBestAsk();
    if (!bestBid || !bestAsk) return 0;
    return bestAsk.price.minus(bestBid.price).toNumber();
  }

  /**
   * Remove filled orders from the book.
   */
  cleanup(): void {
    this.bids = this.bids.filter(b => b.quantity.minus(b.filled).gt(0));
    this.asks = this.asks.filter(a => a.quantity.minus(a.filled).gt(0));
  }

  /**
   * Cancel all open orders for a specific node.
   */
  cancelNodeOrders(nodeId: string): void {
    this.bids = this.bids.filter(b => b.nodeId !== nodeId);
    this.asks = this.asks.filter(a => a.nodeId !== nodeId);
  }

  /**
   * Get aggregated depth for display.
   */
  getDepth(levels: number = 10): { bids: { price: number; quantity: number; count: number }[]; asks: { price: number; quantity: number; count: number }[] } {
    const aggregateSide = (orders: BookOrder[]) => {
      const priceMap = new Map<string, { quantity: Decimal; count: number }>();
      for (const order of orders) {
        const remaining = order.quantity.minus(order.filled);
        if (remaining.lte(0)) continue;
        const priceKey = order.price.toFixed(4);
        const existing = priceMap.get(priceKey) || { quantity: new Decimal(0), count: 0 };
        existing.quantity = existing.quantity.plus(remaining);
        existing.count++;
        priceMap.set(priceKey, existing);
      }
      return Array.from(priceMap.entries())
        .map(([price, data]) => ({
          price: parseFloat(price),
          quantity: data.quantity.toNumber(),
          count: data.count,
        }))
        .slice(0, levels);
    };

    return {
      bids: aggregateSide(this.bids),
      asks: aggregateSide(this.asks),
    };
  }

  setLastClearingPrice(price: Decimal): void {
    this.lastClearingPrice = price;
  }

  getLastClearingPrice(): Decimal {
    return this.lastClearingPrice;
  }

  getBidCount(): number {
    return this.bids.filter(b => b.quantity.minus(b.filled).gt(0)).length;
  }

  getAskCount(): number {
    return this.asks.filter(a => a.quantity.minus(a.filled).gt(0)).length;
  }
}
