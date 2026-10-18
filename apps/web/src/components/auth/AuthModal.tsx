'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LogIn } from 'lucide-react';
import type { GridNodeState } from '@gridpulse/shared';

interface AuthModalProps {
  isOpen: boolean;
  nodes: GridNodeState[];
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (name: string, email: string, password: string, nodeId: string | null) => Promise<void>;
}

const inputClass =
  'w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50';

export function AuthModal({ isOpen, nodes, onClose, onLogin, onRegister }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await onLogin(email, password);
      else await onRegister(name, email, password, nodeId || null);
      setPassword('');
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[380px] max-w-[90vw] bg-background border border-border rounded-xl shadow-2xl"
          >
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="flex items-center gap-2">
                <LogIn className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">
                  {mode === 'login' ? 'Log in' : 'Create account'}
                </h2>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors" aria-label="Close login">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3">
              {mode === 'register' && (
                <input className={inputClass} placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
              )}
              <input className={inputClass} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
              <input
                className={inputClass}
                type="password"
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={6}
                required
              />
              {mode === 'register' && (
                <select className={inputClass} value={nodeId} onChange={e => setNodeId(e.target.value)} aria-label="Your house">
                  <option value="">No house (viewer only)</option>
                  {nodes.map(n => (
                    <option key={n.id} value={n.id}>{n.emoji} {n.name}</option>
                  ))}
                </select>
              )}

              {error && <p className="text-xs text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
              </button>

              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
                className="w-full text-xs text-muted-foreground hover:text-primary"
              >
                {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
