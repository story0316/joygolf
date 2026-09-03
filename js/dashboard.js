(async function init() {
  const session = await JoyGolf.requireSession();
  if (!session) return;
  const user = session.user;
  const profile = await JoyGolf.getOrCreateProfile(user);

  JoyGolf.renderNav("dashboard", { isAdmin: profile.is_admin });
  document.getElementById("welcomeMsg").textContent =
    `${profile.display_name}님, 오늘도 조이골프와 함께 성장해봐요 🐣`;

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
  await renderRadar(user.id);
})();

function renderLevel(practiceLogs, scoreLogs) {
  const totalBalls = practiceLogs.reduce((s, p) => s + p.ball_count, 0);
  const points = Math.round(totalBalls * 0.1 + practiceLogs.length * 2 + scoreLogs.length * 15);
  const info = JoyGolf.calcLevel(points);

  const emojis = ["🌱", "⛳", "🐛", "🎯", "🦅", "🔥", "🏆", "👑", "🐉"];
  document.getElementById("levelEmoji").textContent = emojis[info.level - 1] || "🐉";
  document.getElementById("levelTitle").textContent = `Lv.${info.level} ${info.title}`;
  document.getElementById("levelPoints").textContent = `${info.points} pt`;
  document.getElementById("progressFill").style.width = info.progress + "%";
  document.getElementById("progressHint").textContent = info.nextThreshold
    ? `다음 레벨까지 ${info.nextThreshold - info.points} pt 남았어요`
    : "최고 레벨을 달성했어요! 🎉";
}

function renderStatTiles(practiceLogs, scoreLogs) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const ballsThisMonth = practiceLogs
    .filter((p) => new Date(p.practice_date) >= monthStart)
    .reduce((s, p) => s + p.ball_count, 0);

  const bestScore = scoreLogs.length ? Math.min(...scoreLogs.map((s) => s.total_score)) : "-";
  const streak = calcStreak(practiceLogs);

  const tiles = [
    { num: ballsThisMonth, label: "이번달 연습공" },
    { num: practiceLogs.length, label: "누적 연습인증" },
    { num: scoreLogs.length, label: "누적 라운드" },
    { num: bestScore, label: "베스트 스코어" },
    { num: streak, label: "연속 연습일 🔥" },
  ];

  document.getElementById("statTiles").innerHTML = tiles
    .map((t) => `<div class="stat-tile"><div class="num">${t.num}</div><div class="label">${t.label}</div></div>`)
    .join("");
}

function calcStreak(practiceLogs) {
  const days = new Set(practiceLogs.map((p) => p.practice_date));
  let streak = 0;
  let cursor = new Date();
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}

function renderBadges(practiceLogs, scoreLogs) {
  const badges = [];
  if (practiceLogs.length >= 1) badges.push({ e: "🥉", t: "첫 연습인증" });
  if (practiceLogs.length >= 10) badges.push({ e: "🥈", t: "연습 10회" });
  if (practiceLogs.length >= 50) badges.push({ e: "🥇", t: "연습 50회" });
  if (scoreLogs.length >= 1) badges.push({ e: "⛳", t: "첫 라운드 인증" });
  if (scoreLogs.length >= 5) badges.push({ e: "🎖️", t: "라운드 5회" });
  if (scoreLogs.some((s) => s.total_score - s.par <= 18)) badges.push({ e: "💯", t: "싱글 근접(+18 이내)" });
  if (scoreLogs.some((s) => s.total_score <= 90)) badges.push({ e: "🚀", t: "90타 브레이크" });
  const streak = calcStreak(practiceLogs);
  if (streak >= 7) badges.push({ e: "🔥", t: "7일 연속 연습" });

  const el = document.getElementById("badgeList");
  const empty = document.getElementById("badgeEmpty");
  if (!badges.length) {
    empty.style.display = "block";
    el.innerHTML = "";
    return;
  }
  empty.style.display = "none";
  el.innerHTML = badges
    .map((b) => `<div class="stat-tile"><div class="num">${b.e}</div><div class="label">${b.t}</div></div>`)
    .join("");
}

function renderRecentActivity(practiceLogs, scoreLogs) {
  const items = [
    ...practiceLogs.slice(0, 5).map((p) => ({
      date: p.practice_date,
      text: `🏋️ 연습 인증 · 공 ${p.ball_count}개${p.location ? " · " + JoyGolf.escapeHtml(p.location) : ""}`,
    })),
    ...scoreLogs.slice(0, 5).map((s) => ({
      date: s.round_date,
      text: `⛳ 라운드 인증 · ${s.total_score}타 (${s.course_name ? JoyGolf.escapeHtml(s.course_name) : "코스미기재"})`,
    })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  const el = document.getElementById("recentActivity");
  const empty = document.getElementById("activityEmpty");
  if (!items.length) {
    empty.style.display = "block";
    el.innerHTML = "";
    return;
  }
  empty.style.display = "none";
  el.innerHTML = items
    .map(
      (i) => `<div class="list-item"><div class="list-item-head"><span>${i.text}</span><span class="hint">${JoyGolf.formatDate(i.date)}</span></div></div>`
    )
    .join("");
}

function renderUpcomingMeetups(meetups) {
  const el = document.getElementById("upcomingMeetups");
  const empty = document.getElementById("meetupEmpty");
  if (!meetups.length) {
    empty.style.display = "block";
    el.innerHTML = "";
    return;
  }
  empty.style.display = "none";
  el.innerHTML = meetups
    .map(
      (m) => `<div class="list-item"><div class="list-item-head">
        <span><strong>${JoyGolf.escapeHtml(m.title)}</strong></span>
        <span class="badge badge-green">${new Date(m.meetup_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}</span>
      </div>
      <div class="hint">${JoyGolf.escapeHtml(m.location || "장소 미정")}</div>
      </div>`
    )
    .join("");
}

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
      get: (r) => (r ? (r.avg_score_to_par_prev90d ?? null) - (r.avg_score_to_par_90d ?? null) : null),
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

  const hasAnyData = !!me || !!meP;
  document.getElementById("radarHint").textContent = hasAnyData
    ? "공개 프로필 회원들과 비교한 상대적 위치예요 (본인 데이터만 비교에 사용)."
    : "아직 인증 기록이 없어요. 연습/스코어 인증을 등록하면 육각형이 채워져요!";

  new Chart(document.getElementById("radarChart"), {
    type: "radar",
    data: {
      labels: axes.map((a) => a.label),
      datasets: [
        {
          label: "내 역량",
          data: values,
          backgroundColor: "rgba(34, 160, 107, 0.25)",
          borderColor: "#22a06b",
          borderWidth: 2,
          pointBackgroundColor: "#ff8a3d",
        },
      ],
    },
    options: {
      scales: { r: { min: 0, max: 100, ticks: { display: false }, pointLabels: { font: { size: 12 } } } },
      plugins: { legend: { display: false } },
    },
  });
}
