-- ═══════════════════════════════════════════════════════════════
-- Монета — схема Supabase (Postgres)
-- Выполнить целиком в Supabase → SQL Editor → New query → Run.
-- Идемпотентна: можно запускать повторно, ничего не задвоит.
-- ═══════════════════════════════════════════════════════════════

-- профиль пользователя: расширяет встроенную auth.users полем is_pro
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_pro boolean not null default false,
  created_at timestamptz not null default now()
);

-- автосоздание профиля при регистрации нового пользователя
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── счета ──
create table if not exists public.accounts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('CASH', 'BANK', 'CREDIT')),
  currency text not null check (currency in ('RUB', 'CNY')),
  credit_limit numeric,
  updated_at timestamptz not null default now()
);

-- ── категории ──
create table if not exists public.categories (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('INCOME', 'EXPENSE')),
  parent_id text references public.categories(id) on delete cascade,
  icon text not null,
  color text not null,
  updated_at timestamptz not null default now()
);

-- ── операции ──
create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('INCOME', 'EXPENSE', 'TRANSFER')),
  amount numeric not null check (amount > 0),
  account_id text not null references public.accounts(id) on delete cascade,
  to_account_id text references public.accounts(id) on delete set null,
  category_id text references public.categories(id) on delete set null,
  note text,
  date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── бюджеты ──
create table if not exists public.budgets (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id text not null references public.categories(id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  "limit" numeric not null check ("limit" > 0),
  currency text not null check (currency in ('RUB', 'CNY')),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id, month, currency)
);

-- ── платежи (лог для сверки с ЮKassa; is_pro в profiles — источник истины) ──
create table if not exists public.payments (
  id text primary key, -- id платежа из ЮKassa
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null,
  amount numeric not null,
  currency text not null default 'RUB',
  created_at timestamptz not null default now()
);

-- индексы для быстрых выборок "мои данные"
create index if not exists idx_accounts_user on public.accounts(user_id);
create index if not exists idx_categories_user on public.categories(user_id);
create index if not exists idx_transactions_user on public.transactions(user_id);
create index if not exists idx_transactions_user_date on public.transactions(user_id, date);
create index if not exists idx_budgets_user on public.budgets(user_id);
create index if not exists idx_payments_user on public.payments(user_id);

-- ═══════════════════════════════════════════════════════════════
-- Row-Level Security — каждый видит и меняет только свои данные.
-- Без этого API Supabase отдавало бы данные ВСЕХ пользователей всем.
-- ═══════════════════════════════════════════════════════════════

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.payments enable row level security;

drop policy if exists "profiles: select own" on public.profiles;
create policy "profiles: select own" on public.profiles for select using (auth.uid() = id);
-- обновлять свой профиль пользователь не может напрямую (is_pro меняет только сервер по webhook'у ЮKassa)

drop policy if exists "accounts: all own" on public.accounts;
create policy "accounts: all own" on public.accounts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "categories: all own" on public.categories;
create policy "categories: all own" on public.categories for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "transactions: all own" on public.transactions;
create policy "transactions: all own" on public.transactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "budgets: all own" on public.budgets;
create policy "budgets: all own" on public.budgets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "payments: select own" on public.payments;
create policy "payments: select own" on public.payments for select using (auth.uid() = user_id);
-- вставляют платежи только Edge Functions через service_role ключ (в обход RLS) — из клиента запись запрещена
