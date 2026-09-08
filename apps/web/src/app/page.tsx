'use client';

import { ReactFlowProvider } from '@xyflow/react';
import { useSocket } from '@/hooks/useSocket';
import { Header } from '@/components/layout/Header';
import { GridTopology } from '@/components/dashboard/GridTopology';
import { ImpactMetrics } from '@/components/dashboard/ImpactMetrics';
import { EnergyCharts } from '@/components/dashboard/EnergyCharts';
import { OrderBook } from '@/components/dashboard/OrderBook';
import { LiveTicker } from '@/components/dashboard/LiveTicker';
import type { DataMode } from '@gridpulse/shared';

export default function Dashboard() {
  const {
    isConnected,
    simState,
    nodes,
    trades,
    orderBook,
    metrics,
    liveWeather,
    sendControl,
  } = useSocket();

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

  return (
    <div className="h-screen flex flex-col overflow-hidden">
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
        <aside className="w-52 p-3 overflow-y-auto border-r border-border bg-background/50">
          <ImpactMetrics metrics={metrics} />
        </aside>

        {/* Center — Grid Topology + Bottom Panels */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Hero: Grid Topology */}
          <div className="flex-1 p-3 min-h-0">
            <ReactFlowProvider>
              <GridTopology nodes={nodes} recentTrades={trades} />
            </ReactFlowProvider>
          </div>

          {/* Bottom Row: 3 Panels */}
          <div className="h-[280px] flex gap-3 p-3 pt-0">
            {/* Energy Charts */}
            <div className="flex-1 min-w-0">
              <EnergyCharts
                nodes={nodes}
                simTime={simState?.virtualTime}
              />
            </div>

            {/* Order Book */}
            <div className="w-64">
              <OrderBook orderBook={orderBook} />
            </div>

            {/* Live Ticker */}
            <div className="w-80">
              <LiveTicker trades={trades} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
