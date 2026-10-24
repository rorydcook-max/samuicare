// Shared outbound integrations: email (Resend), LINE push, Google Calendar (service account).
// Every sender is a no-op until its secrets are set, so the app works before the accounts exist.
// Secrets: RESEND_API_KEY, FROM_EMAIL, TEAM_EMAIL, LINE_CHANNEL_TOKEN, LINE_GROUP_ID,
//          GOOGLE_SERVICE_ACCOUNT (JSON), GOOGLE_CALENDAR_ID.

export const env = (k: string) => Deno.env.get(k) ?? "";
export const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export async function sendEmail(to: string | null | undefined, subject: string, html: string) {
  const key = env("RESEND_API_KEY");
  if (!key || !to) return;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env("FROM_EMAIL") || "Samui Care <bookings@samuicare.com>", to: [to], subject, html }),
  }).catch((e) => console.error("email", e));
  if (r && !r.ok) console.error("email", r.status, await r.text());
}

export async function linePush(to: string | null | undefined, text: string) {
  const token = env("LINE_CHANNEL_TOKEN");
  if (!token || !to) return;
  const r = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
  }).catch((e) => console.error("line", e));
  if (r && !r.ok) console.error("line", r.status, await r.text());
}

export interface NotifySettings { team_email?: string; email_customer?: boolean; email_team?: boolean; line_team?: boolean; line_staff?: boolean; google_calendar?: boolean }

export async function notifyTeam(subject: string, text: string, n: NotifySettings, staffLineId?: string | null) {
  const teamEmail = n.team_email || env("TEAM_EMAIL");
  await Promise.allSettled([
    n.email_team !== false && teamEmail ? sendEmail(teamEmail, subject, `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${esc(text)}</pre>`) : null,
    n.line_team !== false ? linePush(env("LINE_GROUP_ID"), `${subject}\n\n${text}`) : null,
    n.line_staff !== false && staffLineId ? linePush(staffLineId, `${subject}\n\n${text}`) : null,
  ]);
}

/* -------------------------------- formatting ------------------------------ */

const TZ = "Asia/Bangkok";
export const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TZ })} at ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ })}`;
};
export const thb = (n: number) => `฿${Math.round(n).toLocaleString("en-US")}`;
export const dur = (min: number) => { const h = Math.floor(min / 60), m = min % 60; return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`; };
const PAY = { card: "Card", promptpay: "PromptPay", cash: "Cash on completion" } as Record<string, string>;

/** A booking row joined with customers, properties and staff (the shape both functions load). */
export interface JobRow {
  id: string; ref: string; start_at: string; duration_min: number; price: number; payment_method: string; payment_status: string;
  status: string; frequency: string; notes: string; details: Record<string, any>; gcal_event_id: string | null;
  customers: { name: string; phone: string | null; whatsapp: string | null; line_id: string | null; email: string | null } | null;
  properties: { address: string; maps_link: string | null; access_notes: string | null; property_type: string } | null;
  staff: { name: string; line_user_id: string | null; color: string } | null;
}
export const JOB_SELECT = "id,ref,start_at,duration_min,price,payment_method,payment_status,status,frequency,notes,details,gcal_event_id,customers(name,phone,whatsapp,line_id,email),properties(address,maps_link,access_notes,property_type),staff(name,line_user_id,color)";

export function jobText(j: JobRow) {
  const d = j.details ?? {};
  const c = j.customers;
  return [
    `Ref: ${j.ref}`,
    `When: ${fmtWhen(j.start_at)} (${dur(j.duration_min)})`,
    `Where: ${j.properties?.address ?? d.address ?? ""}${d.area ? `, ${d.area}` : ""}`,
    (j.properties?.maps_link ?? d.maps_link) ? `Map: ${j.properties?.maps_link ?? d.maps_link}` : "",
    d.bedrooms ? `Property: ${d.bedrooms} bed / ${d.bathrooms} bath ${j.properties?.property_type ?? d.property_type ?? ""}${d.condition ? `, ${String(d.condition).replace("_", "-")}` : ""}${d.kids ? ", kids" : ""}${d.pets ? ", pets" : ""}` : "",
    d.addonNames?.length ? `Extras: ${d.addonNames.join(", ")}` : "",
    `Price: ${thb(j.price)} · ${PAY[j.payment_method] ?? j.payment_method}${j.payment_status !== "unpaid" ? " (paid)" : ""}`,
    c ? `Customer: ${c.name} · ${[c.phone, c.whatsapp && `WA ${c.whatsapp}`, c.line_id && `LINE ${c.line_id}`, c.email].filter(Boolean).join(" · ")}` : "",
    (j.properties?.access_notes ?? d.access_notes) ? `Access: ${j.properties?.access_notes ?? d.access_notes}` : "",
    j.notes ? `Notes: ${j.notes}` : "",
    `Cleaner: ${j.staff?.name ?? "not assigned"}`,
  ].filter(Boolean).join("\n");
}

