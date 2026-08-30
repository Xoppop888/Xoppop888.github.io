import { createClient, type Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Modal, useToast } from "./ui";

// ── клиент Supabase ──
// URL и anon-ключ — не секреты, их видно в исходниках любого клиентского приложения,
// это нормально: реальная защита данных — в RLS-политиках на стороне базы (см. supabase/schema.sql).
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

/** Пока переменные окружения не заданы (VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY) —
 * весь блок аккаунта/Pro просто не показывается, приложение работает как раньше, локально. */
export const authConfigured = supabase !== null;

interface AuthCtx {
  session: Session | null;
  isPro: boolean;
  loading: boolean;
  refreshPro: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ session: null, isPro: false, loading: false, refreshPro: async () => {} });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(!!supabase);

  const refreshPro = async () => {
    if (!supabase || !session) return setIsPro(false);
    const { data } = await supabase.from("profiles").select("is_pro").eq("id", session.user.id).single();
    setIsPro(!!data?.is_pro);
  };

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    refreshPro();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  return <Ctx.Provider value={{ session, isPro, loading, refreshPro }}>{children}</Ctx.Provider>;
}

/** Модалка входа/регистрации по email — открывается из настроек. */
export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { session, isPro, refreshPro } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!supabase) return;
    setBusy(true);
    const fn = mode === "in" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
    const { error } = await fn({ email, password });
    setBusy(false);
    if (error) return toast.push(error.message, "err");
    toast.push(mode === "in" ? "Вы вошли в аккаунт" : "Проверьте почту — письмо для подтверждения отправлено", "ok");
    if (mode === "in") onClose();
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
    toast.push("Вы вышли из аккаунта");
    onClose();
  };

  const buyPro = async () => {
    if (!supabase || !session) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-payment");
      if (error) throw error;
      if (data?.confirmationUrl) {
        // после возврата с оплаты пользователь попадёт обратно на сайт;
        // при следующем открытии этой модалки refreshPro подтянет is_pro
        window.location.href = data.confirmationUrl;
      }
    } catch {
      toast.push("Не удалось создать платёж — попробуйте позже", "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={session ? "Аккаунт" : "Вход / регистрация"}>
      {session ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-4 py-3">
            <div className="text-[13px] font-semibold">{session.user.email}</div>
            <div className="mt-1 font-mono text-[11px]" style={{ color: isPro ? "var(--income)" : "var(--muted)" }}>
              {isPro ? "✓ Pro-доступ активен" : "Без Pro-доступа"}
            </div>
          </div>
          {!isPro && (
            <button
              onClick={buyPro}
              disabled={busy}
              className="w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[13px] font-bold text-[var(--bg)] transition-all hover:brightness-110 disabled:opacity-50"
            >
              Купить Pro — разово, навсегда
            </button>
          )}
          <button onClick={refreshPro} className="w-full rounded-lg border border-[var(--line)] px-4 py-2 text-[12px] text-[var(--muted)] hover:text-[var(--ink)]">
            Обновить статус оплаты
          </button>
          <button onClick={signOut} className="w-full rounded-lg border border-[var(--line)] px-4 py-2 text-[12px] text-[var(--expense)] hover:bg-[var(--expense-soft)]">
            Выйти
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-3"
        >
          <div className="flex rounded-xl border border-[var(--line)] p-1">
            <button type="button" onClick={() => setMode("in")} className={`flex-1 rounded-lg py-1.5 text-[12px] font-semibold ${mode === "in" ? "bg-[var(--accent)] text-[var(--bg)]" : "text-[var(--muted)]"}`}>
              Вход
            </button>
            <button type="button" onClick={() => setMode("up")} className={`flex-1 rounded-lg py-1.5 text-[12px] font-semibold ${mode === "up" ? "bg-[var(--accent)] text-[var(--bg)]" : "text-[var(--muted)]"}`}>
              Регистрация
            </button>
          </div>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--accent)]"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="пароль, от 6 символов"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-[13px] outline-none focus:border-[var(--accent)]"
          />
          <button type="submit" disabled={busy} className="w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[13px] font-bold text-[var(--bg)] transition-all hover:brightness-110 disabled:opacity-50">
            {mode === "in" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>
      )}
    </Modal>
  );
}
