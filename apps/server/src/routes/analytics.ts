import { Router } from 'express';
import { prisma } from '../config/database';
import { WalletService } from '../ledger/LedgerService';

/** Parse and clamp a numeric query param within safe bounds. */
function parseIntParam(value: unknown, defaultVal: number, min: number, max: number): number {
  const parsed = parseInt(value as string, 10);
  if (isNaN(parsed)) return defaultVal;
  return Math.max(min, Math.min(max, parsed));
}

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

  // GET /api/analytics/trades?limit=50&offset=0
  router.get('/trades', async (req, res) => {
    try {
      const limit = parseIntParam(req.query.limit, 50, 1, 500);
      const offset = parseIntParam(req.query.offset, 0, 0, 100000);

      const [trades, total] = await Promise.all([
        prisma.trade.findMany({
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          include: {
            buyerNode: true,
            sellerNode: true,
          },
        }),
        prisma.trade.count(),
      ]);

      res.json({ trades, total, limit, offset });
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

  // GET /api/analytics/readings/:nodeId?limit=100&offset=0
  router.get('/readings/:nodeId', async (req, res) => {
    try {
      const { nodeId } = req.params;
      if (!nodeId || typeof nodeId !== 'string') {
        return res.status(400).json({ error: 'nodeId is required' });
      }

      const limit = parseIntParam(req.query.limit, 100, 1, 1000);
      const offset = parseIntParam(req.query.offset, 0, 0, 100000);

      const readings = await prisma.meterReading.findMany({
        where: { nodeId },
        orderBy: { simulationTime: 'desc' },
        take: limit,
        skip: offset,
      });
      res.json(readings);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch readings' });
    }
  });

  return router;
}

