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

function jwtClaims(token: string) {
  try {
    const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token || jwtClaims(token)?.aal !== "aal2") return response({ error: "Verified sign-in required." }, 403);
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");
    if (!url || !serviceKey || !vapidPublic || !vapidPrivate || !vapidSubject) throw new Error("Push service is not configured.");

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user || user.is_anonymous) return response({ error: "A verified Amanzi account is required." }, 401);

    const { updateId } = await req.json();
    if (typeof updateId !== "string" || !/^[0-9a-f-]{36}$/i.test(updateId)) return response({ error: "Invalid update." }, 400);
    const { data: update, error: updateError } = await admin.from("water_updates")
      .select("id, area, municipality, province, message, water_status, created_by")
      .eq("id", updateId).maybeSingle();
    if (updateError) throw updateError;
    if (!update) return response({ error: "Update not found." }, 404);

    const eventType = update.water_status === "restored" ? "restoration" : ["no_water", "low_pressure"].includes(update.water_status) ? "outage" : null;
    if (!eventType) return response({ skipped: true, reason: "This update is not a water status alert." });
    const preferenceColumn = eventType === "outage" ? "alert_outages" : "alert_restorations";
    const { data: confirmations, error: confirmationError } = await admin.from("update_confirmations").select("user_id").eq("update_id", updateId);
    if (confirmationError) throw confirmationError;
    const independentConfirmations = new Set((confirmations || []).map((entry) => entry.user_id).filter((id) => id !== update.created_by)).size;
    if (independentConfirmations < 2) return response({ skipped: true, reason: "Waiting for two neighbours to confirm this report." });

    const { data: previous, error: previousError } = await admin.from("push_alert_events").select("status").eq("water_update_id", updateId).maybeSingle();
    if (previousError) throw previousError;
    if (previous?.status === "sent" || previous?.status === "processing") return response({ skipped: true, reason: "Alert already processed." });
    const { error: claimError } = await admin.from("push_alert_events").upsert({ water_update_id: updateId, event_type: eventType, status: "processing", delivered_count: 0, failed_count: 0 }, { onConflict: "water_update_id" });
    if (claimError) throw claimError;

    const { data: areas, error: areasError } = await admin.from("user_areas").select("user_id, area, municipality, province");
    if (areasError) throw areasError;
    const recipientIds = [...new Set((areas || []).filter((area) => area.area === update.area && area.municipality === update.municipality && area.province === update.province && area.user_id !== update.created_by).map((area) => area.user_id))];
    if (recipientIds.length === 0) {
      await admin.from("push_alert_events").update({ status: "sent", completed_at: new Date().toISOString() }).eq("water_update_id", updateId);
      return response({ delivered: 0 });
    }
    const { data: subscriptions, error: subscriptionsError } = await admin.from("push_subscriptions")
      .select("endpoint, p256dh, auth_key, user_id").in("user_id", recipientIds).eq(preferenceColumn, true);
    if (subscriptionsError) throw subscriptionsError;

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
    const title = eventType === "restoration" ? `Water restored in ${update.area}` : `Water alert for ${update.area}`;
    const body = eventType === "restoration"
      ? `${update.municipality}: a neighbour reports that water is back. Check the latest area updates.`
      : `${update.municipality}: neighbours report ${update.water_status === "no_water" ? "no water" : "low pressure"}. Check the area updates.`;
    const payload = JSON.stringify({ title, body, tag: `amanzi-${update.id}`, url: `/?area=${encodeURIComponent(update.area)}` });
    let delivered = 0;
    let failed = 0;
    await Promise.all((subscriptions || []).map(async (subscription) => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } }, payload, { TTL: 60 * 60 });
        delivered += 1;
      } catch (error) {
        failed += 1;
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
        }
      }
    }));
    const status = failed > 0 && delivered === 0 ? "failed" : "sent";
    const { error: saveError } = await admin.from("push_alert_events").update({ status, delivered_count: delivered, failed_count: failed, completed_at: new Date().toISOString() }).eq("water_update_id", updateId);
    if (saveError) throw saveError;
    return response({ delivered, failed });
  } catch (error) {
    console.error("dispatch-water-alert failed", error);
    return response({ error: "Could not send the area alert." }, 500);
  }
});
