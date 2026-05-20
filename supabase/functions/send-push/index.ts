import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (_req) => {
  const now = new Date();

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("*");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results: { userId: string; fired: number; removed: boolean }[] = [];

  for (const sub of subs ?? []) {
    const timezone = sub.timezone || "UTC";

    // Convert UTC now → user's local time using sv-SE locale (gives ISO-like string)
    const localStr = now.toLocaleString("sv-SE", { timeZone: timezone });
    const localDate = new Date(localStr);
    const localDay = localDate.getDay();
    const localHour = localDate.getHours();
    const localMin = localDate.getMinutes();

    const schedules: {
      id: string;
      type: "weekly" | "once";
      jsDay?: number;
      time?: string;
      fireAt?: string;
      title: string;
      body: string;
    }[] = sub.schedules || [];

    const toFire: typeof schedules = [];
    const remaining: typeof schedules = [];

    for (const schedule of schedules) {
      if (schedule.type === "once") {
        if (now >= new Date(schedule.fireAt!)) {
          toFire.push(schedule);
          // once-type is consumed — don't add to remaining
        } else {
          remaining.push(schedule);
        }
      } else if (schedule.type === "weekly") {
        const [h, m] = schedule.time!.split(":").map(Number);
        if (localDay === schedule.jsDay && localHour === h && localMin === m) {
          toFire.push(schedule);
        }
        remaining.push(schedule); // weekly repeats
      }
    }

    let removed = false;
    for (const schedule of toFire) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({ title: schedule.title, body: schedule.body })
        );
      } catch (e: unknown) {
        const err = e as { statusCode?: number; message?: string };
        // Subscription expired or unsubscribed — remove it
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
          removed = true;
          break;
        }
        console.warn("Push send failed for", sub.user_id, ":", err.message);
      }
    }

    if (!removed && toFire.length > 0) {
      await supabase
        .from("push_subscriptions")
        .update({ schedules: remaining, updated_at: now.toISOString() })
        .eq("id", sub.id);
    }

    results.push({ userId: sub.user_id, fired: toFire.length, removed });
  }

  return new Response(
    JSON.stringify({ ok: true, processed: subs?.length ?? 0, results }),
    { headers: { "Content-Type": "application/json" } }
  );
});
