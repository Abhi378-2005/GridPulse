import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { OrderBook } from './OrderBook';

describe('OrderBook', () => {
  function makeOrder(id: string, nodeId: string, price: number, quantity: number) {
    return {
      id,
      nodeId,
      nodeName: `Node-${nodeId}`,
      price: new Decimal(price),
      quantity: new Decimal(quantity),
      filled: new Decimal(0),
      timestamp: Date.now(),
    };
  }

  describe('bid ordering (price-time priority)', () => {
    it('should sort bids by highest price first', () => {
      const book = new OrderBook();
      book.addBid(makeOrder('b1', 'n1', 0.10, 1));
      book.addBid(makeOrder('b2', 'n2', 0.15, 1));
      book.addBid(makeOrder('b3', 'n3', 0.12, 1));

      const best = book.getBestBid();
      expect(best?.id).toBe('b2'); // Highest price
      expect(best?.price.toNumber()).toBe(0.15);
    });

    it('should prioritize earlier timestamp at same price', () => {
      const book = new OrderBook();
      const order1 = makeOrder('b1', 'n1', 0.15, 1);
      order1.timestamp = 1000;
      const order2 = makeOrder('b2', 'n2', 0.15, 1);
      order2.timestamp = 2000;

      book.addBid(order2);
      book.addBid(order1);

      const best = book.getBestBid();
      expect(best?.id).toBe('b1'); // Earlier timestamp
    });
  });

  describe('ask ordering (price-time priority)', () => {
    it('should sort asks by lowest price first', () => {
      const book = new OrderBook();
      book.addAsk(makeOrder('a1', 'n1', 0.15, 1));
      book.addAsk(makeOrder('a2', 'n2', 0.10, 1));
      book.addAsk(makeOrder('a3', 'n3', 0.12, 1));

      const best = book.getBestAsk();
      expect(best?.id).toBe('a2'); // Lowest price
      expect(best?.price.toNumber()).toBe(0.10);
    });
  });

  describe('spread', () => {
    it('should calculate correct spread', () => {
      const book = new OrderBook();
      book.addBid(makeOrder('b1', 'n1', 0.10, 1));
      book.addAsk(makeOrder('a1', 'n2', 0.12, 1));

      expect(book.getSpread()).toBeCloseTo(0.02, 4);
    });

    it('should return 0 when no orders', () => {
      const book = new OrderBook();
      expect(book.getSpread()).toBe(0);
    });
  });

  describe('cleanup', () => {
    it('should remove fully filled orders', () => {
      const book = new OrderBook();
      const order = makeOrder('b1', 'n1', 0.10, 1);
      order.filled = new Decimal(1); // Fully filled
      book.addBid(order);
      book.cleanup();

      expect(book.getBestBid()).toBeUndefined();
    });

    it('should keep partially filled orders', () => {
      const book = new OrderBook();
      const order = makeOrder('b1', 'n1', 0.10, 2);
      order.filled = new Decimal(1); // Half filled
      book.addBid(order);
      book.cleanup();

      expect(book.getBestBid()).toBeDefined();
    });
  });

  describe('cancelNodeOrders', () => {
    it('should remove all orders for a specific node', () => {
      const book = new OrderBook();
      book.addBid(makeOrder('b1', 'n1', 0.10, 1));
      book.addBid(makeOrder('b2', 'n2', 0.12, 1));
      book.addAsk(makeOrder('a1', 'n1', 0.15, 1));

      book.cancelNodeOrders('n1');

      expect(book.getBidCount()).toBe(1);
      expect(book.getAskCount()).toBe(0);
    });
  });

  describe('depth aggregation', () => {
    it('should aggregate orders at same price level', () => {
      const book = new OrderBook();
      book.addBid(makeOrder('b1', 'n1', 0.10, 1));
      book.addBid(makeOrder('b2', 'n2', 0.10, 2));

      const depth = book.getDepth();
      expect(depth.bids).toHaveLength(1);
      expect(depth.bids[0].quantity).toBeCloseTo(3, 4);
      expect(depth.bids[0].count).toBe(2);
    });
  });

  describe('clearing price', () => {
    it('should track last clearing price', () => {
      const book = new OrderBook();
      book.setLastClearingPrice(new Decimal(0.123));
      expect(book.getLastClearingPrice().toNumber()).toBe(0.123);
    });
  });
});
