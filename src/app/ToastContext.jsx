import { createContext, useCallback, useContext, useState } from 'react';
import { HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineInformationCircle } from 'react-icons/hi2';

const ToastContext = createContext(() => {});

const ICONS = { success: HiOutlineCheckCircle, error: HiOutlineExclamationCircle, info: HiOutlineInformationCircle };
const ICON_COLOR = { success: 'text-[#3fb950]', error: 'text-[var(--danger)]', info: 'text-primary' };

function Toast({ toast }) {
  const Icon = ICONS[toast.type] ?? ICONS.info;
  return (
    <div role="status" className="fixed bottom-5 left-1/2 z-[2000] flex max-w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 items-start gap-2.5 rounded-lg border border-border bg-[var(--bg-modal)] px-4 py-2.5 text-[13px] text-foreground shadow-2xl">
      <Icon className={`mt-px size-4 shrink-0 ${ICON_COLOR[toast.type] ?? ICON_COLOR.info}`} />
      <span>{toast.message}</span>
    </div>
  );
}

/** Transient notifications: showToast(message, type = 'success' | 'error' | 'info'). */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 3000);
  }, []);
  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && <Toast key={toast.id} toast={toast} />}
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
