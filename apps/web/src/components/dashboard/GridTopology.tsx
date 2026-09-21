'use client';

import { useMemo } from 'react';
import { ReactFlow, Background, Node, Edge, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion } from 'framer-motion';
import type { GridNodeState, TradeData } from '@gridpulse/shared';
import { HOUSE_CONFIGS } from '@gridpulse/shared';
import { Card, CardContent } from '../ui/Card';
import { useTheme } from 'next-themes';

interface GridTopologyProps {
  nodes: GridNodeState[];
  recentTrades: TradeData[];
  onNodeClick?: (node: GridNodeState) => void;
  selectedNodeId?: string;
}

function HouseNodeContent({ data, isSelected }: { data: GridNodeState; isSelected?: boolean }) {
  const isProducer = data.netEnergyKw > 0;
  const isConsumer = data.netEnergyKw < 0;
  const batteryPct = data.batteryCapacityKwh > 0
    ? (data.batteryChargeKwh / data.batteryCapacityKwh) * 100
    : 0;

  return (
    <Card
      className={`
        p-3 min-w-[140px] cursor-pointer shadow-md
        transition-all duration-500 bg-background/95 backdrop-blur-sm
        ${isProducer ? 'border-emerald-500/50 shadow-emerald-500/20' : ''}
        ${isConsumer ? 'border-blue-500/50 shadow-blue-500/20' : ''}
        ${!isProducer && !isConsumer ? 'border-border' : ''}
        ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg">{data.emoji}</span>
        <span className="text-xs font-medium text-muted-foreground">{data.name}</span>
      </div>

      {/* Energy bars */}
      <div className="space-y-1.5">
        {/* Generation */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground w-7">GEN</span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (data.generationKw / data.solarCapacityKw) * 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-500 w-12 text-right">
            {data.generationKw.toFixed(1)}kW
          </span>
        </div>

        {/* Consumption */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground w-7">USE</span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (data.consumptionKw / (data.baseLoadKw * 4)) * 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <span className="font-mono text-[10px] text-blue-600 dark:text-blue-500 w-12 text-right">
            {data.consumptionKw.toFixed(1)}kW
          </span>
        </div>

        {/* Battery */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground w-7">BAT</span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-orange-500 rounded-full"
              animate={{ width: `${batteryPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <span className="font-mono text-[10px] text-orange-600 dark:text-orange-500 w-12 text-right">
            {batteryPct.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Net energy badge */}
      <div className={`
        mt-2 px-2 py-0.5 rounded-md text-center text-[10px] font-mono font-bold
        ${isProducer ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : ''}
        ${isConsumer ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : ''}
        ${!isProducer && !isConsumer ? 'bg-muted text-muted-foreground' : ''}
      `}>
        {data.netEnergyKw > 0 ? '+' : ''}{data.netEnergyKw.toFixed(2)} kW
      </div>
    </Card>
  );
}

/** Deterministic hash for two node IDs, returns value in [0, 1). */
function hashPair(a: string, b: string): number {
  const str = a < b ? `${a}-${b}` : `${b}-${a}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 1000) / 1000;
}

export function GridTopology({ nodes, recentTrades, onNodeClick, selectedNodeId }: GridTopologyProps) {
  const { theme } = useTheme();

  // Build React Flow nodes and edges
  const { flowNodes, flowEdges } = useMemo(() => {
    const positions = HOUSE_CONFIGS.map((c, i) => ({
      x: c.posX,
      y: c.posY,
    }));

    const flowNodes: Node[] = nodes.map((node, idx) => ({
      id: node.id,
      position: positions[idx] || { x: 100 + idx * 150, y: 200 },
      data: node,
      type: 'houseNode',
      draggable: true,
    }));

    const tradeColor = theme === 'dark' ? '#a855f7' : '#9333ea';
    const meshColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const labelBgColor = theme === 'dark' ? 'rgba(10, 14, 26, 0.8)' : 'rgba(255, 255, 255, 0.9)';

    // Create edges from recent trades
    const tradeEdges: Edge[] = recentTrades.slice(0, 8).map((trade, idx) => ({
      id: `trade-${trade.id}`,
      source: trade.sellerNodeId,
      target: trade.buyerNodeId,
      animated: true,
      style: {
        stroke: tradeColor,
        strokeWidth: 2,
        opacity: Math.max(0.3, 1 - idx * 0.1),
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: tradeColor,
        width: 15,
        height: 15,
      },
      label: `${trade.quantityKwh.toFixed(1)} kWh`,
      labelStyle: {
        fill: tradeColor,
        fontSize: 10,
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: 'bold',
      },
      labelBgStyle: {
        fill: labelBgColor,
        fillOpacity: 1,
      },
    }));

    // Add some mesh connectivity edges (visual only)
    const meshEdges: Edge[] = [];
    if (nodes.length >= 2) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          if (hashPair(nodes[i].id, nodes[j].id) < 0.35) { // ~35% deterministic connectivity
            meshEdges.push({
              id: `mesh-${i}-${j}`,
              source: nodes[i].id,
              target: nodes[j].id,
              style: { stroke: meshColor, strokeWidth: 1 },
              animated: false,
            });
          }
        }
      }
    }

    return { flowNodes, flowEdges: [...meshEdges, ...tradeEdges] };
  }, [nodes, recentTrades, theme]);

  const nodeTypes = useMemo(() => ({
    houseNode: ({ data }: { data: GridNodeState }) => (
      <HouseNodeContent data={data} isSelected={selectedNodeId === data.id} />
    ),
  }), [selectedNodeId]);

  if (nodes.length === 0) {
    return (
      <Card className="flex items-center justify-center h-full">
        <CardContent className="text-center p-8">
          <div className="text-4xl mb-4 opacity-50 animate-pulse">⚡</div>
          <div className="text-muted-foreground text-sm">Connecting to GridPulse...</div>
          <div className="text-muted-foreground/50 text-xs mt-1">Waiting for simulation data</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full relative overflow-hidden flex flex-col p-0">
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <h2 className="text-sm font-semibold">
          🌐 Live Grid Topology
        </h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Nodes highlight green (surplus) or blue (demand) • Purple edges = active trades
        </p>
      </div>
      <div className="w-full flex-1" style={{ minHeight: '400px' }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ animated: false }}
          minZoom={0.3}
          maxZoom={1.5}
          onNodeClick={(_event, node) => {
            const nodeData = nodes.find(n => n.id === node.id);
            if (nodeData && onNodeClick) onNodeClick(nodeData);
          }}
        >
          <Background color={theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} gap={40} />
        </ReactFlow>
      </div>
    </Card>
  );
}
