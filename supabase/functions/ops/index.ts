// Samui Care back-office function. One endpoint, three routes:
//   ?route=admin   signed-in owner/admin: tell customer + cleaner about a change, sync the calendar
//   ?route=stripe  Stripe webhook: mark bookings paid online
//   ?route=cron    hourly job: 24-hour reminders (needs x-cron-secret)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  calendarDelete, calendarUpsert, customerEmail, env, fmtWhen, JOB_SELECT, jobText, linePush, notifyTeam, sendEmail,
  type JobRow, type NotifySettings,
} from "./notify.ts";

const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function settings() {
  const { data } = await db.from("settings").select("key,value").in("key", ["notifications", "business"]);
  const s = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return { n: (s.notifications ?? {}) as NotifySettings, b: (s.business ?? {}) as Record<string, string> };
}
async function loadJob(id: string) {
  const { data } = await db.from("bookings").select(JOB_SELECT).eq("id", id).single();
  return data as unknown as JobRow | null;
}

/* --------------------------------- admin ---------------------------------- */

type Change = "rescheduled" | "reassigned" | "cancelled" | "restored" | "updated";

async function routeAdmin(req: Request, body: Record<string, unknown>) {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(jwt);
  if (!u?.user) return json({ error: "Sign in first" }, 401);
  const { data: roles } = await db.from("user_roles").select("role").eq("user_id", u.user.id);
  if (!(roles ?? []).some((r) => r.role === "owner" || r.role === "admin")) return json({ error: "Not allowed" }, 403);

  const id = String(body.id ?? "");
  const change = String(body.change ?? "updated") as Change;
  const tellCustomer = body.notifyCustomer === true;
  const prevStaffLine = typeof body.prevStaffLineId === "string" ? body.prevStaffLineId : null;
  const j = await loadJob(id);
  if (!j) return json({ error: "Booking not found" }, 404);
  const { n, b } = await settings();

  // Calendar
  if (n.google_calendar !== false) {
    if (j.status === "cancelled" || j.status === "no_show") {
      await calendarDelete(j.gcal_event_id);
      if (j.gcal_event_id) await db.from("bookings").update({ gcal_event_id: null }).eq("id", j.id);
    } else {
      const eventId = await calendarUpsert(j);
      if (eventId && eventId !== j.gcal_event_id) await db.from("bookings").update({ gcal_event_id: eventId }).eq("id", j.id);
    }
  }

  // Team + cleaner(s)
  const title = { rescheduled: "🔁 Moved", reassigned: "👤 New cleaner", cancelled: "❌ Cancelled", restored: "↩️ Back on", updated: "✏️ Updated" }[change] ?? "✏️ Updated";
  await notifyTeam(`${title}: ${j.ref}`, jobText(j), n, j.staff?.line_user_id);
  if (prevStaffLine && prevStaffLine !== j.staff?.line_user_id && n.line_staff !== false) {
    await linePush(prevStaffLine, `${title}: ${j.ref} is no longer yours.\n${fmtWhen(j.start_at)}`);
  }

  // Customer
  if (tellCustomer && n.email_customer !== false && j.customers?.email) {
    const first = (j.customers.name ?? "").split(" ")[0];
    if (change === "cancelled") await sendEmail(j.customers.email, `Your Samui Care clean ${j.ref} is cancelled`, customerEmail("Your clean is cancelled", `Hi ${first}, your clean on ${fmtWhen(j.start_at)} has been cancelled. Message us any time to book again.`, j, b));
    else await sendEmail(j.customers.email, `Updated: your Samui Care clean ${j.ref}`, customerEmail("Your booking has changed", `Hi ${first}, here are the updated details for your clean.`, j, b));
  }
  return json({ ok: true, emailed: tellCustomer && !!j.customers?.email && !!env("RESEND_API_KEY") });
}

/* --------------------------------- stripe --------------------------------- */

async function verifyStripe(payload: string, header: string | null, secret: string) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = parts.t;
  const v1s = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !v1s.length || Math.abs(Date.now() / 1000 - Number(t)) > 600) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return v1s.includes(hex);
}

async function routeStripe(req: Request) {
  const payload = await req.text();
  if (!(await verifyStripe(payload, req.headers.get("stripe-signature"), env("STRIPE_WEBHOOK_SECRET")))) return json({ error: "Bad signature" }, 400);
  const evt = JSON.parse(payload);
  const s = evt.data?.object ?? {};
  const paid = (evt.type === "checkout.session.completed" && s.payment_status === "paid") || evt.type === "checkout.session.async_payment_succeeded";
  if (!paid) return json({ received: true });
  const id = s.metadata?.booking_id ?? s.client_reference_id;
  const { data: upd } = await db.from("bookings").update({ payment_status: "paid_online" }).eq("id", id).eq("stripe_session_id", s.id).eq("payment_status", "unpaid").select("id");
  if (upd?.length) {
    const j = await loadJob(id);
    const { n, b } = await settings();
    if (j) {
      await notifyTeam(`💳 Paid online: ${j.ref}`, jobText(j), n);
      if (n.email_customer !== false && j.customers?.email) {
        await sendEmail(j.customers.email, `Your Samui Care booking ${j.ref}`, customerEmail("You're booked in and paid", `Hi ${(j.customers.name ?? "").split(" ")[0]}, thanks, your payment went through.`, j, b));
      }
    }
  }
  return json({ received: true });
}

/* ---------------------------------- cron ---------------------------------- */

async function routeCron(req: Request) {
  // The secret lives in private.secrets (created inside the database) and is sent by the pg_cron job.
  const given = req.headers.get("x-cron-secret") ?? "";
  const { data: ok } = given ? await db.rpc("cron_secret_ok", { s: given }) : { data: false };
  if (!ok) return json({ error: "Not allowed" }, 401);
  const now = Date.now();
  const { data } = await db.from("bookings").select(JOB_SELECT)
    .gte("start_at", new Date(now + 20 * 3600000).toISOString()).lte("start_at", new Date(now + 28 * 3600000).toISOString())
    .eq("reminder_sent", false).not("status", "in", "(cancelled,no_show)");
  const { n, b } = await settings();
  const jobs = (data ?? []) as unknown as JobRow[];
  let sent = 0;
  for (const j of jobs) {
    const tasks: Promise<unknown>[] = [];
    if (n.email_customer !== false && j.customers?.email && env("RESEND_API_KEY")) {
      tasks.push(sendEmail(j.customers.email, `Reminder: Samui Care clean tomorrow, ${fmtWhen(j.start_at)}`,
        customerEmail("See you tomorrow", `Hi ${(j.customers.name ?? "").split(" ")[0]}, a reminder about your clean. Please make sure we can get in.`, j, b)));
    }
    if (n.line_staff !== false && j.staff?.line_user_id && env("LINE_CHANNEL_TOKEN")) tasks.push(linePush(j.staff.line_user_id, `⏰ Tomorrow: ${j.ref}\n\n${jobText(j)}`));
    await Promise.allSettled(tasks);
    if (tasks.length) { await db.from("bookings").update({ reminder_sent: true }).eq("id", j.id); sent++; }
  }
  return json({ checked: jobs.length, sent });
}

/* --------------------------------- server --------------------------------- */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const route = new URL(req.url).searchParams.get("route");
  try {
    if (route === "stripe") return await routeStripe(req);
    if (route === "cron") return await routeCron(req);
    const body = await req.json().catch(() => ({}));
    if ((route ?? body.route) === "admin") return await routeAdmin(req, body);
    return json({ error: "Unknown route" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong" }, 500);
  }
});
