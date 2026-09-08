import { Router } from 'express';
import { prisma } from '../config/database';
import { WalletService } from '../ledger/LedgerService';

export function createAnalyticsRouter(): Router {
  const router = Router();

  // GET /api/analytics/nodes
  router.get('/nodes', async (req, res) => {
    try {
      const nodes = await prisma.gridNode.findMany({
        include: { wallet: true },
      });
      res.json(nodes);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch nodes' });
    }
  });

  // GET /api/analytics/trades
  router.get('/trades', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const trades = await prisma.trade.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          buyerNode: true,
          sellerNode: true,
        },
      });
      res.json(trades);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch trades' });
    }
  });

  // GET /api/analytics/balances
  router.get('/balances', async (req, res) => {
    try {
      const balances = await WalletService.getAllBalances();
      const result: Record<string, number> = {};
      balances.forEach((value, key) => { result[key] = value; });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch balances' });
    }
  });

  // GET /api/analytics/readings/:nodeId
  router.get('/readings/:nodeId', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const readings = await prisma.meterReading.findMany({
        where: { nodeId: req.params.nodeId },
        orderBy: { simulationTime: 'desc' },
        take: limit,
      });
      res.json(readings);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch readings' });
    }
  });

  return router;
}
