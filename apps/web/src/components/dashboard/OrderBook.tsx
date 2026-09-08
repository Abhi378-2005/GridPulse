'use client';

import type { OrderBookSnapshot } from '@gridpulse/shared';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

interface OrderBookProps {
  orderBook: OrderBookSnapshot | null;
}

export function OrderBook({ orderBook }: OrderBookProps) {
  const maxQty = Math.max(
    ...(orderBook?.bids || []).map(b => b.quantity),
    ...(orderBook?.asks || []).map(a => a.quantity),
    1
  );

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="p-4 pb-2 border-b flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold">Order Book</CardTitle>
        {orderBook?.spread !== undefined && (
          <span className="text-xs font-mono text-muted-foreground">
            Spread: ${orderBook.spread.toFixed(4)}
          </span>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 p-3 flex flex-col min-h-0 overflow-y-auto">
        <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider mb-2 px-1">
          <span>Price ($/kWh)</span>
          <span>Quantity (kWh)</span>
        </div>

        {/* Asks (sell orders) — top, sorted ascending (cheapest at bottom near spread) */}
        <div className="space-y-0.5 mb-2">
          {(orderBook?.asks || []).slice(0, 6).reverse().map((ask, idx) => (
            <div key={`ask-${idx}`} className="relative flex justify-between items-center px-2 py-1 rounded">
              <div
                className="absolute right-0 top-0 bottom-0 bg-red-500/10 dark:bg-red-500/20 rounded-r"
                style={{ width: `${(ask.quantity / maxQty) * 100}%` }}
              />
              <span className="font-mono text-xs text-red-600 dark:text-red-400 relative z-10">
                ${ask.price.toFixed(4)}
              </span>
              <span className="font-mono text-xs text-muted-foreground relative z-10">
                {ask.quantity.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Spread indicator */}
        <div className="flex items-center justify-center py-1.5 my-1 border-y bg-muted/20">
          <span className="font-mono text-xs text-primary font-bold">
            ${(orderBook?.lastPrice || 0).toFixed(4)}
          </span>
          <span className="text-[10px] text-muted-foreground ml-2 uppercase">Last Price</span>
        </div>

        {/* Bids (buy orders) — bottom, sorted descending (highest at top near spread) */}
        <div className="space-y-0.5 mt-2">
          {(orderBook?.bids || []).slice(0, 6).map((bid, idx) => (
            <div key={`bid-${idx}`} className="relative flex justify-between items-center px-2 py-1 rounded">
              <div
                className="absolute left-0 top-0 bottom-0 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-l"
                style={{ width: `${(bid.quantity / maxQty) * 100}%` }}
              />
              <span className="font-mono text-xs text-emerald-600 dark:text-emerald-500 relative z-10">
                ${bid.price.toFixed(4)}
              </span>
              <span className="font-mono text-xs text-muted-foreground relative z-10">
                {bid.quantity.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {(!orderBook || (orderBook.bids.length === 0 && orderBook.asks.length === 0)) && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
            Waiting for orders...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
