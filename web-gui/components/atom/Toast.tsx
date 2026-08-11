"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/utils/cn";

export type ToastType = "success" | "error" | "warning" | "info";

type Toast = {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
};

let toastId = 0;
let addToastFn: ((toast: Omit<Toast, "id">) => void) | null = null;

// Global function to show toast from anywhere
export function showToast(type: ToastType, title: string, message?: string, duration = 5000) {
  if (addToastFn) {
    addToastFn({ type, title, message, duration });
  }
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { ...toast, id }]);

    // Auto dismiss
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toast.duration || 5000);
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Register global addToast
  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "animate-slide-in flex w-80 items-start gap-3 rounded-lg border p-4 shadow-lg backdrop-blur-sm",
            toast.type === "success" && "border-accent/30 bg-accent/10",
            toast.type === "error" && "border-danger/30 bg-danger/10",
            toast.type === "warning" && "border-yellow-500/30 bg-yellow-500/10",
            toast.type === "info" && "border-blue-500/30 bg-blue-500/10"
          )}
        >
          {/* Icon */}
          <span className="mt-0.5 text-base">
            {toast.type === "success" && "✅"}
            {toast.type === "error" && "❌"}
            {toast.type === "warning" && "⚠️"}
            {toast.type === "info" && "ℹ️"}
          </span>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className={cn(
              "text-sm font-semibold",
              toast.type === "success" && "text-accent",
              toast.type === "error" && "text-danger",
              toast.type === "warning" && "text-yellow-400",
              toast.type === "info" && "text-blue-400"
            )}>
              {toast.title}
            </div>
            {toast.message && (
              <div className="mt-0.5 truncate text-xs text-text-secondary">
                {toast.message}
              </div>
            )}
          </div>

          {/* Close */}
          <button
            onClick={() => removeToast(toast.id)}
            className="text-text-muted hover:text-text-primary"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
