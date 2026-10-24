// Samui Care public API — the only server endpoint the public site talks to.
// Actions: availability | lead | book | request. Uses the service role, so every input is validated here.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { computeQuote, formatDuration, formatTHB, type AddonDef, type Anchor, type Condition, type Frequency, type PricingSettings } from "./pricing.ts";
import { availability, bangkokDate, bangkokTime, isStaffFree, pickLeastBusy, seriesDates, slotsForDate, type BusyJob, type SchedulingSettings, type StaffAvail } from "./slots.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const env = (k: string) => Deno.env.get(k) ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
class UserError extends Error {}

/* ------------------------------- helpers ---------------------------------- */

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown, lo: number, hi: number) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < lo || n > hi) throw new UserError("Invalid number");
  return n;
};
const oneOf = <T extends string>(v: unknown, opts: readonly T[], fallback?: T): T => {
  if (opts.includes(v as T)) return v as T;
  if (fallback) return fallback;
  throw new UserError("Invalid option");
};
function clean(obj: unknown, depth = 0): unknown {
  if (depth > 3) return null;
  if (typeof obj === "string") return obj.slice(0, 2000);
  if (typeof obj === "number" || typeof obj === "boolean" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.slice(0, 20).map((x) => clean(x, depth + 1));
  if (typeof obj === "object") return Object.fromEntries(Object.entries(obj as object).slice(0, 60).map(([k, v]) => [k.slice(0, 60), clean(v, depth + 1)]));
  return null;
}

async function loadConfig() {
  const [settings, anchors, addons, areas, staff, blocked] = await Promise.all([
    db.from("settings").select("key,value"),
    db.from("price_anchors").select("bedrooms,bathrooms,price"),
    db.from("addons").select("slug,name,price,minutes,enabled"),
    db.from("areas").select("id,name,surcharge"),
    db.from("staff").select("id,name,email,line_user_id,active,working_days,start_window_start,start_window_end,payout_type,payout_value"),
    db.from("blocked_dates").select("date"),
  ]);
  const s = Object.fromEntries((settings.data ?? []).map((r) => [r.key, r.value]));
  return {
    pricing: s.pricing as PricingSettings,
    scheduling: s.scheduling as SchedulingSettings,
    payout: (s.payout ?? { type: "percent", value: 40 }) as { type: string; value: number },
    notifications: (s.notifications ?? {}) as Record<string, unknown>,
    business: (s.business ?? {}) as Record<string, string>,
    anchors: (anchors.data ?? []) as Anchor[],
    addons: (addons.data ?? []) as AddonDef[],
    areas: areas.data ?? [],
    staff: (staff.data ?? []) as (StaffAvail & { name: string; email: string | null; line_user_id: string | null; payout_type: string; payout_value: number })[],
    blocked: (blocked.data ?? []).map((b) => b.date as string),
  };
}

async function busyJobs(fromIso: string, toIso: string): Promise<BusyJob[]> {
  const { data } = await db.from("bookings").select("id,staff_id,start_at,duration_min")
    .gte("start_at", new Date(new Date(fromIso).getTime() - 86400000).toISOString()).lte("start_at", toIso)
    .not("status", "in", "(cancelled,no_show)");
  return (data ?? []) as BusyJob[];
}

/* ---------------------------- notifications ------------------------------- */

async function sendEmail(to: string, subject: string, html: string) {
  const key = env("RESEND_API_KEY");
  if (!key || !to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env("FROM_EMAIL") || "Samui Care <bookings@samuicare.com>", to: [to], subject, html }),
  }).catch((e) => console.error("email", e));
}
async function linePush(to: string, text: string) {
  const token = env("LINE_CHANNEL_TOKEN");
  if (!token || !to) return;
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
  }).catch((e) => console.error("line", e));
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

async function notifyTeam(subject: string, text: string, cfg: Awaited<ReturnType<typeof loadConfig>>, staffLineId?: string | null) {
  const n = cfg.notifications;
  const teamEmail = (n.team_email as string) || env("TEAM_EMAIL");
  await Promise.allSettled([
    n.email_team !== false && teamEmail ? sendEmail(teamEmail, subject, `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${esc(text)}</pre>`) : null,
    n.line_team !== false ? linePush(env("LINE_GROUP_ID"), `${subject}\n\n${text}`) : null,
    n.line_staff !== false && staffLineId ? linePush(staffLineId, `${subject}\n\n${text}`) : null,
  ]);
}

/* -------------------------------- actions --------------------------------- */

