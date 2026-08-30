import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import type {
  Account, AppState, Budget, Category, CategoryType, Currency, Totals, Transaction, TxInput,
} from "./types";
import { buildEmptyState, buildSeedState } from "./seed";
import { uid } from "./format";

export type Result = { ok: true } | { ok: false; error: string };
const ok: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });

const KEY = "moneta:v2";

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      return {
        accounts: (parsed.accounts ?? []).map((a) => ({ ...a, currency: a.currency ?? "RUB" })),
        categories: parsed.categories ?? [],
        transactions: parsed.transactions ?? [],
        budgets: (parsed.budgets ?? []).map((b) => ({ ...b, currency: b.currency ?? "RUB" })),
      };
    }
  } catch {
    /* повреждённые данные — начинаем с демо */
  }
  return buildSeedState();
}

type Action =
  | { type: "ADD_TX"; tx: Transaction }
  | { type: "UPDATE_TX"; tx: Transaction }
  | { type: "DELETE_TX"; id: string }
  | { type: "ADD_ACCOUNT"; acc: Account }
  | { type: "UPDATE_ACCOUNT"; acc: Account }
  | { type: "DELETE_ACCOUNT"; id: string }
  | { type: "ADD_CATEGORY"; cat: Category }
  | { type: "UPDATE_CATEGORY"; cat: Category }
  | { type: "DELETE_CATEGORY"; id: string }
  | { type: "SET_BUDGET"; budget: Budget }
  | { type: "DELETE_BUDGET"; id: string }
  | { type: "RESET"; state: AppState };

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case "ADD_TX":
      return { ...s, transactions: [...s.transactions, a.tx] };
    case "UPDATE_TX":
      return { ...s, transactions: s.transactions.map((t) => (t.id === a.tx.id ? a.tx : t)) };
    case "DELETE_TX":
      return { ...s, transactions: s.transactions.filter((t) => t.id !== a.id) };
    case "ADD_ACCOUNT":
      return { ...s, accounts: [...s.accounts, a.acc] };
    case "UPDATE_ACCOUNT":
      return { ...s, accounts: s.accounts.map((x) => (x.id === a.acc.id ? a.acc : x)) };
    case "DELETE_ACCOUNT":
      return {
        ...s,
        accounts: s.accounts.filter((x) => x.id !== a.id),
        transactions: s.transactions.filter((t) => t.accountId !== a.id && t.toAccountId !== a.id),
      };
    case "ADD_CATEGORY":
      return { ...s, categories: [...s.categories, a.cat] };
    case "UPDATE_CATEGORY":
      return { ...s, categories: s.categories.map((c) => (c.id === a.cat.id ? a.cat : c)) };
    case "DELETE_CATEGORY":
      return {
        ...s,
        categories: s.categories.filter((c) => c.id !== a.id),
        transactions: s.transactions.map((t) => (t.categoryId === a.id ? { ...t, categoryId: null } : t)),
        budgets: s.budgets.filter((b) => b.categoryId !== a.id),
      };
    case "SET_BUDGET": {
      const exists = s.budgets.some((b) => b.categoryId === a.budget.categoryId && b.month === a.budget.month);
      return {
        ...s,
        budgets: exists
          ? s.budgets.map((b) => (b.categoryId === a.budget.categoryId && b.month === a.budget.month ? a.budget : b))
          : [...s.budgets, a.budget],
      };
    }
    case "DELETE_BUDGET":
      return { ...s, budgets: s.budgets.filter((b) => b.id !== a.id) };
    case "RESET":
      return a.state;
  }
}

/* ── производные данные ── */

export function balancesOf(state: AppState): Record<string, number> {
  const map: Record<string, number> = {};
  for (const a of state.accounts) map[a.id] = 0;
  for (const t of state.transactions) {
    if (t.type === "INCOME") map[t.accountId] = (map[t.accountId] ?? 0) + t.amount;
    else if (t.type === "EXPENSE") map[t.accountId] = (map[t.accountId] ?? 0) - t.amount;
    else if (t.type === "TRANSFER") {
      map[t.accountId] = (map[t.accountId] ?? 0) - t.amount; // списываем с источника
      if (t.toAccountId) map[t.toAccountId] = (map[t.toAccountId] ?? 0) + t.amount; // зачисляем получателю
    }
  }
  return map;
}

export const emptyTotals = (): Totals => ({ income: 0, expense: 0, net: 0, transfers: 0 });

