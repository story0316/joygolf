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
  document.getElementById("monthLabel").textContent =
    `${now.getFullYear()}년 ${now.getMonth() + 1}월, 이번 달의 주인공은 누구일까요?`;

  const wrap = document.getElementById("awardWrap");
  wrap.innerHTML = JoyGolf.skeleton(3);

  const { data, error } = await sb.rpc("get_monthly_awards");

  if (error) {
    wrap.innerHTML = `<div class="empty-state">
      <span class="emoji">⚠️</span>이달의 상을 불러오지 못했어요.<br />
      <span class="hint">${JoyGolf.escapeHtml(error.message)}</span>
    </div>`;
    return;
  }

  const byType = {};
  (data || []).forEach((row) => {
    (byType[row.award_type] ||= []).push(row);
  });

  wrap.innerHTML = Object.keys(awardMeta)
    .map((type) => {
      const meta = awardMeta[type];
      const rows = (byType[type] || []).sort((a, b) => a.rank - b.rank);

      return `
      <section class="award-card reveal">
        <div class="award-title">
          <span class="card-icon">${meta.icon}</span>
          이달의 ${type}
        </div>
        <p class="hint">${meta.desc}</p>
        ${
          rows.length
            ? rows
                .map(
                  (r) => `
              <div class="rank-row rank-row-${r.rank}">
                <span class="rank-medal">${medals[r.rank - 1] || r.rank}</span>
                <span class="rank-name">${r.avatar_emoji} ${JoyGolf.escapeHtml(r.display_name)}</span>
                <span class="rank-value">
                  ${Number(r.value).toFixed(type === "스코어 향상상" ? 1 : 0)}${meta.unit}
                </span>
              </div>`
                )
                .join("")
            : `<p class="empty-state mt-16"><span class="emoji">🫥</span>아직 이달의 기록이 없어요.</p>`
        }
      </section>`;
    })
    .join("");
})();
