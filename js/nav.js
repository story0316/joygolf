// 공통 상단 네비게이션 렌더링
JoyGolf.renderNav = function renderNav(activePage) {
  const links = [
    { href: "dashboard.html", label: "🏠 대시보드", key: "dashboard" },
    { href: "practice.html", label: "🏋️ 연습인증", key: "practice" },
    { href: "score.html", label: "⛳ 스코어인증", key: "score" },
    { href: "meetup.html", label: "📅 모임", key: "meetup" },
    { href: "board.html", label: "📝 후기게시판", key: "board" },
    { href: "ranking.html", label: "🏆 랭킹/이달의상", key: "ranking" },
    { href: "profile.html", label: "⚙️ 프로필", key: "profile" },
  ];

  const el = document.getElementById("navbar");
  if (!el) return;

  el.innerHTML = `
    <div class="nav-inner">
      <a href="dashboard.html" class="nav-logo">🏌️‍♂️ JoyGolf</a>
      <button id="navToggle" class="nav-toggle" aria-label="메뉴">☰</button>
      <div class="nav-links" id="navLinks">
        ${links
          .map(
            (l) => `<a href="${l.href}" class="nav-link ${l.key === activePage ? "active" : ""}">${l.label}</a>`
          )
          .join("")}
        <button id="logoutBtn" class="nav-link nav-logout">🚪 로그아웃</button>
      </div>
    </div>
  `;

  document.getElementById("navToggle").addEventListener("click", () => {
    document.getElementById("navLinks").classList.toggle("open");
  });

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await sb.auth.signOut();
    window.location.href = "index.html";
  });
};
