import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jwtClaims(token: string) {
  try {
    const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")));
  } catch {
    return null;
  }
}

function inspectVapidPublicKey(value: string) {
  try {
    const padded = `${value}${"=".repeat((4 - value.length % 4) % 4)}`;
    const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    return {
      chars: value.length,
      bytes: bytes.length,
      base64url: /^[A-Za-z0-9_-]+$/.test(value),
      uncompressedP256: bytes.length === 65 && bytes[0] === 4,
    };
  } catch {
    return { chars: value.length, bytes: 0, base64url: false, uncompressedP256: false };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return response({ error: "Sign in to manage notifications." }, 401);
    const claims = jwtClaims(token);
    if (claims?.aal !== "aal2") return response({ error: "Complete two-step verification first." }, 403);

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    if (!url || !serviceKey) throw new Error("Push service is not configured.");
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user || user.is_anonymous) return response({ error: "A verified Amanzi account is required." }, 401);

    const body = await req.json();
    if (body.action === "config") {
      if (!publicKey) return response({ error: "Push notifications are being configured." }, 503);
      const keyFormat = inspectVapidPublicKey(publicKey);
      let validP256Point = false;
      try {
        const padded = `${publicKey}${"=".repeat((4 - publicKey.length % 4) % 4)}`;
        const raw = Uint8Array.from(atob(padded.replace(/-/g, "+").replace(/_/g, "/")), (character) => character.charCodeAt(0));
        await crypto.subtle.importKey("raw", raw, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
        validP256Point = true;
      } catch {
        validP256Point = false;
      }
      console.info("VAPID public key validation", { ...keyFormat, validP256Point });
      if (!keyFormat.uncompressedP256 || !validP256Point) {
        return response({ error: "Push notifications are misconfigured. Please contact support." }, 503);
      }
      return response({ publicKey });
    }
    if (body.action === "status") {
      const { count, error } = await admin.from("push_subscriptions").select("endpoint", { count: "exact", head: true }).eq("user_id", user.id);
      if (error) throw error;
      const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
      const { data: subscription, error: subscriptionError } = endpoint
        ? await admin.from("push_subscriptions").select("alert_outages, alert_restorations, alert_official_notices").eq("user_id", user.id).eq("endpoint", endpoint).maybeSingle()
        : { data: null, error: null };
      if (subscriptionError) throw subscriptionError;
      return response({ enabled: (count || 0) > 0, deviceCount: count || 0, subscription: subscription ? { alertOutages: subscription.alert_outages, alertRestorations: subscription.alert_restorations, alertOfficialNotices: subscription.alert_official_notices } : null });
    }

    if (body.action === "subscribe") {
      const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
      const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
      const authKey = typeof body.keys?.auth === "string" ? body.keys.auth : "";
      if (!endpoint.startsWith("https://") || endpoint.length > 2048 || p256dh.length < 40 || p256dh.length > 200 || authKey.length < 16 || authKey.length > 100) {
        return response({ error: "The browser returned an invalid push subscription." }, 400);
      }
      const { error } = await admin.from("push_subscriptions").upsert({
        endpoint,
        user_id: user.id,
        p256dh,
        auth_key: authKey,
        alert_outages: body.alertOutages !== false,
        alert_restorations: body.alertRestorations !== false,
        alert_official_notices: body.alertOfficialNotices === true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });
      if (error) throw error;
      return response({ enabled: true });
    }

    if (body.action === "unsubscribe") {
      const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
      if (!endpoint.startsWith("https://") || endpoint.length > 2048) return response({ error: "Invalid subscription endpoint." }, 400);
      const { error } = await admin.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
      if (error) throw error;
      return response({ enabled: false });
    }

    return response({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error("manage-push-subscriptions failed", error);
    return response({ error: "Could not update notification settings." }, 500);
  }
});
