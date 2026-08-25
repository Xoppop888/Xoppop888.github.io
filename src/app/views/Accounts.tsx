import { useMemo, useState } from "react";
import { Banknote, CreditCard, Landmark, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import type { Account, AccountType, Currency } from "../types";
import { CURRENCIES, CURRENCY_META } from "../types";
import { useStore } from "../store";
import { Modal, Progress, Seg, useToast } from "../ui";
import { fmtMoney, parseAmount } from "../format";
import { useRate } from "../rate";

const TYPE_LABEL: Record<AccountType, string> = { CASH: "наличные", BANK: "банковская карта", CREDIT: "кредитная карта" };

const AccountIcon = ({ type }: { type: AccountType }) =>
  type === "CASH" ? <Banknote size={16} /> : type === "BANK" ? <Landmark size={16} /> : <CreditCard size={16} />;

export default function Accounts() {
  const { state, balances, api } = useStore();
  const toast = useToast();
  const { rate } = useRate();
  const [modal, setModal] = useState<{ mode: "add" } | { mode: "edit"; acc: Account } | null>(null);

  const totalPer = useMemo(() => {
    const per: Record<Currency, number> = { RUB: 0, CNY: 0 };
    for (const a of state.accounts) per[a.currency ?? "RUB"] += balances[a.id] ?? 0;
    return per;
  }, [state.accounts, balances]);

  const creditRows = useMemo(
    () =>
      state.accounts
        .filter((a) => a.type === "CREDIT" && a.creditLimit)
        .map((a) => ({ a, used: Math.max(0, -(balances[a.id] ?? 0)), limit: a.creditLimit! })),
    [state.accounts, balances]
  );

  const remove = (a: Account) => {
    const res = api.deleteAccount(a.id);
    if (!res.ok) {
      toast.push(res.error, "err");
      return;
    }
    toast.push(`Счёт «${a.name}» удалён`, "ok");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold sm:text-[26px]">Счета</h1>
          <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">
            {state.accounts.length} шт · наличные, карты и кредитки · ₽ и ¥
          </p>
        </div>
        <button onClick={() => setModal({ mode: "add" })} className="flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[12.5px] font-bold text-[var(--bg)] transition-all hover:brightness-110 active:scale-95">
          <Plus size={14} /> Новый счёт
        </button>
      </div>

      {/* капитал */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-5 py-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Общий капитал</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
            {CURRENCIES.filter((c) => totalPer[c] !== 0 || c === "RUB").map((c) => (
              <span key={c} className={`num-tab font-mono text-[24px] font-bold ${c === "RUB" ? "text-[var(--accent)]" : "text-[var(--transfer)]"}`}>
                {fmtMoney(totalPer[c], { currency: c })}
              </span>
            ))}
          </div>
          {rate != null && totalPer.CNY !== 0 && (
            <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[11px] text-[var(--muted)]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--income)]" />
              всего в рублях ≈{" "}
              <b className="num-tab text-[12.5px] font-bold text-[var(--ink)]">{fmtMoney(totalPer.RUB + totalPer.CNY * rate)}</b>
              <span className="text-[var(--faint)]">· по курсу {rate.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽</span>
            </div>
          )}
        </div>
        {creditRows.map(({ a, used, limit }) => (
          <div key={a.id}>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Кредитные средства · {a.name}</div>
            <div className="num-tab mt-1 font-mono text-[24px] font-bold text-[var(--expense)]">
              {fmtMoney(used, { currency: a.currency })} <span className="text-[13px] text-[var(--faint)]">/ {fmtMoney(limit, { currency: a.currency })}</span>
            </div>
          </div>
        ))}
      </div>

      {/* карточки счетов */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {state.accounts.map((a) => {
          const cur = a.currency ?? "RUB";
          const bal = balances[a.id] ?? 0;
          const isCredit = a.type === "CREDIT" && a.creditLimit != null;
          const used = isCredit ? Math.max(0, -bal) : 0;
          const avail = isCredit ? bal + a.creditLimit! : bal;
          const usedPct = isCredit && a.creditLimit ? (used / a.creditLimit) * 100 : 0;
          const txCount = state.transactions.filter((t) => t.accountId === a.id || t.toAccountId === a.id).length;
          return (
            <div key={a.id} className="group relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:shadow-[0_18px_40px_-30px_rgba(0,0,0,0.6)]">
              <div className="flex items-center gap-2.5">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${isCredit ? "bg-[var(--expense-soft)] text-[var(--expense)]" : a.type === "CASH" ? "bg-[var(--warn-soft)] text-[var(--warn)]" : "bg-[var(--accent-soft)] text-[var(--accent)]"}`}>
                  <AccountIcon type={a.type} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13.5px] font-semibold">{a.name}</span>
                    <span className="rounded border border-[var(--line)] px-1 font-mono text-[9.5px] font-bold text-[var(--muted)]">{CURRENCY_META[cur].symbol}</span>
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--faint)]">{TYPE_LABEL[a.type]}</div>
                </div>
                <div className="ml-auto flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  <button onClick={() => setModal({ mode: "edit", acc: a })} aria-label="Изменить" className="rounded-lg p-1.5 text-[var(--faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--accent)]">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => remove(a)} aria-label="Удалить" className="rounded-lg p-1.5 text-[var(--faint)] transition-colors hover:bg-[var(--expense-soft)] hover:text-[var(--expense)]">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className={`num-tab mt-3 font-mono text-[21px] font-bold ${bal < 0 ? "text-[var(--expense)]" : "text-[var(--ink)]"}`}>{fmtMoney(bal, { currency: cur })}</div>

              {isCredit ? (
                <div className="mt-2.5">
                  <Progress value={usedPct} color={usedPct >= 90 ? "var(--expense)" : usedPct >= 60 ? "var(--warn)" : "var(--transfer)"} />
                  <div className="num-tab mt-1.5 flex justify-between font-mono text-[10.5px] text-[var(--muted)]">
                    <span>доступно {fmtMoney(Math.max(0, avail), { currency: cur })}</span>
                    <span>лимит {fmtMoney(a.creditLimit!, { currency: cur })}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-1.5 font-mono text-[10.5px] text-[var(--faint)]">{txCount} операций</div>
              )}
            </div>
          );
        })}

        {/* карточка-приглашение */}
        <button onClick={() => setModal({ mode: "add" })} className="flex min-h-[130px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--line-strong)] text-[var(--faint)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]">
          <Wallet size={20} />
          <span className="text-[12px] font-semibold">Добавить счёт</span>
        </button>
      </div>

      {modal && <AccountModal mode={modal.mode} acc={modal.mode === "edit" ? modal.acc : null} onClose={() => setModal(null)} />}
    </div>
  );
}

function AccountModal({ mode, acc, onClose }: { mode: "add" | "edit"; acc: Account | null; onClose: () => void }) {
  const { api } = useStore();
  const toast = useToast();
  const [name, setName] = useState(acc?.name ?? "");
  const [type, setType] = useState<AccountType>(acc?.type ?? "BANK");
  const [currency, setCurrency] = useState<Currency>(acc?.currency ?? "RUB");
  const [limit, setLimit] = useState(acc?.creditLimit ? String(acc.creditLimit) : "");
  const [err, setErr] = useState<string | null>(null);

  const save = () => {
    const creditLimit = type === "CREDIT" ? parseAmount(limit) : null;
    if (mode === "add") {
      const limitVal = creditLimit != null && Number.isFinite(creditLimit) ? creditLimit : undefined;
      const res = api.addAccount({ name: name.trim(), type, currency, creditLimit: limitVal });
      if (!res.ok) return setErr(res.error);
      toast.push("Счёт создан", "ok");
    } else if (acc) {
      const limitVal = creditLimit != null && Number.isFinite(creditLimit) ? creditLimit : undefined;
      api.updateAccount({ ...acc, name: name.trim() || acc.name, type, currency, creditLimit: limitVal });
      toast.push("Счёт обновлён", "ok");
    }
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={mode === "add" ? "Новый счёт" : "Изменить счёт"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-4"
      >
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Название</div>
          <input
            autoFocus
            value={name}
            onChange={(e) => { setName(e.target.value); setErr(null); }}
            placeholder={currency === "CNY" ? "Например, «Alipay»" : "Например, «Карта МИР»"}
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-[13px] outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Тип</div>
          <Seg<AccountType>
            value={type}
            onChange={setType}
            options={[
              { v: "CASH", label: "Наличные" },
              { v: "BANK", label: "Карта" },
              { v: "CREDIT", label: "Кредитка" },
            ]}
          />
        </div>
        <div>
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Валюта</div>
          <Seg<Currency>
            value={currency}
            onChange={setCurrency}
            options={CURRENCIES.map((c) => ({ v: c, label: `${CURRENCY_META[c].symbol} ${CURRENCY_META[c].label.toLowerCase()}` }))}
          />
        </div>
        {type === "CREDIT" && (
          <div>
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Кредитный лимит</div>
            <div className="relative">
              <input
                value={limit}
                onChange={(e) => { setLimit(e.target.value); setErr(null); }}
                inputMode="decimal"
                placeholder={currency === "CNY" ? "20 000" : "120 000"}
                className="num-tab w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 pr-10 text-center font-mono text-[16px] font-bold outline-none focus:border-[var(--accent)]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[15px] font-bold text-[var(--faint)]">{CURRENCY_META[currency].symbol}</span>
            </div>
          </div>
        )}
        {err && <div className="animate-toast rounded-lg border border-[var(--expense)]/50 bg-[var(--expense-soft)] px-3 py-2 text-[12px] font-medium text-[var(--expense)]">{err}</div>}
        <button type="submit" className="w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[13px] font-bold text-[var(--bg)] transition-all hover:brightness-110 active:scale-[0.98]">
          {mode === "add" ? "Создать счёт" : "Сохранить"}
        </button>
      </form>
    </Modal>
  );
}
