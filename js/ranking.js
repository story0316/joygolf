const awardMeta = {
  "연습왕": { icon: "🏋️", desc: "이번 달 누적 연습공 개수 1위", unit: "개" },
  "꾸준상": { icon: "🔥", desc: "이번 달 연습 인증 일수 1위", unit: "일" },
  "스코어 향상상": { icon: "📈", desc: "전월 대비 평균 스코어 개선폭 1위 (2라운드 이상)", unit: "타 개선" },
};
const medals = ["🥇", "🥈", "🥉"];

(async function init() {
  const session = await JoyGolf.requireSession();
  if (!session) return;
  const profile = await JoyGolf.getOrCreateProfile(session.user);
  JoyGolf.renderNav("ranking", { isAdmin: profile.is_admin });

  const now = new Date();
  document.getElementById("monthLabel").textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 시상`;

  const { data, error } = await sb.rpc("get_monthly_awards");
  const wrap = document.getElementById("awardWrap");

  if (error) {
    wrap.innerHTML = `<div class="card empty-state">⚠️ 이달의 상을 불러오지 못했어요: ${JoyGolf.escapeHtml(error.message)}</div>`;
    return;
  }

  const byType = {};
  (data || []).forEach((row) => {
    (byType[row.award_type] ||= []).push(row);
  });

  const types = Object.keys(awardMeta);
  wrap.innerHTML = types
    .map((type) => {
      const meta = awardMeta[type];
      const rows = (byType[type] || []).sort((a, b) => a.rank - b.rank);
      return `
      <div class="award-card">
        <div class="award-title">${meta.icon} 이달의 ${type}</div>
        <p class="hint" style="margin: 0 0 12px;">${meta.desc}</p>
        ${
          rows.length
            ? rows
                .map(
                  (r) => `
              <div class="rank-row">
                <span class="rank-medal">${medals[r.rank - 1] || r.rank}</span>
                <span class="rank-name">${r.avatar_emoji} ${JoyGolf.escapeHtml(r.display_name)}</span>
                <span class="rank-value">${Number(r.value).toFixed(type === "스코어 향상상" ? 1 : 0)}${meta.unit}</span>
              </div>`
                )
                .join("")
            : `<p class="empty-state">아직 이달의 기록이 없어요.</p>`
        }
      </div>`;
    })
    .join("");

  JoyGolf.revealCards();
})();
