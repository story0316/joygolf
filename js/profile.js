let currentUserId = null;

(async function init() {
  const session = await JoyGolf.requireSession();
  if (!session) return;
  currentUserId = session.user.id;
  const profile = await JoyGolf.getOrCreateProfile(session.user);
  JoyGolf.renderNav("profile", { isAdmin: profile.is_admin });

  document.getElementById("displayName").value = profile.display_name || "";
  document.getElementById("avatarEmoji").value = profile.avatar_emoji || "🏌️";
  document.getElementById("department").value = profile.department || "";
  document.getElementById("handicap").value = profile.handicap ?? "";
  document.getElementById("visibilitySelect").value = profile.profile_visibility || "private";
  document.getElementById("awardVisibleSelect").value = String(profile.award_visible ?? true);
  await initPushSettings();
  JoyGolf.revealCards();
})().catch((err) => JoyGolf.fatal(err));

/* ---------------- 알림 설정 ---------------- */

async function initPushSettings() {
  const status = document.getElementById("pushStatus");
  const desc = document.getElementById("pushDesc");
  const enableBtn = document.getElementById("pushEnableBtn");
  const disableBtn = document.getElementById("pushDisableBtn");

  if (!JoyGolf.push.supported()) {
    status.textContent = "지원 안 함";
    desc.textContent =
      "이 브라우저는 웹 푸시를 지원하지 않아요. iPhone은 Safari에서 '홈 화면에 추가'로 설치한 뒤에 알림을 켤 수 있어요.";
    enableBtn.disabled = true;
    return;
  }

  if (!JoyGolf.push.configured()) {
    status.textContent = "설정 필요";
    desc.textContent =
      "관리자가 아직 VAPID 공개키를 설정하지 않았어요. (README의 '푸시 알림 설정' 참고)";
    enableBtn.disabled = true;
    return;
  }

  async function refresh() {
    const on = await JoyGolf.push.isEnabled();
    status.textContent = on ? "켜짐" : "꺼짐";
    status.className = "badge " + (on ? "badge-green" : "badge-gray");
    enableBtn.style.display = on ? "none" : "";
    disableBtn.style.display = on ? "" : "none";
  }

  enableBtn.addEventListener("click", async () => {
    enableBtn.disabled = true;
    try {
      await JoyGolf.push.enable(currentUserId);
      JoyGolf.showToast("🔔 이 기기에서 알림을 받도록 설정했어요.");
    } catch (err) {
      JoyGolf.showToast("⚠️ " + (err.message || "알림 설정 실패"));
    } finally {
      enableBtn.disabled = false;
      await refresh();
    }
  });

  disableBtn.addEventListener("click", async () => {
    disableBtn.disabled = true;
    try {
      await JoyGolf.push.disable();
      JoyGolf.showToast("알림을 껐어요.");
    } catch (err) {
      JoyGolf.showToast("⚠️ " + (err.message || "해제 실패"));
    } finally {
      disableBtn.disabled = false;
      await refresh();
    }
  });

  await refresh();
}

document.getElementById("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const handicap = document.getElementById("handicap").value;

  const { error } = await sb
    .from("profiles")
    .update({
      display_name: document.getElementById("displayName").value,
      avatar_emoji: document.getElementById("avatarEmoji").value || "🏌️",
      department: document.getElementById("department").value || null,
      handicap: handicap === "" ? null : Number(handicap),
    })
    .eq("id", currentUserId);

  JoyGolf.showToast(error ? "⚠️ " + error.message : "✅ 프로필을 저장했어요.");
});

document.getElementById("savePrivacyBtn").addEventListener("click", async () => {
  const { error } = await sb
    .from("profiles")
    .update({
      profile_visibility: document.getElementById("visibilitySelect").value,
      award_visible: document.getElementById("awardVisibleSelect").value === "true",
    })
    .eq("id", currentUserId);

  JoyGolf.showToast(error ? "⚠️ " + error.message : "🔒 공개 설정을 저장했어요.");
});
