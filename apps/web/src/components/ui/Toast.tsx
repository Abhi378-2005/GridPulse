'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

const typeStyles: Record<Toast['type'], string> = {
  info: 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  success: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  warning: 'border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-300',
  error: 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300',
};

const typeIcons: Record<Toast['type'], string> = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
};

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newToast: Toast = { ...toast, id };
    setToasts(prev => [newToast, ...prev].slice(0, 5)); // Max 5 visible toasts

    const duration = toast.duration ?? 5000;
    const timeout = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timeoutRefs.current.delete(id);
    }, duration);
    timeoutRefs.current.set(id, timeout);

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }
  }, []);

  return { toasts, addToast, removeToast };
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed top-16 right-4 z-[60] flex flex-col gap-2 w-80 pointer-events-none">
      <AnimatePresence initial={false}>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`
              pointer-events-auto cursor-pointer
              rounded-lg border backdrop-blur-sm shadow-lg
              px-4 py-3 flex items-start gap-3
              ${typeStyles[toast.type]}
            `}
            onClick={() => onDismiss(toast.id)}
          >
            <span className="text-lg flex-shrink-0 mt-0.5">{typeIcons[toast.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(toast.id); }}
              className="text-current opacity-50 hover:opacity-100 text-xs flex-shrink-0"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
