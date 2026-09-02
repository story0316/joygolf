// Supabase JS 클라이언트 초기화 (CDN UMD 빌드 사용, 빌드 도구 불필요)
const sb = window.supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_ANON_KEY
);
window.sb = sb;

// 여러 페이지에서 재사용하는 공통 유틸
window.JoyGolf = window.JoyGolf || {};

JoyGolf.requireSession = async function requireSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
    return null;
  }
  return session;
};

JoyGolf.getOrCreateProfile = async function getOrCreateProfile(user) {
  let { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) {
    const { data: created, error } = await sb
      .from("profiles")
      .insert({
        id: user.id,
        display_name: user.email.split("@")[0],
      })
      .select()
      .single();
    if (error) console.error(error);
    profile = created;
  }
  return profile;
};

JoyGolf.calcLevel = function calcLevel(points) {
  const thresholds = window.APP_CONFIG.LEVEL_THRESHOLDS;
  const titles = window.APP_CONFIG.LEVEL_TITLES;
  let level = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (points >= thresholds[i]) level = i;
  }
  const nextThreshold = thresholds[level + 1];
  const curThreshold = thresholds[level];
  const progress = nextThreshold
    ? Math.min(100, Math.round(((points - curThreshold) / (nextThreshold - curThreshold)) * 100))
    : 100;
  return {
    level: level + 1,
    title: titles[level] || titles[titles.length - 1],
    progress,
    points,
    nextThreshold: nextThreshold ?? null,
  };
};

JoyGolf.escapeHtml = function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

JoyGolf.formatDate = function formatDate(d) {
  const date = new Date(d);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

JoyGolf.showToast = function showToast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
};

JoyGolf.uploadProof = async function uploadProof(file, folder) {
  if (!file) return null;
  const ext = file.name.split(".").pop();
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from("proof-photos").upload(path, file);
  if (error) throw error;
  const { data } = sb.storage.from("proof-photos").getPublicUrl(path);
  return data.publicUrl;
};
