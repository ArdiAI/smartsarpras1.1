import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';
interface ToastItem { id: number; message: string; type: ToastType; }
interface ToastContextValue { toasts: ToastItem[]; showToast: (message: string, type?: ToastType) => void; removeToast: (id: number) => void; }
const ToastContext = createContext<ToastContextValue | undefined>(undefined);
let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const removeToast = useCallback((id: number) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);
  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 4000);
  }, [removeToast]);

  useEffect(() => {
    const handler = (e: Event) => { const detail = (e as CustomEvent).detail as { message: string; type: ToastType }; showToast(detail.message, detail.type); };
    window.addEventListener('show-toast', handler);
    return () => window.removeEventListener('show-toast', handler);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, removeToast }: { toasts: ToastItem[]; removeToast: (id: number) => void }) {
  const colors: Record<ToastType, string> = { success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-brand-600', warning: 'bg-amber-600' };
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`${colors[t.type]} rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg`} onClick={() => removeToast(t.id)}>{t.message}</div>
      ))}
    </div>
  );
}

export function showToast(message: string, type: ToastType = 'success') { window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } })); }
export function useToast() { const ctx = useContext(ToastContext); if (!ctx) throw new Error('useToast must be used within ToastProvider'); return ctx; }
export default ToastProvider;
