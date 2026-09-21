'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus } from 'lucide-react';
import type { AddNodeRequest } from '@gridpulse/shared';

interface AddNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (request: AddNodeRequest) => void;
}

const EMOJI_OPTIONS = ['🏠', '🏡', '🏘️', '🏗️', '🏢', '🏛️', '🏭', '⛺', '🏕️', '🏰'];

export function AddNodeModal({ isOpen, onClose, onAdd }: AddNodeModalProps) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏠');
  const [solarCapacity, setSolarCapacity] = useState(5.0);
  const [batteryCapacity, setBatteryCapacity] = useState(10.0);
  const [baseLoad, setBaseLoad] = useState(1.5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAdd({
      name: name.trim(),
      emoji,
      solarCapacity,
      batteryCapacity,
      baseLoad,
    });

    // Reset form
    setName('');
    setEmoji('🏠');
    setSolarCapacity(5.0);
    setBatteryCapacity(10.0);
    setBaseLoad(1.5);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[420px] max-w-[90vw] bg-background border border-border rounded-xl shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">Add New Node</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
                aria-label="Close add node modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                  Household Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., Iota, Kappa, MyHouse..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                  required
                  maxLength={20}
                  autoFocus
                />
              </div>

              {/* Emoji Picker */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                  Icon
                </label>
                <div className="flex gap-2 flex-wrap">
                  {EMOJI_OPTIONS.map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className={`p-2 text-lg rounded-lg border transition-all ${
                        emoji === e
                          ? 'border-primary bg-primary/10 shadow-sm scale-110'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Solar Capacity */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    ☀️ Solar Capacity
                  </label>
                  <span className="text-xs font-mono text-muted-foreground">{solarCapacity.toFixed(1)} kW</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="0.5"
                  value={solarCapacity}
                  onChange={e => setSolarCapacity(parseFloat(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-gray-300 to-amber-500 dark:from-gray-600 dark:to-amber-500 accent-amber-500"
                />
              </div>

              {/* Battery Capacity */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    🔋 Battery Capacity
                  </label>
                  <span className="text-xs font-mono text-muted-foreground">{batteryCapacity.toFixed(1)} kWh</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={batteryCapacity}
                  onChange={e => setBatteryCapacity(parseFloat(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-gray-300 to-emerald-500 dark:from-gray-600 dark:to-emerald-500 accent-emerald-500"
                />
              </div>

              {/* Base Load */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    ⚡ Base Load
                  </label>
                  <span className="text-xs font-mono text-muted-foreground">{baseLoad.toFixed(1)} kW</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="8"
                  step="0.5"
                  value={baseLoad}
                  onChange={e => setBaseLoad(parseFloat(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-gray-300 to-blue-500 dark:from-gray-600 dark:to-blue-500 accent-blue-500"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!name.trim()}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add {emoji} {name || 'Node'} to Grid
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
