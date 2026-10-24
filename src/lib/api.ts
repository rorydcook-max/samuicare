import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_CONFIG, DEMO_STAFF, type AppConfig } from "./config";
import { availability, type DaySlots } from "./slots";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null until the Supabase project is connected — the site then runs in demo mode on seeded defaults. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
export const DEMO = !supabase;

let configPromise: Promise<AppConfig> | null = null;

export function loadConfig(): Promise<AppConfig> {
  if (!supabase) return Promise.resolve(DEFAULT_CONFIG);
  configPromise ??= (async () => {
    const [settings, anchors, addons, areas] = await Promise.all([
      supabase.from("settings").select("key,value"),
      supabase.from("price_anchors").select("bedrooms,bathrooms,price"),
      supabase.from("addons").select("slug,name,description,price,minutes,enabled").order("sort"),
      supabase.from("areas").select("id,name,surcharge").order("sort"),
    ]);
    if (settings.error || anchors.error || addons.error || areas.error) return DEFAULT_CONFIG;
    const s = Object.fromEntries((settings.data ?? []).map((r) => [r.key, r.value]));
    return {
      pricing: { ...DEFAULT_CONFIG.pricing, ...(s.pricing ?? {}) },
      anchors: anchors.data?.length ? anchors.data : DEFAULT_CONFIG.anchors,
      addons: (addons.data ?? []).filter((a) => a.enabled),
      areas: areas.data?.length ? areas.data : DEFAULT_CONFIG.areas,
      scheduling: { ...DEFAULT_CONFIG.scheduling, ...(s.scheduling ?? {}) },
      business: { ...DEFAULT_CONFIG.business, ...(s.business ?? {}) },
    };
  })();
  return configPromise;
}

async function call<T>(action: string, payload: unknown): Promise<T> {
  const { data, error } = await supabase!.functions.invoke("public-api", { body: { action, ...(payload as object) } });
  if (error) {
    let msg = error.message;
    try { msg = (await (error as { context?: Response }).context?.json())?.error ?? msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  return data as T;
}

export async function getAvailability(minutes: number): Promise<DaySlots[]> {
  if (!supabase) return availability(minutes, DEMO_STAFF, [], DEFAULT_CONFIG.scheduling, new Date());
  return (await call<{ days: DaySlots[] }>("availability", { minutes })).days;
}

/** Upsert an in-progress quote as a CRM lead. Returns the lead id. Never throws. */
export async function saveLead(leadId: string | null, step: number, data: Record<string, unknown>, kind = "quote"): Promise<string | null> {
  if (!supabase) return leadId;
  try {
    return (await call<{ id: string }>("lead", { id: leadId, step, data, kind })).id;
  } catch {
    return leadId;
  }
}

export interface BookingResult { ref: string; total: number; minutes: number; startAt: string; series: number; conflicts: number; checkoutUrl?: string | null }

export async function createBooking(payload: Record<string, unknown>): Promise<BookingResult> {
  if (!supabase) {
    await new Promise((r) => setTimeout(r, 700));
    return { ref: "DEMO01", total: 0, minutes: 0, startAt: String(payload.startAt), series: 1, conflicts: 0 };
  }
  return call<BookingResult>("book", payload);
}

export async function submitRequest(kind: "custom_quote" | "interest" | "contact", data: Record<string, unknown>): Promise<void> {
  if (!supabase) { await new Promise((r) => setTimeout(r, 500)); return; }
  await call("request", { kind, data });
}
