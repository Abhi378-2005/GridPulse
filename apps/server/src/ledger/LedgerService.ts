import Decimal from 'decimal.js';
import mongoose from 'mongoose';
import { Wallet, Trade, Transaction, Posting } from '../models';

interface TradeSettlement {
  bidOrderId: string;
  askOrderId: string;
  buyerNodeId: string;
  sellerNodeId: string;
  clearingPrice: Decimal;
  quantityKwh: Decimal;
  energyCost: Decimal;     // Paid to the seller
  wheelingCharge: Decimal; // Paid to the grid operator for using its lines
  totalCost: Decimal;      // energyCost + wheelingCharge, paid by the buyer
  co2AvoidedKg: Decimal;
}

export interface GridSettlement {
  nodeId: string;
  direction: 'IMPORT' | 'EXPORT';
  kwh: number;
  amount: number; // ₹ — import cost or export revenue
}

/**
 * Double-Entry Financial Ledger Service.
 * Ensures atomicity for all trade settlements using MongoDB transactions.
 * Every trade produces balanced debit/credit postings.
 *
 * NOTE: MongoDB transactions require a replica set (even single-node).
 * docker-compose.yml starts Mongo with --replSet rs0 for this reason.
 */
export class LedgerService {
  /**
   * Settle a trade atomically using MongoDB session.withTransaction().
   * Creates Trade → Transaction → Debit (buyer) + Credit (seller) + Credit (grid, wheeling).
   *
   * INVARIANT: For every transaction, SUM(debits) = SUM(credits).
   */
  async settleTrade(settlement: TradeSettlement): Promise<{ tradeId: string } | null> {
    // Round each part to the stored precision FIRST, then add them. Rounding the total on its
    // own can differ from the sum of its rounded parts by Rs 0.0001, which would break
    // the double-entry rule (debits must equal credits exactly).
    const energyCost = settlement.energyCost.toDecimalPlaces(4);
    const wheelingCharge = settlement.wheelingCharge.toDecimalPlaces(4);
    const totalCost = energyCost.plus(wheelingCharge);

    const session = await mongoose.startSession();

    try {
      let tradeId: string = '';

      await session.withTransaction(async () => {
        // 1. Look up wallets
        const buyerWallet = await Wallet.findOne({ nodeId: settlement.buyerNodeId }).session(session);
        const sellerWallet = await Wallet.findOne({ nodeId: settlement.sellerNodeId }).session(session);
        const gridWallet = await this.getGridWallet(session);

        if (!buyerWallet || !sellerWallet) {
          throw new Error('Wallet not found for buyer or seller');
        }

        // 2. Check buyer has sufficient balance (aggregate pipeline)
        const buyerBalance = await this.getWalletBalance(buyerWallet._id.toString(), session);
        if (buyerBalance.lt(totalCost)) {
          throw new Error(`Insufficient funds: ${buyerBalance.toFixed(4)} < ${totalCost.toFixed(4)}`);
        }

        // 3. Create Trade record
        const [trade] = await Trade.create(
          [
            {
              bidOrderId: settlement.bidOrderId,
              askOrderId: settlement.askOrderId,
              buyerNodeId: settlement.buyerNodeId,
              sellerNodeId: settlement.sellerNodeId,
              clearingPrice: mongoose.Types.Decimal128.fromString(settlement.clearingPrice.toFixed(4)),
              quantityKwh: mongoose.Types.Decimal128.fromString(settlement.quantityKwh.toFixed(4)),
              totalCost: mongoose.Types.Decimal128.fromString(totalCost.toFixed(4)),
              co2AvoidedKg: mongoose.Types.Decimal128.fromString(settlement.co2AvoidedKg.toFixed(4)),
            },
          ],
          { session }
        );

        // 4. Create Transaction record
        const [transaction] = await Transaction.create(
          [
            {
              tradeId: trade._id,
              kind: 'TRADE',
              description: `Trade: ${settlement.quantityKwh.toFixed(2)} kWh @ ₹${settlement.clearingPrice.toFixed(4)}/kWh`,
            },
          ],
          { session }
        );

        // 5. Create DEBIT posting (money leaves buyer)
        await Posting.create(
          [
            {
              amount: mongoose.Types.Decimal128.fromString(totalCost.toFixed(4)),
              type: 'DEBIT',
              walletId: buyerWallet._id,
              transactionId: transaction._id,
            },
          ],
          { session }
        );

        // 6. CREDIT postings: energy cost to the seller, wheeling charge to the grid operator
        await Posting.create(
          [
            {
              amount: mongoose.Types.Decimal128.fromString(energyCost.toFixed(4)),
              type: 'CREDIT',
              walletId: sellerWallet._id,
              transactionId: transaction._id,
            },
            {
              amount: mongoose.Types.Decimal128.fromString(wheelingCharge.toFixed(4)),
              type: 'CREDIT',
              walletId: gridWallet._id,
              transactionId: transaction._id,
            },
          ],
          { session, ordered: true }
        );

        tradeId = trade._id.toString();
      });

      return tradeId ? { tradeId } : null;
    } catch (error: any) {
      if (error.message?.includes('Insufficient funds')) {
        // Expected — just means buyer can't afford it
        return null;
      }
      console.error('❌ Ledger settlement error:', error.message);
      return null;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Settle energy bought from / sold to the main grid (MSEDCL) for one or more houses.
   * IMPORT: house is debited, grid credited. EXPORT: grid debited, house credited.
   * No balance check on imports — like a real electricity bill, the house owes it regardless.
   */
  async settleGridTransfers(items: GridSettlement[]): Promise<void> {
    const payable = items.filter(i => i.amount >= 0.0001);
    if (payable.length === 0) return;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const gridWallet = await this.getGridWallet(session);
        const wallets = await Wallet.find({ nodeId: { $in: payable.map(i => i.nodeId) } }).session(session);
        const walletByNode = new Map(wallets.map(w => [w.nodeId!.toString(), w]));

        for (const item of payable) {
          const wallet = walletByNode.get(item.nodeId);
          if (!wallet) continue;

          const isImport = item.direction === 'IMPORT';
          const [tx] = await Transaction.create(
            [
              {
                kind: isImport ? 'GRID_IMPORT' : 'GRID_EXPORT',
                nodeId: item.nodeId,
                kwh: item.kwh,
                amount: item.amount,
                description: `Grid ${isImport ? 'import' : 'export'}: ${item.kwh.toFixed(3)} kWh`,
              },
            ],
            { session }
          );

          const amount = mongoose.Types.Decimal128.fromString(item.amount.toFixed(4));
          await Posting.create(
            [
              { amount, type: 'DEBIT', walletId: isImport ? wallet._id : gridWallet._id, transactionId: tx._id },
              { amount, type: 'CREDIT', walletId: isImport ? gridWallet._id : wallet._id, transactionId: tx._id },
            ],
            { session, ordered: true }
          );
        }
      });
    } catch (error: any) {
      console.error('❌ Grid settlement error:', error.message);
    } finally {
      await session.endSession();
    }
  }

  /**
   * Create the grid operator's wallet at startup so it's never created concurrently mid-trade.
   */
  static async ensureGridWallet(): Promise<void> {
    await Wallet.updateOne({ systemAccount: 'GRID' }, { $setOnInsert: { systemAccount: 'GRID' } }, { upsert: true });
  }

  /**
   * Find (or create on first use) the grid operator's system wallet.
   */
  private async getGridWallet(session: mongoose.ClientSession) {
    const existing = await Wallet.findOne({ systemAccount: 'GRID' }).session(session);
    if (existing) return existing;
    const [created] = await Wallet.create([{ systemAccount: 'GRID' }], { session });
    return created;
  }

  /**
   * Calculate wallet balance using MongoDB aggregation.
   * Balance = SUM(credits) - SUM(debits)
   * This is the append-only double-entry pattern.
   */
  private async getWalletBalance(walletId: string, session?: mongoose.ClientSession): Promise<Decimal> {
    const pipeline = [
      { $match: { walletId: new mongoose.Types.ObjectId(walletId) } },
      {
        $group: {
          _id: '$type',
          total: { $sum: { $toDecimal: '$amount' } },
        },
      },
    ];

    const results = session
      ? await Posting.aggregate(pipeline).session(session)
      : await Posting.aggregate(pipeline);

    let credits = new Decimal(0);
    let debits = new Decimal(0);

    for (const row of results) {
      const total = new Decimal(row.total.toString());
      if (row._id === 'CREDIT') {
        credits = total;
      } else {
        debits = total;
      }
    }

    return credits.minus(debits);
  }
}

