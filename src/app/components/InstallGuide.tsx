import { useMemo } from "react";
import { Chrome, Home, MonitorSmartphone, Search, Sparkles } from "lucide-react";
import { Modal } from "../ui";

type Platform = "windows" | "mac" | "android" | "ios" | "linux";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Win/i.test(ua)) return "windows";
  if (/Mac/i.test(ua)) return "mac";
  if (/Linux/i.test(ua)) return "linux";
  return "linux";
}

const PLATFORM_TITLE: Record<Platform, string> = {
  windows: "Windows",
  mac: "macOS",
  android: "Android",
  ios: "iPhone / iPad",
  linux: "Linux",
};

const STEPS: Record<Platform, { icon: "monitor" | "search" | "chrome" | "home"; text: string }[]> = {
  windows: [
    { icon: "monitor", text: "Сразу после установки Chrome открывает «Монету» в отдельном окне — без вкладок и адресной строки. Если окно закрылось — ищите дальше." },
    { icon: "search", text: "Меню «Пуск» → введите «Монета». Ярлык также появляется в разделе «Chrome Apps» списка всех программ." },
    { icon: "chrome", text: "В самом Chrome: меню ⋮ → в самом верху будет раздел «Монета» с пунктом «Открыть». Плюс значок в сетке приложений на панели закладок." },
  ],
  mac: [
    { icon: "monitor", text: "После установки «Монета» открывается в своём окне. Если закрыли — она осталась в системе." },
    { icon: "search", text: "Spotlight (⌘ + пробел) → введите «Монета». Или Launchpad — значок появится на первой странице." },
    { icon: "chrome", text: "Finder → «Программы» → папка «Chrome Apps». В Chrome — меню ⋮, раздел «Монета» сверху." },
  ],
  android: [
    { icon: "home", text: "Значок «Монета» появляется на домашнем экране. Chrome при этом показывает уведомление «Добавлено на главный экран»." },
    { icon: "search", text: "Если на экране нет — откройте список всех приложений (свайп вверх) и найдите «Монету» там; ярлык можно перетащить на экран." },
    { icon: "chrome", text: "Запасной путь: Chrome → меню ⋮ → «Установить приложение» или «Добавить на главный экран»." },
  ],
  ios: [
    { icon: "home", text: "На iPhone установка делается через Safari: кнопка «Поделиться» (квадрат со стрелкой) → «На экран „Домой“»." },
    { icon: "search", text: "После этого значок «Монета» появится на домашнем экране и в библиотеке приложений." },
  ],
  linux: [
    { icon: "monitor", text: "После установки открывается отдельное окно приложения. Ярлык появляется в меню приложений вашей среды (раздел Chrome Apps)." },
    { icon: "chrome", text: "В Chrome: меню ⋮ → раздел «Монета» сверху, или chrome://apps." },
  ],
};

const StepIcon = ({ kind }: { kind: "monitor" | "search" | "chrome" | "home" }) => {
  const cls = "text-[var(--accent)]";
  if (kind === "monitor") return <MonitorSmartphone size={15} className={cls} />;
  if (kind === "search") return <Search size={15} className={cls} />;
  if (kind === "home") return <Home size={15} className={cls} />;
  return <Chrome size={15} className={cls} />;
};

export default function InstallGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const platform = useMemo(detectPlatform, []);
  const steps = STEPS[platform];

  // приложение уже запущено в установленном режиме?
  const standalone = useMemo(
    () => window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open]
  );

  return (
    <Modal open={open} onClose={onClose} title="Куда делась «Монета»?">
      <div className="space-y-4">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--income-soft)] text-[var(--income)]">
            <Sparkles size={18} />
          </span>
          <div>
            <div className="font-display text-[15px] font-bold">Приложение установлено</div>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--muted)]">
              PWA-приложения не ставятся как обычные программы — они живут «внутри» Chrome.
              Вот где искать на вашей платформе <b className="text-[var(--ink)]">({PLATFORM_TITLE[platform]})</b>:
            </p>
          </div>
        </div>

        {standalone && (
          <div className="rounded-xl border border-[var(--income)]/45 bg-[var(--income-soft)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--income)]">
            Кстати: это окно открыто без адресной строки — вы уже в установленном приложении.
          </div>
        )}

        <ol className="space-y-2.5">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] font-mono text-[11px] font-bold text-[var(--accent)]">
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="mb-0.5 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
                  <StepIcon kind={s.icon} />
                  {s.icon === "monitor" ? "окно приложения" : s.icon === "search" ? "поиск системы" : s.icon === "home" ? "домашний экран" : "меню chrome"}
                </div>
                <p className="text-[12.5px] leading-relaxed text-[var(--muted)]">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="rounded-xl border border-dashed border-[var(--line-strong)] px-3.5 py-3">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--faint)]">Так и не нашли?</div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--muted)]">
            Откройте Chrome → меню <b className="text-[var(--ink)]">⋮</b> → пункт{" "}
            <b className="text-[var(--ink)]">«Установить приложение»</b> — Chrome сам запустит «Монету» в отдельном окне.
            Данные при этом не дублируются: и браузер, и приложение видят одни и те же финансы на этом устройстве.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[13px] font-bold text-[var(--bg)] transition-all hover:brightness-110 active:scale-[0.98]"
        >
          Понятно
        </button>
      </div>
    </Modal>
  );
}
