// ============================================================
// JoyGolf 설정 파일
// Supabase 프로젝트를 만든 뒤 아래 두 값을 본인 프로젝트 값으로 교체하세요.
// (Supabase 대시보드 > Project Settings > API 에서 확인)
// ============================================================
window.APP_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT-REF.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-SUPABASE-ANON-PUBLIC-KEY",

  // 회원가입 허용 이메일 도메인 (빈 문자열이면 제한 없음)
  ALLOWED_EMAIL_DOMAIN: "",

  // 레벨업 포인트 공식에 사용되는 가중치 (재미 요소, 자유롭게 조정 가능)
  LEVEL_THRESHOLDS: [0, 50, 150, 350, 700, 1200, 2000, 3200, 5000],
  LEVEL_TITLES: [
    "필드 새싹 🌱",
    "그린 입문자 ⛳",
    "성실한 연습벌레 🐛",
    "페어웨이 메이커 🎯",
    "버디 사냥꾼 🦅",
    "싱글 도전자 🔥",
    "클럽 에이스 🏆",
    "레전드 골퍼 👑",
    "조이골프의 신 🐉"
  ]
};
