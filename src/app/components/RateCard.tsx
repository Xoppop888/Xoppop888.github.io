import { RefreshCw, TrendingDown, TrendingUp, WifiOff } from "lucide-react";
import { fmtRateDate, useRate } from "../rate";
import { fmtMoney } from "../format";

const nf2 = (n: number) =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const nf4 = (n: number) =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(n);

/** Полоса курса юаня для дашборда. capitalCny — юаневый капитал для пересчёта в ₽. */
export function RateCard({ capitalCny }: { capitalCny?: number }) {
  const { rate, inverse, date, source, loading, error, refresh } = useRate();

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      {/* лёгкий фоновый градиент-акцент */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-full opacity-[0.06]"
        style={{ background: "linear-gradient(100deg, var(--accent) 0%, transparent 55%)" }}
      />
      <div className="relative flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5 sm:px-5">
        {/* бейдж ¥ */}
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] font-display text-[17px] font-bold text-[var(--accent)]">
          ¥
        </span>

        <div className="min-w-[130px]">
          <div className="flex items-center gap-1.5">
            <span className="font-display text-[13px] font-semibold">Курс юаня</span>
            {/* живой индикатор */}
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                error ? "bg-[var(--expense)]" : loading ? "pulse-dot bg-[var(--warn)]" : "pulse-dot bg-[var(--income)]"
              }`}
            />
          </div>
          <div className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
            {error ? "нет соединения" : date ? `${source} · ${fmtRateDate(date)}` : "…"}
          </div>
        </div>

        {/* основное значение */}
        <div className="flex items-baseline gap-2">
          {loading && !rate ? (
            <span className="h-7 w-32 animate-pulse rounded-md bg-[var(--surface-2)]" />
          ) : rate ? (
            <>
              <span className="font-mono text-[11px] text-[var(--muted)]">1 ¥ =</span>
              <span className="num-tab font-display text-[24px] font-bold leading-none text-[var(--accent)]">{nf2(rate)} ₽</span>
            </>
          ) : (
            <span className="font-mono text-[12px] text-[var(--expense)]">—</span>
          )}
        </div>

        {/* обратный курс */}
        {inverse && (
          <div className="hidden items-center gap-1.5 sm:flex">
            <TrendingDown size={12} className="text-[var(--faint)]" />
            <span className="num-tab font-mono text-[11.5px] text-[var(--muted)]">1 ₽ = {nf4(inverse)} ¥</span>
          </div>
        )}

        {/* пересчёт капитала */}
        {rate && capitalCny != null && capitalCny !== 0 && (
          <div className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1.5">
            <TrendingUp size={12} className="text-[var(--accent)]" />
            <span className="font-mono text-[10.5px] text-[var(--muted)]">юаневый капитал ≈</span>
            <span className="num-tab font-mono text-[12px] font-bold text-[var(--ink)]">{fmtMoney(capitalCny * rate)}</span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {error && !rate && (
            <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-[var(--expense)]">
              <WifiOff size={12} /> офлайн
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            aria-label="Обновить курс"
            title="Обновить курс"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--muted)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] active:scale-90 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Компактный чип курса для сайдбара. По клику — обновление. */
export function RateChip() {
  const { rate, date, loading, error, refresh } = useRate();

  return (
    <button
      onClick={refresh}
      disabled={loading}
      title={error ? "Ошибка — нажмите, чтобы повторить" : date ? `Курс на ${fmtRateDate(date)} · обновить` : "Обновить курс"}
      className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-left transition-all hover:border-[var(--accent)] disabled:opacity-60"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] font-display text-[12px] font-bold text-[var(--accent)]">
        ¥
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--faint)]">курс ¥→₽</span>
        {loading && !rate ? (
          <span className="mt-1 block h-3.5 w-14 animate-pulse rounded bg-[var(--surface-2)]" />
        ) : rate ? (
          <span className="num-tab block font-mono text-[12.5px] font-bold leading-tight text-[var(--ink)]">{nf2(rate)} ₽</span>
        ) : (
          <span className="block font-mono text-[11px] text-[var(--expense)]">офлайн</span>
        )}
      </span>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${error ? "bg-[var(--expense)]" : loading ? "pulse-dot bg-[var(--warn)]" : "pulse-dot bg-[var(--income)]"}`} />
    </button>
  );
}
