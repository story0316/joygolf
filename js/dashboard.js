let radarChart = null;
let radarState = null; // 테마 전환 시 같은 데이터로 다시 그리기 위해 보관
let trendState = null;

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

  const [practiceRes, scoreRes, meetupRes] = await Promise.all([
    sb.from("practice_logs").select("*").eq("user_id", user.id).order("practice_date", { ascending: false }),
    sb.from("score_logs").select("*").eq("user_id", user.id).order("round_date", { ascending: false }),
    sb.from("meetups").select("*").gte("meetup_date", new Date().toISOString()).order("meetup_date").limit(3),
  ]);

  // 연습/스코어는 레벨·배지·차트 전부의 입력이라, 실패했는데 0으로 그리면
  // "기록이 다 날아갔다"로 보인다. 이건 페이지 단위 오류로 올린다.
  if (practiceRes.error) throw new Error("연습 기록을 불러오지 못했어요: " + practiceRes.error.message);
  if (scoreRes.error) throw new Error("스코어 기록을 불러오지 못했어요: " + scoreRes.error.message);

  const practiceLogs = practiceRes.data || [];
  const scoreLogs = scoreRes.data || [];

  // 모임은 대시보드의 곁가지라, 실패해도 나머지는 보여주고 그 카드에만 표시한다
  if (meetupRes.error) {
    document.getElementById("meetupEmpty").hidden = true;
    document.getElementById("upcomingMeetups").innerHTML =
      JoyGolf.errorState("모임을 불러오지 못했어요", meetupRes.error);
  } else {
    renderUpcomingMeetups(meetupRes.data || []);
  }

  renderLevel(practiceLogs, scoreLogs);
  renderStatTiles(practiceLogs, scoreLogs);
  renderBadges(practiceLogs, scoreLogs);
  renderRecentActivity(practiceLogs, scoreLogs);
  renderScoreTrend(scoreLogs);
  await renderRadar(user.id);

  JoyGolf.revealCards();

  // 테마를 바꾸면 차트 색상도 따라가야 해서 다시 그린다
  document.addEventListener("joygolf:themechange", () => {
    drawTrend();
    drawRadar();
  });
})().catch((err) => JoyGolf.fatal(err));

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

/* ---------------- 차트 공통 ---------------- */

// 두 차트가 공유하는 테마 색상
function chartTheme() {
  const isDark = window.JoyTheme && JoyTheme.current() === "dark";
  return {
    isDark,
    gridColor: isDark ? "rgba(255, 255, 255, 0.09)" : "rgba(6, 46, 34, 0.09)",
    labelColor: isDark ? "#93a79d" : "#556a61",
    line: isDark ? "#34d399" : "#10b981",
    fill: isDark ? "rgba(52, 211, 153, 0.18)" : "rgba(16, 185, 129, 0.16)",
    pointBorder: isDark ? "#080d0b" : "#ffffff",
  };
}

// 테마를 바꾸면 같은 캔버스에 다시 그리므로 기존 인스턴스를 먼저 정리한다
function resetCanvas(id) {
  const canvas = document.getElementById(id);
  const existing = typeof Chart.getChart === "function" ? Chart.getChart(canvas) : null;
  if (existing && typeof existing.destroy === "function") existing.destroy();
  return canvas;
}

/* ---------------- 스코어 추이 ---------------- */
function renderScoreTrend(scoreLogs) {
  const hint = document.getElementById("trendHint");
  const empty = document.getElementById("trendEmpty");
  const canvas = document.getElementById("scoreTrendChart");

  // 오래된 라운드부터 최근 12개
  const rounds = scoreLogs
    .slice()
    .sort((a, b) => new Date(a.round_date) - new Date(b.round_date))
    .slice(-12);

  if (rounds.length < 2) {
    empty.hidden = false;
    canvas.closest(".chart-box").hidden = true;
    hint.textContent = "라운드를 2회 이상 인증하면 성장 그래프가 그려져요.";
    trendState = null;
    return;
  }

  empty.hidden = true;
  canvas.closest(".chart-box").hidden = false;

  const toPar = rounds.map((r) => r.total_score - r.par);
  const best = Math.min(...toPar);
  const first = toPar[0];
  const last = toPar[toPar.length - 1];
  const delta = first - last; // 양수면 개선

  hint.textContent =
    delta > 0
      ? `첫 기록 대비 ${delta.toFixed(0)}타 좋아졌어요! 베스트 +${best} 🎉`
      : delta < 0
        ? `첫 기록 대비 ${Math.abs(delta).toFixed(0)}타 늘었어요. 베스트 +${best} — 다시 달려봐요 💪`
        : `기복 없이 유지 중이에요. 베스트 +${best}`;

  trendState = { rounds, toPar };
  drawTrend();
}

function drawTrend() {
  if (!trendState) return;
  const { rounds, toPar } = trendState;
  const t = chartTheme();
  const el = resetCanvas("scoreTrendChart");

  new Chart(el, {
    type: "line",
    data: {
      labels: rounds.map((r) => JoyGolf.formatDate(r.round_date)),
      datasets: [
        {
          label: "파 대비 타수",
          data: toPar,
          borderColor: t.line,
          backgroundColor: t.fill,
          borderWidth: 2.5,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: "#a3e635",
          pointBorderColor: t.pointBorder,
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: "easeOutQuart" },
      interaction: { intersect: false, mode: "index" },
      scales: {
        y: {
          // 타수는 낮을수록 좋으니 위로 갈수록 좋아지도록 뒤집는다
          reverse: true,
          grid: { color: t.gridColor },
          border: { display: false },
          ticks: { color: t.labelColor, font: { size: 11 }, callback: (v) => (v > 0 ? `+${v}` : v) },
        },
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: t.labelColor, font: { size: 11 }, maxRotation: 0, autoSkipPadding: 12 },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const r = rounds[ctx.dataIndex];
              const d = ctx.parsed.y;
              return `${r.total_score}타 (${d > 0 ? "+" + d : d})${r.course_name ? " · " + r.course_name : ""}`;
            },
          },
        },
      },
    },
  });
}

/* ---------------- 육각형 역량 ---------------- */
async function renderRadar(userId) {
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
    me || meP ? "공개 회원과 비교한 상대 위치" : "인증하면 육각형이 채워져요!";

  radarState = { labels: axes.map((a) => a.label), values };
  drawRadar();
}

function drawRadar() {
  if (!radarState) return;
  if (radarChart) radarChart.destroy();

  const t = chartTheme();
  const canvas = resetCanvas("radarChart");

  radarChart = new Chart(canvas, {
    type: "radar",
    data: {
      labels: radarState.labels,
      datasets: [
        {
          label: "내 역량",
          data: radarState.values,
          fill: true,
          backgroundColor: t.fill,
          borderColor: t.line,
          borderWidth: 2,
          pointBackgroundColor: "#a3e635",
          pointBorderColor: t.pointBorder,
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
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
          grid: { color: t.gridColor },
          angleLines: { color: t.gridColor },
          pointLabels: { color: t.labelColor, font: { size: 11, weight: "600" } },
        },
      },
      plugins: { legend: { display: false } },
    },
  });
}
