import { useMemo, useState } from "react";
import { Check, Pencil, Plus, Target, Trash2, X } from "lucide-react";
import type { Currency } from "../types";
import { CURRENCIES } from "../types";
import { spentByCategory, useStore } from "../store";
import { EmptyState, Modal, Progress, Seg, useToast } from "../ui";
import { currentMonthKey, fmtMoney, monthLabel, parseAmount } from "../format";

export default function Budgets() {
  const { state, categoriesById, api } = useStore();
  const toast = useToast();
  const month = currentMonthKey();
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const spent = useMemo(() => {
    const map: Record<string, Record<string, number>> = { RUB: {}, CNY: {} };
    for (const c of CURRENCIES) map[c] = spentByCategory(state, month, c);
    return map;
  }, [state, month]);

  const rows = useMemo(
    () =>
      state.budgets
        .filter((b) => b.month === month)
        .map((b) => {
          const cur: Currency = b.currency ?? "RUB";
          const s = spent[cur][b.categoryId] ?? 0;
          const pct = b.limit ? (s / b.limit) * 100 : 0;
          const status = pct >= 100 ? "over" : pct >= 70 ? "warn" : "ok";
          return { b, cur, s, pct, status };
        })
        .sort((a, b) => b.pct - a.pct),
    [state.budgets, month, spent]
  );

  const totalPer = useMemo(() => {
    const per: Record<Currency, { limit: number; spent: number }> = { RUB: { limit: 0, spent: 0 }, CNY: { limit: 0, spent: 0 } };
    for (const r of rows) {
      per[r.cur].limit += r.b.limit;
      per[r.cur].spent += r.s;
    }
    return per;
  }, [rows]);

  const saveDraft = (categoryId: string, currency: Currency, existingId?: string) => {
    const limit = parseAmount(draft);
    const res = api.setBudget(categoryId, month, limit, currency);
    if (!res.ok) {
      toast.push(res.error, "err");
      return false;
    }
    toast.push(existingId ? "Лимит обновлён" : "Бюджет установлен", "ok");
    setDraft("");
    setEditingId(null);
    setAddOpen(false);
    return true;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold sm:text-[26px]">Бюджеты</h1>
          <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Лимиты на {monthLabel(month).toLowerCase()} · рубли и юани · траты подкатегорий суммируются в родителя</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[12.5px] font-bold text-[var(--bg)] transition-all hover:brightness-110 active:scale-95">
          <Plus size={14} /> Установить лимит
        </button>
      </div>

      {/* общий прогресс по валютам */}
      {rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {CURRENCIES.filter((c) => totalPer[c].limit > 0).map((c) => {
            const pct = totalPer[c].limit ? (totalPer[c].spent / totalPer[c].limit) * 100 : 0;
            const color = pct >= 100 ? "var(--expense)" : pct >= 70 ? "var(--warn)" : "var(--accent)";
            return (
              <div key={c} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-display text-[14px] font-semibold">{c === "CNY" ? "Юани · всего" : "Рубли · всего"}</div>
                  <div className="num-tab font-mono text-[13px] text-[var(--muted)]">
                    <b className="text-[15px] text-[var(--ink)]">{fmtMoney(totalPer[c].spent, { currency: c })}</b> из {fmtMoney(totalPer[c].limit, { currency: c })} ·{" "}
                    <span style={{ color: pct >= 100 ? "var(--expense)" : pct >= 70 ? "var(--warn)" : "var(--income)" }}>{Math.round(pct)}%</span>
                  </div>
                </div>
                <div className="mt-2.5">
                  <Progress value={pct} color={color} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<Target size={20} />}
          title="Лимитов пока нет"
          text="Установите месячный лимит на категорию — и приложение будет следить за порогом 70% и перерасходом."
          action={
            <button onClick={() => setAddOpen(true)} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-[12px] font-bold text-[var(--bg)] transition-all hover:brightness-110 active:scale-95">
              Установить первый лимит
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map(({ b, cur, s, pct, status }) => {
            const cat = categoriesById[b.categoryId];
            const color = status === "over" ? "var(--expense)" : status === "warn" ? "var(--warn)" : "var(--income)";
            const isEdit = editingId === b.id;
            return (
              <div key={`${b.id}-${cur}`} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--line-strong)]">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl text-[16px]" style={{ background: `${cat?.color ?? "#888"}1c` }}>
                    {cat?.icon ?? "📦"}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-semibold">{cat?.name ?? "—"}</span>
                      <span className="rounded border border-[var(--line)] px-1 font-mono text-[9.5px] font-bold text-[var(--muted)]">{cur === "CNY" ? "¥" : "₽"}</span>
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color }}>
                      {status === "over" ? `перерасход ${fmtMoney(s - b.limit, { currency: cur })}` : status === "warn" ? "порог 70% пройден" : "в норме"}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    {isEdit ? (
                      <>
                        <button
                          onClick={() => saveDraft(b.categoryId, cur, b.id)}
                          aria-label="Сохранить"
                          className="rounded-lg bg-[var(--income)] p-1.5 text-white transition-all hover:brightness-110"
                        >
                          <Check size={13} />
                        </button>
                        <button onClick={() => { setEditingId(null); setDraft(""); }} aria-label="Отмена" className="rounded-lg border border-[var(--line)] p-1.5 text-[var(--muted)]">
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditingId(b.id); setDraft(String(b.limit)); }}
                          aria-label="Изменить лимит"
                          className="rounded-lg p-1.5 text-[var(--faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--accent)]"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => { api.deleteBudget(b.id); toast.push("Бюджет удалён"); }}
                          aria-label="Удалить бюджет"
                          className="rounded-lg p-1.5 text-[var(--faint)] transition-colors hover:bg-[var(--expense-soft)] hover:text-[var(--expense)]"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isEdit ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveDraft(b.categoryId, cur, b.id)}
                    inputMode="decimal"
                    className="num-tab mt-3 w-full rounded-lg border border-[var(--accent)] bg-[var(--surface-2)] px-3 py-2 text-center font-mono text-[16px] font-bold outline-none"
                  />
                ) : (
                  <>
                    <div className="mt-3">
                      <Progress value={pct} color={color} />
                    </div>
                    <div className="num-tab mt-2 flex justify-between font-mono text-[11px] text-[var(--muted)]">
                      <span>потрачено <b className="text-[var(--ink)]">{fmtMoney(s, { currency: cur })}</b></span>
                      <span>лимит <b className="text-[var(--ink)]">{fmtMoney(b.limit, { currency: cur })}</b></span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AddBudgetModal open={addOpen} onClose={() => setAddOpen(false)} month={month} existing={rows.map((r) => r.b.categoryId)} onSave={saveDraft} draft={draft} setDraft={setDraft} />
    </div>
  );
}

function AddBudgetModal({
  open,
  onClose,
  month,
  existing,
  onSave,
  draft,
  setDraft,
}: {
  open: boolean;
  onClose: () => void;
  month: string;
  existing: string[];
  onSave: (categoryId: string, currency: Currency) => boolean;
  draft: string;
  setDraft: (v: string) => void;
}) {
  const { roots, state } = useStore();
  const [catId, setCatId] = useState("");
  const hasCny = state.accounts.some((a) => a.currency === "CNY");
  const [currency, setCurrency] = useState<Currency>("RUB");
  const options = roots("EXPENSE").filter((c) => !existing.includes(c.id));

  return (
    <Modal open={open} onClose={onClose} title={`Лимит на ${monthLabel(month).toLowerCase()}`}>
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Категория</div>
          <div className="flex flex-wrap gap-1.5">
            {options.map((c) => (
              <button
                key={c.id}
                onClick={() => setCatId(c.id)}
                className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all ${
                  catId === c.id ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {c.icon} {c.name}
              </button>
            ))}
            {options.length === 0 && <p className="text-[12px] text-[var(--faint)]">На все корневые категории лимиты уже установлены.</p>}
          </div>
        </div>
        {hasCny && (
          <div>
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Валюта лимита</div>
            <Seg<Currency>
              value={currency}
              onChange={setCurrency}
              options={[
                { v: "RUB", label: "₽ рубли" },
                { v: "CNY", label: "¥ юани" },
              ]}
            />
          </div>
        )}
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Месячный лимит</div>
          <div className="relative">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              inputMode="decimal"
              placeholder={currency === "CNY" ? "3 000" : "30 000"}
              className="num-tab w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-2.5 pr-10 text-center font-mono text-[20px] font-bold outline-none focus:border-[var(--accent)]"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[18px] font-bold text-[var(--faint)]">{currency === "CNY" ? "¥" : "₽"}</span>
          </div>
        </div>
        <button
          onClick={() => catId && onSave(catId, currency)}
          disabled={!catId}
          className="w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[13px] font-bold text-[var(--bg)] transition-all enabled:hover:brightness-110 enabled:active:scale-[0.98] disabled:opacity-40"
        >
          Установить
        </button>
      </div>
    </Modal>
  );
}
