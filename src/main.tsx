import { Component } from "react";
import type { ReactNode } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

/* штамп сборки — для диагностики несогласованных кэшей */
const BUILD = "moneta-2026-02-11-rollback";
(window as unknown as Record<string, string>).__MONETA_BUILD__ = BUILD;

/* ── диагностическая панель (чистый DOM — работает даже если React не стартовал) ── */

let reactStarted = false;

function paintDiagnostics(title: string, detail: string, force = false) {
  const root = document.getElementById("root");
  if (!root) return;
  if (reactStarted && !force) return; // React уже в работе — пусть рулит ErrorBoundary
  root.innerHTML = "";
  const box = document.createElement("div");
  box.style.cssText =
    "min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0d120f;color:#e5ebe4;font-family:'JetBrains Mono',ui-monospace,monospace;padding:24px;";
  box.innerHTML = `
    <div style="max-width:560px;width:100%;border:1px solid #37453c;border-radius:14px;padding:28px;background:#141b16;">
      <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#f0717f;">монета · ${title}</div>
      <div style="margin-top:12px;font-size:13.5px;line-height:1.6;word-break:break-word;">${detail}</div>
      <div style="margin-top:10px;font-size:11px;color:#67746a;">сборка ${BUILD}</div>
      <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">
        <button id="__moneta_reload" style="background:#3ecf8e;color:#0d120f;border:none;border-radius:10px;padding:10px 16px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;">Перезагрузить</button>
        <button id="__moneta_hard" style="background:transparent;color:#97a499;border:1px solid #37453c;border-radius:10px;padding:10px 16px;font-size:12.5px;cursor:pointer;font-family:inherit;">Сбросить кэш и перезагрузить</button>
      </div>
      <div style="margin-top:14px;font-size:10.5px;line-height:1.6;color:#67746a;">Данные не пострадали: операции и счета хранятся в localStorage устройства.</div>
    </div>`;
  root.appendChild(box);
  box.querySelector("#__moneta_reload")?.addEventListener("click", () => window.location.reload());
  box.querySelector("#__moneta_hard")?.addEventListener("click", () => {
    const done = () => window.location.reload();
    const tasks: Promise<unknown>[] = [];
    try {
      if ("serviceWorker" in navigator) {
        tasks.push(
          navigator.serviceWorker
            .getRegistrations()
            .then((regs) => Promise.all(regs.map((r) => r.unregister())))
            .catch(() => {})
        );
      }
      if ("caches" in window) {
        tasks.push(
          caches
            .keys()
            .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            .catch(() => {})
        );
      }
    } catch {
      /* noop */
    }
    Promise.all(tasks).finally(done);
  });
}

/* ловим всё, что происходит вне React-рендера: модульные ошибки, обработчики, промисы */
window.addEventListener("error", (e) => {
  paintDiagnostics("сбой при запуске", `${e.message ?? "unknown"}<br/><span style="color:#67746a;font-size:11px;">${e.filename ?? ""}:${e.lineno ?? 0}</span>`);
});
window.addEventListener("unhandledrejection", (e) => {
  paintDiagnostics("необработанный промис", String(e.reason?.message ?? e.reason ?? "unknown"));
});

/* ── ErrorBoundary для ошибок внутри React-дерева ── */

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    try {
      console.error("[Монета] render error:", error, "build:", BUILD);
    } catch {
      /* noop */
    }
    const msg = (error?.message ?? String(error)).replace(/</g, "&lt;");
    // отложенно: React сначала размонтирует дерево, затем рисуем диагностику
    window.setTimeout(() => paintDiagnostics("сбой интерфейса", msg, true), 60);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return null;
  }
}

/* ── запуск ── */

try {
  const container = document.getElementById("root");
  if (!container) throw new Error("контейнер #root не найден");
  ReactDOM.createRoot(container).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
  reactStarted = true;
} catch (e) {
  paintDiagnostics("не удалось запустить React", String((e as Error)?.message ?? e));
}

/*
 * Офлайн-режим (PWA). SW регистрируется ТОЛЬКО на хостингах деплоя
 * (GitHub Pages, Netlify, Vercel, Cloudflare, localhost) — там, где офлайн
 * действительно нужен. В песочницах предпросмотра воркер конфликтует с
 * собственным кэширующим слоем среды: после пересборок браузер получал
 * рассогласованные модули, что проявлялось как
 * «Cannot read properties of null (reading 'useReducer')». Поэтому на
 * незнакомых хостах регистрация отключена, а старые экземпляры и кэши
 * принудительно зачищаются при каждой загрузке.
 */
const SW_HOSTS_OK = (() => {
  const h = window.location.hostname;
  if (window.location.search.includes("pwa=1")) return true; // ручной тест офлайна
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.endsWith(".github.io") ||
    h.endsWith(".netlify.app") ||
    h.endsWith(".netlify.dev") ||
    h.endsWith(".vercel.app") ||
    h.endsWith(".pages.dev")
  );
})();

if ("serviceWorker" in navigator) {
  if (SW_HOSTS_OK) {
    window.addEventListener("load", () => {
      // относительный путь: работает и в корне домена, и в подпапке (GitHub Pages и т.п.)
      navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {
        /* офлайн-режим недоступен — приложение работает и так */
      });
    });
  } else {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .catch(() => {
        /* noop */
      });
    if ("caches" in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((k) => k.startsWith("moneta-")).map((k) => caches.delete(k))))
        .catch(() => {
          /* noop */
        });
    }
  }
}
