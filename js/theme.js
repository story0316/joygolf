// ============================================================
// 테마(다크/라이트) 관리
// 초기 테마는 각 페이지 <head>의 인라인 스크립트가 이미 확정해 둔다.
// 여기서는 전환 버튼 바인딩과, JS에서 색 토큰을 읽는 헬퍼만 담당한다.
// ============================================================
(function () {
  window.JoyGolf = window.JoyGolf || {};

  const STORAGE_KEY = "joygolf-theme";
  const root = document.documentElement;

  function current() {
    return root.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function syncLabel(btn) {
    const light = current() === "light";
    btn.textContent = light ? "☀️" : "🌙";
    btn.setAttribute("aria-label", light ? "다크 모드로 전환" : "라이트 모드로 전환");
  }

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      /* 시크릿 모드 등에서 저장이 막혀도 전환 자체는 동작해야 한다 */
    }
    document.querySelectorAll("[data-theme-toggle]").forEach(syncLabel);
    window.dispatchEvent(new CustomEvent("joygolf:themechange", { detail: { theme } }));
  }

  JoyGolf.currentTheme = current;

  JoyGolf.bindThemeToggle = function bindThemeToggle(btn) {
    if (!btn || btn.dataset.themeToggle) return;
    btn.dataset.themeToggle = "1";
    syncLabel(btn);
    btn.addEventListener("click", () => apply(current() === "light" ? "dark" : "light"));
  };

  // Chart.js처럼 색을 문자열로 받아야 하는 곳에서 디자인 토큰을 읽어간다.
  JoyGolf.cssVar = function cssVar(name) {
    return getComputedStyle(root).getPropertyValue(name).trim();
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("#themeToggle").forEach(JoyGolf.bindThemeToggle);
  });
})();
