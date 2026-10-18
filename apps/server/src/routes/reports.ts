import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { Trade, MeterReading, GridNode, Transaction } from '../models';
import { TRADING, FINANCE } from '@gridpulse/shared';
import { WalletService } from '../ledger/LedgerService';
import { authenticateToken, requireNodeAccess } from '../middleware/auth';

/** Total energy and ₹ a node bought from / sold to the main grid. */
async function getGridTotals(objectId: mongoose.Types.ObjectId) {
  const rows = await Transaction.aggregate([
    { $match: { nodeId: objectId, kind: { $in: ['GRID_IMPORT', 'GRID_EXPORT'] } } },
    { $group: { _id: '$kind', kwh: { $sum: '$kwh' }, amount: { $sum: '$amount' } } },
  ]);
  const get = (kind: string) => rows.find(r => r._id === kind) || { kwh: 0, amount: 0 };
  const imp = get('GRID_IMPORT');
  const exp = get('GRID_EXPORT');
  return { importKwh: imp.kwh, importCost: imp.amount, exportKwh: exp.kwh, exportRevenue: exp.amount };
}

export function createReportsRouter(): Router {
  const router = Router();

  // Reports contain wallet balances — only the owner (or an admin) may see them
  router.use(authenticateToken);

  // GET /api/reports/summary/:nodeId
  // Comprehensive energy & financial summary for a node
  router.get('/summary/:nodeId', requireNodeAccess, async (req: Request, res: Response) => {
    try {
      const { nodeId } = req.params;
      const objectId = new mongoose.Types.ObjectId(nodeId);

      const node = await GridNode.findById(objectId).lean();
      if (!node) {
        return res.status(404).json({ error: 'Node not found' });
      }

      // 1. Get Wallet Balance
      const balance = await WalletService.getBalance(nodeId);

      // 2. Aggregate Trades as Buyer
      const buyTrades = await Trade.aggregate([
        { $match: { buyerNodeId: objectId } },
        {
          $group: {
            _id: null,
            totalKwhBought: { $sum: '$quantityKwh' },
            totalSpent: { $sum: '$totalCost' },
            count: { $sum: 1 },
          },
        },
      ]);

      // 3. Aggregate Trades as Seller
      const sellTrades = await Trade.aggregate([
        { $match: { sellerNodeId: objectId } },
        {
          $group: {
            _id: null,
            totalKwhSold: { $sum: '$quantityKwh' },
            totalEarned: { $sum: { $multiply: ['$quantityKwh', '$clearingPrice'] } },
            count: { $sum: 1 },
          },
        },
      ]);

      // 4. Aggregate Meter Readings (Generation & Consumption)
      const meterStats = await MeterReading.aggregate([
        { $match: { nodeId: objectId } },
        {
          $group: {
            _id: null,
            avgGenerationKw: { $avg: '$generationKw' },
            avgConsumptionKw: { $avg: '$consumptionKw' },
            maxGenerationKw: { $max: '$generationKw' },
            maxConsumptionKw: { $max: '$consumptionKw' },
            readingCount: { $sum: 1 },
          },
        },
      ]);

      const grid = await getGridTotals(objectId);

      const bought = buyTrades[0] || { totalKwhBought: 0, totalSpent: 0, count: 0 };
      const sold = sellTrades[0] || { totalKwhSold: 0, totalEarned: 0, count: 0 };
      const stats = meterStats[0] || {
        avgGenerationKw: 0,
        avgConsumptionKw: 0,
        maxGenerationKw: 0,
        maxConsumptionKw: 0,
        readingCount: 0,
      };

      const kwhBought = parseFloat(bought.totalKwhBought.toString() || '0');
      const spent = parseFloat(bought.totalSpent.toString() || '0');
      const kwhSold = parseFloat(sold.totalKwhSold.toString() || '0');
      const earned = parseFloat(sold.totalEarned.toString() || '0');

      // Grid equivalent cost if the delivered energy had been imported from MSEDCL instead
      const kwhDelivered = kwhBought * (1 - TRADING.TRANSMISSION_LOSS_PCT);
      const gridEquivalentCost = kwhDelivered * TRADING.GRID_PRICE_PER_KWH;
      const p2pSavings = Math.max(0, gridEquivalentCost - spent);
      // Count each P2P kWh once (on the buyer side, after losses) to avoid double counting
      const co2AvoidedKg = kwhDelivered * (FINANCE.CO2_GRID_DEFAULT / 1000);

      res.json({
        node: {
          id: node._id.toString(),
          name: node.name,
          emoji: node.emoji,
          solarCapacityKw: node.solarCapacityKw,
          batteryCapacityKwh: node.batteryCapacityKwh,
        },
        walletBalance: balance,
        currency: TRADING.CURRENCY_SYMBOL,
        p2pTrading: {
          kwhBought: parseFloat(kwhBought.toFixed(3)),
          totalSpent: parseFloat(spent.toFixed(2)),
          buyTradesCount: bought.count,
          kwhSold: parseFloat(kwhSold.toFixed(3)),
          totalEarned: parseFloat(earned.toFixed(2)),
          sellTradesCount: sold.count,
          netEnergyTraded: parseFloat((kwhSold - kwhBought).toFixed(3)),
          netFinancialBenefit: parseFloat((earned - spent).toFixed(2)),
          savingsVsGrid: parseFloat(p2pSavings.toFixed(2)),
          co2AvoidedKg: parseFloat(co2AvoidedKg.toFixed(2)),
        },
        gridTrading: {
          kwhImported: parseFloat(grid.importKwh.toFixed(3)),
          importCost: parseFloat(grid.importCost.toFixed(2)),
          kwhExported: parseFloat(grid.exportKwh.toFixed(3)),
          exportRevenue: parseFloat(grid.exportRevenue.toFixed(2)),
        },
        meterStats: {
          avgGenerationKw: parseFloat((stats.avgGenerationKw || 0).toFixed(2)),
          avgConsumptionKw: parseFloat((stats.avgConsumptionKw || 0).toFixed(2)),
          maxGenerationKw: parseFloat((stats.maxGenerationKw || 0).toFixed(2)),
          maxConsumptionKw: parseFloat((stats.maxConsumptionKw || 0).toFixed(2)),
          totalReadingsLogged: stats.readingCount,
        },
      });
    } catch (error) {
      console.error('Report summary error:', error);
      res.status(500).json({ error: 'Failed to generate summary report' });
    }
  });

  // GET /api/reports/bill/:nodeId
  // Itemized monthly / simulation billing statement
  router.get('/bill/:nodeId', requireNodeAccess, async (req: Request, res: Response) => {
    try {
      const { nodeId } = req.params;
      const objectId = new mongoose.Types.ObjectId(nodeId);

      const node = await GridNode.findById(objectId).lean();
      if (!node) {
        return res.status(404).json({ error: 'Node not found' });
      }

      const balance = await WalletService.getBalance(nodeId);

      const buyTrades = await Trade.aggregate([
        { $match: { buyerNodeId: objectId } },
        {
          $group: {
            _id: null,
            totalKwh: { $sum: '$quantityKwh' },
            totalEnergyCost: { $sum: { $multiply: ['$quantityKwh', '$clearingPrice'] } },
            totalWheelingCost: { $sum: '$totalCost' },
          },
        },
      ]);

      const sellTrades = await Trade.aggregate([
        { $match: { sellerNodeId: objectId } },
        {
          $group: {
            _id: null,
            totalKwh: { $sum: '$quantityKwh' },
            totalEarned: { $sum: { $multiply: ['$quantityKwh', '$clearingPrice'] } },
          },
        },
      ]);

      const grid = await getGridTotals(objectId);

      const buyData = buyTrades[0] || { totalKwh: 0, totalEnergyCost: 0, totalWheelingCost: 0 };
      const sellData = sellTrades[0] || { totalKwh: 0, totalEarned: 0 };

      const kwhBought = parseFloat(buyData.totalKwh.toString() || '0');
      const energyCost = parseFloat(buyData.totalEnergyCost.toString() || '0');
      const totalPaid = parseFloat(buyData.totalWheelingCost.toString() || '0');
      const wheelingCharges = Math.max(0, totalPaid - energyCost);
      const kwhSold = parseFloat(sellData.totalKwh.toString() || '0');
      const solarCredits = parseFloat(sellData.totalEarned.toString() || '0');

      const netPayable = totalPaid + grid.importCost - solarCredits - grid.exportRevenue;

      res.json({
        billNumber: `BILL-${nodeId.slice(-6).toUpperCase()}-${Date.now().toString().slice(-4)}`,
        consumerName: node.name,
        currency: '₹',
        billDate: new Date().toISOString(),
        tariffCategory: 'LT Residential Time-of-Day (MSEDCL / GridPulse P2P)',
        lineItems: [
          {
            description: 'P2P Energy Purchases (Clean Solar)',
            quantity: `${kwhBought.toFixed(2)} kWh`,
            amount: parseFloat(energyCost.toFixed(2)),
          },
          {
            description: `Distribution & Wheeling Charges (@ ₹${TRADING.WHEELING_CHARGE_PER_KWH}/kWh)`,
            quantity: `${kwhBought.toFixed(2)} kWh`,
            amount: parseFloat(wheelingCharges.toFixed(2)),
          },
          {
            description: 'MSEDCL Grid Import (Time-of-Day tariff)',
            quantity: `${grid.importKwh.toFixed(2)} kWh`,
            amount: parseFloat(grid.importCost.toFixed(2)),
          },
          {
            description: `MSEDCL Net-Metering Export Credit (@ ₹${TRADING.GRID_EXPORT_RATE}/kWh)`,
            quantity: `${grid.exportKwh.toFixed(2)} kWh`,
            amount: -parseFloat(grid.exportRevenue.toFixed(2)),
          },
          {
            description: 'Surplus Solar Export Credit (P2P Sold)',
            quantity: `${kwhSold.toFixed(2)} kWh`,
            amount: -parseFloat(solarCredits.toFixed(2)),
          },
        ],
        subtotal: parseFloat(netPayable.toFixed(2)),
        walletCurrentBalance: balance,
      });
    } catch (error) {
      console.error('Billing report error:', error);
      res.status(500).json({ error: 'Failed to generate billing statement' });
    }
  });

  // GET /api/reports/export/csv/:nodeId
  // Stream CSV export of all trades for a node
  router.get('/export/csv/:nodeId', requireNodeAccess, async (req: Request, res: Response) => {
    try {
      const { nodeId } = req.params;
      const objectId = new mongoose.Types.ObjectId(nodeId);

      const trades = await Trade.find({
        $or: [{ buyerNodeId: objectId }, { sellerNodeId: objectId }],
      })
        .sort({ createdAt: -1 })
        .populate('buyerNodeId', 'name')
        .populate('sellerNodeId', 'name')
        .lean();

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="trades-${nodeId}.csv"`);

      let csv = 'Trade ID,Date,Role,Counterparty,Price (₹/kWh),Quantity (kWh),Amount (₹),CO2 Avoided (kg)\n';

      for (const t of trades) {
        const isBuyer = t.buyerNodeId._id.toString() === nodeId;
        const role = isBuyer ? 'BUYER' : 'SELLER';
        const counterparty = isBuyer ? (t.sellerNodeId as any).name : (t.buyerNodeId as any).name;
        const price = parseFloat(t.clearingPrice.toString()).toFixed(4);
        const qty = parseFloat(t.quantityKwh.toString()).toFixed(4);
        // Buyer paid energy + wheeling; seller received the energy portion only
        const cost = (isBuyer
          ? parseFloat(t.totalCost.toString())
          : parseFloat(t.quantityKwh.toString()) * parseFloat(t.clearingPrice.toString())
        ).toFixed(4);
        const co2 = parseFloat(t.co2AvoidedKg.toString()).toFixed(4);

        csv += `"${t._id}","${t.createdAt.toISOString()}","${role}","${counterparty}",${price},${qty},${cost},${co2}\n`;
      }

      res.status(200).send(csv);
    } catch (error) {
      console.error('CSV export error:', error);
      res.status(500).send('Error generating CSV export');
    }
  });

  return router;
}
