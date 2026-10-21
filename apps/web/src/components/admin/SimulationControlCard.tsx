'use client';

import { useState } from 'react';
import { Play, Pause } from 'lucide-react';
import type { DataMode, SimulationState } from '@gridpulse/shared';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import type { Notify } from './types';

interface Props {
  simState: SimulationState | null;
  token: string;
  onNotify: Notify;
  onChanged: () => void;
}

const SPEEDS = [1, 10, 60, 120, 360, 720, 1440];
const MODES: DataMode[] = ['DEMO', 'REPLAY', 'LIVE'];
const MODE_HELP: Record<DataMode, string> = {
  DEMO: 'Maths-based solar and demand',
  REPLAY: 'Replays household data from CSV',
  LIVE: 'Real weather from Open-Meteo',
};
const EVENTS = [
  { type: 'CLOUD_COVER', label: '☁️ Clouds' },
  { type: 'HEATWAVE', label: '🌡️ Heatwave' },
  { type: 'CLEAR_SKY', label: '☀️ Clear sky' },
  { type: 'STORM', label: '⛈️ Storm' },
];

export function SimulationControlCard({ simState, token, onNotify, onChanged }: Props) {
  const [busy, setBusy] = useState(false);

  // One helper for every control: call the admin-only endpoint, report the result.
  const send = async (path: string, body: object | undefined, success: string) => {
    setBusy(true);
    try {
      await apiFetch(`/api/simulation/${path}`, token, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      onNotify(success, 'success');
      onChanged();
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const running = !!simState?.isRunning;
  const time = simState?.virtualTime
    ? new Date(simState.virtualTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' })
    : '—';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Simulation control</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
          <div>
            <div className="text-[10px] uppercase text-muted-foreground">Status</div>
            <div className={`text-sm font-semibold ${running ? 'text-emerald-500' : 'text-amber-500'}`}>
              {running ? 'Running' : 'Paused'}
            </div>
            <div className="text-[11px] text-muted-foreground font-mono mt-0.5">Simulated time: {time}</div>
          </div>
          <Button
            size="sm"
            disabled={busy || !simState}
            onClick={() => (running ? send('pause', undefined, 'Simulation paused') : send('start', undefined, 'Simulation resumed'))}
          >
            {running ? <><Pause className="h-4 w-4 mr-1" /> Pause</> : <><Play className="h-4 w-4 mr-1" /> Resume</>}
          </Button>
        </div>

        <div>
          <div className="text-[10px] uppercase text-muted-foreground mb-1.5">Speed (simulated seconds per real second)</div>
          <div className="flex flex-wrap gap-1.5">
            {SPEEDS.map(s => (
              <Button
                key={s}
                size="sm"
                variant={simState?.speed === s ? 'default' : 'outline'}
                className="h-8 px-3 font-mono"
                disabled={busy}
                onClick={() => send('speed', { speed: s }, `Speed set to ${s}x`)}
              >
                {s}x
              </Button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase text-muted-foreground mb-1.5">Data mode</div>
          <div className="grid grid-cols-3 gap-1.5">
            {MODES.map(m => (
              <Button
                key={m}
                size="sm"
                variant={simState?.mode === m ? 'default' : 'outline'}
                className="h-auto flex-col py-1.5"
                disabled={busy}
                onClick={() => send('mode', { mode: m }, `Switched to ${m} mode`)}
              >
                <span>{m}</span>
                <span className="text-[9px] font-normal opacity-80 whitespace-normal text-center leading-tight">{MODE_HELP[m]}</span>
              </Button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase text-muted-foreground mb-1.5">Trigger a weather event</div>
          <div className="grid grid-cols-2 gap-1.5">
            {EVENTS.map(e => (
              <Button
                key={e.type}
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => send('trigger-event', { eventType: e.type }, `${e.label} triggered`)}
              >
                {e.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
