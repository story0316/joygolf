// JoyGolf 웹 푸시 발송 (Supabase Edge Function / Deno)
//
// 웹 푸시는 VAPID 개인키로 서명해야 해서 브라우저에서 직접 보낼 수 없다.
// 이 함수가 그 서버 역할을 한다.
//
// 배포:
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:admin@yourcompany.com
//   supabase secrets set PUSH_CRON_SECRET=아무거나-긴-랜덤-문자열
//   supabase functions deploy send-push
//
// 호출 예 (모임 리마인더 - pg_cron 등에서):
//   POST /functions/v1/send-push
//   { "kind": "meetup_reminder" }
//
// 특정 사용자에게 임의 알림:
//   { "kind": "custom", "user_ids": ["..."], "title": "...", "body": "...", "url": "meetup.html" }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

type PushSubscriptionRow = {
  endpoint: string;
  user_id: string;
  p256dh: string;
  auth: string;
};

type Payload = {
  kind?: "meetup_reminder" | "custom";
  user_ids?: string[];
  title?: string;
  body?: string;
  url?: string;
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
const CRON_SECRET = Deno.env.get("PUSH_CRON_SECRET") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  // service_role 키는 RLS 를 우회한다. 이 함수 밖으로 절대 노출하지 말 것.
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** 만료(410)/삭제(404)된 구독은 DB에서 정리한다 */
async function sendToSubscriptions(
  subs: PushSubscriptionRow[],
  notification: { title: string; body: string; url: string; tag?: string }
) {
  let sent = 0;
  const stale: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(notification)
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(s.endpoint);
        else console.error("push 실패", s.endpoint.slice(0, 40), status, String(err));
      }
    })
  );

  if (stale.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", stale);
  }

  return { sent, removed: stale.length };
}

/** 내일 열리는 모임의 참가자에게 리마인더 */
async function meetupReminder() {
  const now = new Date();
  const from = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const to = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const { data: meetups, error } = await supabase
    .from("meetups")
    .select("id, title, meetup_date, location")
    .gte("meetup_date", from.toISOString())
    .lt("meetup_date", to.toISOString());

  if (error) throw error;
  if (!meetups?.length) return { meetups: 0, sent: 0, removed: 0 };

  let sent = 0;
  let removed = 0;

  for (const m of meetups) {
    const { data: rsvps } = await supabase
      .from("meetup_rsvps")
      .select("user_id")
      .eq("meetup_id", m.id)
      .eq("status", "going");

    const userIds = (rsvps ?? []).map((r) => r.user_id);
    if (!userIds.length) continue;

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, user_id, p256dh, auth")
      .in("user_id", userIds);

    if (!subs?.length) continue;

    const when = new Date(m.meetup_date).toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const result = await sendToSubscriptions(subs as PushSubscriptionRow[], {
      title: "⛳ 내일 모임이 있어요!",
      body: `${m.title} · ${when}${m.location ? " · " + m.location : ""}`,
      url: "meetup.html",
      tag: `meetup-${m.id}`,
    });

    sent += result.sent;
    removed += result.removed;
  }

  return { meetups: meetups.length, sent, removed };
}

async function custom(payload: Payload) {
  if (!payload.title) return json({ error: "title 이 필요합니다" }, 400);

  let query = supabase.from("push_subscriptions").select("endpoint, user_id, p256dh, auth");
  if (payload.user_ids?.length) query = query.in("user_id", payload.user_ids);

  const { data: subs, error } = await query;
  if (error) throw error;
  if (!subs?.length) return json({ sent: 0, removed: 0, note: "구독자가 없습니다" });

  const result = await sendToSubscriptions(subs as PushSubscriptionRow[], {
    title: payload.title,
    body: payload.body ?? "",
    url: payload.url ?? "dashboard.html",
  });

  return json(result);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST 만 지원합니다" }, 405);

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return json({ error: "VAPID 키가 설정되지 않았습니다" }, 500);
  }

  // 스케줄러/운영진만 호출할 수 있도록 공유 시크릿으로 보호
  if (CRON_SECRET && req.headers.get("x-push-secret") !== CRON_SECRET) {
    return json({ error: "권한이 없습니다" }, 401);
  }

  try {
    const payload: Payload = await req.json().catch(() => ({}));
    if (payload.kind === "custom") return await custom(payload);
    return json(await meetupReminder());
  } catch (err) {
    console.error(err);
    return json({ error: String(err) }, 500);
  }
});
