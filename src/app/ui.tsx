import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Info, X } from "lucide-react";
import { monthLabel, shiftMonth } from "./format";

/* ── Modal (на мобильном — шторка снизу) ── */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} role="dialog" aria-modal="true">
      <div className="animate-fade absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`animate-sheet relative max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-[var(--line-strong)] bg-[var(--surface)] shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.5)] sm:mx-4 sm:rounded-2xl ${
          wide ? "sm:max-w-2xl" : "sm:max-w-lg"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface)] px-5 py-3.5">
          <h2 className="font-display text-[15px] font-bold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
          >
            <X size={17} />
          </button>
        </div>
        <div className="px-5 pb-6 pt-4">{children}</div>
      </div>
    </div>
  );
}

/* ── Тосты ── */

type ToastKind = "ok" | "err" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}

const ToastCtx = createContext<{ push: (text: string, kind?: ToastKind) => void }>({ push: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const push = useCallback((text: string, kind: ToastKind = "info") => {
    const id = ++idRef.current;
    setList((l) => [...l.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3600);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-20 left-1/2 z-[60] flex w-[min(92vw,380px)] -translate-x-1/2 flex-col gap-2 lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0">
        {list.map((t) => (
          <div
            key={t.id}
            className={`animate-toast pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-lg backdrop-blur-md ${
              t.kind === "ok"
                ? "border-[var(--income)]/40 bg-[var(--surface)] text-[var(--ink)]"
                : t.kind === "err"
                  ? "border-[var(--expense)]/50 bg-[var(--surface)] text-[var(--ink)]"
                  : "border-[var(--line-strong)] bg-[var(--surface)] text-[var(--ink)]"
            }`}
          >
            <span className={t.kind === "ok" ? "text-[var(--income)]" : t.kind === "err" ? "text-[var(--expense)]" : "text-[var(--transfer)]"}>
              {t.kind === "ok" ? <Check size={16} /> : t.kind === "err" ? <AlertTriangle size={16} /> : <Info size={16} />}
            </span>
            <span className="text-[13px] leading-snug">{t.text}</span>
            <button
              onClick={() => setList((l) => l.filter((x) => x.id !== t.id))}
              className="ml-auto text-[var(--faint)] transition-colors hover:text-[var(--ink)]"
              aria-label="Скрыть"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ── Прогресс-бар ── */

export function Progress({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]">
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }}
      />
    </div>
  );
}

/* ── Пустое состояние ── */

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--line-strong)] px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--faint)]">{icon}</div>
      <div className="mt-3 font-display text-[14.5px] font-semibold">{title}</div>
      <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-[var(--muted)]">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ── Переключатель месяца ── */

export function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1">
      <button
        onClick={() => onChange(shiftMonth(month, -1))}
        aria-label="Предыдущий месяц"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
      >
        <ChevronLeft size={15} />
      </button>
      <span className="num-tab min-w-[118px] text-center font-mono text-[12px] font-semibold">{monthLabel(month)}</span>
      <button
        onClick={() => onChange(shiftMonth(month, 1))}
        aria-label="Следующий месяц"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

/* ── Сегментированный переключатель ── */

export function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { v: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          title={o.hint}
          className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 font-mono text-[11.5px] font-semibold transition-all ${
            value === o.v ? "bg-[var(--accent)] text-[var(--bg)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--ink)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
