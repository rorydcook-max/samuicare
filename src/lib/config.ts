import { DEFAULT_ANCHORS, DEFAULT_PRICING, type AddonDef, type Anchor, type PricingSettings } from "./pricing";
import type { SchedulingSettings, StaffAvail } from "./slots";

export interface Area { id: string; name: string; surcharge: number }
export interface Business {
  name: string; domain: string; phone: string; whatsapp: string; line_id: string; email: string;
}
export interface AppConfig {
  pricing: PricingSettings;
  anchors: Anchor[];
  addons: AddonDef[];
  areas: Area[];
  scheduling: SchedulingSettings;
  business: Business;
}

export const AREA_NAMES = [
  "Chaweng", "Choeng Mon", "Bophut", "Bangrak", "Plai Laem", "Maenam", "Bang Por", "Nathon",
  "Lipa Noi", "Taling Ngam", "Lamai", "Hua Thanon", "Na Muang", "Ban Tai", "Thong Krut", "Laem Set",
];

export const DEFAULT_ADDONS: AddonDef[] = [
  { slug: "laundry", name: "Laundry & linen", price: 100, minutes: 30, enabled: true,
    description: "Hang out one full washer load, run one wash from your laundry baskets, strip beds into the cycle and change bed linen if fresh sets are available. Ironing not included." },
  { slug: "oven", name: "Inside oven", price: 200, minutes: 30, enabled: true, description: "Degrease and clean the inside of the oven." },
  { slug: "fridge", name: "Inside fridge", price: 150, minutes: 20, enabled: true, description: "Empty, wipe and sanitise the inside of the fridge." },
  { slug: "windows", name: "Interior windows & glass doors", price: 200, minutes: 30, enabled: true, description: "Streak-free interior glass, frames and sliding doors." },
  { slug: "balcony", name: "Balcony / terrace", price: 150, minutes: 20, enabled: true, description: "Sweep, mop and wipe outdoor furniture." },
  { slug: "dishes", name: "Dishes", price: 100, minutes: 20, enabled: true, description: "Wash, dry and put away dishes." },
];

export const DEFAULT_SCHEDULING: SchedulingSettings = { slot_interval: 30, travel_buffer: 30, min_notice_hours: 12, max_days_ahead: 60 };

export const DEMO_STAFF: StaffAvail[] = [
  { id: "demo", working_days: [1, 2, 3, 4, 5, 6], start_window_start: "09:30", start_window_end: "12:00", active: true },
];

export const DEFAULT_BUSINESS: Business = {
  name: "Samui Care", domain: "samuicare.com", phone: "+66 00 000 0000", whatsapp: "+66000000000",
  line_id: "@samuicare", email: "hello@samuicare.com",
};

export const DEFAULT_CONFIG: AppConfig = {
  pricing: DEFAULT_PRICING,
  anchors: DEFAULT_ANCHORS,
  addons: DEFAULT_ADDONS,
  areas: AREA_NAMES.map((name) => ({ id: name, name, surcharge: 0 })),
  scheduling: DEFAULT_SCHEDULING,
  business: DEFAULT_BUSINESS,
};
