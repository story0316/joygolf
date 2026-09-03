let isAdmin = false;

const SUSPICIOUS_BALL_COUNT = 500; // 하루 500개 초과면 이상치로 플래깅
const SUSPICIOUS_SCORE_MIN = 50; // 이보다 낮은 토탈 스코어는 오타 가능성으로 플래깅
const SUSPICIOUS_SCORE_MAX = 200; // 이보다 높은 토탈 스코어도 오타 가능성으로 플래깅

(async function init() {
  const session = await JoyGolf.requireSession();
  if (!session) return;
  const profile = await JoyGolf.getOrCreateProfile(session.user);
  isAdmin = !!profile.is_admin;

  JoyGolf.renderNav("admin", { isAdmin });

  if (!isAdmin) {
    document.getElementById("notAdmin").style.display = "block";
    return;
  }
  document.getElementById("adminContent").style.display = "block";

  await Promise.all([loadPracticeQueue(), loadScoreQueue()]);
})();

async function loadPracticeQueue() {
  const { data: logs, error } = await sb
    .from("practice_logs")
    .select("*")
    .eq("verified", false)
    .order("practice_date", { ascending: false });

  const el = document.getElementById("practiceQueue");
  const empty = document.getElementById("practiceEmpty");
  document.getElementById("practiceCount").textContent = logs?.length || 0;

  if (error || !logs || !logs.length) {
    empty.style.display = "block";
    el.innerHTML = "";
    return;
  }
  empty.style.display = "none";

  const userIds = [...new Set(logs.map((l) => l.user_id))];
  const { data: profiles } = await sb.from("profiles").select("id, display_name, avatar_emoji").in("id", userIds);
  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

  el.innerHTML = logs
    .map((p) => {
      const author = profileMap[p.user_id];
      const suspicious = p.ball_count > SUSPICIOUS_BALL_COUNT;
      return `
      <div class="list-item">
        <div class="list-item-head">
          <span>${author ? author.avatar_emoji : "🏌️"} <strong>${author ? JoyGolf.escapeHtml(author.display_name) : "알 수 없음"}</strong> · ${JoyGolf.formatDate(p.practice_date)} · 공 ${p.ball_count}개 ${p.location ? "· " + JoyGolf.escapeHtml(p.location) : ""}</span>
          ${suspicious ? `<span class="badge badge-orange">⚠️ 이상치 의심</span>` : ""}
        </div>
        ${p.note ? `<div class="hint">${JoyGolf.escapeHtml(p.note)}</div>` : ""}
        ${p.photo_url ? `<img src="${p.photo_url}" class="proof-thumb" alt="인증샷" />` : `<p class="hint">사진 없음</p>`}
        <div style="margin-top:8px; display:flex; gap:8px;">
          <button class="btn btn-sm" onclick="approvePractice('${p.id}')">✅ 승인</button>
          <button class="btn btn-sm btn-danger" onclick="rejectPractice('${p.id}')">✖ 반려</button>
        </div>
      </div>`;
    })
    .join("");
}

async function loadScoreQueue() {
  const { data: logs, error } = await sb
    .from("score_logs")
    .select("*")
    .eq("verified", false)
    .order("round_date", { ascending: false });

  const el = document.getElementById("scoreQueue");
  const empty = document.getElementById("scoreEmpty");
  document.getElementById("scoreCount").textContent = logs?.length || 0;

  if (error || !logs || !logs.length) {
    empty.style.display = "block";
    el.innerHTML = "";
    return;
  }
  empty.style.display = "none";

  const userIds = [...new Set(logs.map((l) => l.user_id))];
  const { data: profiles } = await sb.from("profiles").select("id, display_name, avatar_emoji").in("id", userIds);
  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

  el.innerHTML = logs
    .map((s) => {
      const author = profileMap[s.user_id];
      const suspicious = s.total_score < SUSPICIOUS_SCORE_MIN || s.total_score > SUSPICIOUS_SCORE_MAX;
      return `
      <div class="list-item">
        <div class="list-item-head">
          <span>${author ? author.avatar_emoji : "⛳"} <strong>${author ? JoyGolf.escapeHtml(author.display_name) : "알 수 없음"}</strong> · ${JoyGolf.formatDate(s.round_date)} · ${s.total_score}타 ${s.course_name ? "· " + JoyGolf.escapeHtml(s.course_name) : ""}</span>
          ${suspicious ? `<span class="badge badge-orange">⚠️ 이상치 의심</span>` : ""}
        </div>
        ${s.note ? `<div class="hint">${JoyGolf.escapeHtml(s.note)}</div>` : ""}
        ${s.photo_url ? `<img src="${s.photo_url}" class="proof-thumb" alt="스코어카드" />` : `<p class="hint">사진 없음</p>`}
        <div style="margin-top:8px; display:flex; gap:8px;">
          <button class="btn btn-sm" onclick="approveScore('${s.id}')">✅ 승인</button>
          <button class="btn btn-sm btn-danger" onclick="rejectScore('${s.id}')">✖ 반려</button>
        </div>
      </div>`;
    })
    .join("");
}

window.approvePractice = async function approvePractice(id) {
  const { error } = await sb.from("practice_logs").update({ verified: true }).eq("id", id);
  if (error) return JoyGolf.showToast("⚠️ " + error.message);
  JoyGolf.showToast("승인했어요 ✅");
  await loadPracticeQueue();
};

window.rejectPractice = async function rejectPractice(id) {
  if (!confirm("이 연습 인증을 반려(삭제)할까요?")) return;
  const { error } = await sb.from("practice_logs").delete().eq("id", id);
  if (error) return JoyGolf.showToast("⚠️ " + error.message);
  JoyGolf.showToast("반려했어요.");
  await loadPracticeQueue();
};

window.approveScore = async function approveScore(id) {
  const { error } = await sb.from("score_logs").update({ verified: true }).eq("id", id);
  if (error) return JoyGolf.showToast("⚠️ " + error.message);
  JoyGolf.showToast("승인했어요 ✅");
  await loadScoreQueue();
};

window.rejectScore = async function rejectScore(id) {
  if (!confirm("이 스코어 인증을 반려(삭제)할까요?")) return;
  const { error } = await sb.from("score_logs").delete().eq("id", id);
  if (error) return JoyGolf.showToast("⚠️ " + error.message);
  JoyGolf.showToast("반려했어요.");
  await loadScoreQueue();
};
