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

    it('should post a debit exactly equal to the sum of its credits, even when parts round up', async () => {
      const session = {
        withTransaction: vi.fn(async (cb: () => Promise<void>) => { await cb(); }),
        endSession: vi.fn(),
      };
      vi.spyOn(mongoose, 'startSession').mockResolvedValue(session as any);

      const wallets: Record<string, { _id: mongoose.Types.ObjectId }> = {
        buyer: { _id: new mongoose.Types.ObjectId() },
        seller: { _id: new mongoose.Types.ObjectId() },
        grid: { _id: new mongoose.Types.ObjectId() },
      };
      (Wallet.findOne as any).mockImplementation((q: any) => ({
        session: () => (q.systemAccount ? wallets.grid : q.nodeId === 'buyer-node' ? wallets.buyer : wallets.seller),
      }));
      (Posting.aggregate as any).mockReturnValue({
        session: vi.fn().mockResolvedValue([{ _id: 'CREDIT', total: '5000.0000' }]),
      });
      (Trade.create as any).mockResolvedValue([{ _id: new mongoose.Types.ObjectId() }]);
      (Transaction.create as any).mockResolvedValue([{ _id: new mongoose.Types.ObjectId() }]);
      (Posting.create as any).mockResolvedValue([]);

      // Each part is X.XXXX5 so it rounds UP on its own; the exact total would round DOWN.
      // Old behaviour: debit 0.0002 less than the credits.
      const result = await ledgerService.settleTrade({
        bidOrderId: 'b1',
        askOrderId: 'a1',
        buyerNodeId: 'buyer-node',
        sellerNodeId: 'seller-node',
        clearingPrice: new Decimal(5),
        quantityKwh: new Decimal(1),
        energyCost: new Decimal('1.00005'),
        wheelingCharge: new Decimal('0.50005'),
        totalCost: new Decimal('1.5001'),
        co2AvoidedKg: new Decimal(0.7),
      });

      expect(result).not.toBeNull();
      const posted = (Posting.create as any).mock.calls.flatMap((c: any[]) => c[0]) as Array<{ type: string; amount: { toString(): string } }>;
      const sum = (type: string) =>
        posted.filter(p => p.type === type).reduce((acc, p) => acc.plus(p.amount.toString()), new Decimal(0));

      expect(sum('DEBIT').toFixed(4)).toBe(sum('CREDIT').toFixed(4));
      expect(sum('DEBIT').toFixed(4)).toBe('1.5002');
    });
  });
});
