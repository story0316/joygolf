// 서비스워커 등록 + 설치 프롬프트 + 업데이트 안내
(function () {
  if (!("serviceWorker" in navigator)) return;

  let deferredPrompt = null;

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("sw.js", { scope: "./" });

      // 새 버전이 대기 중이면 사용자에게 알린다
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateChip(reg);
          }
        });
      });
    } catch (e) {
      console.warn("[pwa] 서비스워커 등록 실패:", e);
    }
  });

  // 업데이트 적용 후 한 번만 새로고침
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  function chip(id, label, onClick) {
    let el = document.getElementById(id);
    if (el) return el;
    el = document.createElement("button");
    el.id = id;
    el.className = "pwa-chip";
    el.innerHTML = label;
    el.addEventListener("click", onClick);
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    return el;
  }

  function showUpdateChip(reg) {
    chip("pwaUpdateChip", "🔄 새 버전이 있어요 · 새로고침", () => {
      if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING");
      else location.reload();
    });
  }

  // 설치 프롬프트 (Android/데스크톱 Chrome 계열)
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    chip("pwaInstallChip", "📲 앱으로 설치하기", async () => {
      const el = document.getElementById("pwaInstallChip");
      if (el) el.remove();
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    });
  });

  window.addEventListener("appinstalled", () => {
    const el = document.getElementById("pwaInstallChip");
    if (el) el.remove();
    deferredPrompt = null;
  });
})();
