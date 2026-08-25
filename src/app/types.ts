export type View = "dashboard" | "transactions" | "analytics" | "budgets" | "accounts" | "categories";

export type Currency = "RUB" | "CNY";

export const CURRENCIES: Currency[] = ["RUB", "CNY"];

export const CURRENCY_META: Record<Currency, { symbol: string; label: string; hint: string }> = {
  RUB: { symbol: "₽", label: "Рубли", hint: "₽" },
  CNY: { symbol: "¥", label: "Юани", hint: "¥" },
};

export type AccountType = "CASH" | "BANK" | "CREDIT";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  creditLimit?: number; // только для CREDIT
}

export type TxType = "INCOME" | "EXPENSE" | "TRANSFER";

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  accountId: string; // источник (для перевода — from)
  toAccountId?: string | null; // для перевода
  categoryId: string | null;
  note?: string | null;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export type CategoryType = "INCOME" | "EXPENSE";

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  parentId: string | null;
  icon: string;
  color: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  month: string; // YYYY-MM
  limit: number;
  currency: Currency;
}

export interface AppState {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
}

export interface Totals {
  income: number;
  expense: number;
  net: number;
  transfers: number;
}

export interface TxInput {
  type: TxType;
  amount: number;
  accountId: string;
  toAccountId?: string | null;
  categoryId: string | null;
  note?: string | null;
  date: string;
}
