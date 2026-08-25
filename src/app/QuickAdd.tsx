import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { Transaction, TxInput, TxType } from "./types";
import { CURRENCY_META } from "./types";
import { useStore } from "./store";
import { Modal, Seg, useToast } from "./ui";
import { fmtMoney, parseAmount, todayISO } from "./format";

export default function QuickAdd({
  open,
  onClose,
  editTx,
}: {
  open: boolean;
  onClose: () => void;
  editTx: Transaction | null;
}) {
  const { state, balances, accountsById, categoriesById, childrenOf, roots, api } = useStore();
  const toast = useToast();

  const [type, setType] = useState<TxType>(editTx?.type ?? "EXPENSE");
  const [amount, setAmount] = useState(editTx ? String(editTx.amount) : "");
  const [accountId, setAccountId] = useState(editTx?.accountId ?? state.accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(editTx?.toAccountId ?? state.accounts[1]?.id ?? "");
  const [categoryId, setCategoryId] = useState(editTx?.categoryId ?? "");
  const [date, setDate] = useState(editTx?.date ?? todayISO());
  const [note, setNote] = useState(editTx?.note ?? "");
  const [err, setErr] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) window.setTimeout(() => amountRef.current?.focus(), 60);
  }, [open]);

  // при смене типа сбрасываем неподходящую категорию
  useEffect(() => setCategoryId(""), [type]);

  // получатель перевода должен отличаться от источника и совпадать по валюте
  const toOptions = state.accounts.filter((a) => a.id !== accountId && a.currency === accountsById[accountId]?.currency);
  useEffect(() => {
    if (type !== "TRANSFER") return;
    if (!toOptions.some((a) => a.id === toAccountId)) {
      setToAccountId(toOptions[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, accountId]);

  // клавиши 1/2/3 — вкладки (только вне полей ввода)
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "1") setType("EXPENSE");
      if (e.key === "2") setType("INCOME");
      if (e.key === "3") setType("TRANSFER");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  const cats = useMemo(() => roots(type === "INCOME" ? "INCOME" : "EXPENSE"), [roots, type]);

  const submit = () => {
    const amt = parseAmount(amount);
    const input: TxInput = {
      type,
      amount: amt,
      accountId,
      toAccountId: type === "TRANSFER" ? toAccountId : null,
      categoryId: type === "TRANSFER" ? null : categoryId || null,
      note: note.trim() || null,
      date,
    };
    const res = editTx ? api.updateTransaction(editTx.id, input) : api.addTransaction(input);
    if (!res.ok) {
      setErr(res.error);
      try { navigator.vibrate?.(60); } catch { /* нет вибро */ }
      return;
    }
    try { navigator.vibrate?.(12); } catch { /* нет вибро */ }
    toast.push(editTx ? "Операция обновлена" : type === "TRANSFER" ? "Перевод выполнен" : type === "INCOME" ? "Доход добавлен" : "Расход добавлен", "ok");
    onClose();
  };

  const acc = accountsById[accountId];
  const previewBalance = acc ? balances[acc.id] : 0;

  return (
    <Modal open={open} onClose={onClose} title={editTx ? "Редактировать операцию" : "Новая операция"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <Seg<TxType>
          value={type}
          onChange={(t) => {
            setType(t);
            setErr(null);
          }}
          options={[
            { v: "EXPENSE", label: "Расход · 1" },
            { v: "INCOME", label: "Доход · 2" },
            { v: "TRANSFER", label: "Перевод · 3" },
          ]}
        />

        {/* сумма */}
        <div>
          <div className="relative">
            <input
              ref={amountRef}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setErr(null);
              }}
              inputMode="decimal"
              placeholder="0"
              aria-label="Сумма"
              className={`num-tab w-full rounded-xl border bg-[var(--surface-2)] px-4 py-3 text-center font-mono text-[26px] font-bold outline-none transition-colors placeholder:text-[var(--faint)] ${
                err ? "border-[var(--expense)]" : "border-[var(--line)] focus:border-[var(--accent)]"
              }`}
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[20px] font-bold text-[var(--faint)]">
              {CURRENCY_META[acc?.currency ?? "RUB"].symbol}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between font-mono text-[10.5px] text-[var(--faint)]">
            <span>
              {type === "TRANSFER" ? "со счёта" : "на счёте"} {acc?.name ?? "—"}:{" "}
              <b className={previewBalance < 0 ? "text-[var(--expense)]" : "text-[var(--muted)]"}>{fmtMoney(previewBalance, { currency: acc?.currency })}</b>
            </span>
            <span>Enter — сохранить</span>
          </div>
        </div>

        {/* счета */}
        <div className="space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">
            {type === "INCOME" ? "Счёт зачисления" : "Счёт списания"}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {state.accounts.map((a) => (
              <button
                type="button"
                key={a.id}
                onClick={() => {
                  setAccountId(a.id);
                  setErr(null);
                }}
                className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all ${
                  accountId === a.id
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]"
                }`}
              >
                <span className="mr-1 font-mono text-[10px] font-bold opacity-70">{CURRENCY_META[a.currency ?? "RUB"].symbol}</span>
                {a.name}
                <span className="num-tab ml-1.5 font-mono text-[10.5px] text-[var(--faint)]">{fmtMoney(balances[a.id], { currency: a.currency })}</span>
              </button>
            ))}
          </div>

          {type === "TRANSFER" && (
            <>
              <div className="flex items-center gap-2 pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">
                <ArrowRight size={12} /> Счёт получателя · только в {CURRENCY_META[acc?.currency ?? "RUB"].symbol}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {toOptions.map((a) => (
                  <button
                    type="button"
                    key={a.id}
                    onClick={() => {
                      setToAccountId(a.id);
                      setErr(null);
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all ${
                      toAccountId === a.id
                        ? "border-[var(--transfer)] bg-[var(--transfer-soft)] text-[var(--transfer)]"
                        : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
                {toOptions.length === 0 && (
                  <span className="text-[11.5px] text-[var(--faint)]">Нет второго счёта в этой валюте — создайте его во вкладке «Счета»</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* категории */}
        {type !== "TRANSFER" && (
          <div className="space-y-2.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Категория</div>
            <div className="max-h-[220px] space-y-2.5 overflow-y-auto pr-1">
              {cats.map((root) => {
                const kids = childrenOf(root.id);
                return (
                  <div key={root.id}>
                    <div className="mb-1 flex items-center gap-1.5 font-mono text-[10.5px] text-[var(--muted)]">
                      <span>{root.icon}</span> {root.name}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {kids.length === 0 && (
                        <CatChip active={categoryId === root.id} color={root.color} label={root.name} onClick={() => { setCategoryId(root.id); setErr(null); }} />
                      )}
                      {kids.map((k) => (
                        <CatChip key={k.id} active={categoryId === k.id} color={k.color} label={k.name} onClick={() => { setCategoryId(k.id); setErr(null); }} />
                      ))}
                    </div>
                  </div>
                );
              })}
              {cats.length === 0 && (
                <p className="text-[12px] text-[var(--faint)]">Нет категорий этого типа — создайте их во вкладке «Категории».</p>
              )}
            </div>
          </div>
        )}

        {/* дата + заметка */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Дата</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 font-mono text-[12px] outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Заметка</div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="необязательно"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-[12px] outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {err && (
          <div className="animate-toast rounded-lg border border-[var(--expense)]/50 bg-[var(--expense-soft)] px-3 py-2 text-[12px] font-medium text-[var(--expense)]">
            {err}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-[13px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
          >
            Отмена
          </button>
          <button
            type="submit"
            className="flex-1 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[13px] font-bold text-[var(--bg)] transition-all hover:brightness-110 active:scale-[0.98]"
          >
            {editTx ? "Сохранить" : "Провести"}
            {(() => {
              const amt = parseAmount(amount);
              return Number.isFinite(amt) && amt > 0 ? ` · ${fmtMoney(amt)}` : "";
            })()}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CatChip({ active, color, label, onClick }: { active: boolean; color: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-all ${
        active ? "text-[var(--ink)]" : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--line-strong)] hover:text-[var(--ink)]"
      }`}
      style={active ? { borderColor: color, background: `${color}1f`, boxShadow: `inset 0 0 0 1px ${color}` } : undefined}
    >
      {label}
    </button>
  );
}
