import { useMemo, useState } from "react";
import { ArrowRightLeft, Pencil, Search, Trash2 } from "lucide-react";
import type { Currency, Transaction, TxType } from "../types";
import { CURRENCIES, CURRENCY_META } from "../types";
import { useStore } from "../store";
import { EmptyState, useToast } from "../ui";
import { fmtDay, fmtMoney, labelForDay, monthOf } from "../format";

const TYPE_CHIPS: { v: "ALL" | TxType; label: string }[] = [
  { v: "ALL", label: "Все" },
  { v: "EXPENSE", label: "Расходы" },
  { v: "INCOME", label: "Доходы" },
  { v: "TRANSFER", label: "Переводы" },
];

export function amountColor(t: TxType) {
  return t === "INCOME" ? "var(--income)" : t === "EXPENSE" ? "var(--expense)" : "var(--transfer)";
}

export function txTitle(tx: Transaction, categoriesById: Record<string, { name: string }>, accountsById: Record<string, { name: string }>) {
  if (tx.type === "TRANSFER") {
    const from = accountsById[tx.accountId]?.name ?? "—";
    const to = tx.toAccountId ? accountsById[tx.toAccountId]?.name ?? "—" : "—";
    return `${from} → ${to}`;
  }
  return tx.categoryId ? categoriesById[tx.categoryId]?.name ?? "Без категории" : "Без категории";
}

