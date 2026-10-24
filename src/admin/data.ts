import { supabase } from "../lib/client";
import { bangkokDate, bangkokTime, bangkokToUtc } from "../lib/slots";

export const sb = () => {
  if (!supabase) throw new Error("Database not connected");
  return supabase;
};

export type BookingStatus = "booked" | "assigned" | "in_progress" | "completed" | "paid" | "cancelled" | "no_show";
export type PaymentStatus = "unpaid" | "paid_online" | "paid_cash" | "refunded";
export type LeadStatus = "new" | "contacted" | "quoted" | "won" | "lost";

export interface Customer {
  id: string; name: string; phone: string | null; whatsapp: string | null; line_id: string | null; email: string | null;
  preferred_contact: string | null; notes: string; created_at: string;
}
export interface Property {
  id: string; customer_id: string; property_type: string; bedrooms: number; bathrooms: number; sqm: number | null;
  floors: number | null; area_id: string | null; address: string; maps_link: string | null; access_notes: string | null;
}
export interface Staff {
  id: string; user_id: string | null; name: string; email: string | null; phone: string | null; line_user_id: string | null;
  color: string; active: boolean; payout_type: string; payout_value: number; working_days: number[];
  start_window_start: string; start_window_end: string;
}
export interface Booking {
  id: string; ref: string; customer_id: string | null; property_id: string | null; staff_id: string | null; lead_id: string | null;
  series_id: string | null; start_at: string; duration_min: number; status: BookingStatus; price: number; payout: number;
  payment_method: "card" | "promptpay" | "cash"; payment_status: PaymentStatus; frequency: string; conflict: boolean;
  details: Record<string, any>; notes: string; created_at: string;
  customers?: Customer | null; properties?: Property | null; staff?: Pick<Staff, "id" | "name" | "color"> | null;
}
export interface Lead {
  id: string; kind: string; status: LeadStatus; step: number; name: string | null; phone: string | null; email: string | null;
  whatsapp: string | null; line_id: string | null; data: Record<string, any>; notes: string; quoted_price: number | null;
  booking_id: string | null; created_at: string; updated_at: string;
}

export const BOOKING_SELECT = "*, customers(*), properties(*), staff(id,name,color)";

export const STATUS_LABEL: Record<BookingStatus, string> = {
  booked: "Needs cleaner", assigned: "Scheduled", in_progress: "In progress", completed: "Done", paid: "Done, paid", cancelled: "Cancelled", no_show: "No-show",
};
export const PAYMENT_LABEL: Record<PaymentStatus, string> = { unpaid: "Unpaid", paid_online: "Paid online", paid_cash: "Paid cash", refunded: "Refunded" };
export const METHOD_LABEL = { card: "Card", promptpay: "PromptPay", cash: "Cash" } as const;
export const LEAD_LABEL: Record<LeadStatus, string> = { new: "New", contacted: "Contacted", quoted: "Quoted", won: "Booked", lost: "Lost" };
export const KIND_LABEL: Record<string, string> = { quote: "Unfinished quote", custom_quote: "Custom quote", interest: "Register interest", contact: "Message" };
export const FREQ_LABEL: Record<string, string> = { one_time: "One-time", weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly" };
export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
export const fmtDayLong = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Bangkok" });
export const fmtTime = (iso: string) => bangkokTime(new Date(iso));
export const fmtWhen = (iso: string) => `${fmtDay(iso)}, ${fmtTime(iso)}`;
export const endTime = (b: Pick<Booking, "start_at" | "duration_min">) => bangkokTime(new Date(new Date(b.start_at).getTime() + b.duration_min * 60000));
export const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
};
export { bangkokDate, bangkokToUtc };
export const todayBkk = () => bangkokDate(new Date());

/** Start of a Bangkok calendar day (YYYY-MM-DD) as ISO UTC. */
export const dayStartIso = (date: string) => bangkokToUtc(date, 0).toISOString();

export interface ContactLike { phone?: string | null; whatsapp?: string | null; line_id?: string | null; email?: string | null }
export function contactLinks(c: ContactLike) {
  const digits = (s: string) => s.replace(/[^\d+]/g, "");
  const wa = (s: string) => {
    let d = s.replace(/\D/g, "");
    if (d.startsWith("0")) d = "66" + d.slice(1);
    return `https://wa.me/${d}`;
  };
  const out: { label: string; href: string }[] = [];
  if (c.whatsapp) out.push({ label: "WhatsApp", href: wa(c.whatsapp) });
  if (c.line_id) out.push({ label: "LINE", href: `https://line.me/R/ti/p/~${encodeURIComponent(c.line_id.replace(/^@/, ""))}` });
  if (c.phone) out.push({ label: "Call", href: `tel:${digits(c.phone)}` });
  if (c.email) out.push({ label: "Email", href: `mailto:${c.email}` });
  return out;
}
