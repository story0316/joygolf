/* JoyGolf 서비스워커
   - 앱 셸을 캐시해 오프라인에서도 화면이 뜨게 한다
   - 데이터(Supabase API)는 절대 캐시하지 않는다: 인증/개인정보가 섞이고 오래된 값이 보이면 안 됨
   - 웹 푸시 수신/클릭 처리
*/

const VERSION = "v1";
const SHELL_CACHE = `joygolf-shell-${VERSION}`;
const RUNTIME_CACHE = `joygolf-runtime-${VERSION}`;

const SHELL = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./practice.html",
  "./score.html",
  "./meetup.html",
  "./board.html",
  "./ranking.html",
  "./profile.html",
  "./admin.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/config.js",
  "./js/theme.js",
  "./js/supabaseClient.js",
  "./js/nav.js",
  "./js/pwa.js",
  "./js/push.js",
  "./js/auth.js",
  "./js/dashboard.js",
  "./js/practice.js",
  "./js/score.js",
  "./js/meetup.js",
  "./js/board.js",
  "./js/ranking.js",
  "./js/profile.js",
  "./js/admin.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // 하나라도 실패하면 설치 전체가 실패하는 addAll 대신 개별 처리
      await Promise.all(
        SHELL.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch((err) => {
            console.warn("[sw] 셸 캐시 실패:", url, err);
          })
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("joygolf-") && k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// 페이지가 즉시 업데이트를 적용하고 싶을 때
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isSupabaseRequest(url) {
  // 데이터/인증/스토리지 요청은 캐시 대상에서 제외
  return /\.supabase\.(co|in)$/.test(url.hostname) || url.pathname.startsWith("/rest/v1");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (isSupabaseRequest(url)) return; // 네트워크로 그대로 통과

  // 페이지 이동: 네트워크 우선 + 오프라인이면 캐시/오프라인 안내
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(SHELL_CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          const cached = await caches.match(req, { ignoreSearch: true });
          return cached || (await caches.match("./offline.html")) || Response.error();
        }
      })()
    );
    return;
  }

  // 정적 자산(같은 출처 + 허용된 CDN): stale-while-revalidate
  const sameOrigin = url.origin === self.location.origin;
  const isCdn = url.hostname === "cdn.jsdelivr.net";
  if (!sameOrigin && !isCdn) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(sameOrigin ? SHELL_CACHE : RUNTIME_CACHE);
      const cached = await cache.match(req);

      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);

      return cached || (await network) || Response.error();
    })()
  );
});

/* ---------------- 웹 푸시 ---------------- */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: "JoyGolf", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "JoyGolf ⛳";
  const options = {
    body: payload.body || "",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: payload.tag || "joygolf",
    renotify: !!payload.renotify,
    data: { url: payload.url || "./dashboard.html" },
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || "./dashboard.html",
    self.location.origin
  ).href;

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // 이미 열린 창이 있으면 그 창을 재사용
      for (const client of all) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      for (const client of all) {
        if ("navigate" in client && "focus" in client) {
          await client.navigate(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })()
  );
});
