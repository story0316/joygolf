let currentUserId = null;

(async function init() {
  const session = await JoyGolf.requireSession();
  if (!session) return;
  currentUserId = session.user.id;
  const profile = await JoyGolf.getOrCreateProfile(session.user);
  JoyGolf.renderNav("practice", { isAdmin: profile.is_admin });

  document.getElementById("practiceDate").valueAsDate = new Date();
  document.getElementById("practiceList").innerHTML = JoyGolf.skeleton(4);
  await loadList();
})();

document.getElementById("practiceForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "등록 중…";

  try {
    const file = document.getElementById("photo").files[0];
    let photoUrl = null;
    if (file) photoUrl = await JoyGolf.uploadProof(file, `practice/${currentUserId}`);

    const { error } = await sb.from("practice_logs").insert({
      user_id: currentUserId,
      practice_date: document.getElementById("practiceDate").value,
      ball_count: Number(document.getElementById("ballCount").value),
      location: document.getElementById("location").value || null,
      note: document.getElementById("note").value || null,
      photo_url: photoUrl,
    });
    if (error) throw error;

    JoyGolf.showToast("🎉 연습 인증 완료! 육각형이 조금 더 채워졌어요.");
    document.getElementById("practiceForm").reset();
    document.getElementById("practiceDate").valueAsDate = new Date();
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
    .from("practice_logs")
    .select("*")
    .eq("user_id", currentUserId)
    .order("practice_date", { ascending: false })
    .limit(30);

  const el = document.getElementById("practiceList");
  const logs = error ? [] : data || [];

  document.getElementById("practiceEmpty").hidden = logs.length > 0;
  document.getElementById("practiceTotal").textContent = `${logs.length}건`;

  el.innerHTML = logs
    .map(
      (p) => `
    <div class="list-item">
      <div class="list-item-head">
        <span class="list-item-title">
          🏋️ ${JoyGolf.formatDate(p.practice_date)} · 공 ${p.ball_count.toLocaleString()}개
        </span>
        <span class="badge ${p.verified ? "badge-green" : "badge-gray"}">
          <span class="dot"></span>${p.verified ? "검증완료" : "검증대기"}
        </span>
      </div>
      ${p.location ? `<p class="hint">📍 ${JoyGolf.escapeHtml(p.location)}</p>` : ""}
      ${p.note ? `<p class="hint">💬 ${JoyGolf.escapeHtml(p.note)}</p>` : ""}
      ${p.photo_url ? `<img src="${p.photo_url}" class="proof-thumb" alt="연습 인증샷" loading="lazy" />` : ""}
      ${
        p.verified
          ? ""
          : `<div class="list-item-actions">
               <button class="btn btn-sm btn-danger" onclick="deletePractice('${p.id}')">삭제</button>
             </div>`
      }
    </div>`
    )
    .join("");
}

window.deletePractice = async function deletePractice(id) {
  if (!confirm("이 연습 기록을 삭제할까요?")) return;
  const { error } = await sb.from("practice_logs").delete().eq("id", id);
  if (error) {
    JoyGolf.showToast("⚠️ 삭제 실패: " + error.message);
    return;
  }
  JoyGolf.showToast("삭제했어요.");
  await loadList();
};
