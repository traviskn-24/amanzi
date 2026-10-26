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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}

function jwtClaims(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed." }, 405);

  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!token || !url || !serviceKey) return reply({ error: "Amanzi could not verify this publisher." }, 401);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user || user.is_anonymous) return reply({ error: "A verified Amanzi account is required." }, 401);
    const { noticeId } = await req.json();
    if (typeof noticeId !== "string" || !/^[0-9a-f-]{36}$/i.test(noticeId)) return reply({ error: "Invalid notice." }, 400);
    const { data: publisher, error: publisherError } = await admin.from("notice_publishers").select("role, active").eq("user_id", user.id).maybeSingle();
    if (publisherError) throw publisherError;
    if (!publisher?.active || publisher.role !== "authority" || jwtClaims(token)?.aal !== "aal2") return reply({ error: "Only an approved authority publisher with two-step verification can email live official notices." }, 403);

    const { data: notice, error: noticeError } = await admin.from("official_notices").select("id, authority_name, title, summary, source_url, source_published_at, status, is_demo, revision").eq("id", noticeId).maybeSingle();
    if (noticeError) throw noticeError;
    if (!notice || notice.is_demo || notice.status === "draft") return reply({ skipped: true, reason: "Only published, non-demo notices can send email." });
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("NOTICE_FROM_EMAIL");
    if (!apiKey || !from) return reply({ configured: false, delivered: 0, error: "Email delivery is not configured." }, 503);

    const { data: targets, error: targetsError } = await admin.from("official_notice_areas").select("area, municipality, province").eq("notice_id", noticeId);
    if (targetsError) throw targetsError;
    const { data: subscriptions, error: subscriptionsError } = await admin.from("official_notice_email_subscriptions").select("user_id").eq("enabled", true);
    if (subscriptionsError) throw subscriptionsError;
    const subscribedUsers = new Set((subscriptions || []).map((row) => row.user_id));
    const { data: areas, error: areasError } = await admin.from("user_areas").select("user_id, area, municipality, province");
    if (areasError) throw areasError;
    const recipientIds = [...new Set((areas || []).filter((area) => subscribedUsers.has(area.user_id) && targets?.some((target) => target.area === area.area && target.municipality === area.municipality && target.province === area.province)).map((area) => area.user_id))];
    const publishedAt = notice.source_published_at ? new Date(notice.source_published_at).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }) : "Not supplied by the source";
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#19344d"><p style="color:#078ba6;font-weight:bold;letter-spacing:.08em">OFFICIAL SOURCE NOTICE</p><h1 style="font-size:24px">${escapeHtml(notice.title)}</h1><p><strong>${escapeHtml(notice.authority_name)}</strong> · ${escapeHtml(notice.status.replaceAll("_", " "))}</p><p>${escapeHtml(notice.summary)}</p><p>Source publication time: ${escapeHtml(publishedAt)}</p><p><a href="${escapeHtml(notice.source_url)}">Read the original source</a></p><hr><p style="color:#718696;font-size:12px">Amanzi shares source-linked notices for the areas you follow. Check the issuing authority’s latest information before acting. Manage your email preference in My areas in Amanzi.</p></div>`;
    const text = `${notice.title}\n${notice.authority_name} · ${notice.status.replaceAll("_", " ")}\n\n${notice.summary}\n\nSource publication time: ${publishedAt}\nOriginal source: ${notice.source_url}\n\nAmanzi shares source-linked notices for the areas you follow. Check the issuing authority’s latest information before acting. Manage your email preference in My areas in Amanzi.`;
    let delivered = 0;
    let failed = 0;
    for (const userId of recipientIds) {
      const { data: prior, error: priorError } = await admin.from("official_notice_email_deliveries").select("status").eq("notice_id", noticeId).eq("user_id", userId).eq("revision", notice.revision).maybeSingle();
      if (priorError) throw priorError;
      if (prior?.status === "sent") continue;
      const { data: account, error: accountError } = await admin.auth.admin.getUserById(userId);
      if (accountError || !account.user?.email || !account.user.email_confirmed_at) continue;
      const { error: claimError } = await admin.from("official_notice_email_deliveries").upsert({ notice_id: noticeId, user_id: userId, revision: notice.revision, status: "pending" }, { onConflict: "notice_id,user_id,revision" });
      if (claimError) throw claimError;
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [account.user.email], subject: `[Amanzi official notice] ${notice.title}`, html, text, ...(Deno.env.get("NOTICE_REPLY_TO") ? { reply_to: Deno.env.get("NOTICE_REPLY_TO") } : {}) }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) {
        const { error: markError } = await admin.from("official_notice_email_deliveries").update({ status: "sent", provider_message_id: result.id || null, sent_at: new Date().toISOString() }).eq("notice_id", noticeId).eq("user_id", userId).eq("revision", notice.revision);
        if (markError) throw markError;
        delivered += 1;
      } else {
        await admin.from("official_notice_email_deliveries").update({ status: "failed" }).eq("notice_id", noticeId).eq("user_id", userId).eq("revision", notice.revision);
        failed += 1;
      }
    }
    return reply({ configured: true, delivered, failed, recipients: recipientIds.length });
  } catch (error) {
    console.error("dispatch-official-notice-email failed", error);
    return reply({ error: "Could not send official notice emails." }, 500);
  }
});
