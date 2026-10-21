import type { AggregateMetrics, SimulationState } from '@gridpulse/shared';

export type Notify = (message: string, type: 'success' | 'error' | 'info') => void;

export interface AuditEntry {
  id: string;
  actorEmail: string;
  action: string;
  target: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AdminOverview {
  simulation: SimulationState;
  metrics: AggregateMetrics;
  counts: { users: number; houses: number; trades: number };
  grid: {
    receivedFromHouses: number;
    paidToHouses: number;
    net: number;
    importKwh: number;
    importCost: number;
    exportKwh: number;
    exportRevenue: number;
  };
  houseBalancesTotal: number;
  ledger: { balanced: boolean; credits: number; debits: number };
  audit: AuditEntry[];
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  nodeId: string | null;
  houseName: string | null;
  houseEmoji: string | null;
  createdAt: string;
}

export interface AdminHouse {
  id: string;
  name: string;
  emoji: string;
  ownerId: string | null;
}
