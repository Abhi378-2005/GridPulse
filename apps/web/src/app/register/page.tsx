'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { UserPlus, ArrowLeft } from 'lucide-react';
import { apiFetch, saveToken } from '@/lib/api';
import { setSocketToken } from '@/lib/socket';

interface GridNodeOption {
  _id: string;
  name: string;
  emoji: string;
}

interface AuthResponse {
  token: string;
  user: { id: string; email: string; name: string; role: string; nodeId: string | null };
}

const inputClass =
  'w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [nodes, setNodes] = useState<GridNodeOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Fetch available nodes for the "Your house" dropdown
  useEffect(() => {
    apiFetch<GridNodeOption[]>('/api/analytics/nodes', null)
      .then(data => setNodes(data))
      .catch(() => {
        // Non-critical — user can still register without picking a house
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<AuthResponse>('/api/auth/register', null, {
        method: 'POST',
        body: JSON.stringify({ name, email, password, nodeId: nodeId || undefined }),
      });
      // Save token and reconnect socket so the dashboard picks up the new session
      saveToken(res.token);
      setSocketToken(res.token);
      // Redirect back to the dashboard
      router.push('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      {/* Subtle animated background accents */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="relative z-10 w-[420px] max-w-[95vw] bg-background border border-border rounded-2xl shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-2.5">
            <UserPlus className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground">Create account</h1>
          </div>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground rounded-md hover:bg-muted transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="reg-name" className="text-xs font-medium text-muted-foreground">
              Full Name
            </label>
            <input
              id="reg-name"
              className={inputClass}
              placeholder="e.g. John Doe"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-email" className="text-xs font-medium text-muted-foreground">
              Email Address
            </label>
            <input
              id="reg-email"
              className={inputClass}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-password" className="text-xs font-medium text-muted-foreground">
              Password
            </label>
            <input
              id="reg-password"
              className={inputClass}
              type="password"
              placeholder="Min 6 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-node" className="text-xs font-medium text-muted-foreground">
              Claim a House <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <select
              id="reg-node"
              className={inputClass}
              value={nodeId}
              onChange={e => setNodeId(e.target.value)}
            >
              <option value="">No house — viewer only</option>
              {nodes.map(n => (
                <option key={n._id} value={n._id}>
                  {n.emoji} {n.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground/70">
              Pick a house to manage its solar panels and battery.
            </p>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-500 bg-red-500/10 px-3 py-2 rounded-lg"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {busy ? 'Creating account…' : 'Create account'}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => router.push('/')}
              className="text-primary hover:underline font-medium"
            >
              Log in
            </button>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
