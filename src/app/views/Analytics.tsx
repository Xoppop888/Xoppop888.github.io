import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import type { Category, Currency } from "../types";
import { monthTotals, txCurrency, useStore } from "../store";
import { EmptyState, MonthSwitcher, Progress, Seg } from "../ui";
import { currentMonthKey, fmtMoney, monthLabel, monthShort, shiftMonth } from "../format";

const compact = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}к` : String(v));

function BarTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--line-strong)] bg-[var(--surface-2)] px-3 py-2 shadow-xl">
      <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--faint)]">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="num-tab mt-0.5 flex items-center gap-2 font-mono text-[12px]">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.fill }} />
          {p.name}: <b>{fmtMoney(p.value)}</b>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const { state, categoriesById } = useStore();
  const [month, setMonth] = useState(currentMonthKey());

  const hasCny = useMemo(() => state.transactions.some((t) => txCurrency(state, t.accountId) === "CNY"), [state]);
  const [currency, setCurrency] = useState<Currency>("RUB");

  const donut = useMemo(() => {
    const byCat: Record<string, number> = {};
    for (const t of state.transactions) {
      if (t.type !== "EXPENSE" || !t.date.startsWith(month) || !t.categoryId) continue;
      if (txCurrency(state, t.accountId) !== currency) continue;
      byCat[t.categoryId] = (byCat[t.categoryId] ?? 0) + t.amount;
    }
    const rows = Object.entries(byCat)
      .map(([id, value]) => ({ id, value, cat: categoriesById[id] }))
      .filter((r) => r.cat)
      .sort((a, b) => b.value - a.value);
    const top = rows.slice(0, 6);
    const rest = rows.slice(6).reduce((s, r) => s + r.value, 0);
    const data = top.map((r) => ({ name: r.cat!.name, value: r.value, color: r.cat!.color, icon: r.cat!.icon }));
    if (rest > 0) data.push({ name: "Прочее", value: rest, color: "var(--line-strong)", icon: "📦" });
    return data;
  }, [state, month, categoriesById, currency]);

  const catTotal = donut.reduce((s, d) => s + d.value, 0);
  const [active, setActive] = useState<number | null>(null);

  const monthsSeries = useMemo(() => {
    const out: { m: string; Доходы: number; Расходы: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const key = shiftMonth(month, -i);
      const t = monthTotals(state, key)[currency];
      out.push({ m: monthShort(key), Доходы: t.income, Расходы: t.expense });
    }
    return out;
  }, [state, month, currency]);

  const topRoots = useMemo(() => {
    const byRoot: Record<string, number> = {};
    for (const t of state.transactions) {
      if (t.type !== "EXPENSE" || !t.date.startsWith(month) || !t.categoryId) continue;
      if (txCurrency(state, t.accountId) !== currency) continue;
      let id: string | null = t.categoryId;
      while (id) {
        const c: Category | undefined = categoriesById[id];
        if (!c) break;
        if (!c.parentId) byRoot[id] = (byRoot[id] ?? 0) + t.amount;
        id = c.parentId;
      }
    }
    const rows = Object.entries(byRoot)
      .map(([id, value]) => ({ id, value, cat: categoriesById[id] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
    const max = rows[0]?.value ?? 1;
    return rows.map((r) => ({ ...r, pct: (r.value / max) * 100 }));
  }, [state, month, categoriesById, currency]);

  const hovered = active != null ? donut[active] : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold sm:text-[26px]">Аналитика</h1>
          <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Структура расходов за {monthLabel(month).toLowerCase()}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasCny && (
            <Seg<Currency>
              value={currency}
              onChange={(c) => { setCurrency(c); setActive(null); }}
              options={[
                { v: "RUB", label: "₽ рубли" },
                { v: "CNY", label: "¥ юани" },
              ]}
            />
          )}
          <MonthSwitcher month={month} onChange={(m) => { setMonth(m); setActive(null); }} />
        </div>
      </div>

      {catTotal === 0 ? (
        <EmptyState icon={<PieIcon size={20} />} title={`Расходов в ${currency === "CNY" ? "юанях" : "рублях"} за этот месяц нет`} text="Добавьте операции — и здесь появится структура трат по категориям." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          {/* пончик */}
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
            <div className="font-display text-[14px] font-semibold">Расходы по категориям</div>
            <div className="relative mx-auto mt-2 h-[240px] max-w-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donut}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="64%"
                    outerRadius="92%"
                    paddingAngle={2}
                    strokeWidth={0}
                    onMouseEnter={(_, i) => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                  >
                    {donut.map((d, i) => (
                      <Cell key={i} fill={d.color} opacity={active == null || active === i ? 1 : 0.35} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active: a, payload }) => {
                      if (!a || !payload?.length) return null;
                      const p = payload[0].payload as (typeof donut)[number];
                      return (
                        <div className="rounded-lg border border-[var(--line-strong)] bg-[var(--surface-2)] px-3 py-2 shadow-xl">
                          <div className="text-[12px] font-semibold">{p.icon} {p.name}</div>
                          <div className="num-tab font-mono text-[12px] text-[var(--muted)]">
                            {fmtMoney(p.value, { currency })} · {Math.round((p.value / catTotal) * 100)}%
                          </div>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="num-tab font-mono text-[19px] font-bold leading-none">{fmtMoney(hovered ? hovered.value : catTotal, { currency })}</div>
                <div className="mt-1 max-w-[120px] font-mono text-[9.5px] uppercase leading-relaxed tracking-wider text-[var(--faint)]">
                  {hovered ? `${hovered.name} · ${Math.round((hovered.value / catTotal) * 100)}%` : "всего за месяц"}
                </div>
              </div>
            </div>
            <ul className="mt-3 space-y-1">
              {donut.map((d, i) => (
                <li
                  key={d.name}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  className={`flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${active === i ? "bg-[var(--surface-2)]" : ""}`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
                  <span className="truncate text-[12.5px]">{d.icon} {d.name}</span>
                  <span className="num-tab ml-auto font-mono text-[11.5px] text-[var(--faint)]">{Math.round((d.value / catTotal) * 100)}%</span>
                  <span className="num-tab w-[92px] text-right font-mono text-[12px] font-semibold">{fmtMoney(d.value, { currency })}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* топ корневых категорий */}
          <div className="flex flex-col rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
            <div className="font-display text-[14px] font-semibold">Крупнейшие направления</div>
            <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">подкатегории свёрнуты в родительские</p>
            <ul className="mt-4 flex-1 space-y-4">
              {topRoots.map((r) => (
                <li key={r.id}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-[15px]">{r.cat.icon}</span>
                    <span className="text-[12.5px] font-medium">{r.cat.name}</span>
                    <span className="num-tab ml-auto font-mono text-[12px] font-bold">{fmtMoney(r.value, { currency })}</span>
                  </div>
                  <Progress value={r.pct} color={r.cat.color} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* гистограмма по месяцам */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-display text-[14px] font-semibold">Доходы и расходы по месяцам</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--faint)]">полгода назад → сегодня · {currency === "CNY" ? "юани" : "рубли"}</div>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px] text-[var(--muted)]">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--income)]" /> доходы</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--expense)]" /> расходы</span>
          </div>
        </div>
        <div className="mt-3 h-[220px] sm:h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthsSeries} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={3}>
              <CartesianGrid stroke="var(--grid-line)" vertical={false} />
              <XAxis dataKey="m" tick={{ fill: "var(--faint)", fontSize: 11, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={compact} tick={{ fill: "var(--faint)", fontSize: 10.5, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<BarTip />} cursor={{ fill: "var(--grid-line)" }} />
              <Bar dataKey="Доходы" fill="var(--income)" radius={[4, 4, 0, 0]} maxBarSize={26} />
              <Bar dataKey="Расходы" fill="var(--expense)" radius={[4, 4, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