export function monthTotals(state: AppState, month: string): Record<Currency, Totals> {
  const curOf: Record<string, Currency> = {};
  for (const a of state.accounts) curOf[a.id] = a.currency ?? "RUB";
  const res: Record<Currency, Totals> = { RUB: emptyTotals(), CNY: emptyTotals() };
  for (const t of state.transactions) {
    if (!t.date.startsWith(month)) continue;
    const cur = curOf[t.accountId] ?? "RUB";
    const acc = res[cur];
    if (t.type === "INCOME") acc.income += t.amount;
    else if (t.type === "EXPENSE") acc.expense += t.amount;
    else acc.transfers += t.amount;
  }
  res.RUB.net = res.RUB.income - res.RUB.expense;
  res.CNY.net = res.CNY.income - res.CNY.expense;
  return res;
}

export function spentByCategory(state: AppState, month: string, currency?: Currency): Record<string, number> {
  const curOf: Record<string, Currency> = {};
  for (const a of state.accounts) curOf[a.id] = a.currency ?? "RUB";
  const map: Record<string, number> = {};
  for (const t of state.transactions) {
    if (t.type !== "EXPENSE" || !t.date.startsWith(month) || !t.categoryId) continue;
    if (currency && (curOf[t.accountId] ?? "RUB") !== currency) continue;
    map[t.categoryId] = (map[t.categoryId] ?? 0) + t.amount;
  }
  return map;
}

export function txCurrency(state: AppState, accountId: string): Currency {
  return state.accounts.find((a) => a.id === accountId)?.currency ?? "RUB";
}

