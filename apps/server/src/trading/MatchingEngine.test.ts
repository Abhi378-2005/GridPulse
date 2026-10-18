import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import mongoose from 'mongoose';
import { MatchingEngine } from './MatchingEngine';
import { Order } from '../models';

// Mock mongoose models
vi.mock('../models', () => {
  const mockOrder = {
    create: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    find: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    findOneAndUpdate: vi.fn(),
  };
  return {
    Order: mockOrder,
    Wallet: {},
    Trade: {},
    Transaction: {},
    Posting: {},
    GridNode: {},
    MeterReading: {},
    WeatherEvent: {},
    ApiCache: {},
  };
});

// Mock LedgerService with class constructor for vitest v5
vi.mock('../ledger/LedgerService', () => {
  class MockLedgerService {
    settleTrade = vi.fn().mockResolvedValue({
      tradeId: 'mock-trade-123',
      transactionId: 'mock-tx-123',
    });
  }

  return {
    LedgerService: MockLedgerService,
    WalletService: {
      getBalance: vi.fn().mockResolvedValue(5000),
      getAllBalances: vi.fn().mockResolvedValue(new Map()),
    },
  };
});

describe('MatchingEngine', () => {
  let engine: MatchingEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new MatchingEngine();
    engine.setNodeInfo('node-1', 'Koregaon', '🏠');
    engine.setNodeInfo('node-2', 'Baner', '🏡');
  });

  it('should initialize with empty order book and default clearing price', () => {
    const snapshot = engine.getOrderBookSnapshot();
    expect(snapshot.bids).toHaveLength(0);
    expect(snapshot.asks).toHaveLength(0);
    expect(snapshot.spread).toBe(0);
    expect(snapshot.lastPrice).toBeGreaterThan(0);
  });

  it('should submit a BID order and add to book when no matching asks exist', async () => {
    const mockCreatedOrder = {
      _id: { toString: () => 'order-bid-1' },
      nodeId: 'node-1',
      side: 'BID',
      pricePerKwh: '7.50',
      quantityKwh: '2.00',
      filledKwh: '0.00',
      status: 'OPEN',
    };
    (Order.create as any).mockResolvedValue(mockCreatedOrder);
    (Order.findByIdAndUpdate as any).mockResolvedValue(mockCreatedOrder);

    const result = await engine.submitOrder('node-1', 'BID', 7.50, 2.0);

    expect(Order.create).toHaveBeenCalled();
    expect(result.trades).toHaveLength(0);
    expect(result.orderBookSnapshot.bids).toHaveLength(1);
    expect(result.orderBookSnapshot.bids[0].price).toBe(7.5);
    expect(result.orderBookSnapshot.bids[0].quantity).toBe(2);
  });

  it('should submit an ASK order and add to book when no matching bids exist', async () => {
    const mockCreatedOrder = {
      _id: { toString: () => 'order-ask-1' },
      nodeId: 'node-2',
      side: 'ASK',
      pricePerKwh: '8.00',
      quantityKwh: '3.00',
      filledKwh: '0.00',
      status: 'OPEN',
    };
    (Order.create as any).mockResolvedValue(mockCreatedOrder);
    (Order.findByIdAndUpdate as any).mockResolvedValue(mockCreatedOrder);

    const result = await engine.submitOrder('node-2', 'ASK', 8.00, 3.0);

    expect(Order.create).toHaveBeenCalled();
    expect(result.trades).toHaveLength(0);
    expect(result.orderBookSnapshot.asks).toHaveLength(1);
    expect(result.orderBookSnapshot.asks[0].price).toBe(8.0);
    expect(result.orderBookSnapshot.asks[0].quantity).toBe(3);
  });

  it('should match a incoming BID against a resting ASK when bid >= ask', async () => {
    // 1. Submit resting ASK at ₹6.50
    const mockAskOrder = {
      _id: { toString: () => 'order-ask-1' },
      nodeId: 'node-2',
      side: 'ASK',
      pricePerKwh: '6.50',
      quantityKwh: '5.00',
      filledKwh: '0.00',
      status: 'OPEN',
    };
    (Order.create as any).mockResolvedValueOnce(mockAskOrder);
    (Order.findByIdAndUpdate as any).mockResolvedValue(mockAskOrder);

    await engine.submitOrder('node-2', 'ASK', 6.50, 5.0);

    // 2. Submit matching BID at ₹7.00 for 2.0 kWh
    const mockBidOrder = {
      _id: { toString: () => 'order-bid-1' },
      nodeId: 'node-1',
      side: 'BID',
      pricePerKwh: '7.00',
      quantityKwh: '2.00',
      filledKwh: '0.00',
      status: 'OPEN',
    };
    (Order.create as any).mockResolvedValueOnce(mockBidOrder);

    const result = await engine.submitOrder('node-1', 'BID', 7.00, 2.0);

    // Trade should execute at resting order's price (₹6.50)
    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].clearingPrice).toBe(6.50);
    expect(result.trades[0].quantityKwh).toBe(2.0);
    expect(result.trades[0].buyerNodeId).toBe('node-1');
    expect(result.trades[0].sellerNodeId).toBe('node-2');
  });

  it('should cancel node orders and mark them CANCELLED in DB', async () => {
    const validOrderId = new mongoose.Types.ObjectId().toString();
    const mockOrder = {
      _id: { toString: () => validOrderId },
      nodeId: 'node-1',
      side: 'BID',
      pricePerKwh: '6.00',
      quantityKwh: '1.00',
      filledKwh: '0.00',
      status: 'OPEN',
    };
    (Order.create as any).mockResolvedValue(mockOrder);
    (Order.findByIdAndUpdate as any).mockResolvedValue(mockOrder);

    await engine.submitOrder('node-1', 'BID', 6.00, 1.0);
    expect(engine.getOrderBookSnapshot().bids).toHaveLength(1);

    await engine.cancelNodeOrders('node-1');

    expect(engine.getOrderBookSnapshot().bids).toHaveLength(0);
    expect(Order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ _id: { $in: expect.any(Array) } }),
      { status: 'CANCELLED' }
    );
  });

  const mockOrder = (id: string, nodeId: string) => ({ _id: { toString: () => id }, nodeId, status: 'OPEN' });

  it('should pay the seller the energy cost and the grid the wheeling charge', async () => {
    (Order.create as any).mockResolvedValueOnce(mockOrder('ask-1', 'node-2'));
    (Order.findByIdAndUpdate as any).mockResolvedValue({});
    await engine.submitOrder('node-2', 'ASK', 6.00, 2.0);

    (Order.create as any).mockResolvedValueOnce(mockOrder('bid-1', 'node-1'));
    await engine.submitOrder('node-1', 'BID', 7.00, 2.0);

    const settle = (engine as any).ledgerService.settleTrade;
    const arg = settle.mock.calls[0][0];
    expect(arg.energyCost.toNumber()).toBeCloseTo(12.0);          // 2 kWh × ₹6.00
    expect(arg.wheelingCharge.toNumber()).toBeCloseTo(3.0);       // 2 kWh × ₹1.50
    expect(arg.totalCost.toNumber()).toBeCloseTo(15.0);
  });

  it('should skip a bidder who cannot pay and fill the next bid instead', async () => {
    engine.setNodeInfo('node-3', 'Aundh', '🏛️');
    (Order.findByIdAndUpdate as any).mockResolvedValue({});

    // Best bid (node-1 @ ₹7) can't pay; next bid (node-3 @ ₹6.50) can
    (Order.create as any).mockResolvedValueOnce(mockOrder('bid-broke', 'node-1'));
    await engine.submitOrder('node-1', 'BID', 7.00, 1.0);
    (Order.create as any).mockResolvedValueOnce(mockOrder('bid-ok', 'node-3'));
    await engine.submitOrder('node-3', 'BID', 6.50, 1.0);

    const settle = (engine as any).ledgerService.settleTrade;
    settle.mockResolvedValueOnce(null).mockResolvedValueOnce({ tradeId: 't-2' });

    (Order.create as any).mockResolvedValueOnce(mockOrder('ask-1', 'node-2'));
    const result = await engine.submitOrder('node-2', 'ASK', 6.00, 1.0);

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].buyerNodeId).toBe('node-3');
    // The unpaid bid stays in the book, untouched
    expect(result.orderBookSnapshot.bids).toHaveLength(1);
    expect(result.orderBookSnapshot.bids[0].price).toBe(7);
  });

  it('cancelOrder should remove the order from the live book so it cannot match', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    (Order.create as any).mockResolvedValueOnce(mockOrder(id, 'node-1'));
    (Order.findByIdAndUpdate as any).mockResolvedValue({});
    (Order.findOneAndUpdate as any).mockResolvedValue({ _id: id });

    await engine.submitOrder('node-1', 'BID', 7.00, 1.0);
    expect(await engine.cancelOrder(id)).toBe(true);
    expect(engine.getOrderBookSnapshot().bids).toHaveLength(0);

    (Order.create as any).mockResolvedValueOnce(mockOrder('ask-1', 'node-2'));
    const result = await engine.submitOrder('node-2', 'ASK', 6.00, 1.0);
    expect(result.trades).toHaveLength(0);
  });
});
