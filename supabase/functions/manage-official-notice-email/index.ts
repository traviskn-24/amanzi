import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed." }, 405);

  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!token || !url || !serviceKey) return reply({ error: "Amanzi could not verify this session." }, 401);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user || user.is_anonymous || !user.email || !user.email_confirmed_at) return reply({ error: "Confirm your account email before managing official notice emails." }, 403);
    const { action, enabled } = await req.json();
    const configured = Boolean(Deno.env.get("RESEND_API_KEY") && Deno.env.get("NOTICE_FROM_EMAIL"));
    const { data: preference, error: preferenceError } = await admin.from("official_notice_email_subscriptions").select("enabled").eq("user_id", user.id).maybeSingle();
    if (preferenceError) throw preferenceError;
    if (action === "status") return reply({ configured, enabled: preference?.enabled === true, email: user.email });
    if (action !== "set" || typeof enabled !== "boolean") return reply({ error: "Invalid subscription request." }, 400);
    if (enabled && !configured) return reply({ configured: false, error: "Official notice email delivery has not been configured yet." }, 503);
    const { error: saveError } = await admin.from("official_notice_email_subscriptions").upsert({ user_id: user.id, enabled, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (saveError) throw saveError;
    return reply({ configured, enabled, email: user.email });
  } catch (error) {
    console.error("manage-official-notice-email failed", error);
    return reply({ error: "Could not update your email preference." }, 500);
  }
});