/**
 * Wallet Service — reads wallet balances for display.
 */
export class WalletService {
  /**
   * Get current balance of a node's wallet.
   */
  static async getBalance(nodeId: string): Promise<number> {
    const wallet = await Wallet.findOne({ nodeId });
    if (!wallet) return 0;

    const results = await Posting.aggregate([
      { $match: { walletId: wallet._id } },
      {
        $group: {
          _id: '$type',
          total: { $sum: { $toDecimal: '$amount' } },
        },
      },
    ]);

    let credits = new Decimal(0);
    let debits = new Decimal(0);

    for (const row of results) {
      const total = new Decimal(row.total.toString());
      if (row._id === 'CREDIT') {
        credits = total;
      } else {
        debits = total;
      }
    }

    return credits.minus(debits).toNumber();
  }

  /**
   * Get all wallet balances efficiently with aggregation.
   */
  static async getAllBalances(): Promise<Map<string, number>> {
    const balances = new Map<string, number>();

    // Get all wallets with their postings aggregated
    const wallets = await Wallet.find({ nodeId: { $type: 'objectId' } }).lean();

    if (wallets.length === 0) return balances;

    // Single aggregation across all wallets
    const results = await Posting.aggregate([
      {
        $group: {
          _id: { walletId: '$walletId', type: '$type' },
          total: { $sum: { $toDecimal: '$amount' } },
        },
      },
    ]);

    // Build a map of walletId → { credits, debits }
    const walletTotals = new Map<string, { credits: Decimal; debits: Decimal }>();
    for (const row of results) {
      const wid = row._id.walletId.toString();
      if (!walletTotals.has(wid)) {
        walletTotals.set(wid, { credits: new Decimal(0), debits: new Decimal(0) });
      }
      const entry = walletTotals.get(wid)!;
      const total = new Decimal(row.total.toString());
      if (row._id.type === 'CREDIT') {
        entry.credits = total;
      } else {
        entry.debits = total;
      }
    }

    // Map wallet → nodeId → balance
    for (const wallet of wallets) {
      const wid = wallet._id.toString();
      const nodeId = wallet.nodeId!.toString();
      const entry = walletTotals.get(wid);
      if (entry) {
        balances.set(nodeId, entry.credits.minus(entry.debits).toNumber());
      } else {
        balances.set(nodeId, 0);
      }
    }

    return balances;
  }
}
