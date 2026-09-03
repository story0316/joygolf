let mode = "login"; // 'login' | 'signup'

const tabLogin = document.getElementById("tabLogin");
const tabSignup = document.getElementById("tabSignup");
const nameField = document.getElementById("nameField");
const displayNameInput = document.getElementById("displayName");
const passwordInput = document.getElementById("password");
const submitBtn = document.getElementById("submitBtn");
const formHint = document.getElementById("formHint");
const form = document.getElementById("authForm");

function setMode(next) {
  mode = next;
  const isSignup = mode === "signup";

  tabLogin.classList.toggle("active", !isSignup);
  tabSignup.classList.toggle("active", isSignup);
  tabLogin.setAttribute("aria-selected", String(!isSignup));
  tabSignup.setAttribute("aria-selected", String(isSignup));

  nameField.hidden = !isSignup;
  displayNameInput.required = isSignup;
  passwordInput.autocomplete = isSignup ? "new-password" : "current-password";

  submitBtn.textContent = isSignup ? "회원가입" : "로그인";
  formHint.textContent = "";
}

tabLogin.addEventListener("click", () => setMode("login"));
tabSignup.addEventListener("click", () => setMode("signup"));

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = passwordInput.value;
  const displayName = displayNameInput.value.trim();

  const allowedDomain = window.APP_CONFIG.ALLOWED_EMAIL_DOMAIN;
  if (allowedDomain && !email.toLowerCase().endsWith("@" + allowedDomain.toLowerCase())) {
    formHint.textContent = `⚠️ @${allowedDomain} 이메일만 가입할 수 있어요.`;
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = mode === "signup" ? "가입 중…" : "로그인 중…";
  formHint.textContent = "";

  try {
    if (mode === "signup") {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) throw error;

      if (data.user) {
        // 이메일 인증이 꺼져 있으면 세션이 바로 생성됨 -> 프로필 생성
        if (data.session) {
          await sb.from("profiles").insert({
            id: data.user.id,
            display_name: displayName || email.split("@")[0],
          });
          window.location.href = "dashboard.html";
          return;
        }
        formHint.textContent = "📩 가입 확인 이메일을 보냈어요. 메일함을 확인해주세요!";
        setMode("login");
      }
    } else {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session) {
        window.location.href = "dashboard.html";
        return;
      }
    }
  } catch (err) {
    formHint.textContent = "⚠️ " + (err.message || "오류가 발생했어요. 다시 시도해주세요.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = mode === "signup" ? "회원가입" : "로그인";
  }
});

// 이미 로그인된 상태면 바로 대시보드로
(async () => {
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (session) window.location.href = "dashboard.html";
})();
