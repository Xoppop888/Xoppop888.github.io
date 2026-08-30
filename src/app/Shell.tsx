import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Banknote,
  Database,
  Download,
  LayoutDashboard,
  Moon,
  PieChart,
  Plus,
  RotateCcw,
  Save,
  Sun,
  Tags,
  Target,
  Upload,
  UserCircle2,
  WifiOff,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Transaction, View } from "./types";
import { useStore } from "./store";
import { useInstallPrompt, useOnline, useTheme } from "../lib/hooks";
import { RateProvider } from "./rate";
import { RateChip } from "./components/RateCard";
import InstallGuide from "./components/InstallGuide";
import { Modal, ToastProvider, useToast } from "./ui";
import { AuthModal, AuthProvider, authConfigured, useAuth } from "./auth";
import QuickAdd from "./QuickAdd";
import Dashboard from "./views/Dashboard";
import Transactions from "./views/Transactions";
import Analytics from "./views/Analytics";
import Budgets from "./views/Budgets";
import Accounts from "./views/Accounts";
import Categories from "./views/Categories";
import { currentMonthKey } from "./format";

const NAV: { view: View; label: string; short: string; icon: LucideIcon }[] = [
  { view: "dashboard", label: "Сводка", short: "Сводка", icon: LayoutDashboard },
  { view: "transactions", label: "Операции", short: "Операции", icon: ArrowLeftRight },
  { view: "analytics", label: "Аналитика", short: "Аналит.", icon: PieChart },
  { view: "budgets", label: "Бюджеты", short: "Бюджеты", icon: Target },
  { view: "accounts", label: "Счета", short: "Счета", icon: Banknote },
  { view: "categories", label: "Категории", short: "Катег.", icon: Tags },
];

const VIEWS: View[] = NAV.map((n) => n.view);

function CoinMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="18" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2" />
      <circle cx="20" cy="20" r="12.5" fill="none" stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 3" />
      <text x="20" y="26.5" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" fontSize="16" fill="var(--accent)">
        М
      </text>
    </svg>
  );
}

const LAST_BACKUP_KEY = "moneta-last-backup";
const LAST_NAG_KEY = "moneta-last-backup-nag";
const NAG_INTERVAL_DAYS = 30; // не чаще раза в месяц

