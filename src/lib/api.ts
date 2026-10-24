// Public-site data access. Deliberately uses plain fetch (no supabase-js) to keep the public bundle small;
// the admin area loads the full client from ./client.ts in its own chunk.
import { DEFAULT_CONFIG, DEMO_STAFF, type AppConfig } from "./config";
import { availability, type DaySlots } from "./slots";

export const SB_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
export const SB_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";
export const DEMO = !SB_URL || !SB_KEY;

const headers = { apikey: SB_KEY, "Content-Type": "application/json" };

async function rest<T>(path: string): Promise<T> {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers });
  if (!r.ok) throw new Error(`Couldn't load ${path.split("?")[0]}`);
  return r.json();
}

let configPromise: Promise<AppConfig> | null = null;

export function loadConfig(): Promise<AppConfig> {
  if (DEMO) return Promise.resolve(DEFAULT_CONFIG);
  configPromise ??= (async () => {
    try {
      const [settings, anchors, addons, areas] = await Promise.all([
        rest<{ key: string; value: any }[]>("settings?select=key,value"),
        rest<AppConfig["anchors"]>("price_anchors?select=bedrooms,bathrooms,price"),
        rest<AppConfig["addons"]>("addons?select=slug,name,description,price,minutes,enabled&order=sort"),
        rest<AppConfig["areas"]>("areas?select=id,name,surcharge&order=sort"),
      ]);
      const s = Object.fromEntries(settings.map((r) => [r.key, r.value]));
      return {
        pricing: { ...DEFAULT_CONFIG.pricing, ...(s.pricing ?? {}) },
        anchors: anchors.length ? anchors : DEFAULT_CONFIG.anchors,
        addons: addons.filter((a) => a.enabled),
        areas: areas.length ? areas : DEFAULT_CONFIG.areas,
        scheduling: { ...DEFAULT_CONFIG.scheduling, ...(s.scheduling ?? {}) },
        business: { ...DEFAULT_CONFIG.business, ...(s.business ?? {}) },
      };
    } catch {
      configPromise = null;
      return DEFAULT_CONFIG;
    }
  })();
  return configPromise;
}

async function call<T>(action: string, payload: object): Promise<T> {
  const r = await fetch(`${SB_URL}/functions/v1/public-api`, { method: "POST", headers, body: JSON.stringify({ action, ...payload }) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error ?? "Something went wrong. Try again or message us on LINE.");
  return body as T;
}

export async function getAvailability(minutes: number): Promise<DaySlots[]> {
  if (DEMO) return availability(minutes, DEMO_STAFF, [], DEFAULT_CONFIG.scheduling, new Date());
  return (await call<{ days: DaySlots[] }>("availability", { minutes })).days;
}

/** Upsert an in-progress quote as a CRM lead. Returns the lead id. Never throws. */
export async function saveLead(leadId: string | null, step: number, data: Record<string, unknown>, kind = "quote"): Promise<string | null> {
  if (DEMO) return leadId;
  try {
    return (await call<{ id: string }>("lead", { id: leadId, step, data, kind })).id;
  } catch {
    return leadId;
  }
}

export interface BookingResult { ref: string; total: number; minutes: number; startAt: string; series: number; conflicts: number; checkoutUrl?: string | null }

export async function createBooking(payload: Record<string, unknown>): Promise<BookingResult> {
  if (DEMO) {
    await new Promise((r) => setTimeout(r, 700));
    return { ref: "DEMO01", total: 0, minutes: 0, startAt: String(payload.startAt), series: 1, conflicts: 0 };
  }
  return call<BookingResult>("book", payload);
}

export async function submitRequest(kind: "custom_quote" | "interest" | "contact", data: Record<string, unknown>): Promise<void> {
  if (DEMO) { await new Promise((r) => setTimeout(r, 500)); return; }
  await call("request", { kind, data });
}

/** Upload a quote photo to the private `uploads` bucket. Returns the stored path, or null on failure. */
export async function uploadPhoto(file: File): Promise<string | null> {
  if (DEMO) return null;
  const path = `quotes/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const r = await fetch(`${SB_URL}/storage/v1/object/uploads/${path}`, {
    method: "POST", headers: { apikey: SB_KEY, "Content-Type": file.type || "application/octet-stream" }, body: file,
  });
  return r.ok ? path : null;
}
