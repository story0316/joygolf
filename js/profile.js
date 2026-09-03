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
  JoyGolf.revealCards();
})();

document.getElementById("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const { error } = await sb
    .from("profiles")
    .update({
      display_name: document.getElementById("displayName").value,
      avatar_emoji: document.getElementById("avatarEmoji").value || "🏌️",
      department: document.getElementById("department").value || null,
      handicap: document.getElementById("handicap").value ? Number(document.getElementById("handicap").value) : null,
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
