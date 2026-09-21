'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { SimulationState, LiveWeatherData, DataMode } from '@gridpulse/shared';
import { ThemeToggle } from '../ui/ThemeToggle';
import { Button } from '../ui/Button';

interface HeaderProps {
  simState: SimulationState | null;
  liveWeather: LiveWeatherData | null;
  isConnected: boolean;
  onSpeedChange: (speed: number) => void;
  onPauseResume: () => void;
  onModeChange: (mode: DataMode) => void;
  onTriggerHeatwave: () => void;
}

export function Header({
  simState,
  liveWeather,
  isConnected,
  onSpeedChange,
  onPauseResume,
  onModeChange,
  onTriggerHeatwave,
}: HeaderProps) {
  const virtualTime = simState?.virtualTime
    ? new Date(simState.virtualTime).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    : '--:--:--';

  const virtualDate = simState?.virtualTime
    ? new Date(simState.virtualTime).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : '';

  const speedPresets = [1, 10, 60, 360, 720, 1440];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center gap-4">
        {/* Logo & Brand */}
        <div className="flex items-center gap-2 font-semibold">
          <span className="text-xl">⚡</span>
          <div className="hidden sm:inline-block">
            <span className="text-foreground">Grid</span>
            <span className="text-primary">Pulse</span>
          </div>
        </div>

        <div className="flex-1" />

        {/* Live Weather (when in LIVE mode) */}
        <AnimatePresence>
          {liveWeather && simState?.mode === 'LIVE' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="hidden md:flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground border rounded-full bg-muted/30"
            >
              <span>☁️ {liveWeather.cloudCoverPct}%</span>
              <span>•</span>
              <span>🌡️ {liveWeather.temperatureC}°C</span>
              <span>•</span>
              <span>☀️ {Math.round(liveWeather.solarRadiationWm2)} W/m²</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mode Selector */}
        <div className="hidden md:flex items-center rounded-md border p-1 bg-muted/30" role="group" aria-label="Data mode selector">
          {(['DEMO', 'REPLAY', 'LIVE'] as DataMode[]).map(mode => {
            const isActive = simState?.mode === mode;
            return (
              <button
                key={mode}
                onClick={() => onModeChange(mode)}
                aria-pressed={isActive}
                aria-label={`Switch to ${mode} mode`}
                className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                  isActive
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                {mode}
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPauseResume}
            className="w-24"
            aria-label={simState?.isRunning ? 'Pause simulation' : 'Resume simulation'}
          >
            {simState?.isRunning ? '⏸ Pause' : '▶ Resume'}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onTriggerHeatwave}
            aria-label="Trigger a heatwave weather event"
          >
            ⚡ Heatwave
          </Button>
        </div>

        {/* Virtual Clock & Speed */}
        <div className="hidden lg:flex items-center gap-4 px-4 border-l">
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground uppercase leading-none mb-1">
              Virtual Time
            </div>
            <div className="font-mono text-sm font-medium">
              {virtualTime}
            </div>
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="Simulation speed">
            {speedPresets.map(speed => (
              <button
                key={speed}
                onClick={() => onSpeedChange(speed)}
                aria-label={`Set speed to ${speed}x`}
                aria-pressed={simState?.speed === speed}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                  simState?.speed === speed
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {speed >= 1000 ? `${speed / 1000}k` : speed}x
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 border-l pl-4">
          <ThemeToggle />
          
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}
              role="status"
              aria-label={isConnected ? 'Server connected' : 'Server disconnected'}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