interface Ctx {
  state: AppState;
  balances: Record<string, number>;
  accountsById: Record<string, Account>;
  categoriesById: Record<string, Category>;
  childrenOf: (id: string) => Category[];
  roots: (type: CategoryType) => Category[];
  api: {
    addTransaction: (input: TxInput) => Result;
    updateTransaction: (id: string, input: TxInput) => Result;
    deleteTransaction: (id: string) => Result;
    addAccount: (a: Omit<Account, "id">) => Result;
    updateAccount: (a: Account) => Result;
    deleteAccount: (id: string) => Result;
    addCategory: (c: Omit<Category, "id">) => Result;
    updateCategory: (c: Category) => Result;
    deleteCategory: (id: string) => Result;
    setBudget: (categoryId: string, month: string, limit: number, currency: Currency) => Result;
    deleteBudget: (id: string) => Result;
    resetDemo: () => void;
    resetEmpty: () => void;
    exportJSON: () => string;
    importJSON: (text: string) => Result;
  };
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* квота — игнорируем */
    }
  }, [state]);

  const balances = useMemo(() => balancesOf(state), [state]);
  const accountsById = useMemo(() => Object.fromEntries(state.accounts.map((a) => [a.id, a])), [state.accounts]);
  const categoriesById = useMemo(() => Object.fromEntries(state.categories.map((c) => [c.id, c])), [state.categories]);
  const childrenOf = useMemo(
    () => (id: string) => state.categories.filter((c) => c.parentId === id),
    [state.categories]
  );
  const roots = useMemo(
    () => (type: CategoryType) => state.categories.filter((c) => c.type === type && !c.parentId),
    [state.categories]
  );

  const api = useMemo<Ctx["api"]>(() => {
    const accOf = (id: string) => state.accounts.find((a) => a.id === id);

    return {
      addTransaction(input) {
        if (!Number.isFinite(input.amount) || input.amount <= 0) return fail("Введите сумму больше нуля");
        const from = accOf(input.accountId);
        if (!from) return fail("Выберите счёт");
        if (input.type === "TRANSFER") {
          const to = accOf(input.toAccountId ?? "");
          if (!to || to.id === from.id) return fail("Выберите счёт получателя");
          if (to.currency !== from.currency) return fail("Перевод между счетами в разных валютах недоступен");
        }
        if (input.type !== "TRANSFER") {
          const cat = input.categoryId ? state.categories.find((c) => c.id === input.categoryId) : null;
          if (input.categoryId && !cat) return fail("Выберите категорию");
          if (cat && cat.type !== (input.type === "INCOME" ? "INCOME" : "EXPENSE")) return fail("Категория не подходит по типу");
        }
        if (input.type === "EXPENSE" && from.type === "CREDIT" && from.creditLimit != null) {
          const bal = balances[from.id] ?? 0;
          const avail = bal >= 0 ? bal + from.creditLimit : from.creditLimit + bal;
          if (input.amount > avail)
            return fail(`Превышен кредитный лимит: доступно ${Math.round(avail).toLocaleString("ru-RU")}`);
        }
        const tx: Transaction = {
          id: uid(),
          type: input.type,
          amount: input.amount,
          accountId: input.accountId,
          toAccountId: input.type === "TRANSFER" ? input.toAccountId : null,
          categoryId: input.type === "TRANSFER" ? null : input.categoryId,
          note: input.note,
          date: input.date,
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: "ADD_TX", tx });
        return ok;
      },

      updateTransaction(id, input) {
        if (!Number.isFinite(input.amount) || input.amount <= 0) return fail("Введите сумму больше нуля");
        const from = accOf(input.accountId);
        if (!from) return fail("Выберите счёт");
        if (input.type === "TRANSFER") {
          const to = accOf(input.toAccountId ?? "");
          if (!to || to.id === from.id) return fail("Выберите счёт получателя");
          if (to.currency !== from.currency) return fail("Перевод между счетами в разных валютах недоступен");
        }
        const tx: Transaction = {
          id,
          type: input.type,
          amount: input.amount,
          accountId: input.accountId,
          toAccountId: input.type === "TRANSFER" ? input.toAccountId : null,
          categoryId: input.type === "TRANSFER" ? null : input.categoryId,
          note: input.note,
          date: input.date,
          createdAt: state.transactions.find((t) => t.id === id)?.createdAt ?? new Date().toISOString(),
        };
        dispatch({ type: "UPDATE_TX", tx });
        return ok;
      },

      deleteTransaction(id) {
        dispatch({ type: "DELETE_TX", id });
        return ok;
      },

      addAccount(a) {
        if (!a.name.trim()) return fail("Укажите название счёта");
        if (a.type === "CREDIT" && (a.creditLimit == null || a.creditLimit <= 0))
          return fail("Для кредитки нужен лимит больше нуля");
        dispatch({ type: "ADD_ACCOUNT", acc: { ...a, id: uid() } });
        return ok;
      },

      updateAccount(a) {
        dispatch({ type: "UPDATE_ACCOUNT", acc: a });
        return ok;
      },

      deleteAccount(id) {
        const used = state.transactions.some((t) => t.accountId === id || t.toAccountId === id);
        if (used) return fail("Нельзя удалить счёт с операциями — сначала удалите их в журнале");
        dispatch({ type: "DELETE_ACCOUNT", id });
        return ok;
      },

      addCategory(c) {
        if (!c.name.trim()) return fail("Укажите название");
        dispatch({ type: "ADD_CATEGORY", cat: { ...c, id: uid() } });
        return ok;
      },

      updateCategory(c) {
        dispatch({ type: "UPDATE_CATEGORY", cat: c });
        return ok;
      },

      deleteCategory(id) {
        const used = state.transactions.some((t) => t.categoryId === id);
        if (used) return fail("Категория используется в операциях — удалите или перенесите их");
        dispatch({ type: "DELETE_CATEGORY", id });
        return ok;
      },

      setBudget(categoryId, month, limit, currency) {
        if (!Number.isFinite(limit) || limit <= 0) return fail("Лимит должен быть больше нуля");
        const existing = state.budgets.find((b) => b.categoryId === categoryId && b.month === month);
        dispatch({
          type: "SET_BUDGET",
          budget: { id: existing?.id ?? uid(), categoryId, month, limit, currency },
        });
        return ok;
      },

      deleteBudget(id) {
        dispatch({ type: "DELETE_BUDGET", id });
        return ok;
      },

      resetDemo() {
        dispatch({ type: "RESET", state: buildSeedState() });
      },

      resetEmpty() {
        dispatch({ type: "RESET", state: buildEmptyState() });
      },

      exportJSON() {
        return JSON.stringify(
          { app: "moneta", version: 2, exportedAt: new Date().toISOString(), state },
          null,
          2
        );
      },

      importJSON(text) {
        try {
          const parsed = JSON.parse(text) as { app?: string; state?: Partial<AppState> };
          const raw = parsed.state ?? (parsed as Partial<AppState>);
          if (!raw || !Array.isArray(raw.accounts) || !Array.isArray(raw.categories) || !Array.isArray(raw.transactions)) {
            return fail("Файл не похож на копию «Монеты»");
          }
          const restored: AppState = {
            accounts: raw.accounts.map((a) => ({ ...a, currency: a.currency ?? "RUB" })),
            categories: raw.categories,
            transactions: raw.transactions,
            budgets: (raw.budgets ?? []).map((b) => ({ ...b, currency: b.currency ?? "RUB" })),
          };
          if (restored.accounts.length === 0) return fail("В копии нет ни одного счёта");
          dispatch({ type: "RESET", state: restored });
          return ok;
        } catch {
          return fail("Не удалось прочитать файл — это не JSON-копия");
        }
      },
    };
  }, [state, balances]);

  const value = useMemo<Ctx>(
    () => ({ state, balances, accountsById, categoriesById, childrenOf, roots, api }),
    [state, balances, accountsById, categoriesById, childrenOf, roots, api]
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore вне StoreProvider");
  return ctx;
}
