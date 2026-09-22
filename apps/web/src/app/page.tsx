'use client';

import { useEffect, useState, useCallback } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { useSocket } from '@/hooks/useSocket';
import { Header } from '@/components/layout/Header';
import { GridTopology } from '@/components/dashboard/GridTopology';
import { ImpactMetrics } from '@/components/dashboard/ImpactMetrics';
import { EnergyCharts } from '@/components/dashboard/EnergyCharts';
import { OrderBook } from '@/components/dashboard/OrderBook';
import { LiveTicker } from '@/components/dashboard/LiveTicker';
import { NodeDetailPanel } from '@/components/dashboard/NodeDetailPanel';
import { AddNodeModal } from '@/components/dashboard/AddNodeModal';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ToastContainer, useToast } from '@/components/ui/Toast';
import type { DataMode, GridNodeState } from '@gridpulse/shared';
import { Plus } from 'lucide-react';

export default function Dashboard() {
  const {
    isConnected,
    simState,
    nodes,
    trades,
    orderBook,
    metrics,
    liveWeather,
    weatherEvents,
    sendControl,
    sendNodeConfig,
    sendNodeNameUpdate,
    sendAddNode,
    sendLocation,
  } = useSocket();

  const { toasts, addToast, removeToast } = useToast();
  const [selectedNode, setSelectedNode] = useState<GridNodeState | null>(null);
  const [isAddNodeOpen, setIsAddNodeOpen] = useState(false);

  // Keep selected node's live data up-to-date
  useEffect(() => {
    if (selectedNode && nodes.length > 0) {
      const updated = nodes.find(n => n.id === selectedNode.id);
      if (updated) setSelectedNode(updated);
    }
  }, [nodes, selectedNode]);

  // Show toast notifications for weather events
  useEffect(() => {
    if (weatherEvents.length === 0) return;
    const latest = weatherEvents[0];
    if (!latest) return;

    const typeMap: Record<string, 'info' | 'warning' | 'error' | 'success'> = {
      CLOUD_COVER: 'info',
      HEATWAVE: 'warning',
      CLEAR_SKY: 'success',
      STORM: 'error',
    };

    addToast({
      message: latest.description,
      type: typeMap[latest.type] || 'info',
      duration: Math.min(latest.durationMs, 8000),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weatherEvents.length]);

  const handleSpeedChange = (speed: number) => {
    sendControl({ type: 'setSpeed', speed });
  };

  const handlePauseResume = () => {
    if (simState?.isRunning) {
      sendControl({ type: 'pause' });
    } else {
      sendControl({ type: 'resume' });
    }
  };

  const handleModeChange = (mode: DataMode) => {
    sendControl({ type: 'setMode', mode });
  };

  const handleTriggerHeatwave = () => {
    sendControl({ type: 'triggerEvent', eventType: 'HEATWAVE' });
  };

  const handleNodeClick = useCallback((node: GridNodeState) => {
    setSelectedNode(prev => prev?.id === node.id ? null : node);
  }, []);

  const handleCloseNodePanel = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Add Node Modal */}
      <AddNodeModal
        isOpen={isAddNodeOpen}
        onClose={() => setIsAddNodeOpen(false)}
        onAdd={(request) => {
          sendAddNode(request);
          addToast({ message: `🏠 Adding ${request.emoji} ${request.name} to the grid...`, type: 'success', duration: 3000 });
        }}
      />

      {/* Accessibility: announce connection status */}
      <div className="sr-only" aria-live="polite" role="status">
        {isConnected ? 'Connected to GridPulse server' : 'Disconnected from GridPulse server'}
      </div>

      {/* Header */}
      <Header
        simState={simState}
        liveWeather={liveWeather}
        isConnected={isConnected}
        onSpeedChange={handleSpeedChange}
        onPauseResume={handlePauseResume}
        onModeChange={handleModeChange}
        onTriggerHeatwave={handleTriggerHeatwave}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar — Impact Metrics */}
        <aside className="w-52 p-3 overflow-y-auto border-r border-border bg-background/50 hidden md:block">
          <ErrorBoundary fallbackTitle="Metrics Error">
            <ImpactMetrics metrics={metrics} />
          </ErrorBoundary>
          
          {/* Add Node Button */}
          <button
            onClick={() => setIsAddNodeOpen(true)}
            className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 text-muted-foreground hover:text-primary"
            aria-label="Add a new node to the grid"
          >
            <Plus className="h-4 w-4" />
            <span className="text-xs font-medium">Add Node</span>
          </button>
        </aside>

        {/* Center — Grid Topology + Bottom Panels */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Hero: Grid Topology */}
          <div className="flex-1 p-3 min-h-0">
            <ErrorBoundary fallbackTitle="Grid Topology Error">
              <ReactFlowProvider>
                <GridTopology
                  nodes={nodes}
                  recentTrades={trades}
                  onNodeClick={handleNodeClick}
                  selectedNodeId={selectedNode?.id}
                />
              </ReactFlowProvider>
            </ErrorBoundary>
          </div>

          {/* Bottom Row: 3 Panels */}
          <div className="h-[280px] flex gap-3 p-3 pt-0">
            {/* Energy Charts */}
            <div className="flex-1 min-w-0">
              <ErrorBoundary fallbackTitle="Charts Error">
                <EnergyCharts
                  nodes={nodes}
                  simTime={simState?.virtualTime}
                />
              </ErrorBoundary>
            </div>

            {/* Order Book */}
            <div className="w-64 hidden lg:block">
              <ErrorBoundary fallbackTitle="Order Book Error">
                <OrderBook orderBook={orderBook} />
              </ErrorBoundary>
            </div>

            {/* Live Ticker */}
            <div className="w-80 hidden lg:block">
              <ErrorBoundary fallbackTitle="Live Ticker Error">
                <LiveTicker trades={trades} />
              </ErrorBoundary>
            </div>
          </div>

          {/* Node Detail Panel (slides in from the right) */}
          <NodeDetailPanel
            node={selectedNode}
            onClose={handleCloseNodePanel}
            onUpdateConfig={sendNodeConfig}
            onUpdateName={sendNodeNameUpdate}
          />
        </main>
      </div>
    </div>
  );
}


