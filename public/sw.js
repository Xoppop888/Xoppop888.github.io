/*
 * Сервис-воркер «Монеты» (v6) — офлайн-режим.
 *  · Работает только на хостах деплоя (GitHub Pages, Netlify, Vercel,
 *    Cloudflare, localhost). На прочих (песочницы предпросмотра) воркер
 *    САМОУНИЧТОЖАЕТСЯ: чистит кэши и снимает регистрацию. Это страховка
 *    от рассогласованных модулей после пересборок —
 *    «Cannot read properties of null (reading 'useReducer')».
 *  · Навигация: сеть-first, кэшируется только УСПЕШНЫЙ ответ. Офлайн —
 *    последняя удачная страница, иначе — заглушка «нет сети».
 *  · Статика: кэш-first, дозапись из сети (файлы с хэшем иммутабельны).
 */
const CACHE = "moneta-v6";
const NAV_KEY = "moneta-nav";

const HOSTS_OK = (() => {
  const h = self.location.hostname;
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

const selfDestruct = () =>
  caches
    .keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith("moneta-")).map((k) => caches.delete(k))))
    .then(() => self.registration.unregister());

const OFFLINE_PAGE =
  '<!doctype html><html lang="ru"><head><meta charset="utf-8"/>' +
  '<meta name="viewport" content="width=device-width,initial-scale=1"/>' +
  "<title>Монета — нет сети</title><style>" +
  "body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0d120f;color:#e5ebe4;font:14px/1.6 system-ui,sans-serif;padding:24px}" +
  ".c{max-width:420px;text-align:center}.m{font-size:44px}h1{font-size:17px;margin:14px 0 6px}" +
  "p{color:#97a499;font-size:13px}button{margin-top:18px;background:#3ecf8e;color:#0d120f;border:0;border-radius:10px;padding:11px 20px;font:700 13px system-ui;cursor:pointer}" +
  "</style></head><body><div class=c><div class=m>🪙</div>" +
  "<h1>Монета не может открыться офлайн</h1>" +
  "<p>Сохранённой копии на этом устройстве пока нет. Подключитесь к интернету и откройте приложение один раз — дальше оно будет работать без сети.</p>" +
  '<button onclick="location.reload()">Попробовать снова</button></div></body></html>';

self.addEventListener("install", () => {
  if (!HOSTS_OK) return;
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  if (!HOSTS_OK) {
    event.waitUntil(selfDestruct());
    return;
  }
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (!HOSTS_OK) return; // чистая сеть — воркер вот-вот самоуничтожится
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  /* навигация: сеть → удачный кэш → офлайн-заглушка */
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(NAV_KEY, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches
            .open(CACHE)
            .then((c) => c.match(NAV_KEY))
            .then(
              (hit) =>
                hit ||
                new Response(OFFLINE_PAGE, {
                  status: 200,
                  headers: { "Content-Type": "text/html; charset=utf-8" },
                })
            )
        )
    );
    return;
  }

  /* статика: кэш-first с дозаписью */
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req)
          .then((res) => {
            if (res && res.ok && res.type === "basic") {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => Response.error())
    )
  );
});
