"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";

interface Toast {
  id: number;
  message: string;
  variant: "success" | "loading";
}

interface ToastContextValue {
  showToast: (message: string, variant?: "success" | "loading", duration?: number) => number;
  dismissToast: (id: number) => void;
  updateToast: (id: number, message: string, variant?: "success" | "loading", duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: "success" | "loading" = "success", duration = 3000) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, variant }]);
      if (variant !== "loading") {
        setTimeout(() => dismissToast(id), duration);
      }
      return id;
    },
    [dismissToast]
  );

  const updateToast = useCallback(
    (id: number, message: string, variant: "success" | "loading" = "success", duration = 3000) => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, message, variant } : t)));
      if (variant !== "loading") {
        setTimeout(() => dismissToast(id), duration);
      }
    },
    [dismissToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, updateToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg text-sm text-white ${
              t.variant === "loading" ? "bg-zinc-700" : "bg-green-600"
            }`}
          >
            {t.variant === "loading" && (
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
