// 라이트/다크 테마 관리 (system 기본, 사용자가 고르면 localStorage에 저장)
window.JoyTheme = (function () {
  const KEY = "joygolf-theme";

  function stored() {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  // 현재 실제로 적용된 테마
  function current() {
    const s = stored();
    if (s === "dark" || s === "light") return s;
    return systemPrefersDark() ? "dark" : "light";
  }

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  function set(theme) {
    try {
      localStorage.setItem(KEY, theme);
    } catch (e) {
      /* 프라이빗 모드 등에서 저장 실패해도 화면 전환은 유지 */
    }
    apply(theme);
    document.dispatchEvent(new CustomEvent("joygolf:themechange", { detail: { theme } }));
  }

  function toggle() {
    const next = current() === "dark" ? "light" : "dark";
    set(next);
    return next;
  }

  // 저장값이 있으면 즉시 반영 (head 인라인 스크립트가 이미 처리하지만 안전망)
  const s = stored();
  if (s === "dark" || s === "light") apply(s);

  return { current, set, toggle };
})();
