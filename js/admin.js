let isAdmin = false;

const SUSPICIOUS_BALL_COUNT = 500; // 하루 500개 초과면 이상치로 플래깅
const SUSPICIOUS_SCORE_MIN = 50; // 이보다 낮은 토탈 스코어는 오타 가능성
const SUSPICIOUS_SCORE_MAX = 200; // 이보다 높은 토탈 스코어도 오타 가능성

(async function init() {
  const session = await JoyGolf.requireSession();
  if (!session) return;
  const profile = await JoyGolf.getOrCreateProfile(session.user);
  isAdmin = !!profile.is_admin;

  JoyGolf.renderNav("admin", { isAdmin });

  document.getElementById("notAdmin").hidden = isAdmin;
  document.getElementById("adminContent").hidden = !isAdmin;
  if (!isAdmin) return;

  document.getElementById("practiceQueue").innerHTML = JoyGolf.skeleton(2);
  document.getElementById("scoreQueue").innerHTML = JoyGolf.skeleton(2);

  await Promise.all([loadPracticeQueue(), loadScoreQueue()]);
})();

// 대기열 항목의 작성자 프로필을 한 번에 가져온다
async function profileMapFor(logs) {
  const userIds = [...new Set(logs.map((l) => l.user_id))];
  if (!userIds.length) return {};
  const { data } = await sb.from("profiles").select("id, display_name, avatar_emoji").in("id", userIds);
  return Object.fromEntries((data || []).map((p) => [p.id, p]));
}

function queueItem({ author, headline, suspicious, note, photoUrl, approve, reject }) {
  return `
    <div class="list-item">
      <div class="list-item-head">
        <span class="list-item-title">
          ${author ? author.avatar_emoji : "🏌️"}
          <strong>${author ? JoyGolf.escapeHtml(author.display_name) : "알 수 없음"}</strong>
        </span>
        ${suspicious ? `<span class="badge badge-danger">⚠️ 이상치 의심</span>` : ""}
      </div>
      <p class="hint">${headline}</p>
      ${note ? `<p class="hint">💬 ${JoyGolf.escapeHtml(note)}</p>` : ""}
      ${
        photoUrl
          ? `<img src="${photoUrl}" class="proof-thumb" alt="인증샷" loading="lazy" />`
          : `<p class="hint">📷 사진 없음</p>`
      }
      <div class="list-item-actions">
        <button class="btn btn-sm" onclick="${approve}">✅ 승인</button>
        <button class="btn btn-sm btn-danger" onclick="${reject}">✖ 반려</button>
      </div>
    </div>`;
}

async function loadPracticeQueue() {
  const { data, error } = await sb
    .from("practice_logs")
    .select("*")
    .eq("verified", false)
    .order("practice_date", { ascending: false });

  const logs = error ? [] : data || [];
  document.getElementById("practiceCount").textContent = logs.length;
  document.getElementById("practiceEmpty").hidden = logs.length > 0;

  const profiles = await profileMapFor(logs);

  document.getElementById("practiceQueue").innerHTML = logs
    .map((p) =>
      queueItem({
        author: profiles[p.user_id],
        headline: `🏋️ ${JoyGolf.formatDate(p.practice_date)} · 공 ${p.ball_count.toLocaleString()}개${
          p.location ? " · " + JoyGolf.escapeHtml(p.location) : ""
        }`,
        suspicious: p.ball_count > SUSPICIOUS_BALL_COUNT,
        note: p.note,
        photoUrl: p.photo_url,
        approve: `approvePractice('${p.id}')`,
        reject: `rejectPractice('${p.id}')`,
      })
    )
    .join("");
}

async function loadScoreQueue() {
  const { data, error } = await sb
    .from("score_logs")
    .select("*")
    .eq("verified", false)
    .order("round_date", { ascending: false });

  const logs = error ? [] : data || [];
  document.getElementById("scoreCount").textContent = logs.length;
  document.getElementById("scoreEmpty").hidden = logs.length > 0;

  const profiles = await profileMapFor(logs);

  document.getElementById("scoreQueue").innerHTML = logs
    .map((s) =>
      queueItem({
        author: profiles[s.user_id],
        headline: `⛳ ${JoyGolf.formatDate(s.round_date)} · ${s.total_score}타${
          s.course_name ? " · " + JoyGolf.escapeHtml(s.course_name) : ""
        }`,
        suspicious: s.total_score < SUSPICIOUS_SCORE_MIN || s.total_score > SUSPICIOUS_SCORE_MAX,
        note: s.note,
        photoUrl: s.photo_url,
        approve: `approveScore('${s.id}')`,
        reject: `rejectScore('${s.id}')`,
      })
    )
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
