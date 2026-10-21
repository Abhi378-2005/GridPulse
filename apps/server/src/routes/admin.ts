import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Decimal from 'decimal.js';
import { SimulationEngine } from '../engine/SimulationEngine';
import { User, GridNode, Wallet, Posting, Transaction, Trade, AuditLog } from '../models';
import { WalletService } from '../ledger/LedgerService';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { recordAudit } from '../middleware/audit';

/** Sum of credits and debits (as Decimals) from a `$group` by posting type. */
function splitCreditsDebits(rows: Array<{ _id: string; total: { toString(): string } }>) {
  let credits = new Decimal(0);
  let debits = new Decimal(0);
  for (const row of rows) {
    const total = new Decimal(row.total.toString());
    if (row._id === 'CREDIT') credits = total;
    else debits = total;
  }
  return { credits, debits };
}

export function createAdminRouter(simEngine: SimulationEngine): Router {
  const router = Router();

  // Every route here is admin-only. The role is re-read from the database on each request.
  router.use(authenticateToken, requireAdmin);

  // GET /api/admin/overview
  // Read-only snapshot for the "Grid & money" panel.
  router.get('/overview', async (req: Request, res: Response) => {
    try {
      const gridWallet = await Wallet.findOne({ systemAccount: 'GRID' }).lean();

      const [gridRows, gridEnergyRows, ledgerRows, houseBalances, userCount, houseCount, tradeCount, audit] =
        await Promise.all([
          gridWallet
            ? Posting.aggregate([
                { $match: { walletId: gridWallet._id } },
                { $group: { _id: '$type', total: { $sum: { $toDecimal: '$amount' } } } },
              ])
            : Promise.resolve([]),
          Transaction.aggregate([
            { $match: { kind: { $in: ['GRID_IMPORT', 'GRID_EXPORT'] } } },
            { $group: { _id: '$kind', kwh: { $sum: '$kwh' }, amount: { $sum: '$amount' } } },
          ]),
          // Ledger self-check: for real trades and grid transfers, debits must equal credits.
          // (Initial deposits are one-sided by design, so they are excluded.)
          Posting.aggregate([
            { $lookup: { from: 'transactions', localField: 'transactionId', foreignField: '_id', as: 'tx' } },
            { $match: { 'tx.kind': { $in: ['TRADE', 'GRID_IMPORT', 'GRID_EXPORT'] } } },
            { $group: { _id: '$type', total: { $sum: { $toDecimal: '$amount' } } } },
          ]),
          WalletService.getAllBalances(),
          User.countDocuments(),
          GridNode.countDocuments(),
          Trade.countDocuments(),
          AuditLog.find({}).sort({ createdAt: -1 }).limit(10).lean(),
        ]);

      const grid = splitCreditsDebits(gridRows as any);
      const ledger = splitCreditsDebits(ledgerRows as any);
      const energy = (kind: string) => (gridEnergyRows as any[]).find(r => r._id === kind) || { kwh: 0, amount: 0 };
      const imp = energy('GRID_IMPORT');
      const exp = energy('GRID_EXPORT');

      let housesTotal = new Decimal(0);
      houseBalances.forEach(v => { housesTotal = housesTotal.plus(v); });

      res.json({
        simulation: simEngine.getState(),
        metrics: simEngine.getMetrics(),
        counts: { users: userCount, houses: houseCount, trades: tradeCount },
        grid: {
          receivedFromHouses: grid.credits.toNumber(), // Wheeling charges + grid imports paid by houses
          paidToHouses: grid.debits.toNumber(),        // Net-metering payouts for exported solar
          net: grid.credits.minus(grid.debits).toNumber(),
          importKwh: imp.kwh,
          importCost: imp.amount,
          exportKwh: exp.kwh,
          exportRevenue: exp.amount,
        },
        houseBalancesTotal: housesTotal.toNumber(),
        ledger: {
          balanced: ledger.credits.equals(ledger.debits),
          credits: ledger.credits.toNumber(),
          debits: ledger.debits.toNumber(),
        },
        audit: audit.map(a => ({
          id: a._id.toString(),
          actorEmail: a.actorEmail,
          action: a.action,
          target: a.target,
          details: a.details ?? {}, // Mongoose drops empty objects, so default it
          createdAt: a.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      console.error('Admin overview error:', error);
      res.status(500).json({ error: 'Failed to load overview' });
    }
  });

  // GET /api/admin/users
  // Every account plus the list of houses, so the UI can offer a house dropdown.
  router.get('/users', async (req: Request, res: Response) => {
    try {
      const [users, houses] = await Promise.all([
        User.find({}).select('-passwordHash').sort({ createdAt: 1 }).lean(),
        GridNode.find({}).select('name emoji').sort({ name: 1 }).lean(),
      ]);

      const houseById = new Map(houses.map(h => [h._id.toString(), h]));
      const ownerByHouse = new Map<string, string>();
      for (const u of users) {
        if (u.nodeId) ownerByHouse.set(u.nodeId.toString(), u._id.toString());
      }

      res.json({
        users: users.map(u => {
          const house = u.nodeId ? houseById.get(u.nodeId.toString()) : undefined;
          return {
            id: u._id.toString(),
            email: u.email,
            name: u.name,
            role: u.role,
            nodeId: u.nodeId ? u.nodeId.toString() : null,
            houseName: house?.name ?? null,
            houseEmoji: house?.emoji ?? null,
            createdAt: u.createdAt.toISOString(),
          };
        }),
        houses: houses.map(h => ({
          id: h._id.toString(),
          name: h.name,
          emoji: h.emoji,
          ownerId: ownerByHouse.get(h._id.toString()) ?? null,
        })),
      });
    } catch (error) {
      console.error('Admin users error:', error);
      res.status(500).json({ error: 'Failed to load users' });
    }
  });

  // PATCH /api/admin/users/:id   body: { role?: 'user' | 'admin', nodeId?: string | null }
  router.patch('/users/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { role, nodeId } = req.body ?? {};

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid user id' });
      }
      if (role === undefined && nodeId === undefined) {
        return res.status(400).json({ error: 'Nothing to change: send role and/or nodeId' });
      }

      const target = await User.findById(id);
      if (!target) {
        return res.status(404).json({ error: 'User not found' });
      }

      const changes: Record<string, unknown> = {};

      if (role !== undefined) {
        if (role !== 'user' && role !== 'admin') {
          return res.status(400).json({ error: "role must be 'user' or 'admin'" });
        }
        if (role !== target.role) {
          if (role === 'user') {
            // Lock-out protection: you can't demote yourself, and the last admin can't be demoted.
            if (target._id.toString() === req.user!.userId) {
              return res.status(400).json({ error: 'You cannot remove your own admin role' });
            }
            const adminCount = await User.countDocuments({ role: 'admin' });
            if (adminCount <= 1) {
              return res.status(400).json({ error: 'At least one admin must remain' });
            }
          }
          target.role = role;
          changes.role = role;
        }
      }

      if (nodeId !== undefined) {
        if (nodeId === null || nodeId === '') {
          if (target.nodeId) {
            target.nodeId = null;
            changes.nodeId = null;
          }
        } else {
          if (!mongoose.Types.ObjectId.isValid(nodeId)) {
            return res.status(400).json({ error: 'Invalid house id' });
          }
          const house = await GridNode.findById(nodeId).lean();
          if (!house) {
            return res.status(404).json({ error: 'House not found' });
          }
          const owner = await User.findOne({ nodeId, _id: { $ne: target._id } }).lean();
          if (owner) {
            return res.status(409).json({ error: `${house.name} already belongs to ${owner.email}` });
          }
          if (target.nodeId?.toString() !== nodeId) {
            target.nodeId = new mongoose.Types.ObjectId(nodeId);
            changes.nodeId = house.name;
          }
        }
      }

      if (Object.keys(changes).length > 0) {
        await target.save();
        if ('role' in changes) recordAudit(req.user!, 'user.role', target.email, { role: changes.role });
        if ('nodeId' in changes) recordAudit(req.user!, 'user.house', target.email, { house: changes.nodeId });
      }

      res.json({
        message: Object.keys(changes).length > 0 ? 'User updated' : 'No changes',
        user: {
          id: target._id.toString(),
          email: target.email,
          role: target.role,
          nodeId: target.nodeId ? target.nodeId.toString() : null,
        },
      });
    } catch (error) {
      console.error('Admin update user error:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  return router;
}
