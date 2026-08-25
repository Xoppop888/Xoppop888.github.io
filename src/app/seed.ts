import type { Account, AppState, Budget, Category, Currency, Transaction, TxType } from "./types";
import { currentMonthKey, pad } from "./format";

export const SEED_ACCOUNTS: Account[] = [
  { id: "acc-cash", name: "Наличные", type: "CASH", currency: "RUB" },
  { id: "acc-debit", name: "T‑Bank Black", type: "BANK", currency: "RUB" },
  { id: "acc-sber", name: "Сбер · дебет", type: "BANK", currency: "RUB" },
  { id: "acc-credit", name: "T‑Bank Platinum", type: "CREDIT", currency: "RUB", creditLimit: 120000 },
  { id: "acc-cny", name: "WeChat Pay", type: "BANK", currency: "CNY" },
  { id: "acc-cny-cash", name: "Наличные юани", type: "CASH", currency: "CNY" },
];

export const SEED_CATEGORIES: Category[] = [
  // ── расходы: корни ──
  { id: "c-food", name: "Еда", type: "EXPENSE", parentId: null, icon: "🍽️", color: "#E8A33D" },
  { id: "c-trans", name: "Транспорт", type: "EXPENSE", parentId: null, icon: "🚌", color: "#5B8DEF" },
  { id: "c-home", name: "Жильё и связь", type: "EXPENSE", parentId: null, icon: "🏠", color: "#9A7BD4" },
  { id: "c-health", name: "Здоровье и спорт", type: "EXPENSE", parentId: null, icon: "💪", color: "#EF6A85" },
  { id: "c-fun", name: "Развлечения", type: "EXPENSE", parentId: null, icon: "🎬", color: "#45C4A0" },
  { id: "c-cloth", name: "Одежда и обувь", type: "EXPENSE", parentId: null, icon: "👟", color: "#E07856" },
  { id: "c-shop", name: "Покупки", type: "EXPENSE", parentId: null, icon: "🛍️", color: "#3E9DC4" },
  { id: "c-other", name: "Прочее", type: "EXPENSE", parentId: null, icon: "📦", color: "#8A94A6" },
  // ── расходы: дети ──
  { id: "c-groc", name: "Продукты", type: "EXPENSE", parentId: "c-food", icon: "🛒", color: "#E8A33D" },
  { id: "c-cafe", name: "Кафе и рестораны", type: "EXPENSE", parentId: "c-food", icon: "☕", color: "#D98E2B" },
  { id: "c-deliv", name: "Доставка еды", type: "EXPENSE", parentId: "c-food", icon: "🛵", color: "#C77F22" },
  { id: "c-taxi", name: "Такси", type: "EXPENSE", parentId: "c-trans", icon: "🚕", color: "#5B8DEF" },
  { id: "c-metro", name: "Метро и автобус", type: "EXPENSE", parentId: "c-trans", icon: "🚇", color: "#4A7BD8" },
  { id: "c-fuel", name: "Бензин", type: "EXPENSE", parentId: "c-trans", icon: "⛽", color: "#3F6BC0" },
  { id: "c-rent", name: "Аренда", type: "EXPENSE", parentId: "c-home", icon: "🔑", color: "#9A7BD4" },
  { id: "c-util", name: "Коммуналка", type: "EXPENSE", parentId: "c-home", icon: "💡", color: "#8A68C6" },
  { id: "c-net", name: "Интернет и связь", type: "EXPENSE", parentId: "c-home", icon: "📶", color: "#7A57B5" },
  { id: "c-pharm", name: "Аптека", type: "EXPENSE", parentId: "c-health", icon: "💊", color: "#EF6A85" },
  { id: "c-gym", name: "Спортзал", type: "EXPENSE", parentId: "c-health", icon: "🏋️", color: "#E05573" },
  { id: "c-sub", name: "Подписки", type: "EXPENSE", parentId: "c-fun", icon: "📱", color: "#45C4A0" },
  { id: "c-cinema", name: "Кино и концерты", type: "EXPENSE", parentId: "c-fun", icon: "🎟️", color: "#35B28E" },
  { id: "c-games", name: "Игры", type: "EXPENSE", parentId: "c-fun", icon: "🎮", color: "#2AA07F" },
  { id: "c-market", name: "Маркетплейсы", type: "EXPENSE", parentId: "c-shop", icon: "📦", color: "#3E9DC4" },
  // ── доходы ──
  { id: "c-salary", name: "Зарплата", type: "INCOME", parentId: null, icon: "💼", color: "#2FA36B" },
  { id: "c-free", name: "Фриланс", type: "INCOME", parentId: null, icon: "💻", color: "#3E9DC4" },
  { id: "c-int", name: "Проценты по вкладам", type: "INCOME", parentId: null, icon: "📈", color: "#6FAF5E" },
  { id: "c-giftin", name: "Подарки и переводы", type: "INCOME", parentId: null, icon: "🎁", color: "#D97BA6" },
];

