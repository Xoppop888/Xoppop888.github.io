import React, { useCallback, useEffect, useRef, useState } from "react";

/* ───────────────────────── theme ───────────────────────── */

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark"
      : "light"
  );

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    root.setAttribute("data-theme", theme);
    try {
      window.localStorage.setItem("moneta-theme", theme);
    } catch {
      /* noop */
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  return { theme, toggle };
}

/* ──────────────────── reveal on scroll ─────────────────── */

export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // страховка: если IO недоступен — показываем сразу
    if (typeof IntersectionObserver === "undefined") {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setOn(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -4% 0px" }
    );
    io.observe(el);
    // фолбэк: не даём контенту остаться невидимым
    const t = window.setTimeout(() => setOn(true), 1400);
    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`rv ${on ? "rv-on" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/* ────────────────────── scroll spy ─────────────────────── */

export function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? "");

  useEffect(() => {
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) visible.set(e.target.id, e.intersectionRatio);
          else visible.delete(e.target.id);
        });
        if (visible.size) {
          // pick the one closest to the top among visible
          let best: string | null = null;
          let bestTop = Infinity;
          visible.forEach((_r, id) => {
            const el = document.getElementById(id);
            if (!el) return;
            const top = Math.abs(el.getBoundingClientRect().top - 120);
            if (top < bestTop) {
              bestTop = top;
              best = id;
            }
          });
          if (best) setActive(best as string);
        }
      },
      { rootMargin: "-100px 0px -55% 0px", threshold: [0, 0.15, 0.4] }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [ids.join(",")]);

  return active;
}

/* ──────────────── animated number (rAF) ────────────────── */

export function useAnimatedNumber(value: number, duration = 520) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, duration]);

  return display;
}

/* ────────────────────── online status ──────────────────── */

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

/* ──────────────────── PWA install prompt ───────────────── */

export function useInstallPrompt() {
  const [evt, setEvt] = useState<Event | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const prompt = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    const e = evt as (Event & { prompt?: () => Promise<void>; userChoice?: Promise<{ outcome: string }> }) | null;
    if (!e?.prompt) return "unavailable";
    e.prompt();
    try {
      const choice = await e.userChoice;
      if (choice?.outcome === "accepted") {
        setEvt(null);
        return "accepted";
      }
      return "dismissed";
    } catch {
      return "dismissed";
    }
  }, [evt]);

  return { canInstall: !!evt, installed, prompt };
}

export const fmtRub = (n: number, opts: { sign?: boolean; kopecks?: boolean } = {}) => {
  const abs = Math.abs(n);
  const base = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: opts.kopecks ? 2 : 0,
    maximumFractionDigits: opts.kopecks ? 2 : 0,
  }).format(abs);
  const sign = n < 0 ? "−" : opts.sign ? "+" : "";
  return `${sign}${base} ₽`;
};
