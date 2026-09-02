let currentUserId = null;
const typeLabel = { round: "⛳ 라운딩", practice: "🏋️ 연습", etc: "🎉 기타" };

(async function init() {
  const session = await JoyGolf.requireSession();
  if (!session) return;
  currentUserId = session.user.id;
  await JoyGolf.getOrCreateProfile(session.user);
  JoyGolf.renderNav("meetup");

  const d = new Date();
  d.setHours(d.getHours() + 3);
  document.getElementById("meetupDate").value = d.toISOString().slice(0, 16);

  await loadList();
})();

document.getElementById("meetupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;
  try {
    const { data: meetup, error } = await sb
      .from("meetups")
      .insert({
        host_id: currentUserId,
        title: document.getElementById("title").value,
        meetup_type: document.getElementById("meetupType").value,
        meetup_date: new Date(document.getElementById("meetupDate").value).toISOString(),
        location: document.getElementById("location").value || null,
        max_people: Number(document.getElementById("maxPeople").value) || 4,
        description: document.getElementById("description").value || null,
      })
      .select()
      .single();
    if (error) throw error;

    // 호스트는 자동으로 참석 처리
    await sb.from("meetup_rsvps").insert({ meetup_id: meetup.id, user_id: currentUserId, status: "going" });

    JoyGolf.showToast("📅 모임을 만들었어요!");
    document.getElementById("meetupForm").reset();
    document.getElementById("maxPeople").value = 4;
    await loadList();
  } catch (err) {
    JoyGolf.showToast("⚠️ " + (err.message || "생성 실패"));
  } finally {
    submitBtn.disabled = false;
  }
});

async function loadList() {
  const { data: meetups, error } = await sb
    .from("meetups")
    .select("*")
    .gte("meetup_date", new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString())
    .order("meetup_date", { ascending: true });

  const el = document.getElementById("meetupList");
  const empty = document.getElementById("meetupEmpty");
  if (error || !meetups || !meetups.length) {
    empty.style.display = "block";
    el.innerHTML = "";
    return;
  }
  empty.style.display = "none";

  const meetupIds = meetups.map((m) => m.id);
  const userIds = [...new Set(meetups.map((m) => m.host_id))];

  const [{ data: rsvps }, { data: profiles }] = await Promise.all([
    sb.from("meetup_rsvps").select("*").in("meetup_id", meetupIds),
    sb.from("profiles").select("id, display_name, avatar_emoji").in("id", userIds.length ? userIds : ["-"]),
  ]);

  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  const rsvpsByMeetup = {};
  (rsvps || []).forEach((r) => {
    (rsvpsByMeetup[r.meetup_id] ||= []).push(r);
  });

  el.innerHTML = meetups
    .map((m) => {
      const rs = rsvpsByMeetup[m.id] || [];
      const going = rs.filter((r) => r.status === "going");
      const myRsvp = rs.find((r) => r.user_id === currentUserId);
      const host = profileMap[m.host_id];
      const dateStr = new Date(m.meetup_date).toLocaleString("ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

      return `
      <div class="list-item">
        <div class="list-item-head">
          <span><strong>${JoyGolf.escapeHtml(m.title)}</strong> <span class="badge badge-orange">${typeLabel[m.meetup_type] || "🎉"}</span></span>
          <span class="badge badge-green">${going.length}/${m.max_people}명</span>
        </div>
        <div class="hint">🗓️ ${dateStr} · 📍 ${JoyGolf.escapeHtml(m.location || "장소 미정")} · 호스트 ${host ? JoyGolf.escapeHtml(host.display_name) : ""}</div>
        ${m.description ? `<div class="hint">${JoyGolf.escapeHtml(m.description)}</div>` : ""}
        <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-sm ${myRsvp?.status === "going" ? "" : "btn-outline"}" onclick="rsvp('${m.id}','going')">✋ 참가</button>
          <button class="btn btn-sm ${myRsvp?.status === "maybe" ? "btn-orange" : "btn-outline"}" onclick="rsvp('${m.id}','maybe')">🤔 미정</button>
          <button class="btn btn-sm btn-outline" onclick="rsvp('${m.id}','cancelled')">✖ 불참</button>
          ${m.host_id === currentUserId ? `<button class="btn btn-sm btn-danger" onclick="deleteMeetup('${m.id}')">삭제</button>` : ""}
        </div>
      </div>`;
    })
    .join("");
}

window.rsvp = async function rsvp(meetupId, status) {
  const { error } = await sb
    .from("meetup_rsvps")
    .upsert({ meetup_id: meetupId, user_id: currentUserId, status }, { onConflict: "meetup_id,user_id" });
  if (error) {
    JoyGolf.showToast("⚠️ " + error.message);
    return;
  }
  JoyGolf.showToast(status === "going" ? "참가 신청 완료! ⛳" : status === "maybe" ? "미정으로 표시했어요." : "불참으로 표시했어요.");
  await loadList();
};

window.deleteMeetup = async function deleteMeetup(id) {
  if (!confirm("이 모임을 삭제할까요?")) return;
  const { error } = await sb.from("meetups").delete().eq("id", id);
  if (error) {
    JoyGolf.showToast("⚠️ " + error.message);
    return;
  }
  JoyGolf.showToast("모임을 삭제했어요.");
  await loadList();
};
