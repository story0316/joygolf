// 공통 플로팅 글래스 네비게이션 (모바일에서는 하단 독으로 전환)
JoyGolf.renderNav = function renderNav(activePage, options) {
  const links = [
    { href: "dashboard.html", label: "🏠 대시보드", short: "🏠", key: "dashboard" },
    { href: "practice.html", label: "🏋️ 연습", short: "🏋️", key: "practice" },
    { href: "score.html", label: "⛳ 스코어", short: "⛳", key: "score" },
    { href: "meetup.html", label: "📅 모임", short: "📅", key: "meetup" },
    { href: "board.html", label: "📝 게시판", short: "📝", key: "board" },
    { href: "ranking.html", label: "🏆 랭킹", short: "🏆", key: "ranking" },
    { href: "profile.html", label: "⚙️ 프로필", short: "⚙️", key: "profile" },
  ];

  if (options && options.isAdmin) {
    links.push({ href: "admin.html", label: "🛡️ 운영진", short: "🛡️", key: "admin" });
  }

  const el = document.getElementById("navbar");
  if (!el) return;

  const isDark = window.JoyTheme && JoyTheme.current() === "dark";

  // 데스크톱 상단바와 모바일 하단 독을 분리해서 렌더한다.
  // (.nav-inner 의 backdrop-filter 가 fixed 자식의 컨테이닝 블록이 되어버리므로
  //  독은 반드시 .nav-inner 바깥, #navbar 의 직계 자식이어야 뷰포트 기준으로 붙는다)
  el.innerHTML = `
    <nav class="nav-inner" aria-label="주요 메뉴">
      <a href="dashboard.html" class="nav-logo"><span class="dot"></span>JoyGolf</a>
      <div class="nav-links">
        ${links
          .map(
            (l) =>
              `<a href="${l.href}" class="nav-link ${l.key === activePage ? "active" : ""}">${l.label}</a>`
          )
          .join("")}
      </div>
      <div class="nav-tools">
        <button id="themeBtn" class="icon-btn" aria-label="테마 전환" title="라이트/다크 전환">${isDark ? "☀️" : "🌙"}</button>
        <button id="logoutBtn" class="icon-btn" aria-label="로그아웃" title="로그아웃">🚪</button>
      </div>
    </nav>
    <nav class="nav-dock" aria-label="모바일 메뉴">
      ${links
        .map(
          (l) => `<a href="${l.href}" class="dock-link ${l.key === activePage ? "active" : ""}">
            <span class="dock-ico">${l.short}</span>
            <span class="dock-label">${l.label.replace(/^\S+\s/, "")}</span>
          </a>`
        )
        .join("")}
    </nav>
  `;

  document.getElementById("themeBtn").addEventListener("click", (e) => {
    const next = JoyTheme.toggle();
    e.currentTarget.textContent = next === "dark" ? "☀️" : "🌙";
  });

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await sb.auth.signOut();
    window.location.href = "index.html";
  });
};

// 카드가 순차적으로 떠오르는 진입 애니메이션
JoyGolf.revealCards = function revealCards() {
  document.querySelectorAll(".container .card, .container .award-card").forEach((el, i) => {
    el.style.setProperty("--i", i);
    el.classList.add("reveal");
  });
};