function buildSeedTransactions(): Transaction[] {
  const out: Transaction[] = [];
  const now = new Date();
  let seq = 0;

  const push = (
    mOff: number,
    day: number,
    type: TxType,
    amount: number,
    accountId: string,
    categoryId: string | null,
    toAccountId: string | null = null,
    note: string | null = null
  ) => {
    const base = new Date(now.getFullYear(), now.getMonth() + mOff, 1);
    const dim = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    if (day > dim) return;
    if (mOff === 0 && day > now.getDate()) return;
    const iso = `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(day)}`;
    out.push({
      id: `seed-${++seq}`,
      type,
      amount,
      accountId,
      categoryId,
      toAccountId,
      note,
      date: iso,
      createdAt: `${iso}T12:00:00.000Z`,
    });
  };

  const grocDays = [4, 8, 12, 16, 20, 24, 27];
  const grocAmt = [3240, 1870, 4120, 2350, 2980, 3610, 1540];
  const grocAcc = ["acc-debit", "acc-debit", "acc-credit", "acc-cash", "acc-debit", "acc-sber", "acc-credit"];
  const grocNote = ["Пятёрочка", "ВкусВилл", "Лента", "Магнит", "Перекрёсток", "Пятёрочка", "Азбука Вкуса"];

  for (let m = -2; m <= 0; m++) {
    // ── рубли: доходы и база ──
    push(m, 1, "INCOME", 145000, "acc-debit", "c-salary", null, "Зарплата");
    if (m === -2) push(m, 12, "INCOME", 18500, "acc-sber", "c-free", null, "Проект: лендинг");
    if (m === -1) push(m, 14, "INCOME", 24000, "acc-sber", "c-free", null, "Консультации");
    if (m === -1) push(m, 28, "INCOME", 1320, "acc-sber", "c-int", null, "Проценты по накопительному");
    if (m === -2) push(m, 23, "INCOME", 5000, "acc-cash", "c-giftin", null, "День рождения");

    push(m, 2, "EXPENSE", 45000, "acc-debit", "c-rent", null, "Аренда квартиры");
    push(m, 7, "EXPENSE", 5900 + (m + 2) * 140, "acc-debit", "c-util", null, "ЖКУ");
    push(m, 8, "EXPENSE", 950, "acc-debit", "c-net", null, "Ростелеком");
    push(m, 3, "TRANSFER", 8000, "acc-debit", null, "acc-cash", "Наличные на неделю");

    grocDays.forEach((d, i) => push(m, d, "EXPENSE", grocAmt[i], grocAcc[i], "c-groc", null, grocNote[i]));
    push(m, 6, "EXPENSE", 1180, "acc-debit", "c-cafe", null, "Кофемания");
    push(m, 13, "EXPENSE", 2340, "acc-credit", "c-cafe", null, "Шоколадница");
    push(m, 21, "EXPENSE", 890, "acc-debit", "c-cafe", null, "Surf Coffee");
    push(m, 9, "EXPENSE", 1340, "acc-credit", "c-deliv", null, "Самокат");
    push(m, 23, "EXPENSE", 1890, "acc-credit", "c-deliv", null, "Яндекс Еда");
    push(m, 5, "EXPENSE", 640, "acc-debit", "c-taxi", null, "Яндекс Такси");
    push(m, 19, "EXPENSE", 820, "acc-cash", "c-taxi", null, "Такси");
    push(m, 10, "EXPENSE", 1200, "acc-cash", "c-metro", null, "Тройка, пополнение");
    push(m, 15, "EXPENSE", 799, "acc-debit", "c-sub", null, "Яндекс Плюс");
    push(m, 17, "EXPENSE", 399, "acc-debit", "c-sub", null, "Telegram Premium");
    push(m, 21, "EXPENSE", 1450, "acc-debit", "c-cinema", null, "Кинотеатр «Октябрь»");
    push(m, 5, "EXPENSE", 3490, "acc-debit", "c-gym", null, "World Class");
    if (m === -2) push(m, 11, "EXPENSE", 860, "acc-cash", "c-pharm", null, "Аптека.ру");
    if (m === -1) push(m, 26, "EXPENSE", 1240, "acc-debit", "c-pharm", null, "Горздрав");
    if (m === -1) push(m, 22, "EXPENSE", 3100, "acc-debit", "c-fuel", null, "Лукойл");
    if (m === -2) push(m, 18, "EXPENSE", 7990, "acc-debit", "c-cloth", null, "Uniqlo");
    if (m === -1) push(m, 9, "EXPENSE", 12490, "acc-credit", "c-cloth", null, "Lamoda");
    if (m === -1) push(m, 20, "EXPENSE", 2999, "acc-debit", "c-games", null, "Steam");
    if (m === -2) push(m, 25, "EXPENSE", 2100, "acc-cash", "c-other", null, "Хозтовары");
    if (m === 0) push(m, 11, "EXPENSE", 1650, "acc-debit", "c-other", null, "Канцелярия");

    // ── юани ──
    if (m === -2) push(m, 3, "INCOME", 8000, "acc-cny", "c-giftin", null, "Перевод на юаневый кошелёк");
    if (m === -1) push(m, 25, "INCOME", 3000, "acc-cny", "c-free", null, "Проект для китайского клиента");
    if (m === -1) push(m, 26, "INCOME", 2000, "acc-cny-cash", "c-giftin", null, "Возврат долга");

    push(m, 6, "EXPENSE", 88, "acc-cny", "c-cafe", null, "Luckin Coffee");
    push(m, 14, "EXPENSE", 96, "acc-cny", "c-cafe", null, "Starbucks · Шанхай");
    push(m, 15, "EXPENSE", 1280 + (m + 2) * 60, "acc-cny", "c-market", null, "Taobao");
    push(m, 21, "EXPENSE", 350, "acc-cny", "c-cafe", null, "Ужин, Haidilao");
    push(m, 5, "EXPENSE", 68, "acc-cny-cash", "c-metro", null, "Метро · Гуанчжоу");
    push(m, 12, "EXPENSE", 980, "acc-cny", "c-cafe", null, "Dianping · ресторан");
    push(m, 19, "EXPENSE", 560, "acc-cny", "c-groc", null, "Продукты, Hema Fresh");
    if (m !== 0) push(m, 24, "EXPENSE", 2400, "acc-cny", "c-market", null, "JD.com");
    if (m === 0) push(m, 9, "EXPENSE", 1680, "acc-cny", "c-cloth", null, "Uniqlo · ЦУМ Шанхай");
    push(m, 17, "TRANSFER", 500, "acc-cny", null, "acc-cny-cash", "Наличные на мелкие траты");
  }

  return out;
}

