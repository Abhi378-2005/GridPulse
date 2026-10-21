'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { apiFetch } from '@/lib/api';
import { AuthModal } from '@/components/auth/AuthModal';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Button } from '@/components/ui/Button';
import { ToastContainer, useToast } from '@/components/ui/Toast';
import { SimulationControlCard } from '@/components/admin/SimulationControlCard';
import { GridMoneyCard } from '@/components/admin/GridMoneyCard';
import { UsersCard } from '@/components/admin/UsersCard';
import { ActivityCard } from '@/components/admin/ActivityCard';
import type { AdminOverview, Notify } from '@/components/admin/types';

const POLL_MS = 5000;

export default function AdminPage() {
  const { token, user, ready, isAdmin, login, logout } = useAuth();
  const { simState } = useSocket(); // Live simulation state (also updates while paused)
  const { toasts, addToast, removeToast } = useToast();

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  const notify: Notify = useCallback((message, type) => {
    addToast({ message, type, duration: 4000 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setOverview(await apiFetch<AdminOverview>('/api/admin/overview', token));
      setLoadError(null);
    } catch (err) {
      setLoadError((err as Error).message);
    }
  }, [token]);

  // Poll the overview while an admin has the page open
  useEffect(() => {
    if (!isAdmin) return;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [isAdmin, refresh]);

  // ── Access gate ──────────────────────────────────────────
  if (!ready) {
    return <Centered>Checking your session…</Centered>;
  }

  if (!user) {
    return (
      <Centered>
        <h1 className="text-lg font-semibold mb-1">Admin area</h1>
        <p className="text-sm text-muted-foreground mb-4">Log in with an admin account to continue.</p>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => setIsLoginOpen(true)}>Log in</Button>
          <Button variant="outline" asChild><Link href="/">Back to dashboard</Link></Button>
        </div>
        <AuthModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} onLogin={login} />
      </Centered>
    );
  }

  if (!isAdmin) {
    return (
      <Centered>
        <h1 className="text-lg font-semibold mb-1">Admins only</h1>
        <p className="text-sm text-muted-foreground mb-4">
          {user.email} doesn’t have admin access. Ask an admin to change your role.
        </p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" asChild><Link href="/">Back to dashboard</Link></Button>
          <Button variant="ghost" onClick={logout}>Log out</Button>
        </div>
      </Centered>
    );
  }

  // ── Admin page ───────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/"><ArrowLeft className="h-4 w-4 mr-1" /> Dashboard</Link>
          </Button>
          <div className="font-semibold">
            <span className="text-foreground">Grid</span><span className="text-primary">Pulse</span>
            <span className="ml-2 text-xs font-normal text-muted-foreground">Admin</span>
          </div>
          <div className="flex-1" />
          <span className="hidden sm:inline text-xs text-muted-foreground">{user.email}</span>
          <Button variant="ghost" size="sm" onClick={logout}>Log out</Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 space-y-4">
        {loadError && (
          <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-500">
            Couldn’t refresh: {loadError}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <SimulationControlCard
              simState={simState ?? overview?.simulation ?? null}
              token={token!}
              onNotify={notify}
              onChanged={refresh}
            />
            <GridMoneyCard overview={overview} />
          </div>
          <div className="space-y-4">
            <UsersCard token={token!} selfId={user.id} onNotify={notify} onChanged={refresh} />
            <ActivityCard audit={overview?.audit ?? null} />
          </div>
        </div>
      </main>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center bg-background">
      <div>{children}</div>
    </div>
  );
}
