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

// 'YYYY-MM-DD' (로컬 타임존 기준).
// toISOString()은 UTC라 KST 새벽에는 하루 전 날짜가 나와, 연속 기록 계산이 어긋난다.
JoyGolf.toLocalDateKey = function toLocalDateKey(d) {
  const date = d instanceof Date ? d : new Date(d);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

JoyGolf.formatDate = function formatDate(d) {
  const date = new Date(d);
  const today = JoyGolf.toLocalDateKey(new Date());
  const key = JoyGolf.toLocalDateKey(date);
  if (key === today) return "오늘";

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === JoyGolf.toLocalDateKey(yesterday)) return "어제";

  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

// 로딩 중 자리를 잡아주는 스켈레톤 (레이아웃 흔들림 방지)
JoyGolf.skeleton = function skeleton(rows) {
  return Array.from({ length: rows || 3 })
    .map(
      () => `<div class="list-item">
        <div class="skeleton skeleton-line" style="width:62%"></div>
        <div class="skeleton skeleton-line short mb-0"></div>
      </div>`
    )
    .join("");
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
