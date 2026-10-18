import { describe, it, expect, vi, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import mongoose from 'mongoose';
import { LedgerService, WalletService } from './LedgerService';
import { Wallet, Trade, Transaction, Posting } from '../models';

vi.mock('../models', () => {
  return {
    Wallet: {
      findOne: vi.fn(),
      find: vi.fn(),
    },
    Trade: {
      create: vi.fn(),
    },
    Transaction: {
      create: vi.fn(),
    },
    Posting: {
      create: vi.fn(),
      aggregate: vi.fn(),
    },
  };
});

describe('LedgerService', () => {
  let ledgerService: LedgerService;

  beforeEach(() => {
    vi.clearAllMocks();
    ledgerService = new LedgerService();
  });

  describe('WalletService', () => {
    it('should return 0 if wallet does not exist', async () => {
      (Wallet.findOne as any).mockResolvedValue(null);
      const balance = await WalletService.getBalance('non-existent');
      expect(balance).toBe(0);
    });

    it('should correctly calculate balance as Credits - Debits', async () => {
      const mockWallet = { _id: new mongoose.Types.ObjectId() };
      (Wallet.findOne as any).mockResolvedValue(mockWallet);

      (Posting.aggregate as any).mockResolvedValue([
        { _id: 'CREDIT', total: '5000.00' },
        { _id: 'DEBIT', total: '1200.50' },
      ]);

      const balance = await WalletService.getBalance('node-1');
      expect(balance).toBeCloseTo(3799.50, 2);
    });

    it('should calculate all wallet balances across multiple nodes', async () => {
      const w1 = new mongoose.Types.ObjectId();
      const w2 = new mongoose.Types.ObjectId();

      (Wallet.find as any).mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { _id: w1, nodeId: { toString: () => 'node-1' } },
          { _id: w2, nodeId: { toString: () => 'node-2' } },
        ]),
      });

      (Posting.aggregate as any).mockResolvedValue([
        { _id: { walletId: w1, type: 'CREDIT' }, total: '5000' },
        { _id: { walletId: w1, type: 'DEBIT' }, total: '500' },
        { _id: { walletId: w2, type: 'CREDIT' }, total: '3000' },
      ]);

      const balances = await WalletService.getAllBalances();
      expect(balances.get('node-1')).toBe(4500);
      expect(balances.get('node-2')).toBe(3000);
    });
  });

  describe('settleTrade', () => {
    it('should abort and return null if buyer has insufficient funds', async () => {
      const mockSession = {
        withTransaction: vi.fn(async (cb: () => Promise<void>) => {
          await cb();
        }),
        endSession: vi.fn(),
      };
      vi.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);

      const buyerWalletId = new mongoose.Types.ObjectId();
      const sellerWalletId = new mongoose.Types.ObjectId();

      (Wallet.findOne as any).mockReturnValue({
        session: vi.fn().mockImplementation(() => ({
          _id: buyerWalletId,
        })),
      });

      // Aggregate returns balance of only ₹10
      (Posting.aggregate as any).mockReturnValue({
        session: vi.fn().mockResolvedValue([{ _id: 'CREDIT', total: '10.00' }]),
      });

      const result = await ledgerService.settleTrade({
        bidOrderId: 'b1',
        askOrderId: 'a1',
        buyerNodeId: 'node-buyer',
        sellerNodeId: 'node-seller',
        clearingPrice: new Decimal(7.50),
        quantityKwh: new Decimal(10), // Total cost: 75.00 > 10.00
        energyCost: new Decimal(60.00),
        wheelingCharge: new Decimal(15.00),
        totalCost: new Decimal(75.00),
        co2AvoidedKg: new Decimal(7.08),
      });

      expect(result).toBeNull();
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });
});
