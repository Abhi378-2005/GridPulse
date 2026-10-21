'use client';

import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import type { AdminOverview } from './types';

const rs = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const kwh = (n: number) => `${n.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kWh`;

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export function GridMoneyCard({ overview }: { overview: AdminOverview | null }) {
  if (!overview) {
    return (
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Grid & money</CardTitle></CardHeader>
        <CardContent className="text-xs text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  }

  const { grid, ledger, counts } = overview;

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold">Grid & money</CardTitle>
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-medium ${ledger.balanced ? 'text-emerald-500' : 'text-red-500'}`}
          title={
            ledger.balanced
              ? 'For every trade and grid transfer, money debited equals money credited'
              : `Debits and credits differ by ${rs(Math.abs(ledger.debits - ledger.credits))}`
          }
        >
          {ledger.balanced ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {ledger.balanced ? 'Ledger balanced' : 'Ledger MISMATCH'}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-[10px] uppercase text-muted-foreground mb-1.5">Grid operator (MSEDCL)</div>
          <div className="grid grid-cols-3 gap-2">
            <Tile label="Received" value={rs(grid.receivedFromHouses)} sub="imports + wheeling" />
            <Tile label="Paid out" value={rs(grid.paidToHouses)} sub="solar exports" />
            <Tile
              label="Net"
              value={rs(grid.net)}
              sub={grid.net < 0 ? 'paid out more than received' : 'received more than paid'}
            />
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase text-muted-foreground mb-1.5">Energy exchanged with the grid</div>
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Imported" value={kwh(grid.importKwh)} sub={`houses paid ${rs(grid.importCost)}`} />
            <Tile label="Exported" value={kwh(grid.exportKwh)} sub={`grid paid ${rs(grid.exportRevenue)}`} />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Tile label="House wallets" value={rs(overview.houseBalancesTotal)} />
          <Tile label="Houses" value={String(counts.houses)} />
          <Tile label="Users" value={String(counts.users)} />
          <Tile label="Trades" value={String(counts.trades)} />
        </div>
      </CardContent>
    </Card>
  );
}
