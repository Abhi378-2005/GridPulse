'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { TradeData } from '@gridpulse/shared';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

interface LiveTickerProps {
  trades: TradeData[];
}

function timeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function LiveTicker({ trades }: LiveTickerProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="p-4 pb-2 border-b flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold">Live Trades</CardTitle>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-mono font-medium text-emerald-600 dark:text-emerald-500">LIVE</span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
        <AnimatePresence initial={false}>
          {trades.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs">
              <div className="text-2xl mb-2 opacity-50">⚡</div>
              Waiting for trades...
            </div>
          ) : (
            trades.slice(0, 20).map((trade) => (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, x: 30, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="rounded-md border bg-muted/30 p-2.5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span>{trade.sellerEmoji}</span>
                    <span className="text-muted-foreground font-medium">{trade.sellerName}</span>
                    <span className="text-muted-foreground/50">→</span>
                    <span>{trade.buyerEmoji}</span>
                    <span className="text-muted-foreground font-medium">{trade.buyerName}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(trade.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-500">
                      {trade.quantityKwh.toFixed(2)} kWh
                    </span>
                    <span className="text-muted-foreground text-[10px]">@</span>
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      ${trade.clearingPrice.toFixed(4)}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground font-medium">
                    ${trade.totalCost.toFixed(4)}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
