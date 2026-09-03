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

// 프로필은 모든 페이지가 의존하는 값이라, 실패하면 undefined 를 돌려주는 대신
// 원인을 담아 throw 한다. (예전엔 조용히 undefined 를 반환해서 호출부가
// profile.display_name 에서 TypeError 로 죽고 화면이 백지가 됐다)
JoyGolf.getOrCreateProfile = async function getOrCreateProfile(user) {
  // 없을 수도 있는 조회이므로 single() 이 아니라 maybeSingle()
  const { data: profile, error: readError } = await sb
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) {
    throw new Error("프로필을 불러오지 못했어요: " + readError.message);
  }
  if (profile) return profile;

  const { data: created, error: insertError } = await sb
    .from("profiles")
    .insert({
      id: user.id,
      display_name: user.email.split("@")[0],
    })
    .select()
    .single();

  if (insertError) {
    throw new Error("프로필을 만들지 못했어요: " + insertError.message);
  }
  return created;
};

// 페이지 전체를 못 그릴 정도의 실패를 사용자가 읽을 수 있는 화면으로 바꾼다.
// 콘솔을 열지 않아도 무엇이 잘못됐는지 알 수 있어야 한다.
JoyGolf.fatal = function fatal(err) {
  console.error("[JoyGolf] 치명적 오류:", err);
  const detail = (err && err.message) || String(err);
  const main = document.querySelector(".container") || document.body;

  main.innerHTML = `
    <div class="card" style="max-width: 560px; margin: 40px auto; text-align: center;">
      <div style="font-size: 2.4rem; margin-bottom: 8px;">😵‍💫</div>
      <h2 style="margin-bottom: 8px;">화면을 불러오지 못했어요</h2>
      <p class="hint" style="margin-bottom: 4px;">${JoyGolf.escapeHtml(detail)}</p>
      <p class="hint">
        로그인이 만료됐거나 서버 설정에 문제가 있을 수 있어요.
        계속 이러면 운영진에게 위 메시지를 알려주세요.
      </p>
      <div class="btn-row" style="justify-content: center;">
        <button class="btn btn-sm" onclick="location.reload()">다시 시도</button>
        <a class="btn btn-sm btn-outline" href="index.html">로그인 화면으로</a>
      </div>
    </div>
  `;
};

// 목록 조회가 "실패"한 것과 "비어있는" 것은 다르다.
// 실패를 빈 상태로 보여주면 회원은 자기 기록이 사라졌다고 생각한다.
JoyGolf.errorState = function errorState(title, err) {
  const detail = (err && err.message) || "";
  return `
    <div class="empty-state">
      <div style="font-size: 1.6rem; margin-bottom: 6px;">⚠️</div>
      <strong>${JoyGolf.escapeHtml(title)}</strong>
      ${detail ? `<p class="hint" style="margin-top: 6px;">${JoyGolf.escapeHtml(detail)}</p>` : ""}
      <p class="hint">잠시 후 새로고침해 주세요.</p>
    </div>
  `;
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
