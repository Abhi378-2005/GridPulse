'use client';

import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { GridNodeState } from '@gridpulse/shared';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { useTheme } from 'next-themes';

interface EnergyChartsProps {
  nodes: GridNodeState[];
  simTime: string | undefined;
}

// Keep a rolling history for the chart
const MAX_HISTORY = 60;
let chartHistory: Array<{
  time: string;
  totalGen: number;
  totalCon: number;
  netEnergy: number;
}> = [];

export function EnergyCharts({ nodes, simTime }: EnergyChartsProps) {
  const { theme } = useTheme();

  // Update history
  useMemo(() => {
    if (nodes.length === 0 || !simTime) return;

    const totalGen = nodes.reduce((sum, n) => sum + n.generationKw, 0);
    const totalCon = nodes.reduce((sum, n) => sum + n.consumptionKw, 0);
    const timeLabel = new Date(simTime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    chartHistory.push({
      time: timeLabel,
      totalGen: parseFloat(totalGen.toFixed(1)),
      totalCon: parseFloat(totalCon.toFixed(1)),
      netEnergy: parseFloat((totalGen - totalCon).toFixed(1)),
    });

    if (chartHistory.length > MAX_HISTORY) {
      chartHistory = chartHistory.slice(-MAX_HISTORY);
    }
  }, [nodes, simTime]);

  const data = [...chartHistory];

  const genColor = theme === 'dark' ? '#10b981' : '#059669'; // Emerald
  const conColor = theme === 'dark' ? '#3b82f6' : '#2563eb'; // Blue
  const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const textColor = theme === 'dark' ? '#9ca3af' : '#6b7280';
  const tooltipBg = theme === 'dark' ? 'rgba(3, 7, 18, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  const tooltipBorder = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="p-4 pb-2 border-b">
        <CardTitle className="text-sm font-semibold">Community Energy Flow</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-4 pl-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="genGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={genColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={genColor} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="conGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={conColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={conColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: textColor, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              minTickGap={20}
            />
            <YAxis
              tick={{ fill: textColor, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}kW`}
            />
            <Tooltip
              contentStyle={{
                background: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: '8px',
                fontSize: '12px',
                color: theme === 'dark' ? '#e5e7eb' : '#1f2937',
              }}
            />
            <Area
              type="monotone"
              dataKey="totalGen"
              name="Generation"
              stroke={genColor}
              fill="url(#genGradient)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="totalCon"
              name="Consumption"
              stroke={conColor}
              fill="url(#conGradient)"
              strokeWidth={2}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', color: textColor, paddingTop: '10px' }}
              iconType="circle"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
