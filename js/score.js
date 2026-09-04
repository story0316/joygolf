let currentUserId = null;

(async function init() {
  const session = await JoyGolf.requireSession();
  if (!session) return;
  currentUserId = session.user.id;
  const profile = await JoyGolf.getOrCreateProfile(session.user);
  JoyGolf.renderNav("score", { isAdmin: profile.is_admin });

  document.getElementById("roundDate").valueAsDate = new Date();
  document.getElementById("scoreList").innerHTML = JoyGolf.skeleton(4);
  await loadList();
  JoyGolf.revealCards();
})().catch((err) => JoyGolf.fatal(err));

document.getElementById("scoreForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "등록 중…";

  try {
    const file = document.getElementById("photo").files[0];
    let photoUrl = null;
    if (file) photoUrl = await JoyGolf.uploadProof(file, `score/${currentUserId}`);

    const num = (id) => {
      const v = document.getElementById(id).value;
      return v === "" ? null : Number(v);
    };

    const { error } = await sb.from("score_logs").insert({
      user_id: currentUserId,
      round_date: document.getElementById("roundDate").value,
      course_name: document.getElementById("courseName").value || null,
      total_score: Number(document.getElementById("totalScore").value),
      par: Number(document.getElementById("par").value) || 72,
      putts: num("putts"),
      fairways_hit: num("fairwaysHit"),
      fairways_total: num("fairwaysTotal"),
      gir: num("girHit"),
      gir_total: num("girTotal"),
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
    submitBtn.textContent = "✅ 인증 등록";
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

  if (error) {
    empty.hidden = true;
    document.getElementById("scoreTotal").textContent = "0건";
    el.innerHTML = JoyGolf.errorState("스코어 기록을 불러오지 못했어요", error);
    return;
  }

  const logs = data || [];
  empty.hidden = logs.length > 0;
  document.getElementById("scoreTotal").textContent = `${logs.length}건`;

  el.innerHTML = logs
    .map((s) => {
      const diff = s.total_score - s.par;
      const diffLabel = diff === 0 ? "이븐파" : diff > 0 ? `+${diff}` : `${diff}`;

      const details = [
        s.putts != null ? `퍼팅 ${s.putts}` : null,
        s.fairways_hit != null ? `페어웨이 ${s.fairways_hit}/${s.fairways_total}` : null,
        s.gir != null ? `GIR ${s.gir}/${s.gir_total}` : null,
      ].filter(Boolean);

      return `
    <div class="list-item">
      <div class="list-item-head">
        <span class="list-item-title">
          ⛳ ${JoyGolf.formatDate(s.round_date)} · <strong>${s.total_score}타</strong>
          <span class="badge ${diff <= 0 ? "badge-green" : "badge-orange"}">${diffLabel}</span>
        </span>
        <span class="badge ${s.verified ? "badge-green" : "badge-gray"}">
          <span class="dot"></span>${s.verified ? "검증완료" : "검증대기"}
        </span>
      </div>
      ${s.course_name ? `<p class="hint">📍 ${JoyGolf.escapeHtml(s.course_name)}</p>` : ""}
      ${details.length ? `<p class="hint">${details.join(" · ")}</p>` : ""}
      ${s.note ? `<p class="hint">💬 ${JoyGolf.escapeHtml(s.note)}</p>` : ""}
      ${s.photo_url ? `<img src="${s.photo_url}" class="proof-thumb" alt="스코어카드" loading="lazy" />` : ""}
      ${
        s.verified
          ? ""
          : `<div class="list-item-actions">
               <button class="btn btn-sm btn-danger" onclick="deleteScore('${s.id}')">삭제</button>
             </div>`
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