/* строка операции — переиспользуется в Сводке; рендерит div, обёртку <li> делает вызывающий */
export function TxRow({ tx }: { tx: Transaction }) {
  const { categoriesById, accountsById } = useStore();
  const cat = tx.categoryId ? categoriesById[tx.categoryId] : null;
  const title = txTitle(tx, categoriesById, accountsById);
  const sign = tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "−" : "";

  return (
    <div className="flex items-center gap-3 py-2.5 pl-4 pr-4 transition-colors hover:bg-[var(--surface-2)]">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[16px]"
        style={{ background: `${cat?.color ?? "var(--transfer)"}1c` }}
      >
        {tx.type === "TRANSFER" ? <ArrowRightLeft size={15} className="text-[var(--transfer)]" /> : cat?.icon ?? "•"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium">{title}</div>
        <div className="truncate font-mono text-[10.5px] text-[var(--faint)]">
          {tx.note ? `${tx.note} · ` : ""}
          {accountsById[tx.accountId]?.name ?? "—"}
          {tx.type !== "TRANSFER" && cat ? ` · ${fmtDay(tx.date)}` : ""}
        </div>
      </div>
      <span className="num-tab shrink-0 font-mono text-[13px] font-bold" style={{ color: amountColor(tx.type) }}>
        {sign}
        {fmtMoney(tx.amount, { currency: accountsById[tx.accountId]?.currency })}
      </span>
    </div>
  );
}

export default function Transactions({ openAdd, openEdit }: { openAdd: () => void; openEdit: (tx: Transaction) => void }) {
  const { state, api } = useStore();
  const toast = useToast();
  const [type, setType] = useState<"ALL" | TxType>("ALL");
  const [accountId, setAccountId] = useState("ALL");
  const [q, setQ] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const months = useMemo(() => {
    const set = new Set(state.transactions.map((t) => monthOf(t.date)));
    return [...set].sort().reverse();
  }, [state.transactions]);
  const [month, setMonth] = useState("ALL");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return state.transactions
      .filter((t) => {
        if (type !== "ALL" && t.type !== type) return false;
        if (accountId !== "ALL" && t.accountId !== accountId && t.toAccountId !== accountId) return false;
        if (month !== "ALL" && monthOf(t.date) !== month) return false;
        if (query) {
          const cat = t.categoryId ? state.categories.find((c) => c.id === t.categoryId)?.name ?? "" : "";
          const hay = `${t.note ?? ""} ${cat} ${state.accounts.find((a) => a.id === t.accountId)?.name ?? ""}`.toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : a.createdAt < b.createdAt ? 1 : -1));
  }, [state, type, accountId, month, q]);

  const groups = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    filtered.forEach((t) => {
      const arr = m.get(t.date) ?? [];
      arr.push(t);
      m.set(t.date, arr);
    });
    return [...m.entries()];
  }, [filtered]);

  const totals = useMemo(() => {
    const cur = (t: Transaction) => state.accounts.find((a) => a.id === t.accountId)?.currency ?? "RUB";
    const per: Record<Currency, { inc: number; exp: number }> = { RUB: { inc: 0, exp: 0 }, CNY: { inc: 0, exp: 0 } };
    filtered.forEach((t) => {
      if (t.type === "INCOME") per[cur(t)].inc += t.amount;
      else if (t.type === "EXPENSE") per[cur(t)].exp += t.amount;
    });
    return per;
  }, [filtered, state.accounts]);

  const totalsLabel = useMemo(() => {
    const parts: string[] = [];
    for (const c of CURRENCIES) {
      const t = totals[c];
      if (t.inc === 0 && t.exp === 0) continue;
      parts.push(`${CURRENCY_META[c].symbol} +${new Intl.NumberFormat("ru-RU").format(t.inc)} / −${new Intl.NumberFormat("ru-RU").format(t.exp)}`);
    }
    return parts.join(" · ");
  }, [totals]);

  const del = (id: string) => {
    api.deleteTransaction(id);
    toast.push("Операция удалена, балансы пересчитаны", "ok");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold sm:text-[26px]">Операции</h1>
          <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">
            {filtered.length ? `${filtered.length} шт · доходы / расходы: ${totalsLabel || "—"}` : "журнал всех операций"}
          </p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[12.5px] font-bold text-[var(--bg)] transition-all hover:brightness-110 active:scale-95">
          Добавить <kbd className="rounded border border-[var(--bg)]/30 px-1 font-mono text-[10px]">N</kbd>
        </button>
      </div>

      {/* фильтры */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1">
          {TYPE_CHIPS.map((c) => (
            <button
              key={c.v}
              onClick={() => setType(c.v)}
              className={`rounded-lg px-3 py-1.5 text-[11.5px] font-semibold transition-all ${
                type === c.v ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-mono text-[11.5px] text-[var(--ink)] outline-none focus:border-[var(--accent)]"
        >
          <option value="ALL">Все месяцы</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 font-mono text-[11.5px] text-[var(--ink)] outline-none focus:border-[var(--accent)]"
        >
          <option value="ALL">Все счета</option>
          {state.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <div className="relative min-w-[160px] flex-1 sm:max-w-[220px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск…"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] py-2 pl-9 pr-3 text-[12px] outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {/* журнал */}
      {groups.length === 0 ? (
        <EmptyState
          icon={<Search size={20} />}
          title="Ничего не нашлось"
          text="Под выбранные фильтры не попала ни одна операция. Попробуйте сбросить поиск или выбрать другой месяц."
        />
      ) : (
        <div className="space-y-4">
          {groups.map(([day, txs]) => {
            const cur = (t: Transaction) => state.accounts.find((a) => a.id === t.accountId)?.currency ?? "RUB";
            const dayPer: Record<Currency, number> = { RUB: 0, CNY: 0 };
            txs.forEach((t) => {
              if (t.type === "INCOME") dayPer[cur(t)] += t.amount;
              else if (t.type === "EXPENSE") dayPer[cur(t)] -= t.amount;
            });
            return (
              <div key={day} className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface-2)] px-4 py-2">
                  <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{labelForDay(day)}</span>
                  <span className="flex items-center gap-3">
                    {CURRENCIES.filter((c) => dayPer[c] !== 0).map((c) => (
                      <span key={c} className="num-tab font-mono text-[11px] font-bold" style={{ color: dayPer[c] > 0 ? "var(--income)" : "var(--expense)" }}>
                        {fmtMoney(dayPer[c], { sign: true, currency: c })}
                      </span>
                    ))}
                  </span>
                </div>
                <ul className="divide-y divide-[var(--line)]">
                  {txs.map((t) => (
                    <li key={t.id} className="group/row relative pr-16">
                      <TxRow tx={t} />
                      <div className="absolute right-1.5 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/row:opacity-100">
                        {confirmId === t.id ? (
                          <>
                            <button
                              onClick={() => del(t.id)}
                              className="rounded-lg bg-[var(--expense)] px-2.5 py-1.5 font-mono text-[10.5px] font-bold text-white transition-all hover:brightness-110"
                            >
                              удалить
                            </button>
                            <button
                              onClick={() => setConfirmId(null)}
                              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 font-mono text-[10.5px] text-[var(--muted)]"
                            >
                              отмена
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => openEdit(t)}
                              aria-label="Редактировать"
                              className="rounded-lg bg-[var(--surface)] p-1.5 text-[var(--faint)] transition-colors hover:text-[var(--accent)]"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => setConfirmId(t.id)}
                              aria-label="Удалить"
                              className="rounded-lg p-1.5 text-[var(--faint)] transition-colors hover:bg-[var(--expense-soft)] hover:text-[var(--expense)]"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