async function actionAvailability(body: Record<string, unknown>) {
  const minutes = int(body.minutes, 30, 16 * 60);
  const cfg = await loadConfig();
  const now = new Date();
  const jobs = await busyJobs(now.toISOString(), new Date(now.getTime() + (cfg.scheduling.max_days_ahead + 2) * 86400000).toISOString());
  const days = availability(minutes, cfg.staff, jobs, cfg.scheduling, now, cfg.blocked)
    .map((d) => ({ date: d.date, slots: d.slots.map((s) => ({ time: s.time, startAt: s.startAt, staffIds: [] })) }));
  return { days };
}

async function actionLead(body: Record<string, unknown>) {
  const data = clean(body.data) as Record<string, unknown>;
  const row = {
    kind: oneOf(body.kind, ["quote", "custom_quote"] as const, "quote"),
    step: int(body.step ?? 0, 0, 20),
    name: str(data?.name, 120) || null,
    phone: str(data?.phone, 40) || null,
    email: str(data?.email, 120) || null,
    whatsapp: str(data?.whatsapp, 40) || null,
    line_id: str(data?.lineId, 60) || null,
    quoted_price: (data?.quote as { total?: number } | null)?.total ?? null,
    data,
    updated_at: new Date().toISOString(),
  };
  const id = str(body.id, 40);
  if (id) {
    const { data: upd } = await db.from("leads").update(row).eq("id", id).eq("status", "new").is("booking_id", null).select("id").maybeSingle();
    if (upd) return { id: upd.id };
  }
  const { data: ins, error } = await db.from("leads").insert(row).select("id").single();
  if (error) throw error;
  return { id: ins.id };
}

async function actionRequest(body: Record<string, unknown>) {
  const kind = oneOf(body.kind, ["custom_quote", "interest", "contact"] as const);
  const data = clean(body.data) as Record<string, unknown>;
  const name = str(data?.name, 120);
  if (!name) throw new UserError("Please add your name");
  const row = {
    kind, status: "new", step: 99, name,
    phone: str(data?.phone, 40) || str(data?.contact, 120) || null,
    email: str(data?.email, 120) || null, whatsapp: str(data?.whatsapp, 40) || null, line_id: str(data?.lineId, 60) || null,
    data, updated_at: new Date().toISOString(),
  };
  const leadId = str(data?.leadId, 40);
  let id = leadId;
  if (leadId) {
    const { data: upd } = await db.from("leads").update(row).eq("id", leadId).is("booking_id", null).select("id").maybeSingle();
    id = upd?.id ?? "";
  }
  if (!id) {
    const { data: ins, error } = await db.from("leads").insert(row).select("id").single();
    if (error) throw error;
    id = ins.id;
  }
  const cfg = await loadConfig();
  const title = { custom_quote: "📝 New custom quote request", interest: "🌱 New register-interest", contact: "✉️ New contact message" }[kind];
  const lines = Object.entries(data ?? {})
    .filter(([k, v]) => v !== "" && v !== null && v !== false && !["leadId", "slot", "photos", "quote", "addons"].includes(k) && typeof v !== "object")
    .map(([k, v]) => `${k}: ${v}`);
  await notifyTeam(`${title} — ${name}`, lines.join("\n"), cfg);
  return { id };
}

