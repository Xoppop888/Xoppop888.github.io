import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Receipt, Target, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import type { Currency, Totals, View } from "../types";
import { CURRENCIES } from "../types";
import { monthTotals, spentByCategory, useStore } from "../store";
import { MonthSwitcher, Progress } from "../ui";
import { RateCard } from "../components/RateCard";
import { fmtMoney, monthOf, monthShort, shiftMonth, toISO } from "../format";
import { TxRow } from "./Transactions";

const compact = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}к` : String(v));

/** Сумма по валютам: одна строка на каждую активную валюту */
function Dual({ per, sign }: { per: Record<Currency, number>; sign?: boolean }) {
  const active = CURRENCIES.filter((c) => per[c] !== 0);
  if (active.length === 0) return <span className="block truncate">{fmtMoney(0)}</span>;
  return (
    <>
      {active.map((c) => (
        <div key={c} className="truncate">{fmtMoney(per[c], { sign, currency: c })}</div>
      ))}
    </>
  );
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--line-strong)] bg-[var(--surface-2)] px-3 py-2 shadow-xl">
      <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--faint)]">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="num-tab mt-0.5 font-mono text-[13px] font-bold">
          {fmtMoney(p.value, { currency: p.dataKey === "cny" ? "CNY" : "RUB" })}
        </div>
      ))}
    </div>
  );
}

export default function Dashboard({ month, setMonth, go, openAdd }: { month: string; setMonth: (m: string) => void; go: (v: View) => void; openAdd: () => void }) {
  const { state, balances, categoriesById } = useStore();

  const cur = useMemo(() => monthTotals(state, month), [state, month]);
  const prev = useMemo(() => monthTotals(state, shiftMonth(month, -1)), [state, month]);

  const totalPer = useMemo(() => {
    const per: Record<Currency, number> = { RUB: 0, CNY: 0 };
    for (const a of state.accounts) per[a.currency ?? "RUB"] += balances[a.id] ?? 0;
    return per;
  }, [state.accounts, balances]);

  const series = useMemo(() => {
    const curOf: Record<string, Currency> = {};
    for (const a of state.accounts) curOf[a.id] = a.currency ?? "RUB";
    const txs = [...state.transactions].sort((a, b) => (a.date < b.date ? -1 : 1));
    const now = new Date();
    const pts: { label: string; rub: number; cny: number }[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const iso = toISO(d);
      let rub = 0;
      let cny = 0;
      for (const t of txs) {
        if (t.date > iso) break;
        if (t.type === "TRANSFER") continue;
        const c = curOf[t.accountId] ?? "RUB";
        const delta = t.type === "INCOME" ? t.amount : -t.amount;
        if (c === "CNY") cny += delta;
        else rub += delta;
      }
      pts.push({ label: `${d.getDate()} ${monthShort(monthOf(iso))}`, rub, cny });
    }
    return pts;
  }, [state.transactions, state.accounts]);

  const recent = useMemo(
    () =>
      [...state.transactions]
        .filter((t) => monthOf(t.date) === month)
        .sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 7),
    [state.transactions, month]
  );

  const budgetRows = useMemo(
    () =>
      state.budgets
        .filter((b) => b.month === month)
        .map((b) => {
          const spent = spentByCategory(state, month, b.currency ?? "RUB");
          const s = spent[b.categoryId] ?? 0;
          return { b, s, pct: b.limit ? (s / b.limit) * 100 : 0 };
        })
        .sort((x, y) => y.pct - x.pct)
        .slice(0, 4),
    [state, month]
  );

  const hasCny = cur.CNY.income !== 0 || cur.CNY.expense !== 0 || totalPer.CNY !== 0;

  const delta = (a: Totals, b: Totals, key: "income" | "expense"): number | null => {
    if (hasCny) return null; // при двух валютах процент некорректен
    if (b[key] === 0) return null;
    return Math.round(((a[key] - b[key]) / b[key]) * 100);
  };
  const dInc = delta(cur.RUB, prev.RUB, "income");
  const dExp = delta(cur.RUB, prev.RUB, "expense");

  const balanceSeriesEnd = series[series.length - 1] ?? { rub: 0, cny: 0 };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold sm:text-[26px]">Сводка</h1>
          <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Рубли и юани · данные хранятся локально</p>
        </div>
        <MonthSwitcher month={month} onChange={setMonth} />
      </div>

      {/* карточки */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={`Доходы · ${monthShort(month)}`} value={<Dual per={{ RUB: cur.RUB.income, CNY: cur.CNY.income }} sign />} tone="var(--income)" icon={<TrendingUp size={15} />} delta={dInc} goodWhenPositive />
        <StatCard label={`Расходы · ${monthShort(month)}`} value={<Dual per={{ RUB: -cur.RUB.expense, CNY: -cur.CNY.expense }} />} tone="var(--expense)" icon={<TrendingDown size={15} />} delta={dExp} goodWhenPositive={false} />
        <StatCard label="Разница" value={<Dual per={{ RUB: cur.RUB.net, CNY: cur.CNY.net }} sign />} tone={cur.RUB.net + (hasCny ? 0 : cur.CNY.net) >= 0 ? "var(--income)" : "var(--expense)"} icon={cur.RUB.net >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />} />
        <StatCard label="На всех счетах" value={<Dual per={totalPer} />} tone="var(--accent)" icon={<Wallet size={15} />} />
      </div>

      {/* живой курс юаня */}
      <RateCard capitalCny={totalPer.CNY} />

      {/* график баланса */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-display text-[14px] font-semibold">Динамика общего баланса</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--faint)]">последние 90 дней · без переводов</div>
          </div>
          <div className="text-right">
            <div className="num-tab font-mono text-[15px] font-bold" style={{ color: "var(--accent)" }}>{fmtMoney(balanceSeriesEnd.rub)}</div>
            {hasCny && (
              <div className="num-tab font-mono text-[12px] font-bold text-[var(--muted)]">{fmtMoney(balanceSeriesEnd.cny, { currency: "CNY" })}</div>
            )}
          </div>
        </div>
        <div className="h-[220px] sm:h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 6, right: hasCny ? 4 : 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="balFillRub" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="balFillCny" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--income)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--income)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--grid-line)" vertical={false} />
              <XAxis dataKey="label" interval={14} tick={{ fill: "var(--faint)", fontSize: 10.5, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="rub" tickFormatter={compact} tick={{ fill: "var(--faint)", fontSize: 10.5, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} width={40} />
              {hasCny && (
                <YAxis yAxisId="cny" orientation="right" tickFormatter={compact} tick={{ fill: "var(--income)", fontSize: 10.5, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} width={40} />
              )}
              <Tooltip content={<ChartTip />} cursor={{ stroke: "var(--line-strong)" }} />
              <Area yAxisId="rub" dataKey="rub" name="₽" stroke="var(--accent)" strokeWidth={2} fill="url(#balFillRub)" dot={false} activeDot={{ r: 3.5 }} />
              {hasCny && (
                <Area yAxisId="cny" dataKey="cny" name="¥" stroke="var(--income)" strokeWidth={2} fill="url(#balFillCny)" dot={false} activeDot={{ r: 3.5 }} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {hasCny && (
          <div className="mt-2 flex items-center gap-4 font-mono text-[10.5px] text-[var(--muted)]">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} />₽ рубли</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "var(--income)" }} />¥ юани</span>
          </div>
        )}
      </div>

      {/* последние операции + бюджеты */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
            <div className="font-display text-[14px] font-semibold">Последние операции</div>
            <button onClick={() => go("transactions")} className="flex items-center gap-1 font-mono text-[11px] font-semibold text-[var(--accent)] transition-opacity hover:opacity-75">
              все <ArrowRight size={12} />
            </button>
          </div>
          {recent.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Receipt size={22} className="mx-auto text-[var(--faint)]" />
              <p className="mt-2 text-[12.5px] text-[var(--muted)]">В этом месяце операций пока нет</p>
              <button onClick={openAdd} className="mt-3 rounded-lg bg-[var(--accent)] px-4 py-2 text-[12px] font-bold text-[var(--bg)] transition-all hover:brightness-110 active:scale-95">
                Добавить первую
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {recent.map((t) => (
                <li key={t.id}>
                  <TxRow tx={t} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
            <div className="font-display text-[14px] font-semibold">Бюджеты месяца</div>
            <button onClick={() => go("budgets")} className="flex items-center gap-1 font-mono text-[11px] font-semibold text-[var(--accent)] transition-opacity hover:opacity-75">
              все <ArrowRight size={12} />
            </button>
          </div>
          {budgetRows.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Target size={22} className="mx-auto text-[var(--faint)]" />
              <p className="mt-2 text-[12.5px] text-[var(--muted)]">Лимиты на месяц не установлены</p>
              <button onClick={() => go("budgets")} className="mt-3 rounded-lg border border-[var(--accent)] px-4 py-2 text-[12px] font-bold text-[var(--accent)] transition-all hover:bg-[var(--accent-soft)]">
                Настроить
              </button>
            </div>
          ) : (
            <ul className="space-y-3.5 px-4 py-4">
              {budgetRows.map(({ b, s, pct }) => {
                const cat = categoriesById[b.categoryId];
                const color = pct >= 100 ? "var(--expense)" : pct >= 70 ? "var(--warn)" : "var(--income)";
                return (
                  <li key={b.id}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="text-[14px]">{cat?.icon}</span>
                      <span className="truncate text-[12.5px] font-medium">{cat?.name ?? "—"}</span>
                      <span className="rounded border border-[var(--line)] px-1 font-mono text-[9px] text-[var(--faint)]">{(b.currency ?? "RUB") === "CNY" ? "¥" : "₽"}</span>
                      <span className="num-tab ml-auto shrink-0 font-mono text-[11px] text-[var(--muted)]">
                        {fmtMoney(s, { currency: b.currency })} / {fmtMoney(b.limit, { currency: b.currency })}
                      </span>
                    </div>
                    <Progress value={pct} color={color} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone, icon, delta, goodWhenPositive }: { label: string; value: ReactNode; tone: string; icon: ReactNode; delta?: number | null; goodWhenPositive?: boolean }) {
  return (
    <div className="group min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:shadow-[0_16px_36px_-28px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--faint)]">
        {label}
        <span style={{ color: tone }}>{icon}</span>
      </div>
      <div className="num-tab mt-2 font-mono text-[18px] font-bold leading-snug sm:text-[20px]" style={{ color: tone }}>
        {value}
      </div>
      {delta != null && (
        <div className={`mt-1 flex items-center gap-1 font-mono text-[10.5px] ${delta === 0 ? "text-[var(--faint)]" : (delta > 0) === (goodWhenPositive ?? true) ? "text-[var(--income)]" : "text-[var(--expense)]"}`}>
          {delta > 0 ? <ArrowUpRight size={11} /> : delta < 0 ? <ArrowDownRight size={11} /> : null}
          {delta === 0 ? "как в прошлом месяце" : `${Math.abs(delta)}% к прошлому`}
        </div>
      )}
    </div>
  );
}