export function customerEmail(title: string, intro: string, j: JobRow, b: Record<string, string>) {
  const d = j.details ?? {};
  return `<div style="font-family:Arial,sans-serif;color:#0E2A2F;max-width:560px;line-height:1.5">
    <h2 style="color:#0A6C74;margin:0 0 12px">${esc(title)}</h2>
    <p>${intro}</p>
    <p><b>When:</b> ${esc(fmtWhen(j.start_at))}<br><b>Takes about:</b> ${dur(j.duration_min)}<br>
    <b>Where:</b> ${esc(j.properties?.address ?? d.address ?? "")}${d.area ? `, ${esc(d.area)}` : ""}<br>
    <b>Price:</b> ${thb(j.price)} (${esc((PAY[j.payment_method] ?? j.payment_method).toLowerCase())}${j.payment_status !== "unpaid" ? ", paid" : ""})<br>
    <b>Reference:</b> ${esc(j.ref)}</p>
    <p>Need to change something? Message us on LINE ${esc(b.line_id ?? "")}, WhatsApp ${esc(b.whatsapp ?? "")} or reply to this email.</p>
    <p>Samui Care</p></div>`;
}

/* ----------------------------- Google Calendar ---------------------------- */

let gToken: { token: string; exp: number } | null = null;

function b64url(data: ArrayBuffer | string) {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function googleToken(): Promise<string | null> {
  const raw = env("GOOGLE_SERVICE_ACCOUNT");
  if (!raw || !env("GOOGLE_CALENDAR_ID")) return null;
  if (gToken && gToken.exp > Date.now() + 60000) return gToken.token;
  const sa = JSON.parse(raw) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/calendar.events", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claim}`));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claim}.${b64url(sig)}` }),
  });
  if (!r.ok) { console.error("gcal token", r.status, await r.text()); return null; }
  const j = await r.json();
  gToken = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return gToken.token;
}

// Google Calendar's fixed event colour ids, matched to the cleaner colours used in the admin.
const GCAL_COLOR: Record<string, string> = { "#0A6C74": "7", "#B4471F": "6", "#5B5BD6": "9", "#C58A00": "5", "#2F8F4E": "10", "#B0397A": "3" };

/** Create or update the job's calendar event. Returns the event id (or the existing one on failure). */
export async function calendarUpsert(j: JobRow, enabled = true): Promise<string | null> {
  if (!enabled) return j.gcal_event_id;
  const token = await googleToken();
  if (!token) return j.gcal_event_id;
  const cal = encodeURIComponent(env("GOOGLE_CALENDAR_ID"));
  const d = j.details ?? {};
  const event = {
    summary: `${d.area ?? ""} · ${d.bedrooms ?? "?"}bd/${d.bathrooms ?? "?"}ba · ${j.customers?.name ?? ""}`,
    description: jobText(j),
    location: j.properties?.address ?? d.address ?? "",
    start: { dateTime: j.start_at, timeZone: TZ },
    end: { dateTime: new Date(new Date(j.start_at).getTime() + j.duration_min * 60000).toISOString(), timeZone: TZ },
    colorId: GCAL_COLOR[j.staff?.color ?? ""] ?? "7",
  };
  const base = `https://www.googleapis.com/calendar/v3/calendars/${cal}/events`;
  const r = await fetch(j.gcal_event_id ? `${base}/${j.gcal_event_id}` : base, {
    method: j.gcal_event_id ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!r.ok) { console.error("gcal upsert", r.status, await r.text()); return j.gcal_event_id; }
  return (await r.json()).id ?? j.gcal_event_id;
}

export async function calendarDelete(eventId: string | null) {
  if (!eventId) return;
  const token = await googleToken();
  if (!token) return;
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(env("GOOGLE_CALENDAR_ID"))}/events/${eventId}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok && r.status !== 410 && r.status !== 404) console.error("gcal delete", r.status, await r.text());
}
