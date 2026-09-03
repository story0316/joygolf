let radarChart = null;
let radarState = null; // 테마 전환 시 같은 데이터로 다시 그리기 위해 보관

(async function init() {
  const session = await JoyGolf.requireSession();
  if (!session) return;
  const user = session.user;
  const profile = await JoyGolf.getOrCreateProfile(user);

  JoyGolf.renderNav("dashboard", { isAdmin: profile.is_admin });

  document.getElementById("greeting").textContent = greetingByHour();
  document.getElementById("welcomeMsg").textContent =
    `${profile.display_name}님, 오늘도 조이골프와 함께 성장해봐요 ${profile.avatar_emoji || "🏌️"}`;

  // 로딩 동안 자리를 잡아둔다
  document.getElementById("recentActivity").innerHTML = JoyGolf.skeleton(3);
  document.getElementById("upcomingMeetups").innerHTML = JoyGolf.skeleton(2);

  const [{ data: practiceLogs }, { data: scoreLogs }, { data: meetups }] = await Promise.all([
    sb.from("practice_logs").select("*").eq("user_id", user.id).order("practice_date", { ascending: false }),
    sb.from("score_logs").select("*").eq("user_id", user.id).order("round_date", { ascending: false }),
    sb.from("meetups").select("*").gte("meetup_date", new Date().toISOString()).order("meetup_date").limit(3),
  ]);

  renderLevel(practiceLogs || [], scoreLogs || []);
  renderStatTiles(practiceLogs || [], scoreLogs || []);
  renderBadges(practiceLogs || [], scoreLogs || []);
  renderRecentActivity(practiceLogs || [], scoreLogs || []);
  renderUpcomingMeetups(meetups || []);
  await loadRadar(user.id);
})();

function greetingByHour() {
  const h = new Date().getHours();
  if (h < 6) return "늦은 밤에도 스윙 생각 중이네요";
  if (h < 11) return "좋은 아침, 오늘의 한 타";
  if (h < 17) return "오늘도 좋은 스윙 되세요";
  return "오늘 하루도 수고했어요";
}

/* ---------------- 레벨 ---------------- */
function renderLevel(practiceLogs, scoreLogs) {
  const totalBalls = practiceLogs.reduce((s, p) => s + p.ball_count, 0);
  const points = Math.round(totalBalls * 0.1 + practiceLogs.length * 2 + scoreLogs.length * 15);
  const info = JoyGolf.calcLevel(points);

  const emojis = ["🌱", "⛳", "🐛", "🎯", "🦅", "🔥", "🏆", "👑", "🐉"];

  document.getElementById("levelEmoji").textContent = emojis[info.level - 1] || "🐉";
  document.getElementById("levelChip").textContent = `Lv.${info.level}`;
  document.getElementById("levelTitle").textContent = info.title;
  document.getElementById("levelPoints").innerHTML =
    `${info.points.toLocaleString()} <span class="unit">pt</span>`;

  // 링과 막대는 페인트 이후에 채워야 전환 애니메이션이 보인다
  requestAnimationFrame(() => {
    document.getElementById("levelRing").style.setProperty("--p", info.progress);
    document.getElementById("progressFill").style.width = info.progress + "%";
  });

  document.getElementById("progressHint").textContent = info.nextThreshold
    ? `다음 레벨까지 ${(info.nextThreshold - info.points).toLocaleString()} pt 남았어요`
    : "최고 레벨을 달성했어요! 🎉";
}

/* ---------------- 스탯 타일 ---------------- */
function renderStatTiles(practiceLogs, scoreLogs) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const ballsThisMonth = practiceLogs
    .filter((p) => new Date(p.practice_date) >= monthStart)
    .reduce((s, p) => s + p.ball_count, 0);

  const bestScore = scoreLogs.length ? Math.min(...scoreLogs.map((s) => s.total_score)) : "–";

  const tiles = [
    { num: ballsThisMonth.toLocaleString(), label: "이번달 연습공" },
    { num: practiceLogs.length, label: "누적 연습인증" },
    { num: scoreLogs.length, label: "누적 라운드" },
    { num: bestScore, label: "베스트 스코어" },
    { num: calcStreak(practiceLogs), label: "연속 연습일 🔥" },
  ];

  document.getElementById("statTiles").innerHTML = tiles
    .map((t) => `<div class="stat-tile"><div class="num">${t.num}</div><div class="label">${t.label}</div></div>`)
    .join("");
}

