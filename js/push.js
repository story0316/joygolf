// 웹 푸시 구독 관리
// 실제 발송은 서버(Supabase Edge Function)가 VAPID 개인키로 서명해서 보낸다.
// 여기서는 브라우저 구독 정보를 만들어 DB에 저장/삭제하는 것까지만 담당한다.
JoyGolf.push = (function () {
  function supported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }

  function configured() {
    const key = window.APP_CONFIG && window.APP_CONFIG.VAPID_PUBLIC_KEY;
    return !!key && !key.startsWith("YOUR-");
  }

  // VAPID 공개키(base64url) -> Uint8Array
  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
    return output;
  }

  async function currentSubscription() {
    if (!supported()) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }

  async function isEnabled() {
    if (!supported()) return false;
    if (Notification.permission !== "granted") return false;
    return !!(await currentSubscription());
  }

  async function enable(userId) {
    if (!supported()) throw new Error("이 브라우저는 웹 푸시를 지원하지 않아요.");
    if (!configured()) throw new Error("서버에 VAPID 공개키가 설정되지 않았어요. (js/config.js)");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error(
        permission === "denied"
          ? "알림이 차단돼 있어요. 브라우저 주소창의 자물쇠 아이콘에서 알림을 허용해주세요."
          : "알림 권한이 필요해요."
      );
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(window.APP_CONFIG.VAPID_PUBLIC_KEY),
      });
    }

    const json = sub.toJSON();
    const { error } = await sb.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: json.keys && json.keys.p256dh,
        auth: json.keys && json.keys.auth,
        user_agent: navigator.userAgent.slice(0, 300),
      },
      { onConflict: "endpoint" }
    );
    if (error) throw error;

    return true;
  }

  async function disable() {
    const sub = await currentSubscription();
    if (!sub) return false;

    // 브라우저 구독을 먼저 해제하고, DB에서도 지운다
    const endpoint = sub.endpoint;
    await sub.unsubscribe().catch(() => {});
    const { error } = await sb.from("push_subscriptions").delete().eq("endpoint", endpoint);
    if (error) throw error;
    return true;
  }

  return { supported, configured, isEnabled, enable, disable };
})();
