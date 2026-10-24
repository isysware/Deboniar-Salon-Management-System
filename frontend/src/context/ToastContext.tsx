import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (type: ToastType, message: string, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Standalone global trigger so toast can be called anywhere
type ToastListener = (type: ToastType, message: string, title?: string, duration?: number) => void;
let globalToastListener: ToastListener | null = null;

export const toast = {
  success: (message: string, title?: string, duration?: number) => {
    if (globalToastListener) globalToastListener('success', message, title, duration);
  },
  error: (message: string, title?: string, duration?: number) => {
    if (globalToastListener) globalToastListener('error', message, title, duration);
  },
  info: (message: string, title?: string, duration?: number) => {
    if (globalToastListener) globalToastListener('info', message, title, duration);
  },
  warning: (message: string, title?: string, duration?: number) => {
    if (globalToastListener) globalToastListener('warning', message, title, duration);
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, title?: string, duration: number = 4200) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [newToast, ...prev].slice(0, 5)); // Keep max 5 visible

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  // Connect global listener
  globalToastListener = showToast;

  const success = useCallback((msg: string, title?: string) => showToast('success', msg, title), [showToast]);
  const error = useCallback((msg: string, title?: string) => showToast('error', msg, title), [showToast]);
  const info = useCallback((msg: string, title?: string) => showToast('info', msg, title), [showToast]);
  const warning = useCallback((msg: string, title?: string) => showToast('warning', msg, title), [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast, success, error, info, warning }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// ── Toast Container & Visual Card Component ─────────────────────────────────

const ToastContainer: React.FC<{ toasts: ToastItem[]; onDismiss: (id: string) => void }> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0 || typeof document === 'undefined') return null;

  return createPortal(
    <div
      aria-live="polite"
      className="fixed top-5 right-5 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      style={{ zIndex: 99999999 }}
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={() => onDismiss(item.id)} />
      ))}
    </div>,
    document.body
  );
};

const ToastCard: React.FC<{ item: ToastItem; onDismiss: () => void }> = ({ item, onDismiss }) => {
  const duration = item.duration || 3800;

  const config = {
    success: {
      border: 'border-emerald-300 bg-white shadow-2xl shadow-emerald-950/15 ring-1 ring-emerald-500/20',
      accentBg: 'bg-emerald-500',
      iconBg: 'bg-emerald-50 text-emerald-600',
      icon: <CheckCircle2 className="w-5 h-5" />,
      defaultTitle: 'Success',
      progressBg: 'bg-emerald-500',
      titleColor: 'text-emerald-950',
    },
    error: {
      border: 'border-rose-300 bg-white shadow-2xl shadow-rose-950/20 ring-1 ring-rose-500/25',
      accentBg: 'bg-rose-500',
      iconBg: 'bg-rose-50 text-rose-600',
      icon: <AlertCircle className="w-5 h-5" />,
      defaultTitle: 'Action Required',
      progressBg: 'bg-rose-500',
      titleColor: 'text-rose-950',
    },
    warning: {
      border: 'border-amber-300 bg-white shadow-2xl shadow-amber-950/15 ring-1 ring-amber-500/20',
      accentBg: 'bg-amber-500',
      iconBg: 'bg-amber-50 text-amber-600',
      icon: <AlertTriangle className="w-5 h-5" />,
      defaultTitle: 'Warning',
      progressBg: 'bg-amber-500',
      titleColor: 'text-amber-950',
    },
    info: {
      border: 'border-blue-300 bg-white shadow-2xl shadow-blue-950/15 ring-1 ring-[#2254E1]/20',
      accentBg: 'bg-[#2254E1]',
      iconBg: 'bg-blue-50 text-[#2254E1]',
      icon: <Info className="w-5 h-5" />,
      defaultTitle: 'Information',
      progressBg: 'bg-[#2254E1]',
      titleColor: 'text-slate-900',
    },
  }[item.type];

  return (
    <div
      role="alert"
      className={`pointer-events-auto relative overflow-hidden rounded-xl border transition-all duration-200 transform translate-y-0 opacity-100 flex flex-col ${config.border}`}
      style={{
        animation: 'toast-slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      <div className="p-3.5 flex items-start gap-3">
        {/* Colorful Round Icon */}
        <div className={`p-2 rounded-xl shrink-0 ${config.iconBg}`}>
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          <h5 className={`text-xs font-semibold ${config.titleColor}`}>
            {item.title || config.defaultTitle}
          </h5>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed break-words">
            {item.message}
          </p>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar (Toastify Style shrink animation) */}
      <div className="w-full h-1 bg-slate-100 overflow-hidden">
        <div
          className={`h-full ${config.progressBg}`}
          style={{
            animation: `toast-progress ${duration}ms linear forwards`,
          }}
        />
      </div>

      <style>{`
        @keyframes toast-slide-in {
          0% {
            opacity: 0;
            transform: translateY(-12px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes toast-progress {
          0% {
            width: 100%;
          }
          100% {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
};
