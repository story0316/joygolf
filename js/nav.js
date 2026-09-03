// ============================================================
// 공통 네비게이션
//  - 데스크톱: 상단 글래스 바 + 알약 링크
//  - 모바일  : 상단 바(로고/테마) + 하단 탭바 + "더보기" 시트
// ============================================================
JoyGolf.renderNav = function renderNav(activePage, options) {
  const isAdmin = !!(options && options.isAdmin);

  // 하단 탭바에 노출할 주요 메뉴 4개
  const primary = [
    { href: "dashboard.html", icon: "🏠", label: "대시보드", short: "홈", key: "dashboard" },
    { href: "practice.html", icon: "🏋️", label: "연습인증", short: "연습", key: "practice" },
    { href: "score.html", icon: "⛳", label: "스코어인증", short: "스코어", key: "score" },
    { href: "meetup.html", icon: "📅", label: "모임", short: "모임", key: "meetup" },
  ];

  // 데스크톱 상단 바에는 함께, 모바일에서는 "더보기" 시트에 들어갈 메뉴
  const secondary = [
    { href: "board.html", icon: "📝", label: "후기게시판", key: "board" },
    { href: "ranking.html", icon: "🏆", label: "랭킹/이달의상", key: "ranking" },
    { href: "profile.html", icon: "⚙️", label: "프로필", key: "profile" },
  ];

  if (isAdmin) {
    secondary.push({ href: "admin.html", icon: "🛡️", label: "운영진", key: "admin" });
  }

  const all = [...primary, ...secondary];
  const inSheet = secondary.some((l) => l.key === activePage);

  const host = document.getElementById("navbar");
  if (!host) return;

  const navLink = (l) =>
    `<a href="${l.href}" class="nav-link${l.key === activePage ? " active" : ""}">${l.icon} ${l.label}</a>`;

  const tab = (l) =>
    `<a href="${l.href}" class="tab${l.key === activePage ? " active" : ""}">
       <span class="tab-icon">${l.icon}</span>${l.short}
     </a>`;

  const sheetLink = (l) =>
    `<a href="${l.href}" class="sheet-link${l.key === activePage ? " active" : ""}">
       <span>${l.icon}</span>${l.label}
     </a>`;

  host.innerHTML = `
    <nav class="nav">
      <div class="nav-inner">
        <a href="dashboard.html" class="nav-logo">
          <span class="mark">⛳</span>JoyGolf
        </a>

        <div class="nav-links">${all.map(navLink).join("")}</div>

        <div class="nav-actions">
          <button id="themeToggle" class="icon-btn" type="button">🌙</button>
          <button id="logoutBtn" class="icon-btn" type="button" aria-label="로그아웃">🚪</button>
        </div>
      </div>
    </nav>

    <div class="tabbar">
      ${primary.map(tab).join("")}
      <button id="moreBtn" class="tab${inSheet ? " active" : ""}" type="button" aria-haspopup="dialog" aria-expanded="false">
        <span class="tab-icon">⋯</span>더보기
      </button>
    </div>

    <div class="sheet-backdrop" id="sheetBackdrop"></div>
    <div class="sheet" id="sheet" role="dialog" aria-modal="true" aria-label="더보기 메뉴">
      <div class="sheet-grip"></div>
      ${secondary.map(sheetLink).join("")}
      <button class="sheet-link" id="sheetTheme" type="button"><span>🎨</span>테마 전환</button>
      <button class="sheet-link danger" id="sheetLogout" type="button"><span>🚪</span>로그아웃</button>
    </div>
  `;

  JoyGolf.bindThemeToggle(document.getElementById("themeToggle"));

  // 활성 링크가 가로 스크롤 밖에 있으면 보이도록 스크롤
  const active = host.querySelector(".nav-link.active");
  if (active) active.scrollIntoView({ block: "nearest", inline: "center" });

  // ---- 더보기 시트 ----
  const sheet = document.getElementById("sheet");
  const backdrop = document.getElementById("sheetBackdrop");
  const moreBtn = document.getElementById("moreBtn");

  function setSheet(open) {
    sheet.classList.toggle("open", open);
    backdrop.classList.toggle("open", open);
    moreBtn.setAttribute("aria-expanded", String(open));
  }

  moreBtn.addEventListener("click", () => setSheet(!sheet.classList.contains("open")));
  backdrop.addEventListener("click", () => setSheet(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setSheet(false);
  });

  document.getElementById("sheetTheme").addEventListener("click", () => {
    document.getElementById("themeToggle").click();
    setSheet(false);
  });

  // ---- 로그아웃 ----
  async function logout() {
    await sb.auth.signOut();
    window.location.href = "index.html";
  }

  document.getElementById("logoutBtn").addEventListener("click", logout);
  document.getElementById("sheetLogout").addEventListener("click", logout);
};
