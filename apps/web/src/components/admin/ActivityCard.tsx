'use client';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import type { AuditEntry } from './types';

/** Turn a raw audit row into a sentence a person can read. */
function describe(a: AuditEntry): string {
  const d = (a.details ?? {}) as Record<string, unknown>;
  switch (a.action) {
    case 'sim.pause': return 'Paused the simulation';
    case 'sim.resume': return 'Resumed the simulation';
    case 'sim.setSpeed': return `Set speed to ${d.speed}x`;
    case 'sim.setMode': return `Switched to ${d.mode} mode`;
    case 'sim.triggerEvent': return `Triggered ${a.target || d.eventType}`;
    case 'user.role': return `Made ${a.target} ${d.role === 'admin' ? 'an admin' : 'a regular user'}`;
    case 'user.house': return d.house ? `Assigned ${a.target} to ${d.house}` : `Removed ${a.target}'s house`;
    case 'house.add': return `Added house ${a.target}`;
    default: return a.action;
  }
}

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-IN');
}

export function ActivityCard({ audit }: { audit: AuditEntry[] | null }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Recent admin activity</CardTitle>
      </CardHeader>
      <CardContent>
        {!audit ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : audit.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing yet. Admin actions will be listed here.</p>
        ) : (
          <ul className="divide-y divide-border text-xs">
            {audit.map(a => (
              <li key={a.id} className="flex items-start justify-between gap-3 py-2">
                <div>
                  <div>{describe(a)}</div>
                  <div className="text-[10px] text-muted-foreground">by {a.actorEmail}</div>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