function readLastBackup(): number | null {
  try {
    const v = window.localStorage.getItem(LAST_BACKUP_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function daysAgo(ts: number): number {
  return Math.floor((Date.now() - ts) / 86_400_000);
}

export default function Shell() {
  return (
    <AuthProvider>
      <RateProvider>
        <ToastProvider>
          <ShellInner />
        </ToastProvider>
      </RateProvider>
    </AuthProvider>
  );
}

function ShellInner() {
  const { state, api } = useStore();
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const { canInstall, installed, prompt } = useInstallPrompt();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmImport, setConfirmImport] = useState<string | null>(null); // содержимое файла, ждущее подтверждения
  const [guideOpen, setGuideOpen] = useState(false); // «где найти приложение»
  const [authOpen, setAuthOpen] = useState(false);
  const { session, isPro } = useAuth();
  const [backupUrl, setBackupUrl] = useState<string | null>(null); // ссылка на свежую копию
  const [backupName, setBackupName] = useState("");
  const [lastBackup, setLastBackup] = useState<number | null>(() => readLastBackup());

  const exportBackup = () => {
    const blob = new Blob([api.exportJSON()], { type: "application/json" });
    if (backupUrl) URL.revokeObjectURL(backupUrl);
    const url = URL.createObjectURL(blob);
    const name = `moneta-backup-${new Date().toISOString().slice(0, 10)}.json`;
    setBackupUrl(url);
    setBackupName(name);
    // автозапуск; если заблокирован — в окне появится видимая ссылка
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    const now = Date.now();
    try {
      window.localStorage.setItem(LAST_BACKUP_KEY, String(now));
    } catch {
      /* приватный режим — просто не запомним дату */
    }
    setLastBackup(now);
    toast.push("Копия готова — ссылка ниже", "ok");
  };

  // ненавязчивое напоминание: раз в месяц, только если есть что терять
  useEffect(() => {
    if (state.transactions.length === 0) return;
    const overdue = lastBackup == null ? true : daysAgo(lastBackup) >= NAG_INTERVAL_DAYS;
    if (!overdue) return;
    let lastNag: number | null = null;
    try {
      const v = window.localStorage.getItem(LAST_NAG_KEY);
      lastNag = v ? Number(v) : null;
    } catch {
      /* игнор */
    }
    if (lastNag != null && daysAgo(lastNag) < NAG_INTERVAL_DAYS) return;
    const t = window.setTimeout(() => {
      toast.push(
        lastBackup == null ? "У вас ещё нет резервной копии данных — сохраните в настройках" : "Резервная копия давно не обновлялась — стоит сделать новую",
        "info"
      );
      try {
        window.localStorage.setItem(LAST_NAG_KEY, String(Date.now()));
      } catch {
        /* игнор */
      }
    }, 1200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onImportFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setConfirmImport(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const install = async () => {
    if (!canInstall) {
      if (installed) {
        setGuideOpen(true);
        return;
      }
      toast.push("Браузер не даёт диалог установки: меню Chrome ⋮ → «Установить приложение»", "info");
      return;
    }
    const outcome = await prompt();
    if (outcome === "accepted") {
      toast.push("Установлено!", "ok"); // путеводитель откроется по событию appinstalled
    } else if (outcome === "dismissed") {
      toast.push("Установка отменена — повторить можно в этом меню", "info");
    }
  };

  // Chrome сообщил, что приложение установлено (нашей кнопкой или через своё меню) — показываем, где его искать
  useEffect(() => {
    if (installed) {
      toast.push("«Монета» установлена на устройство", "ok");
      setGuideOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installed]);

  const [view, setView] = useState<View>(() => {
    const h = window.location.hash.replace("#/", "") as View;
    return VIEWS.includes(h) ? h : "dashboard";
  });
  const [month, setMonth] = useState(currentMonthKey());
  const [qa, setQa] = useState<{ open: boolean; edit: Transaction | null }>({ open: false, edit: null });
  const [resetOpen, setResetOpen] = useState(false);

  const go = useCallback((v: View) => {
    setView(v);
    window.history.replaceState(null, "", `#/${v}`);
    window.scrollTo({ top: 0 });
  }, []);

  const openAdd = useCallback(() => setQa({ open: true, edit: null }), []);
  const openEdit = useCallback((tx: Transaction) => setQa({ open: true, edit: tx }), []);
  const closeQa = useCallback(() => setQa((q) => ({ ...q, open: false })), []);

  // глобальная горячая клавиша N (и «т» в русской раскладке)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (qa.open || resetOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "n" || e.key.toLowerCase() === "т") {
        e.preventDefault();
        openAdd();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [qa.open, resetOpen, openAdd]);

  return (
    <div className="min-h-screen">
      <div className="bg-ambient" />

      {/* ── шапка (мобильная) ── */}
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_srgb, var(--bg)_88%, transparent)] backdrop-blur-md lg:hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex h-[54px] items-center gap-2.5 px-4">
          <CoinMark size={26} />
          <span className="font-display text-[15px] font-bold tracking-tight">Монета</span>
          {!online && (
            <span className="flex items-center gap-1 rounded-full border border-[var(--warn)]/50 bg-[var(--warn-soft)] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--warn)]">
              <WifiOff size={10} /> офлайн
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setResetOpen(true)}
              aria-label="Данные и резервные копии"
              title="Данные и резервные копии"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <Database size={15} />
            </button>
            <button
              onClick={toggle}
              aria-label="Переключить тему"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              onClick={openAdd}
              aria-label="Новая операция"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--bg)] transition-all hover:brightness-110 active:scale-90"
            >
              <Plus size={17} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1200px]">
        {/* ── сайдбар (десктоп) ── */}
        <aside className="sticky top-0 hidden h-screen w-[218px] shrink-0 flex-col border-r border-[var(--line)] px-3 py-5 lg:flex">
          <div className="flex items-center gap-2.5 px-2">
            <CoinMark />
            <div className="leading-none">
              <div className="font-display text-[15px] font-bold tracking-tight">Монета</div>
              <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--faint)]">финансы · mvp</div>
            </div>
          </div>

          <button
            onClick={openAdd}
            className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[13px] font-bold text-[var(--bg)] transition-all hover:brightness-110 active:scale-[0.97]"
          >
            <Plus size={15} /> Новая операция
            <kbd className="rounded border border-[var(--bg)]/30 px-1.5 font-mono text-[10px]">N</kbd>
          </button>

          <nav className="mt-5 space-y-1">
            {NAV.map((n) => (
              <button
                key={n.view}
                onClick={() => go(n.view)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] transition-all ${
                  view === n.view
                    ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                }`}
              >
                <n.icon size={16} />
                {n.label}
                {view === n.view && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
              </button>
            ))}
          </nav>

          <div className="mt-auto space-y-2">
            <RateChip />
            {authConfigured && (
              <button
                onClick={() => setAuthOpen(true)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12px] text-[var(--faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--muted)]"
              >
                <UserCircle2 size={14} />
                {session ? (isPro ? "Аккаунт · Pro" : session.user.email) : "Войти в аккаунт"}
              </button>
            )}
            {(canInstall || installed) && (
            <button
              onClick={install}
              className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-3 py-2 text-[12px] font-semibold text-[var(--accent)] transition-all hover:brightness-110"
            >
              <Download size={14} /> {installed ? "Установлено · где найти?" : "Установить приложение"}
            </button>            )}
            <button
              onClick={() => setResetOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12px] text-[var(--faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--muted)]"
            >
              <Database size={14} /> Данные и копии
            </button>
            <button
              onClick={toggle}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12px] text-[var(--faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--muted)]"
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              {theme === "dark" ? "Светлая тема" : "Тёмная тема"}
            </button>
            <div className="px-3 pt-1 font-mono text-[9.5px] leading-relaxed text-[var(--faint)]">
              данные в localStorage
              <br />
              v1.0 · 7 шагов дизайна
            </div>
          </div>
        </aside>

        {/* ── контент ── */}
        <main className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-7">
          <div key={view} className="animate-view">
            {view === "dashboard" && <Dashboard month={month} setMonth={setMonth} go={go} openAdd={openAdd} />}
            {view === "transactions" && <Transactions openAdd={openAdd} openEdit={openEdit} />}
            {view === "analytics" && <Analytics />}
            {view === "budgets" && <Budgets />}
            {view === "accounts" && <Accounts />}
            {view === "categories" && <Categories />}
          </div>
        </main>
      </div>

      {/* ── нижняя навигация (мобильная) ── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[color-mix(in_srgb, var(--surface)_92%, transparent)] backdrop-blur-md lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="grid grid-cols-6">
          {NAV.map((n) => (
            <button
              key={n.view}
              onClick={() => go(n.view)}
              className={`flex flex-col items-center gap-1 py-2.5 transition-colors ${view === n.view ? "text-[var(--accent)]" : "text-[var(--faint)]"}`}
            >
              <n.icon size={17} strokeWidth={view === n.view ? 2.4 : 2} />
              <span className="font-mono text-[8.5px] font-semibold uppercase tracking-wide">{n.short}</span>
            </button>
          ))}
        </div>
      </nav>

      <QuickAdd key={qa.edit?.id ?? (qa.open ? "new" : "closed")} open={qa.open} onClose={closeQa} editTx={qa.edit} />

      <Modal
        open={resetOpen}
        onClose={() => {
          setResetOpen(false);
          setConfirmImport(null);
          if (backupUrl) URL.revokeObjectURL(backupUrl);
          setBackupUrl(null);
        }}
        title="Данные и резервные копии"
      >
        <div className="space-y-3">
          <p className="text-[12.5px] leading-relaxed text-[var(--muted)]">
            Всё хранится локально на этом устройстве (localStorage) и переживает выключение компьютера и перезапуск браузера. Никуда не отправляется.
          </p>

          {/* что сейчас в базе */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2.5 font-mono text-[11px] text-[var(--muted)]">
            <span><b className="text-[var(--ink)]">{state.transactions.length}</b> операций</span>
            <span><b className="text-[var(--ink)]">{state.accounts.length}</b> счетов</span>
            <span><b className="text-[var(--ink)]">{state.categories.length}</b> категорий</span>
            <span><b className="text-[var(--ink)]">{state.budgets.length}</b> бюджетов</span>
          </div>

          {/* давность резервной копии */}
          <div
            className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 font-mono text-[11px] ${
              lastBackup != null && daysAgo(lastBackup) < NAG_INTERVAL_DAYS
                ? "border-[var(--income)]/40 bg-[var(--income-soft)] text-[var(--income)]"
                : "border-[var(--warn)]/40 bg-[var(--warn-soft)] text-[var(--warn)]"
            }`}
          >
            <Save size={13} />
            {lastBackup == null
              ? "Резервной копии ещё не было — сохраните на всякий случай"
              : daysAgo(lastBackup) === 0
                ? "Последняя копия: сегодня"
                : `Последняя копия: ${daysAgo(lastBackup)} дн. назад`}
          </div>

          {authConfigured && (
            <button
              onClick={() => setAuthOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--line)] px-4 py-3 text-left text-[13px] font-semibold text-[var(--muted)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <UserCircle2 size={15} /> {session ? (isPro ? "Аккаунт · Pro" : session.user.email) : "Войти в аккаунт / купить Pro"}
            </button>
          )}

          <button
            onClick={install}
            className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--accent)] px-4 py-3 text-left text-[13px] font-semibold text-[var(--accent)] transition-all hover:bg-[var(--accent-soft)]"
          >
            <Download size={15} /> {installed ? "Установлено · где найти?" : "Установить на телефон"}
          </button>
          {/* резервная копия */}
          <div className="rounded-xl border border-[var(--line)]">
            <div className="border-b border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--faint)]">
              Резервная копия · файл
            </div>
            <div className="grid grid-cols-2 gap-2 p-2.5">
              <button
                onClick={exportBackup}
                className="flex items-center justify-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2.5 text-[12.5px] font-semibold transition-all hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
              >
                <Save size={14} /> Скачать
              </button>
              {confirmImport == null ? (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center justify-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2.5 text-[12.5px] font-semibold transition-all hover:border-[var(--transfer)] hover:bg-[var(--transfer-soft)] hover:text-[var(--transfer)]"
                >
                  <Upload size={14} /> Восстановить
                </button>
              ) : (
                <button
                  onClick={() => {
                    const res = api.importJSON(confirmImport);
                    setConfirmImport(null);
                    if (fileRef.current) fileRef.current.value = "";
                    if (res.ok) {
                      toast.push("Данные восстановлены из копии", "ok");
                      setResetOpen(false);
                    } else {
                      toast.push(res.error, "err");
                    }
                  }}
                  className="animate-toast flex items-center justify-center gap-2 rounded-lg bg-[var(--transfer)] px-3 py-2.5 text-[12.5px] font-bold text-white transition-all hover:brightness-110"
                >
                  Точно заменить?
                </button>
              )}
            </div>
            {backupUrl && (
              <div className="animate-toast px-2.5 pb-2.5">
                <a
                  href={backupUrl}
                  download={backupName}
                  className="flex items-center justify-center gap-2 rounded-lg border border-[var(--income)]/50 bg-[var(--income-soft)] px-3 py-2.5 font-mono text-[11px] font-bold text-[var(--income)] transition-all hover:brightness-110 active:scale-[0.98]"
                >
                  <Download size={13} /> {backupName} — сохранить
                </a>
                <p className="mt-1 text-center font-mono text-[9px] leading-relaxed text-[var(--faint)]">
                  если не началось — нажмите ссылку; в окне предпросмотра скачивание блокируется, откройте приложение в новой вкладке (↗)
                </p>
              </div>
            )}
            {confirmImport != null && (
              <button
                onClick={() => { setConfirmImport(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="block w-full px-3.5 pb-2.5 text-center font-mono text-[10.5px] text-[var(--faint)] transition-colors hover:text-[var(--muted)]"
              >
                отменить восстановление
              </button>
            )}
            <p className="px-3.5 pb-3 font-mono text-[10px] leading-relaxed text-[var(--faint)]">
              Копия — обычный JSON-файл: переносит данные на другой компьютер или телефон, страхует от очистки браузера.
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => onImportFile(e.target.files?.[0] ?? null)}
          />

          <button
            onClick={() => {
              api.resetDemo();
              setResetOpen(false);
              toast.push("Демо-данные восстановлены", "ok");
            }}
            className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--line)] px-4 py-3 text-left text-[13px] font-medium transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <RotateCcw size={15} /> Восстановить демо-данные
          </button>
          <button
            onClick={() => {
              api.resetEmpty();
              setResetOpen(false);
              toast.push("Начинаем с чистого листа", "ok");
            }}
            className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--expense)]/40 px-4 py-3 text-left text-[13px] font-medium text-[var(--expense)] transition-colors hover:bg-[var(--expense-soft)]"
          >
            <Banknote size={15} /> Очистить всё и начать заново
          </button>
        </div>
      </Modal>

      <InstallGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
      {authConfigured && <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
