import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * Курс CNY → RUB. Два бесплатных источника без ключа:
 *  1) Frankfurter (официальные справочные курсы ЕЦБ) — основной;
 *  2) open.er-api.com — запасной.
 * Результат кэшируется в localStorage (ЕЦБ обновляет курс раз в день),
 * при загрузке используется стратегия stale-while-revalidate.
 */

const FRANKFURTER = "https://api.frankfurter.app/latest?from=CNY&to=RUB";
const OPEN_ER = "https://open.er-api.com/v6/latest/CNY";
const CACHE_KEY = "moneta-cny-rate";
const STALE_MS = 6 * 60 * 60 * 1000; // 6 часов

export interface RateData {
  rate: number; // сколько ₽ за 1 ¥
  date: string; // дата курса (YYYY-MM-DD)
  source: string;
  fetchedAt: number;
}

export interface RateApi {
  rate: number | null;
  inverse: number | null; // сколько ¥ за 1 ₽
  date: string | null;
  source: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function readCache(): RateData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as RateData;
    if (typeof p.rate !== "number" || p.rate <= 0) return null;
    return p;
  } catch {
    return null;
  }
}

function writeCache(d: RateData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(d));
  } catch {
    /* приватный режим — просто без кэша */
  }
}

async function fetchRate(): Promise<RateData> {
  // 1) Frankfurter — курсы ЕЦБ
  try {
    const res = await fetch(FRANKFURTER);
    if (res.ok) {
      const j = await res.json();
      const rate = j?.rates?.RUB;
      if (typeof rate === "number" && rate > 0) {
        return { rate, date: j.date, source: "ЕЦБ · Frankfurter", fetchedAt: Date.now() };
      }
    }
  } catch {
    /* переходим к запасному */
  }
  // 2) open.er-api.com
  const res = await fetch(OPEN_ER);
  if (!res.ok) throw new Error("rate unavailable");
  const j = await res.json();
  const rate = j?.rates?.RUB;
  if (typeof rate !== "number" || rate <= 0) throw new Error("no rate");
  return { rate, date: new Date().toISOString().slice(0, 10), source: "open.er-api", fetchedAt: Date.now() };
}

const RateContext = createContext<RateApi | null>(null);

export function RateProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<RateData | null>(() => readCache());
  const [loading, setLoading] = useState(() => readCache() === null);
  const [error, setError] = useState<string | null>(null);
  // ref зеркалирует data: решение о showError принимается без сайд-эффектов в апдейтерах
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const load = useCallback(async (silent: boolean) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const d = await fetchRate();
      setData(d);
      writeCache(d);
    } catch {
      // ошибку показываем, только если данных нет вообще (иначе — тихий revalidate).
      // ВАЖНО: никаких setState внутри апдейтер-функций — React исполняет их в render-фазе
      if (!dataRef.current) setError("Не удалось получить курс");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // первичная загрузка: stale-while-revalidate
  useEffect(() => {
    const cached = readCache();
    void load(cached !== null);
  }, [load]);

  // при возвращении на вкладку обновляем, если курс устарел
  useEffect(() => {
    const onFocus = () => {
      const cached = readCache();
      if (!cached || Date.now() - cached.fetchedAt > STALE_MS) void load(true);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const value = useMemo<RateApi>(
    () => ({
      rate: data?.rate ?? null,
      inverse: data?.rate ? 1 / data.rate : null,
      date: data?.date ?? null,
      source: data?.source ?? null,
      loading,
      error,
      refresh: () => void load(false),
    }),
    [data, loading, error, load]
  );

  return <RateContext.Provider value={value}>{children}</RateContext.Provider>;
}

export function useRate(): RateApi {
  const ctx = useContext(RateContext);
  if (!ctx) throw new Error("useRate должен вызываться внутри <RateProvider>");
  return ctx;
}

/** Русская дата курса: «2026-02-06» → «6 февраля» */
export function fmtRateDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  return `${d} ${months[(m ?? 1) - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ""}`;
}