function buildSeedBudgets(): Budget[] {
  const m = currentMonthKey();
  const rows: [string, number, Currency][] = [
    ["c-food", 40000, "RUB"],
    ["c-trans", 15000, "RUB"],
    ["c-home", 55000, "RUB"],
    ["c-health", 8000, "RUB"],
    ["c-fun", 12000, "RUB"],
    ["c-cloth", 15000, "RUB"],
    ["c-shop", 5000, "CNY"],
    ["c-food", 3000, "CNY"],
  ];
  return rows.map(([categoryId, limit, currency], i) => ({ id: `bud-${i + 1}`, categoryId, month: m, limit, currency }));
}

export function buildSeedState(): AppState {
  return {
    accounts: SEED_ACCOUNTS,
    categories: SEED_CATEGORIES,
    transactions: buildSeedTransactions(),
    budgets: buildSeedBudgets(),
  };
}

export function buildEmptyState(): AppState {
  return {
    accounts: [
      { id: "acc-cash", name: "Наличные", type: "CASH", currency: "RUB" },
      { id: "acc-card", name: "Моя карта", type: "BANK", currency: "RUB" },
      { id: "acc-cny", name: "Юаневый кошелёк", type: "BANK", currency: "CNY" },
    ],
    categories: SEED_CATEGORIES,
    transactions: [],
    budgets: [],
  };
}
