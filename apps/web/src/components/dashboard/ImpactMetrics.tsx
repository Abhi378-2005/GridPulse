'use client';

import { motion } from 'framer-motion';
import type { AggregateMetrics } from '@gridpulse/shared';
import CountUp from 'react-countup';
import { Card, CardContent } from '../ui/Card';

interface ImpactMetricsProps {
  metrics: AggregateMetrics | null;
}

export function ImpactMetrics({ metrics }: ImpactMetricsProps) {
  const items = [
    {
      label: 'CO₂ Avoided',
      value: metrics?.totalCO2AvoidedKg || 0,
      unit: 'kg',
      icon: '🌿',
      color: 'text-emerald-500',
      decimals: 2,
    },
    {
      label: 'Money Saved',
      value: metrics?.totalMoneySaved || 0,
      unit: '$',
      icon: '💰',
      color: 'text-blue-500',
      decimals: 2,
    },
    {
      label: 'Energy Traded',
      value: metrics?.totalKwhTraded || 0,
      unit: 'kWh',
      icon: '⚡',
      color: 'text-purple-500',
      decimals: 2,
    },
    {
      label: 'Total Trades',
      value: metrics?.totalTradesCount || 0,
      unit: '',
      icon: '🤝',
      color: 'text-orange-500',
      decimals: 0,
    },
  ];

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="px-2 pb-2 border-b">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">System Impact</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-3 px-1">
        {items.map((item, idx) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="border-border/50 shadow-sm transition-colors hover:bg-muted/30">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="text-3xl drop-shadow-sm">{item.icon}</div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-0.5">
                    {item.label}
                  </div>
                  <div className={`text-xl font-mono font-bold ${item.color}`}>
                    {item.unit === '$' && '$'}
                    <CountUp
                      end={item.value}
                      decimals={item.decimals}
                      duration={1}
                      preserveValue
                      separator=","
                    />
                    {item.unit !== '$' && <span className="text-xs ml-1 opacity-70 text-foreground">{item.unit}</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {/* Extra stats at the bottom */}
        <div className="pt-2 flex flex-col gap-2">
          <Card className="bg-muted/20 shadow-none border-dashed">
            <CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Nodes Online</div>
              <div className="flex items-center justify-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-lg font-bold text-foreground">
                  {metrics?.nodesOnline || 0}
                </span>
                <span className="text-muted-foreground text-xs">online</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/20 shadow-none border-dashed">
            <CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">Avg P2P Price</div>
              <div className="font-mono text-lg font-bold text-blue-500">
                ${(metrics?.avgP2PPrice || 0).toFixed(3)}
              </div>
              <div className="text-[10px] text-muted-foreground">vs Grid: ${(metrics?.currentGridPrice || 0.15).toFixed(3)}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
