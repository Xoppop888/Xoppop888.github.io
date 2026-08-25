import type { Currency } from "./types";
import { CURRENCY_META } from "./types";

export const uid = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const MONTHS_NOM = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

export const pad = (n: number) => String(n).padStart(2, "0");

export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayISO = () => toISO(new Date());

export function fmtMoney(n: number, opts: { sign?: boolean; kopecks?: boolean; currency?: Currency } = {}) {
  const cur: Currency = opts.currency ?? "RUB";
  const symbol = CURRENCY_META[cur].symbol;
  const abs = Math.abs(n);
  const base = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: opts.kopecks ? 2 : 0,
    maximumFractionDigits: opts.kopecks ? 2 : 0,
  }).format(abs);
  const sign = n < 0 ? "−" : opts.sign ? "+" : "";
  return `${sign}${base} ${symbol}`;
}

export const symbolOf = (cur: Currency) => CURRENCY_META[cur].symbol;

export function parseAmount(s: string): number {
  const n = parseFloat(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

const dOf = (iso: string) => new Date(`${iso}T00:00:00`);

export function fmtDay(iso: string) {
  const d = dOf(iso);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

export function fmtDayFull(iso: string) {
  const d = dOf(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

export function labelForDay(iso: string) {
  const t = todayISO();
  if (iso === t) return "Сегодня";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (iso === toISO(y)) return "Вчера";
  return fmtDayFull(iso);
}

export const monthOf = (iso: string) => iso.slice(0, 7);

export const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_NOM[(m ?? 1) - 1]} ${y}`;
}

export function monthShort(key: string) {
  const [, m] = key.split("-").map(Number);
  return MONTHS_SHORT[(m ?? 1) - 1];
}

export function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
