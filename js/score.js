let currentUserId = null;

(async function init() {
  const session = await JoyGolf.requireSession();
  if (!session) return;
  currentUserId = session.user.id;
  await JoyGolf.getOrCreateProfile(session.user);
  JoyGolf.renderNav("score");
  document.getElementById("roundDate").valueAsDate = new Date();
  await loadList();
})();

document.getElementById("scoreForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;

  try {
    const file = document.getElementById("photo").files[0];
    let photoUrl = null;
    if (file) {
      photoUrl = await JoyGolf.uploadProof(file, `score/${currentUserId}`);
    }

    const fairwaysHit = document.getElementById("fairwaysHit").value;
    const fairwaysTotal = document.getElementById("fairwaysTotal").value;
    const girHit = document.getElementById("girHit").value;
    const girTotal = document.getElementById("girTotal").value;

    const { error } = await sb.from("score_logs").insert({
      user_id: currentUserId,
      round_date: document.getElementById("roundDate").value,
      course_name: document.getElementById("courseName").value || null,
      total_score: Number(document.getElementById("totalScore").value),
      par: Number(document.getElementById("par").value) || 72,
      putts: document.getElementById("putts").value ? Number(document.getElementById("putts").value) : null,
      fairways_hit: fairwaysHit ? Number(fairwaysHit) : null,
      fairways_total: fairwaysTotal ? Number(fairwaysTotal) : null,
      gir: girHit ? Number(girHit) : null,
      gir_total: girTotal ? Number(girTotal) : null,
      note: document.getElementById("note").value || null,
      photo_url: photoUrl,
    });
    if (error) throw error;

    JoyGolf.showToast("🎉 스코어 인증 완료! 성장 그래프에 반영됐어요.");
    document.getElementById("scoreForm").reset();
    document.getElementById("roundDate").valueAsDate = new Date();
    document.getElementById("par").value = 72;
    await loadList();
  } catch (err) {
    JoyGolf.showToast("⚠️ " + (err.message || "등록 실패"));
  } finally {
    submitBtn.disabled = false;
  }
});

async function loadList() {
  const { data, error } = await sb
    .from("score_logs")
    .select("*")
    .eq("user_id", currentUserId)
    .order("round_date", { ascending: false })
    .limit(30);

  const el = document.getElementById("scoreList");
  const empty = document.getElementById("scoreEmpty");
  if (error || !data || !data.length) {
    empty.style.display = "block";
    el.innerHTML = "";
    return;
  }
  empty.style.display = "none";

  el.innerHTML = data
    .map((s) => {
      const diff = s.total_score - s.par;
      const diffLabel = diff === 0 ? "이븐파" : diff > 0 ? `+${diff}` : diff;
      return `
    <div class="list-item">
      <div class="list-item-head">
        <span><strong>${JoyGolf.formatDate(s.round_date)}</strong> · ${s.total_score}타 (${diffLabel}) ${s.course_name ? "· " + JoyGolf.escapeHtml(s.course_name) : ""}</span>
        <span class="badge ${s.verified ? "badge-green" : "badge-gray"}">${s.verified ? "✅ 검증완료" : "검증대기"}</span>
      </div>
      <div class="hint">
        ${s.putts ? `퍼팅 ${s.putts} · ` : ""}${s.fairways_hit != null ? `페어웨이 ${s.fairways_hit}/${s.fairways_total} · ` : ""}${s.gir != null ? `GIR ${s.gir}/${s.gir_total}` : ""}
      </div>
      ${s.note ? `<div class="hint">${JoyGolf.escapeHtml(s.note)}</div>` : ""}
      ${s.photo_url ? `<img src="${s.photo_url}" class="proof-thumb" alt="스코어카드" />` : ""}
      ${
        !s.verified
          ? `<button class="btn btn-sm btn-danger" style="margin-top:8px;" onclick="deleteScore('${s.id}')">삭제</button>`
          : ""
      }
    </div>`;
    })
    .join("");
}

window.deleteScore = async function deleteScore(id) {
  if (!confirm("이 스코어 기록을 삭제할까요?")) return;
  const { error } = await sb.from("score_logs").delete().eq("id", id);
  if (error) {
    JoyGolf.showToast("⚠️ 삭제 실패: " + error.message);
    return;
  }
  JoyGolf.showToast("삭제했어요.");
  await loadList();
};
