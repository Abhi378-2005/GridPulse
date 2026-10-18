import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { SimulationEngine } from '../engine/SimulationEngine';
import { Order, Trade, GridNode } from '../models';
import { TRADING } from '@gridpulse/shared';
import { authenticateToken, canAccessNode, requireNodeAccess } from '../middleware/auth';

export function createTradingRouter(simEngine: SimulationEngine): Router {
  const router = Router();

  // Every trading route requires a logged-in user
  router.use(authenticateToken);

  // POST /api/trading/order
  // Place a manual order (allows prosumers / users to buy or sell energy directly)
  router.post('/order', async (req: Request, res: Response) => {
    try {
      const { nodeId, side, pricePerKwh, quantityKwh } = req.body;

      if (!nodeId || !side || pricePerKwh === undefined || quantityKwh === undefined) {
        return res.status(400).json({ error: 'nodeId, side, pricePerKwh, and quantityKwh are required' });
      }

      if (!mongoose.Types.ObjectId.isValid(nodeId)) {
        return res.status(400).json({ error: 'Invalid nodeId' });
      }

      // Users can only trade from their own house's wallet
      if (!canAccessNode(req.user, nodeId)) {
        return res.status(403).json({ error: 'You can only place orders for your own node' });
      }

      if (side !== 'BID' && side !== 'ASK') {
        return res.status(400).json({ error: 'side must be BID or ASK' });
      }

      const price = parseFloat(pricePerKwh);
      const qty = parseFloat(quantityKwh);

      if (isNaN(price) || price < TRADING.MIN_PRICE || price > TRADING.MAX_PRICE) {
        return res.status(400).json({
          error: `Price must be between ₹${TRADING.MIN_PRICE} and ₹${TRADING.MAX_PRICE} per kWh`,
        });
      }

      if (isNaN(qty) || qty < TRADING.MIN_ORDER_QTY) {
        return res.status(400).json({
          error: `Quantity must be at least ${TRADING.MIN_ORDER_QTY} kWh`,
        });
      }

      const node = await GridNode.findById(nodeId);
      if (!node) {
        return res.status(404).json({ error: 'Node not found' });
      }

      const result = await simEngine.submitManualOrder(nodeId, side, price, qty);

      res.status(201).json({
        message: 'Order placed successfully',
        trades: result.trades,
        orderBook: result.orderBookSnapshot,
      });
    } catch (error) {
      console.error('Manual order placement error:', error);
      res.status(500).json({ error: 'Failed to place order' });
    }
  });

  // GET /api/trading/orders/:nodeId
  router.get('/orders/:nodeId', requireNodeAccess, async (req: Request, res: Response) => {
    try {
      const { nodeId } = req.params;
      const status = req.query.status as string;

      const filter: any = { nodeId: new mongoose.Types.ObjectId(nodeId) };
      if (status) {
        filter.status = status;
      }

      const orders = await Order.find(filter)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      const serialized = orders.map(o => ({
        ...o,
        pricePerKwh: parseFloat(o.pricePerKwh.toString()),
        quantityKwh: parseFloat(o.quantityKwh.toString()),
        filledKwh: parseFloat(o.filledKwh.toString()),
      }));

      res.json(serialized);
    } catch (error) {
      console.error('Fetch node orders error:', error);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });

  // POST /api/trading/cancel/:orderId
  router.post('/cancel/:orderId', async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({ error: 'Invalid orderId' });
      }

      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      if (!canAccessNode(req.user, order.nodeId.toString())) {
        return res.status(403).json({ error: 'You can only cancel your own orders' });
      }

      if (order.status === 'FILLED' || order.status === 'CANCELLED') {
        return res.status(400).json({ error: `Cannot cancel order with status ${order.status}` });
      }

      // Removes it from the live order book too, so it can no longer match
      const cancelled = await simEngine.getMatchingEngine().cancelOrder(orderId);
      if (!cancelled) {
        return res.status(409).json({ error: 'Order was filled or cancelled in the meantime' });
      }

      res.json({ message: 'Order cancelled successfully', orderId });
    } catch (error) {
      console.error('Cancel order error:', error);
      res.status(500).json({ error: 'Failed to cancel order' });
    }
  });

  // GET /api/trading/depth
  router.get('/depth', (req: Request, res: Response) => {
    try {
      const snapshot = simEngine.getMatchingEngine().getOrderBookSnapshot();
      res.json(snapshot);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch order book depth' });
    }
  });

  return router;
}