async function actionBook(body: Record<string, unknown>) {
  const cfg = await loadConfig();
  const q = (body.quote ?? {}) as Record<string, unknown>;
  const prop = (body.property ?? {}) as Record<string, unknown>;
  const cust = (body.customer ?? {}) as Record<string, unknown>;

  const input = {
    bedrooms: int(q.bedrooms, 1, 20),
    bathrooms: int(q.bathrooms, 1, 20),
    condition: oneOf(q.condition, ["regular", "lived_in", "heavy"] as const) as Condition,
    kids: q.kids === true,
    pets: q.pets === true,
    addons: (Array.isArray(q.addons) ? q.addons : []).map((a) => str(a, 40)).slice(0, 20),
    frequency: oneOf(q.frequency, ["one_time", "weekly", "fortnightly", "monthly"] as const) as Frequency,
  };
  const area = cfg.areas.find((a) => a.id === str(prop.areaId, 40));
  if (!area) throw new UserError("Please choose your area");
  const address = str(prop.address, 300);
  if (address.length < 3) throw new UserError("Please add your address");
  const name = str(cust.name, 120);
  const contact = { phone: str(cust.phone, 40), whatsapp: str(cust.whatsapp, 40), lineId: str(cust.lineId, 60), email: str(cust.email, 120) };
  if (!name || !(contact.phone || contact.whatsapp || contact.lineId || contact.email)) throw new UserError("Please add your name and a way to contact you");
  const payment = oneOf(body.payment, ["card", "promptpay", "cash"] as const);

  // Authoritative price & duration — never trust the browser's numbers.
  const quote = computeQuote({ ...input, surcharge: area.surcharge ?? 0 }, cfg.pricing, cfg.anchors, cfg.addons);

  const start = new Date(str(body.startAt, 40));
  if (isNaN(start.getTime())) throw new UserError("Please pick a time slot");
  const date = bangkokDate(start);
  const now = new Date();
  const horizon = new Date(start.getTime() + 95 * 86400000);
  const jobs = await busyJobs(now.toISOString(), horizon.toISOString());
  const slot = slotsForDate(date, quote.minutes, cfg.staff, jobs, cfg.scheduling, now, cfg.blocked).find((s) => s.startAt === start.toISOString());
  if (!slot) throw new UserError("Sorry — that slot was just taken. Please pick another time slot.");
  const staffId = pickLeastBusy(slot.staffIds, date, jobs)!;
  const staff = cfg.staff.find((s) => s.id === staffId)!;

  // Customer: reuse by email/phone when we've seen them before.
  let customerId: string | null = null;
  for (const [col, val] of [["email", contact.email], ["phone", contact.phone], ["whatsapp", contact.whatsapp]] as const) {
    if (!val || customerId) continue;
    const { data } = await db.from("customers").select("id").ilike(col, val).limit(1).maybeSingle();
    customerId = data?.id ?? null;
  }
  const custRow = { name, phone: contact.phone || null, whatsapp: contact.whatsapp || null, line_id: contact.lineId || null, email: contact.email || null, preferred_contact: str(cust.preferred, 20) || null };
  if (customerId) await db.from("customers").update(custRow).eq("id", customerId);
  else {
    const { data, error } = await db.from("customers").insert(custRow).select("id").single();
    if (error) throw error;
    customerId = data.id;
  }

  const { data: property, error: pErr } = await db.from("properties").insert({
    customer_id: customerId,
    property_type: oneOf(prop.type, ["villa", "house", "townhouse", "condo"] as const, "house"),
    bedrooms: input.bedrooms, bathrooms: input.bathrooms,
    sqm: Number(prop.sqm) > 0 ? Math.round(Number(prop.sqm)) : null,
    floors: Number(prop.floors) > 0 ? Math.round(Number(prop.floors)) : null,
    area_id: area.id, address, maps_link: str(prop.mapsLink, 500) || null, access_notes: str(prop.accessNotes, 1000) || null,
  }).select("id").single();
  if (pErr) throw pErr;

  const payoutFor = (price: number) => {
    const t = staff.payout_type === "default" ? cfg.payout.type : staff.payout_type;
    const v = staff.payout_type === "default" ? cfg.payout.value : Number(staff.payout_value);
    return Math.round(t === "fixed" ? v : (price * v) / 100);
  };
  const addonNames = input.addons.map((s) => cfg.addons.find((a) => a.slug === s && a.enabled)?.name).filter(Boolean);
  const details = {
    ...input, addonNames, area: area.name, address, property_type: prop.type, maps_link: str(prop.mapsLink, 500),
    access_notes: str(prop.accessNotes, 1000), someone_home: str(prop.someoneHome, 5), last_cleaned: str(prop.lastCleaned, 40),
    photos: (Array.isArray(prop.photos) ? prop.photos : []).map((p) => str(p, 200)).filter((p) => p.startsWith("quotes/")).slice(0, 10),
    lines: quote.lines,
  };

  // Recurring: reserve the series, flag clashes for the team instead of failing.
  const dates = seriesDates(start, input.frequency, 90);
  const seriesId = dates.length > 1 ? crypto.randomUUID() : null;
  const leadId = str(body.leadId, 40) || null;
  const rows = [];
  const taken = [...jobs];
  for (const d of dates) {
    const first = d.getTime() === start.getTime();
    let sid: string | null = first ? staffId : null;
    if (!first) {
      const free = cfg.staff.filter((s) => s.active && isStaffFree(s.id, d, quote.minutes, taken, cfg.scheduling.travel_buffer));
      sid = free.find((s) => s.id === staffId)?.id ?? free[0]?.id ?? null;
    }
    rows.push({
      customer_id: customerId, property_id: property.id, staff_id: sid, series_id: seriesId, lead_id: leadId,
      start_at: d.toISOString(), duration_min: quote.minutes, status: sid ? "assigned" : "booked",
      price: quote.total, payout: payoutFor(quote.total), payment_method: payment, frequency: input.frequency,
      conflict: !sid || cfg.blocked.includes(bangkokDate(d)), details, notes: str(body.notes, 1000),
    });
    if (sid) taken.push({ staff_id: sid, start_at: d.toISOString(), duration_min: quote.minutes });
  }
  const { data: created, error: bErr } = await db.from("bookings").insert(rows).select("id,ref,start_at").order("start_at");
  if (bErr) throw bErr;
  const firstBooking = created[0];
  if (leadId) await db.from("leads").update({ status: "won", booking_id: firstBooking.id, quoted_price: quote.total, updated_at: new Date().toISOString() }).eq("id", leadId);

  // Notifications (each one quietly skips until its keys are added).
  const when = `${start.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Bangkok" })} at ${bangkokTime(start)}`;
  const conflicts = rows.filter((r) => r.conflict).length;
  const summary = [
    `Ref: ${firstBooking.ref}`,
    `When: ${when} (${formatDuration(quote.minutes)})`,
    `Where: ${address}, ${area.name}`,
    details.maps_link ? `Map: ${details.maps_link}` : "",
    `Property: ${input.bedrooms} bed / ${input.bathrooms} bath ${prop.type ?? ""}, ${input.condition.replace("_", "-")}${input.kids ? ", kids" : ""}${input.pets ? ", pets" : ""}`,
    addonNames.length ? `Add-ons: ${addonNames.join(", ")}` : "",
    `Price: ${formatTHB(quote.total)} · ${{ card: "Card", promptpay: "PromptPay", cash: "Cash on completion" }[payment]}`,
    input.frequency !== "one_time" ? `Repeats: ${input.frequency} (${rows.length} reserved${conflicts ? `, ⚠️ ${conflicts} need attention` : ""})` : "",
    `Customer: ${name} · ${[contact.phone, contact.whatsapp && `WA ${contact.whatsapp}`, contact.lineId && `LINE ${contact.lineId}`, contact.email].filter(Boolean).join(" · ")}`,
    details.access_notes ? `Access: ${details.access_notes}` : "",
    str(body.notes, 1000) ? `Notes: ${str(body.notes, 1000)}` : "",
    `Assigned: ${staff.name}`,
  ].filter(Boolean).join("\n");

  const b = cfg.business;
  await Promise.allSettled([
    notifyTeam(`🧽 New booking ${firstBooking.ref} — ${area.name}, ${when}`, summary, cfg, staff.line_user_id),
    cfg.notifications.email_customer !== false && contact.email
      ? sendEmail(contact.email, `Your Samui Care booking ${firstBooking.ref} — ${when}`,
        `<div style="font-family:Arial,sans-serif;color:#10302c;max-width:560px">
          <h2 style="color:#0f6a60">You're booked in ✨</h2>
          <p>Hi ${esc(name.split(" ")[0])}, thanks for booking with Samui Care.</p>
          <p><b>When:</b> ${esc(when)}<br><b>Estimated time:</b> ${formatDuration(quote.minutes)}<br><b>Where:</b> ${esc(address)}, ${esc(area.name)}<br>
          <b>Price:</b> ${formatTHB(quote.total)} (${{ card: "card", promptpay: "PromptPay", cash: "cash on completion" }[payment]})<br><b>Reference:</b> ${firstBooking.ref}</p>
          <p>Need to change something? Message us on LINE ${esc(b.line_id ?? "")}, WhatsApp ${esc(b.whatsapp ?? "")} or reply to this email.</p>
          <p>— Samui Care</p></div>`)
      : null,
  ]);

  return { ref: firstBooking.ref, total: quote.total, minutes: quote.minutes, startAt: firstBooking.start_at, series: rows.length, conflicts, checkoutUrl: null };
}

/* --------------------------------- server --------------------------------- */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    switch (body?.action) {
      case "availability": return json(await actionAvailability(body));
      case "lead": return json(await actionLead(body));
      case "request": return json(await actionRequest(body));
      case "book": return json(await actionBook(body));
      default: return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    if (e instanceof UserError) return json({ error: e.message }, 400);
    console.error(e);
    return json({ error: "Something went wrong — please try again or message us on LINE." }, 500);
  }
});