// 오늘(또는 어제)부터 거꾸로 이어지는 연습일 수.
// 오늘 아직 연습을 안 했더라도 어제까지 이어졌다면 연속 기록은 살아있는 것으로 본다.
function calcStreak(practiceLogs) {
  const days = new Set(practiceLogs.map((p) => p.practice_date));
  const cursor = new Date();

  if (!days.has(JoyGolf.toLocalDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(JoyGolf.toLocalDateKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(JoyGolf.toLocalDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/* ---------------- 배지 ---------------- */
function renderBadges(practiceLogs, scoreLogs) {
  const badges = [];
  if (practiceLogs.length >= 1) badges.push({ e: "🥉", t: "첫 연습인증" });
  if (practiceLogs.length >= 10) badges.push({ e: "🥈", t: "연습 10회" });
  if (practiceLogs.length >= 50) badges.push({ e: "🥇", t: "연습 50회" });
  if (scoreLogs.length >= 1) badges.push({ e: "⛳", t: "첫 라운드 인증" });
  if (scoreLogs.length >= 5) badges.push({ e: "🎖️", t: "라운드 5회" });
  if (scoreLogs.some((s) => s.total_score - s.par <= 18)) badges.push({ e: "💯", t: "싱글 근접" });
  if (scoreLogs.some((s) => s.total_score <= 90)) badges.push({ e: "🚀", t: "90타 브레이크" });
  if (calcStreak(practiceLogs) >= 7) badges.push({ e: "🔥", t: "7일 연속 연습" });

  const el = document.getElementById("badgeList");
  const empty = document.getElementById("badgeEmpty");

  document.getElementById("badgeCount").textContent = badges.length;
  empty.hidden = badges.length > 0;

  el.innerHTML = badges
    .map(
      (b) => `<div class="stat-tile badge-tile"><div class="num">${b.e}</div><div class="label">${b.t}</div></div>`
    )
    .join("");
}

/* ---------------- 최근 활동 ---------------- */
function renderRecentActivity(practiceLogs, scoreLogs) {
  const items = [
    ...practiceLogs.slice(0, 5).map((p) => ({
      date: p.practice_date,
      icon: "🏋️",
      title: `연습 공 ${p.ball_count}개`,
      meta: p.location ? JoyGolf.escapeHtml(p.location) : "연습장 미기재",
    })),
    ...scoreLogs.slice(0, 5).map((s) => ({
      date: s.round_date,
      icon: "⛳",
      title: `라운드 ${s.total_score}타`,
      meta: s.course_name ? JoyGolf.escapeHtml(s.course_name) : "코스 미기재",
    })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 4);

  const el = document.getElementById("recentActivity");
  document.getElementById("activityEmpty").hidden = items.length > 0;

  el.innerHTML = items
    .map(
      (i) => `<div class="list-item timeline-item">
        <span class="timeline-icon">${i.icon}</span>
        <div class="flex-1">
          <div class="list-item-head">
            <span class="list-item-title">${i.title}</span>
            <span class="hint mt-0">${JoyGolf.formatDate(i.date)}</span>
          </div>
          <p class="hint mt-0">${i.meta}</p>
        </div>
      </div>`
    )
    .join("");
}

/* ---------------- 다가오는 모임 ---------------- */
function renderUpcomingMeetups(meetups) {
  const el = document.getElementById("upcomingMeetups");
  document.getElementById("meetupEmpty").hidden = meetups.length > 0;

  el.innerHTML = meetups
    .map(
      (m) => `<div class="list-item">
        <div class="list-item-head">
          <span class="list-item-title">${JoyGolf.escapeHtml(m.title)}</span>
          <span class="badge badge-green">
            ${new Date(m.meetup_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
          </span>
        </div>
        <p class="hint mt-0">📍 ${JoyGolf.escapeHtml(m.location || "장소 미정")}</p>
      </div>`
    )
    .join("");
}

/* ---------------- 육각형 역량 ---------------- */
async function loadRadar(userId) {
  const [{ data: radarRows }, { data: practiceRows }] = await Promise.all([
    sb.from("user_radar_raw").select("*"),
    sb.from("user_practice_raw").select("*"),
  ]);

  const rows = radarRows || [];
  const pRows = practiceRows || [];
  const me = rows.find((r) => r.user_id === userId);
  const meP = pRows.find((r) => r.user_id === userId);

  const axes = [
    { key: "fairway", label: "정확도", better: "high", get: (r) => r?.avg_fairway_pct },
    { key: "gir", label: "그린적중", better: "high", get: (r) => r?.avg_gir_pct },
    { key: "putts", label: "퍼팅", better: "low", get: (r) => r?.avg_putts },
    { key: "score", label: "스코어", better: "low", get: (r) => r?.avg_score_to_par_90d },
    {
      key: "growth",
      label: "성장",
      better: "high",
      // 직전 90일 대비 최근 90일 개선폭. 어느 한쪽이라도 비면 비교 불가로 둔다.
      get: (r) => {
        const prev = r?.avg_score_to_par_prev90d;
        const cur = r?.avg_score_to_par_90d;
        if (prev == null || cur == null) return null;
        return prev - cur;
      },
    },
    { key: "consistency", label: "꾸준함", better: "high", get: (r) => r?.sessions_30d },
  ];

  const values = axes.map((axis) => {
    const source = axis.key === "consistency" ? pRows : rows;
    const mine = axis.key === "consistency" ? meP : me;
    const all = source.map(axis.get).filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
    const mineVal = axis.get(mine);

    if (mineVal === null || mineVal === undefined || Number.isNaN(mineVal) || all.length === 0) return 15;

    const min = Math.min(...all);
    const max = Math.max(...all);
    if (max === min) return 60;

    const ratio = (mineVal - min) / (max - min);
    const score = axis.better === "high" ? ratio : 1 - ratio;
    return Math.round(Math.max(5, Math.min(100, score * 100)));
  });

  document.getElementById("radarHint").textContent =
    me || meP
      ? "공개 프로필 회원들과 비교한 상대적 위치예요."
      : "아직 인증 기록이 없어요. 인증을 등록하면 육각형이 채워져요!";

  radarState = { labels: axes.map((a) => a.label), values };
  drawRadar();
}

// hex(#rgb/#rrggbb)를 rgba 문자열로. canvas fillStyle은 color-mix()를 못 읽는 브라우저가 있다.
function withAlpha(color, alpha) {
  const hex = String(color).trim();
  const m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  const m6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  let r, g, b;
  if (m6) {
    [r, g, b] = [m6[1], m6[2], m6[3]].map((h) => parseInt(h, 16));
  } else if (m3) {
    [r, g, b] = [m3[1], m3[2], m3[3]].map((h) => parseInt(h + h, 16));
  } else {
    return hex; // rgb()/named color 등은 그대로 넘긴다
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawRadar() {
  if (!radarState) return;
  if (radarChart) radarChart.destroy();

  // 색을 CSS 토큰에서 읽어와 다크/라이트 어느 쪽에서도 대비가 유지되게 한다
  const accent = JoyGolf.cssVar("--accent") || "#34d399";
  const lime = JoyGolf.cssVar("--lime") || "#a3e635";
  const text = JoyGolf.cssVar("--text-muted") || "#93a79d";
  const grid = JoyGolf.cssVar("--border") || "rgba(255,255,255,0.09)";

  radarChart = new Chart(document.getElementById("radarChart"), {
    type: "radar",
    data: {
      labels: radarState.labels,
      datasets: [
        {
          label: "내 역량",
          data: radarState.values,
          fill: true,
          backgroundColor: withAlpha(accent, 0.22),
          borderColor: accent,
          borderWidth: 2,
          pointBackgroundColor: lime,
          pointBorderColor: accent,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.05,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: "easeOutQuart" },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { display: false, stepSize: 25 },
          grid: { color: grid },
          angleLines: { color: grid },
          pointLabels: { color: text, font: { size: 12, weight: "600" } },
        },
      },
      plugins: { legend: { display: false } },
    },
  });
}

// 테마가 바뀌면 차트 색도 따라가야 한다
window.addEventListener("joygolf:themechange", drawRadar);
