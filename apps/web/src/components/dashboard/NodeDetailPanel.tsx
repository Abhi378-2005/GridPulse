'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sun, Zap, AlertTriangle, Battery, Gauge } from 'lucide-react';
import type { GridNodeState, NodeConfigUpdate } from '@gridpulse/shared';

interface NodeDetailPanelProps {
  node: GridNodeState | null;
  onClose: () => void;
  onUpdateConfig: (update: NodeConfigUpdate) => void;
}

export function NodeDetailPanel({ node, onClose, onUpdateConfig }: NodeDetailPanelProps) {
  const [localSolar, setLocalSolar] = useState<number | null>(null);
  const [localLoad, setLocalLoad] = useState<number | null>(null);
  const [zeroGen, setZeroGen] = useState(false);
  const [maxLoad, setMaxLoad] = useState(false);

  // Reset local state when node changes
  const solarValue = localSolar ?? node?.solarCapacityKw ?? 5;
  const loadValue = localLoad ?? node?.baseLoadKw ?? 1.5;

  const handleSolarChange = useCallback((value: number) => {
    setLocalSolar(value);
    if (node) {
      onUpdateConfig({ nodeId: node.id, field: 'solarCapacityKw', value });
    }
  }, [node, onUpdateConfig]);

  const handleLoadChange = useCallback((value: number) => {
    setLocalLoad(value);
    if (node) {
      onUpdateConfig({ nodeId: node.id, field: 'baseLoadKw', value });
    }
  }, [node, onUpdateConfig]);

  const handleZeroGen = useCallback(() => {
    const newVal = !zeroGen;
    setZeroGen(newVal);
    if (node) {
      onUpdateConfig({ nodeId: node.id, field: 'forceZeroGeneration', value: newVal ? 1 : 0 });
    }
  }, [zeroGen, node, onUpdateConfig]);

  const handleMaxLoad = useCallback(() => {
    const newVal = !maxLoad;
    setMaxLoad(newVal);
    if (node) {
      onUpdateConfig({ nodeId: node.id, field: 'forceMaxLoad', value: newVal ? 1 : 0 });
    }
  }, [maxLoad, node, onUpdateConfig]);

  const batteryPct = node && node.batteryCapacityKwh > 0
    ? ((node.batteryChargeKwh / node.batteryCapacityKwh) * 100).toFixed(0)
    : '0';

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="absolute top-0 right-0 h-full w-80 z-50 bg-background/95 backdrop-blur-lg border-l border-border shadow-2xl overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <span className="text-xl">{node.emoji}</span>
              <div>
                <h2 className="text-sm font-bold text-foreground">{node.name}</h2>
                <span className="text-[10px] text-muted-foreground font-mono">{node.id.slice(0, 8)}...</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              aria-label="Close node detail panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Live Stats */}
          <div className="p-4 border-b border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Live Status</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sun className="h-3 w-3 text-emerald-500" />
                  <span className="text-[10px] text-muted-foreground">Generation</span>
                </div>
                <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {node.generationKw.toFixed(2)} kW
                </span>
              </div>
              <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="h-3 w-3 text-blue-500" />
                  <span className="text-[10px] text-muted-foreground">Consumption</span>
                </div>
                <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
                  {node.consumptionKw.toFixed(2)} kW
                </span>
              </div>
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Battery className="h-3 w-3 text-amber-500" />
                  <span className="text-[10px] text-muted-foreground">Battery</span>
                </div>
                <span className="font-mono text-sm font-bold text-amber-600 dark:text-amber-400">
                  {batteryPct}%
                </span>
              </div>
              <div className={`rounded-lg p-3 ${node.netEnergyKw >= 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Gauge className="h-3 w-3 text-current" />
                  <span className="text-[10px] text-muted-foreground">Net</span>
                </div>
                <span className={`font-mono text-sm font-bold ${node.netEnergyKw >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {node.netEnergyKw > 0 ? '+' : ''}{node.netEnergyKw.toFixed(2)} kW
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Controls */}
          <div className="p-4 border-b border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Adjust Parameters</h3>
            
            {/* Solar Capacity Slider */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium flex items-center gap-1.5">
                  <Sun className="h-3.5 w-3.5 text-amber-500" />
                  Solar Capacity
                </label>
                <span className="font-mono text-xs text-muted-foreground">
                  {solarValue.toFixed(1)} kW
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={solarValue}
                onChange={e => handleSolarChange(parseFloat(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-gray-300 to-amber-500 dark:from-gray-600 dark:to-amber-500 accent-amber-500"
                aria-label="Adjust solar panel capacity in kilowatts"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-muted-foreground">0 kW</span>
                <span className="text-[9px] text-muted-foreground">20 kW</span>
              </div>
            </div>

            {/* Base Load Slider */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-blue-500" />
                  Base Load
                </label>
                <span className="font-mono text-xs text-muted-foreground">
                  {loadValue.toFixed(1)} kW
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={loadValue}
                onChange={e => handleLoadChange(parseFloat(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-gray-300 to-blue-500 dark:from-gray-600 dark:to-blue-500 accent-blue-500"
                aria-label="Adjust household base load in kilowatts"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-muted-foreground">0.1 kW</span>
                <span className="text-[9px] text-muted-foreground">10 kW</span>
              </div>
            </div>
          </div>

          {/* Stress Test Overrides */}
          <div className="p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Stress Test Overrides
            </h3>
            
            <div className="space-y-3">
              {/* Force Zero Generation */}
              <button
                onClick={handleZeroGen}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
                  zeroGen
                    ? 'bg-red-500/15 border-red-500/40 text-red-700 dark:text-red-300'
                    : 'bg-muted/30 border-border hover:bg-muted/50 text-foreground'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">☁️</span>
                  <div className="text-left">
                    <div className="text-xs font-medium">Panel Failure</div>
                    <div className="text-[10px] text-muted-foreground">Force generation to zero</div>
                  </div>
                </div>
                <div className={`w-10 h-5 rounded-full flex items-center transition-colors ${zeroGen ? 'bg-red-500 justify-end' : 'bg-muted justify-start'}`}>
                  <div className="w-4 h-4 bg-white rounded-full shadow-sm mx-0.5" />
                </div>
              </button>

              {/* Force Max Load */}
              <button
                onClick={handleMaxLoad}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all duration-200 ${
                  maxLoad
                    ? 'bg-orange-500/15 border-orange-500/40 text-orange-700 dark:text-orange-300'
                    : 'bg-muted/30 border-border hover:bg-muted/50 text-foreground'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">🔥</span>
                  <div className="text-left">
                    <div className="text-xs font-medium">Max Load</div>
                    <div className="text-[10px] text-muted-foreground">Simulate peak demand (4× base)</div>
                  </div>
                </div>
                <div className={`w-10 h-5 rounded-full flex items-center transition-colors ${maxLoad ? 'bg-orange-500 justify-end' : 'bg-muted justify-start'}`}>
                  <div className="w-4 h-4 bg-white rounded-full shadow-sm mx-0.5" />
                </div>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
