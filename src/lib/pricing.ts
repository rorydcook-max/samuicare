// Pure pricing engine shared by the quote wizard (live estimate) and the server (authoritative price).
// Ported from the tested Lovable version. Keep supabase/functions/public-api/pricing.ts in sync (npm run sync).
export type Condition = "regular" | "lived_in" | "heavy" | "very_heavy";
export type Frequency = "one_time" | "weekly" | "fortnightly" | "monthly";

export interface PricingSettings {
  min_price: number;
  extra_bedroom: number;
  extra_bathroom: number;
  minutes_per_bedroom: number;
  min_minutes: number;
  round_minutes: number;
  multipliers: { regular: number; lived_in: number; heavy: number };
  kids_pct: number;
  pets_pct: number;
  discounts: Record<Frequency, number>;
  hourly_rate: number;
  placeholders?: string[];
}

export interface Anchor {
  bedrooms: number;
  bathrooms: number;
  price: number;
}

export interface AddonDef {
  slug: string;
  name: string;
  description?: string;
  price: number;
  minutes: number;
  enabled: boolean;
}

export interface QuoteInput {
  bedrooms: number;
  bathrooms: number;
  condition: Condition;
  kids: boolean;
  pets: boolean;
  addons: string[];
  frequency: Frequency;
  surcharge?: number;
}

export interface QuoteResult {
  custom: boolean;
  base: number;
  conditionAdjusted: number;
  addonsTotal: number;
  surcharge: number;
  subtotal: number;
  discountPct: number;
  discount: number;
  total: number;
  minutes: number;
  lines: { label: string; amount: number }[];
}

export function basePrice(beds: number, baths: number, anchors: Anchor[], s: PricingSettings): number {
  const sorted = [...anchors].sort((a, b) => a.bedrooms - b.bedrooms || a.bathrooms - b.bathrooms);
  const candidates = sorted.filter((a) => a.bedrooms <= beds && a.bathrooms <= baths);
  const anchor =
    candidates.sort((a, b) => b.bedrooms - a.bedrooms || b.bathrooms - a.bathrooms)[0] ?? sorted[0];
  if (!anchor) return s.min_price;
  const extraBeds = Math.max(0, beds - anchor.bedrooms);
  const extraBaths = Math.max(0, baths - anchor.bathrooms);
  return anchor.price + extraBeds * s.extra_bedroom + extraBaths * s.extra_bathroom;
}

export function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

export function computeQuote(
  input: QuoteInput,
  s: PricingSettings,
  anchors: Anchor[],
  addons: AddonDef[],
): QuoteResult {
  const lines: QuoteResult["lines"] = [];
  if (input.condition === "very_heavy") {
    return {
      custom: true, base: 0, conditionAdjusted: 0, addonsTotal: 0, surcharge: 0, subtotal: 0,
      discountPct: 0, discount: 0, total: 0, minutes: 0, lines,
    };
  }
  const base = basePrice(input.bedrooms, input.bathrooms, anchors, s);
  const mult = s.multipliers[input.condition] ?? 1;
  const familyPct = (input.kids ? s.kids_pct : 0) + (input.pets ? s.pets_pct : 0);
  const factor = mult * (1 + familyPct / 100);
  const conditionAdjusted = Math.round(base * factor);
  lines.push({ label: `Cleaning (${input.bedrooms} bed / ${input.bathrooms} bath)`, amount: base });
  if (conditionAdjusted !== base) lines.push({ label: "Condition & household", amount: conditionAdjusted - base });

  let addonsTotal = 0;
  let addonMinutes = 0;
  for (const slug of input.addons) {
    const a = addons.find((x) => x.slug === slug && x.enabled);
    if (!a) continue;
    addonsTotal += a.price;
    addonMinutes += a.minutes;
    lines.push({ label: a.name, amount: a.price });
  }
  const surcharge = input.surcharge ?? 0;
  if (surcharge) lines.push({ label: "Travel surcharge", amount: surcharge });

  const subtotal = conditionAdjusted + addonsTotal + surcharge;
  const discountPct = s.discounts[input.frequency] ?? 0;
  const discount = Math.round((subtotal * discountPct) / 100);
  if (discount) lines.push({ label: `Recurring discount (${discountPct}%)`, amount: -discount });
  const total = Math.max(s.min_price, subtotal - discount);

  const baseMinutes = Math.max(s.min_minutes, input.bedrooms * s.minutes_per_bedroom) * factor;
  const minutes = Math.max(s.min_minutes, roundTo(baseMinutes + addonMinutes, s.round_minutes));

  return { custom: false, base, conditionAdjusted, addonsTotal, surcharge, subtotal, discountPct, discount, total, minutes, lines };
}

export function formatTHB(n: number) {
  return `฿${Math.round(n).toLocaleString("en-US")}`;
}

export function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const DEFAULT_PRICING: PricingSettings = {
  min_price: 500, extra_bedroom: 200, extra_bathroom: 100, minutes_per_bedroom: 60, min_minutes: 60,
  round_minutes: 15, multipliers: { regular: 1, lived_in: 1.25, heavy: 1.5 }, kids_pct: 10, pets_pct: 10,
  discounts: { one_time: 0, weekly: 10, fortnightly: 5, monthly: 0 }, hourly_rate: 350,
};

export const DEFAULT_ANCHORS: Anchor[] = [
  { bedrooms: 1, bathrooms: 1, price: 500 },
  { bedrooms: 2, bathrooms: 1, price: 700 },
  { bedrooms: 2, bathrooms: 2, price: 800 },
  { bedrooms: 3, bathrooms: 3, price: 1000 },
  { bedrooms: 4, bathrooms: 3, price: 1200 },
];
