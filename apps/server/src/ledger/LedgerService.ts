import Decimal from 'decimal.js';
import { prisma } from '../config/database';

interface TradeSettlement {
  bidOrderId: string;
  askOrderId: string;
  buyerNodeId: string;
  sellerNodeId: string;
  clearingPrice: Decimal;
  quantityKwh: Decimal;
  totalCost: Decimal;
  co2AvoidedKg: Decimal;
}

/**
 * Double-Entry Financial Ledger Service.
 * Ensures ACID compliance for all trade settlements.
 * Every trade produces balanced debit/credit postings.
 */
export class LedgerService {
  /**
   * Settle a trade atomically using Prisma's interactive transaction.
   * Creates Trade → Transaction → Debit (buyer) + Credit (seller).
   * 
   * INVARIANT: For every transaction, SUM(debits) = SUM(credits).
   */
  async settleTrade(settlement: TradeSettlement): Promise<{ tradeId: string } | null> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Look up wallets
        const buyerWallet = await tx.wallet.findUnique({
          where: { nodeId: settlement.buyerNodeId },
        });
        const sellerWallet = await tx.wallet.findUnique({
          where: { nodeId: settlement.sellerNodeId },
        });

        if (!buyerWallet || !sellerWallet) {
          throw new Error('Wallet not found for buyer or seller');
        }

        // 2. Check buyer has sufficient balance
        const buyerBalance = await this.getWalletBalance(tx, buyerWallet.id);
        if (buyerBalance.lt(settlement.totalCost)) {
          throw new Error(`Insufficient funds: ${buyerBalance.toFixed(4)} < ${settlement.totalCost.toFixed(4)}`);
        }

        // 3. Create Trade record
        const trade = await tx.trade.create({
          data: {
            bidOrderId: settlement.bidOrderId,
            askOrderId: settlement.askOrderId,
            buyerNodeId: settlement.buyerNodeId,
            sellerNodeId: settlement.sellerNodeId,
            clearingPrice: settlement.clearingPrice.toFixed(4),
            quantityKwh: settlement.quantityKwh.toFixed(4),
            totalCost: settlement.totalCost.toFixed(4),
            co2AvoidedKg: settlement.co2AvoidedKg.toFixed(4),
          },
        });

        // 4. Create Transaction record
        const transaction = await tx.transaction.create({
          data: {
            tradeId: trade.id,
            description: `Trade: ${settlement.quantityKwh.toFixed(2)} kWh @ $${settlement.clearingPrice.toFixed(4)}/kWh`,
          },
        });

        // 5. Create DEBIT posting (money leaves buyer)
        await tx.posting.create({
          data: {
            amount: settlement.totalCost.toFixed(4),
            type: 'DEBIT',
            walletId: buyerWallet.id,
            transactionId: transaction.id,
          },
        });

        // 6. Create CREDIT posting (money enters seller)
        await tx.posting.create({
          data: {
            amount: settlement.totalCost.toFixed(4),
            type: 'CREDIT',
            walletId: sellerWallet.id,
            transactionId: transaction.id,
          },
        });

        return { tradeId: trade.id };
      });

      return result;
    } catch (error: any) {
      if (error.message?.includes('Insufficient funds')) {
        // Expected — just means buyer can't afford it
        return null;
      }
      console.error('❌ Ledger settlement error:', error.message);
      return null;
    }
  }

  /**
   * Calculate wallet balance from the sum of all postings.
   * Balance = SUM(credits) - SUM(debits)
   * This is the append-only double-entry pattern.
   */
  private async getWalletBalance(tx: any, walletId: string): Promise<Decimal> {
    const result = await tx.posting.groupBy({
      by: ['type'],
      where: { walletId },
      _sum: { amount: true },
    });

    let credits = new Decimal(0);
    let debits = new Decimal(0);

    for (const row of result) {
      if (row.type === 'CREDIT') {
        credits = new Decimal(row._sum.amount?.toString() || '0');
      } else {
        debits = new Decimal(row._sum.amount?.toString() || '0');
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
    const wallet = await prisma.wallet.findUnique({ where: { nodeId } });
    if (!wallet) return 0;

    const result = await prisma.posting.groupBy({
      by: ['type'],
      where: { walletId: wallet.id },
      _sum: { amount: true },
    });

    let credits = new Decimal(0);
    let debits = new Decimal(0);

    for (const row of result) {
      if (row.type === 'CREDIT') {
        credits = new Decimal(row._sum.amount?.toString() || '0');
      } else {
        debits = new Decimal(row._sum.amount?.toString() || '0');
      }
    }

    return credits.minus(debits).toNumber();
  }

  /**
   * Get all wallet balances efficiently with a single query.
   */
  static async getAllBalances(): Promise<Map<string, number>> {
    const balances = new Map<string, number>();

    // Single query: aggregate all postings grouped by wallet's nodeId
    const wallets = await prisma.wallet.findMany({
      include: {
        postings: {
          select: { amount: true, type: true },
        },
      },
    });

    for (const wallet of wallets) {
      let credits = new Decimal(0);
      let debits = new Decimal(0);
      for (const posting of wallet.postings) {
        if (posting.type === 'CREDIT') {
          credits = credits.plus(posting.amount.toString());
        } else {
          debits = debits.plus(posting.amount.toString());
        }
      }
      balances.set(wallet.nodeId, credits.minus(debits).toNumber());
    }

    return balances;
  }
}
