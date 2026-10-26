import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function jwtClaims(token: string): Record<string, unknown> | null {
  try {
    const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed." }, 405);

  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token || jwtClaims(token)?.aal !== "aal2") return response({ error: "Verified publisher sign-in is required." }, 403);
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");
    if (!url || !serviceKey || !vapidPublic || !vapidPrivate || !vapidSubject) throw new Error("Push service is not configured.");

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user || user.is_anonymous) return response({ error: "A verified Amanzi account is required." }, 401);
    const { data: publisher, error: publisherError } = await admin.from("notice_publishers")
      .select("role, active").eq("user_id", user.id).maybeSingle();
    if (publisherError) throw publisherError;
    if (!publisher?.active || publisher.role !== "authority") return response({ error: "Only an approved authority publisher can send official notice alerts." }, 403);

    const { noticeId } = await req.json();
    if (typeof noticeId !== "string" || !/^[0-9a-f-]{36}$/i.test(noticeId)) return response({ error: "Invalid notice." }, 400);
    const { data: notice, error: noticeError } = await admin.from("official_notices")
      .select("id, published_by, title, summary, status, is_demo, revision")
      .eq("id", noticeId).maybeSingle();
    if (noticeError) throw noticeError;
    if (!notice || notice.published_by !== user.id || notice.is_demo || notice.status === "draft") {
      return response({ skipped: true, reason: "Only the authority publisher can alert for its live notices." }, 403);
    }

    const { data: claimed, error: claimError } = await admin.rpc("claim_official_notice_push", {
      p_notice_id: noticeId,
      p_revision: notice.revision,
    });
    if (claimError) throw claimError;
    if (!claimed) return response({ skipped: true, reason: "This notice revision is already sent or processing." });

    const { data: targets, error: targetsError } = await admin.from("official_notice_areas")
      .select("area, municipality, province").eq("notice_id", noticeId);
    if (targetsError) throw targetsError;
    const { data: savedAreas, error: areasError } = await admin.from("user_areas")
      .select("user_id, area, municipality, province");
    if (areasError) throw areasError;
    const recipientIds = [...new Set((savedAreas || []).filter((saved) =>
      targets?.some((target) => target.area === saved.area && target.municipality === saved.municipality && target.province === saved.province)
    ).map((saved) => saved.user_id))];
    if (!recipientIds.length) {
      await admin.from("official_notice_push_events").update({ status: "sent", completed_at: new Date().toISOString() }).eq("notice_id", noticeId).eq("revision", notice.revision);
      return response({ delivered: 0, failed: 0, recipients: 0 });
    }
    const { data: subscriptions, error: subscriptionsError } = await admin.from("push_subscriptions")
      .select("endpoint, p256dh, auth_key, user_id").in("user_id", recipientIds).eq("alert_official_notices", true);
    if (subscriptionsError) throw subscriptionsError;

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
    const areaLabel = targets?.map((target) => target.area).join(", ") || "your saved area";
    const payload = JSON.stringify({
      title: `Official notice: ${notice.title}`,
      body: `${areaLabel}: ${notice.summary.slice(0, 150)}${notice.summary.length > 150 ? "…" : ""}`,
      tag: `amanzi-official-${noticeId}-${notice.revision}`,
      url: `/?notice=${encodeURIComponent(noticeId)}`,
    });
    let delivered = 0;
    let failed = 0;
    await Promise.all((subscriptions || []).map(async (subscription) => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } }, payload, { TTL: 60 * 60 * 24 });
        delivered += 1;
      } catch (error) {
        failed += 1;
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
        }
      }
    }));
    const status = failed > 0 && delivered === 0 ? "failed" : "sent";
    const { error: saveError } = await admin.from("official_notice_push_events").update({
      status, delivered_count: delivered, failed_count: failed, completed_at: new Date().toISOString(),
    }).eq("notice_id", noticeId).eq("revision", notice.revision);
    if (saveError) throw saveError;
    return response({ delivered, failed, recipients: (subscriptions || []).length });
  } catch (error) {
    console.error("dispatch-official-notice-push failed", error);
    return response({ error: "Could not send official notice alerts." }, 500);
  }
});
