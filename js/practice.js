let currentUserId = null;

(async function init() {
  const session = await JoyGolf.requireSession();
  if (!session) return;
  currentUserId = session.user.id;
  await JoyGolf.getOrCreateProfile(session.user);
  JoyGolf.renderNav("practice");
  document.getElementById("practiceDate").valueAsDate = new Date();
  await loadList();
})();

document.getElementById("practiceForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;

  try {
    const file = document.getElementById("photo").files[0];
    let photoUrl = null;
    if (file) {
      photoUrl = await JoyGolf.uploadProof(file, `practice/${currentUserId}`);
    }

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
  const empty = document.getElementById("practiceEmpty");
  if (error || !data || !data.length) {
    empty.style.display = "block";
    el.innerHTML = "";
    return;
  }
  empty.style.display = "none";

  el.innerHTML = data
    .map(
      (p) => `
    <div class="list-item">
      <div class="list-item-head">
        <span><strong>${JoyGolf.formatDate(p.practice_date)}</strong> · 공 ${p.ball_count}개 ${p.location ? "· " + JoyGolf.escapeHtml(p.location) : ""}</span>
        <span class="badge ${p.verified ? "badge-green" : "badge-gray"}">${p.verified ? "✅ 검증완료" : "검증대기"}</span>
      </div>
      ${p.note ? `<div class="hint">${JoyGolf.escapeHtml(p.note)}</div>` : ""}
      ${p.photo_url ? `<img src="${p.photo_url}" class="proof-thumb" alt="인증샷" />` : ""}
      ${
        !p.verified
          ? `<button class="btn btn-sm btn-danger" style="margin-top:8px;" onclick="deletePractice('${p.id}')">삭제</button>`
          : ""
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
