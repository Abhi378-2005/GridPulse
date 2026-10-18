'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Home, Download } from 'lucide-react';
import { apiDownload, apiFetch } from '@/lib/api';

interface MyHouseModalProps {
  isOpen: boolean;
  nodeId: string;
  token: string;
  onClose: () => void;
  onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface Summary {
  node: { name: string; emoji: string };
  walletBalance: number;
  p2pTrading: { kwhBought: number; totalSpent: number; kwhSold: number; totalEarned: number; savingsVsGrid: number };
  gridTrading: { kwhImported: number; importCost: number; kwhExported: number; exportRevenue: number };
}

interface OrderRow {
  _id: string;
  side: 'BID' | 'ASK';
  pricePerKwh: number;
  quantityKwh: number;
  filledKwh: number;
  status: string;
}

const inputClass =
  'w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}

export function MyHouseModal({ isOpen, nodeId, token, onClose, onNotify }: MyHouseModalProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [side, setSide] = useState<'BID' | 'ASK'>('BID');
  const [price, setPrice] = useState('5.50');
  const [qty, setQty] = useState('1.0');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [s, o] = await Promise.all([
        apiFetch<Summary>(`/api/reports/summary/${nodeId}`, token),
        apiFetch<OrderRow[]>(`/api/trading/orders/${nodeId}`, token),
      ]);
      setSummary(s);
      setOrders(o.slice(0, 8));
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  }, [nodeId, token, onNotify]);

  useEffect(() => {
    if (!isOpen) return;
    refresh();
    const id = setInterval(refresh, 10000);
    return () => clearInterval(id);
  }, [isOpen, refresh]);

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiFetch<{ trades: unknown[] }>('/api/trading/order', token, {
        method: 'POST',
        body: JSON.stringify({ nodeId, side, pricePerKwh: price, quantityKwh: qty }),
      });
      onNotify(
        res.trades.length > 0 ? `Order matched — ${res.trades.length} trade(s)` : 'Order placed in the order book',
        'success'
      );
      refresh();
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    try {
      await apiFetch(`/api/trading/cancel/${orderId}`, token, { method: 'POST' });
      onNotify('Order cancelled', 'info');
      refresh();
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  const downloadCsv = async () => {
    try {
      await apiDownload(`/api/reports/export/csv/${nodeId}`, token, `gridpulse-trades-${nodeId}.csv`);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    }
  };

  const rs = (n: number) => `₹${n.toFixed(2)}`;
  const kwh = (n: number) => `${n.toFixed(2)} kWh`;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[560px] max-w-[95vw] max-h-[90vh] overflow-y-auto bg-background border border-border rounded-xl shadow-2xl"
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <Home className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">
                  {summary ? `${summary.node.emoji} ${summary.node.name}` : 'My House'}
                </h2>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors" aria-label="Close my house">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Report */}
              {summary && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Report</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <Stat label="Wallet" value={rs(summary.walletBalance)} />
                    <Stat label="P2P bought" value={kwh(summary.p2pTrading.kwhBought)} />
                    <Stat label="P2P sold" value={kwh(summary.p2pTrading.kwhSold)} />
                    <Stat label="Spent (P2P)" value={rs(summary.p2pTrading.totalSpent)} />
                    <Stat label="Earned (P2P)" value={rs(summary.p2pTrading.totalEarned)} />
                    <Stat label="Saved vs grid" value={rs(summary.p2pTrading.savingsVsGrid)} />
                    <Stat label="Grid import" value={`${kwh(summary.gridTrading.kwhImported)} · ${rs(summary.gridTrading.importCost)}`} />
                    <Stat label="Grid export" value={`${kwh(summary.gridTrading.kwhExported)} · ${rs(summary.gridTrading.exportRevenue)}`} />
                    <button
                      onClick={downloadCsv}
                      className="rounded-lg border border-border p-2 text-xs flex items-center justify-center gap-1 hover:bg-muted"
                    >
                      <Download className="h-3.5 w-3.5" /> Trades CSV
                    </button>
                  </div>
                </section>
              )}

              {/* Manual order */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Place an order</h3>
                <form onSubmit={placeOrder} className="grid grid-cols-4 gap-2 items-end">
                  <label className="text-[10px] text-muted-foreground">
                    Side
                    <select className={inputClass} value={side} onChange={e => setSide(e.target.value as 'BID' | 'ASK')}>
                      <option value="BID">Buy (BID)</option>
                      <option value="ASK">Sell (ASK)</option>
                    </select>
                  </label>
                  <label className="text-[10px] text-muted-foreground">
                    Price ₹/kWh
                    <input className={inputClass} type="number" step="0.01" min="1" max="15" value={price} onChange={e => setPrice(e.target.value)} required />
                  </label>
                  <label className="text-[10px] text-muted-foreground">
                    Quantity kWh
                    <input className={inputClass} type="number" step="0.01" min="0.01" value={qty} onChange={e => setQty(e.target.value)} required />
                  </label>
                  <button
                    type="submit"
                    disabled={busy}
                    className="h-[34px] rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    {busy ? '…' : 'Submit'}
                  </button>
                </form>
                <p className="text-[10px] text-muted-foreground">
                  Unmatched orders stay in the order book until filled or cancelled. The AutoTrader keeps trading alongside them.
                </p>
              </section>

              {/* Recent orders */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent orders</h3>
                <div className="text-xs font-mono divide-y divide-border">
                  {orders.length === 0 && <p className="text-muted-foreground py-2">No orders yet.</p>}
                  {orders.map(o => (
                    <div key={o._id} className="flex items-center justify-between py-1.5">
                      <span className={o.side === 'BID' ? 'text-emerald-500' : 'text-red-500'}>{o.side}</span>
                      <span>₹{o.pricePerKwh.toFixed(2)}</span>
                      <span>{o.filledKwh.toFixed(2)}/{o.quantityKwh.toFixed(2)} kWh</span>
                      <span className="text-muted-foreground w-28 text-right">{o.status}</span>
                      {(o.status === 'OPEN' || o.status === 'PARTIALLY_FILLED') ? (
                        <button onClick={() => cancelOrder(o._id)} className="text-red-500 hover:underline w-12 text-right">Cancel</button>
                      ) : <span className="w-12" />}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
