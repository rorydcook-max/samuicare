import { useEffect, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { basePrice, formatTHB, DEFAULT_PRICING, type PricingSettings } from "../lib/pricing";
import { sb } from "./data";
import { Err, Field, PageHead, Placeholder } from "./ui";

type Settings = Record<string, any>;

function Section({ title, intro, children, onSave, saving, saved, err }: { title: string; intro?: string; children: ReactNode; onSave?: () => void; saving?: boolean; saved?: boolean; err?: string | null }) {
  return (
    <section className="rounded-xl border border-sand-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {intro && <p className="mt-1 max-w-2xl text-sm text-ink/60">{intro}</p>}
      <div className="mt-5">{children}</div>
      {(onSave || err) && (
        <div className="mt-5 flex items-center gap-3">
          {onSave && <button className="btn-primary !py-2" disabled={saving} onClick={onSave}>{saving ? "Saving" : "Save"}</button>}
          {saved && <span className="text-sm text-sea-700" role="status">Saved</span>}
          <Err e={err ?? null} />
        </div>
      )}
    </section>
  );
}

function useSave() {
  const [state, setState] = useState<{ saving: boolean; saved: boolean; err: string | null }>({ saving: false, saved: false, err: null });
  const run = async (fn: () => Promise<{ error: { message: string } | null } | void>) => {
    setState({ saving: true, saved: false, err: null });
    try {
      const r = await fn();
      if (r && r.error) setState({ saving: false, saved: false, err: r.error.message });
      else setState({ saving: false, saved: true, err: null });
    } catch (e) { setState({ saving: false, saved: false, err: String((e as Error).message ?? e) }); }
  };
  return { ...state, run };
}

const num = (v: string) => (v === "" ? 0 : Number(v.replace(/[^\d.]/g, "")));
const NumIn = ({ value, onChange, suffix }: { value: number; onChange: (n: number) => void; suffix?: string }) => (
  <div className="relative">
    <input className="field pr-12" inputMode="decimal" value={value} onChange={(e) => onChange(num(e.target.value))} />
    {suffix && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink/45">{suffix}</span>}
  </div>
);

async function saveSetting(key: string, value: unknown) {
  return sb().from("settings").update({ value, updated_at: new Date().toISOString() }).eq("key", key);
}

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  useEffect(() => {
    sb().from("settings").select("key,value").then(({ data }) => setS(Object.fromEntries((data ?? []).map((r) => [r.key, r.value]))));
  }, []);
  if (!s) return <p className="text-ink/60">Loading</p>;
  return (
    <>
      <PageHead title="Settings" />
      <p className="-mt-3 mb-6 max-w-2xl text-ink/65">Changes apply to the website straight away. Anything marked <Placeholder /> was a starting guess, so check it.</p>
      <div className="space-y-6">
        <PricingSection initial={{ ...DEFAULT_PRICING, ...s.pricing }} />
        <AnchorsSection pricing={{ ...DEFAULT_PRICING, ...s.pricing }} />
        <AddonsSection />
        <SchedulingSection initial={s.scheduling} />
        <BlockedSection />
        <AreasSection />
        <PayoutSection initial={s.payout} />
        <BusinessSection initial={s.business} notifications={s.notifications} />
      </div>
    </>
  );
}

function PricingSection({ initial }: { initial: PricingSettings }) {
  const [p, setP] = useState(initial);
  const sv = useSave();
  const ph = (k: string) => (p.placeholders ?? []).includes(k) ? <Placeholder /> : null;
  return (
    <Section title="Price rules" intro="Applied on top of the base price table. Condition, kids and pets change both the price and the time." onSave={() => sv.run(() => saveSetting("pricing", { ...p, placeholders: [] }).then((r) => { if (!r.error) setP({ ...p, placeholders: [] }); return r; }))} {...sv}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Smallest job"><NumIn value={p.min_price} onChange={(v) => setP({ ...p, min_price: v })} suffix="฿" /></Field>
        <Field label="Each extra bedroom"><NumIn value={p.extra_bedroom} onChange={(v) => setP({ ...p, extra_bedroom: v })} suffix="฿" /></Field>
        <Field label="Each extra bathroom"><NumIn value={p.extra_bathroom} onChange={(v) => setP({ ...p, extra_bathroom: v })} suffix="฿" /></Field>
        <Field label="Time per bedroom"><NumIn value={p.minutes_per_bedroom} onChange={(v) => setP({ ...p, minutes_per_bedroom: v })} suffix="min" /></Field>
        <Field label="Lived-in multiplier" hint="1.25 means 25% more"><NumIn value={p.multipliers.lived_in} onChange={(v) => setP({ ...p, multipliers: { ...p.multipliers, lived_in: v } })} suffix="×" /></Field>
        <Field label="Heavy multiplier"><NumIn value={p.multipliers.heavy} onChange={(v) => setP({ ...p, multipliers: { ...p.multipliers, heavy: v } })} suffix="×" /></Field>
        <Field label="Kids at home"><NumIn value={p.kids_pct} onChange={(v) => setP({ ...p, kids_pct: v })} suffix="%" /></Field>
        <Field label="Pets at home"><NumIn value={p.pets_pct} onChange={(v) => setP({ ...p, pets_pct: v })} suffix="%" /></Field>
        <div />
        <Field label={<>Weekly discount{ph("discounts")}</>}><NumIn value={p.discounts.weekly} onChange={(v) => setP({ ...p, discounts: { ...p.discounts, weekly: v } })} suffix="%" /></Field>
        <Field label="Fortnightly discount"><NumIn value={p.discounts.fortnightly} onChange={(v) => setP({ ...p, discounts: { ...p.discounts, fortnightly: v } })} suffix="%" /></Field>
        <Field label="Monthly discount"><NumIn value={p.discounts.monthly} onChange={(v) => setP({ ...p, discounts: { ...p.discounts, monthly: v } })} suffix="%" /></Field>
        <Field label={<>Hourly rate for custom quotes{ph("hourly_rate")}</>}><NumIn value={p.hourly_rate} onChange={(v) => setP({ ...p, hourly_rate: v })} suffix="฿" /></Field>
      </div>
    </Section>
  );
}

function AnchorsSection({ pricing }: { pricing: PricingSettings }) {
  const [rows, setRows] = useState<{ id?: string; bedrooms: number; bathrooms: number; price: number }[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const sv = useSave();
  const load = () => sb().from("price_anchors").select("*").order("bedrooms").order("bathrooms").then(({ data }) => setRows(data ?? []));
  useEffect(() => { load(); }, []);
  const save = () => sv.run(async () => {
    const db = sb();
    for (const id of removed) { const r = await db.from("price_anchors").delete().eq("id", id); if (r.error) return r; }
    const keys = rows.map((r) => `${r.bedrooms}-${r.bathrooms}`);
    if (new Set(keys).size !== keys.length) return { error: { message: "Two rows have the same bedrooms and bathrooms." } };
    for (const r of rows) {
      const res = r.id
        ? await db.from("price_anchors").update({ bedrooms: r.bedrooms, bathrooms: r.bathrooms, price: r.price }).eq("id", r.id)
        : await db.from("price_anchors").insert({ bedrooms: r.bedrooms, bathrooms: r.bathrooms, price: r.price });
      if (res.error) return res;
    }
    setRemoved([]); load();
    return { error: null };
  });
  return (
    <Section title="Base prices" intro={`For a regular-condition clean. Homes not listed start from the nearest smaller row and add ${formatTHB(pricing.extra_bedroom)} per bedroom and ${formatTHB(pricing.extra_bathroom)} per bathroom.`} onSave={save} {...sv}>
      <table className="w-full max-w-lg text-left">
        <thead className="text-sm text-ink/55"><tr><th className="pb-2 font-semibold">Bedrooms</th><th className="pb-2 font-semibold">Bathrooms</th><th className="pb-2 font-semibold">Price (฿)</th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? `n${i}`}>
              {(["bedrooms", "bathrooms", "price"] as const).map((k) => (
                <td key={k} className="py-1 pr-2"><input className="field !py-2" inputMode="numeric" value={r[k]} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, [k]: num(e.target.value) } : x)))} aria-label={k} /></td>
              ))}
              <td><button className="p-2 text-ink/50 hover:text-coral" aria-label="Remove row" onClick={() => { if (r.id) setRemoved([...removed, r.id]); setRows(rows.filter((_, j) => j !== i)); }}><Trash2 size={18} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="mt-2 text-sm font-semibold text-sea-700" onClick={() => setRows([...rows, { bedrooms: 5, bathrooms: 4, price: 0 }])}>Add a row</button>
      <p className="mt-4 text-sm text-ink/60">Check: 3 bed, 2 bath currently comes to {formatTHB(Math.max(pricing.min_price, basePrice(3, 2, rows, pricing)))}.</p>
    </Section>
  );
}

function AddonsSection() {
  const [rows, setRows] = useState<any[]>([]);
  const sv = useSave();
  useEffect(() => { sb().from("addons").select("*").order("sort").then(({ data }) => setRows(data ?? [])); }, []);
  const set = (i: number, patch: object) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = () => sv.run(async () => {
    for (const r of rows) {
      const res = await sb().from("addons").update({ name: r.name, description: r.description, price: r.price, minutes: r.minutes, enabled: r.enabled, is_placeholder: false }).eq("id", r.id);
      if (res.error) return res;
    }
    setRows(rows.map((r) => ({ ...r, is_placeholder: false })));
  });
  return (
    <Section title="Extras" intro="Customers tick these in the booking form. Switch one off to hide it." onSave={save} {...sv}>
      <div className="divide-y divide-sand-200 border-y border-sand-200">
        {rows.map((r, i) => (
          <div key={r.id} className="grid gap-3 py-4 sm:grid-cols-[1.4fr_0.6fr_0.6fr_auto] sm:items-end">
            <Field label={<>Name{r.is_placeholder && <Placeholder />}</>}><input className="field !py-2" value={r.name} onChange={(e) => set(i, { name: e.target.value })} /></Field>
            <Field label="Price"><NumIn value={r.price} onChange={(v) => set(i, { price: v })} suffix="฿" /></Field>
            <Field label="Extra time"><NumIn value={r.minutes} onChange={(v) => set(i, { minutes: v })} suffix="min" /></Field>
            <label className="flex items-center gap-2 pb-2.5 text-sm font-semibold"><input type="checkbox" checked={r.enabled} onChange={(e) => set(i, { enabled: e.target.checked })} /> On</label>
            <div className="sm:col-span-4"><Field label="Description shown to customers"><input className="field !py-2" value={r.description} onChange={(e) => set(i, { description: e.target.value })} /></Field></div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function SchedulingSection({ initial }: { initial: Settings }) {
  const [c, setC] = useState({ slot_interval: 30, travel_buffer: 30, min_notice_hours: 12, max_days_ahead: 60, ...initial });
  const sv = useSave();
  return (
    <Section title="Booking rules" intro="Each cleaner's own days and start times are set on the Staff page." onSave={() => sv.run(() => saveSetting("scheduling", c))} {...sv}>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Start times every"><NumIn value={c.slot_interval} onChange={(v) => setC({ ...c, slot_interval: v || 30 })} suffix="min" /></Field>
        <Field label="Travel time between jobs"><NumIn value={c.travel_buffer} onChange={(v) => setC({ ...c, travel_buffer: v })} suffix="min" /></Field>
        <Field label="Minimum notice"><NumIn value={c.min_notice_hours} onChange={(v) => setC({ ...c, min_notice_hours: v })} suffix="h" /></Field>
        <Field label="Book up to"><NumIn value={c.max_days_ahead} onChange={(v) => setC({ ...c, max_days_ahead: v || 60 })} suffix="days" /></Field>
      </div>
    </Section>
  );
}

function BlockedSection() {
  const [rows, setRows] = useState<{ id: string; date: string; reason: string }[]>([]);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const sv = useSave();
  const load = () => sb().from("blocked_dates").select("*").gte("date", new Date().toISOString().slice(0, 10)).order("date").then(({ data }) => setRows(data ?? []));
  useEffect(() => { load(); }, []);
  return (
    <Section title="Closed days" intro="No bookings can be made on these days, for holidays or days off." err={sv.err}>
      <ul className="mb-4 divide-y divide-sand-200 border-y border-sand-200">
        {rows.length === 0 && <li className="py-3 text-sm text-ink/55">No closed days coming up.</li>}
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between py-2.5">
            <span>{new Date(r.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" })} <span className="text-ink/55">{r.reason}</span></span>
            <button className="p-2 text-ink/50 hover:text-coral" aria-label="Reopen this day" onClick={() => sv.run(async () => { const r2 = await sb().from("blocked_dates").delete().eq("id", r.id); load(); return r2; })}><Trash2 size={18} /></button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Date"><input type="date" className="field !py-2" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Reason (optional)"><input className="field !py-2" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <button className="btn-ghost !py-2" disabled={!date} onClick={() => sv.run(async () => { const r = await sb().from("blocked_dates").insert({ date, reason }); if (!r.error) { setDate(""); setReason(""); load(); } return r; })}>Close this day</button>
      </div>
    </Section>
  );
}

function AreasSection() {
  const [rows, setRows] = useState<{ id: string; name: string; surcharge: number }[]>([]);
  const sv = useSave();
  useEffect(() => { sb().from("areas").select("*").order("sort").then(({ data }) => setRows(data ?? [])); }, []);
  const save = () => sv.run(async () => {
    for (const r of rows) { const res = await sb().from("areas").update({ surcharge: r.surcharge }).eq("id", r.id); if (res.error) return res; }
  });
  return (
    <Section title="Areas" intro="Add a travel charge for areas that are far from your base. Leave at 0 for the same price everywhere." onSave={save} {...sv}>
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((r, i) => (
          <label key={r.id} className="flex items-center justify-between gap-3 py-1">
            <span className="text-[0.95rem]">{r.name}</span>
            <span className="w-28"><NumIn value={r.surcharge} onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, surcharge: v } : x)))} suffix="฿" /></span>
          </label>
        ))}
      </div>
    </Section>
  );
}

function PayoutSection({ initial }: { initial: Settings }) {
  const [p, setP] = useState<{ type: string; value: number; placeholder?: boolean }>({ type: "percent", value: 40, ...initial });
  const sv = useSave();
  return (
    <Section title="Default cleaner pay" intro="Used for every cleaner set to the default rule. Applies to new bookings." onSave={() => sv.run(() => saveSetting("payout", { type: p.type, value: p.value }).then((r) => { if (!r.error) setP({ ...p, placeholder: false }); return r; }))} {...sv}>
      <div className="grid max-w-md grid-cols-2 gap-4">
        <Field label={<>Pay type{p.placeholder && <Placeholder />}</>}>
          <select className="field" value={p.type} onChange={(e) => setP({ ...p, type: e.target.value })}><option value="percent">% of job price</option><option value="fixed">Fixed ฿ per job</option></select>
        </Field>
        <Field label={p.type === "percent" ? "Percent" : "Baht per job"}><NumIn value={p.value} onChange={(v) => setP({ ...p, value: v })} suffix={p.type === "percent" ? "%" : "฿"} /></Field>
      </div>
    </Section>
  );
}

function BusinessSection({ initial, notifications }: { initial: Settings; notifications: Settings }) {
  const [b, setB] = useState({ name: "Samui Care", phone: "", whatsapp: "", line_id: "", email: "", ...initial });
  const [n, setN] = useState({ team_email: "", email_customer: true, email_team: true, line_team: true, line_staff: true, ...notifications });
  const sv = useSave();
  const save = () => sv.run(async () => {
    const r1 = await saveSetting("business", { ...b, placeholder: false });
    if (r1.error) return r1;
    return saveSetting("notifications", n);
  });
  return (
    <Section title="Contact details and alerts" intro="Shown on the website and in booking emails." onSave={save} {...sv}>
      {initial.placeholder && <p className="mb-4 text-sm">These are still the placeholder details <Placeholder /></p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone"><input className="field" value={b.phone} onChange={(e) => setB({ ...b, phone: e.target.value })} /></Field>
        <Field label="WhatsApp number"><input className="field" value={b.whatsapp} onChange={(e) => setB({ ...b, whatsapp: e.target.value })} /></Field>
        <Field label="LINE ID"><input className="field" value={b.line_id} onChange={(e) => setB({ ...b, line_id: e.target.value })} /></Field>
        <Field label="Email"><input className="field" value={b.email} onChange={(e) => setB({ ...b, email: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field label="Send team alerts to" hint="New bookings, leads and quote requests are emailed here once email sending is connected."><input className="field" type="email" value={n.team_email} onChange={(e) => setN({ ...n, team_email: e.target.value })} /></Field></div>
      </div>
      <div className="mt-4 grid gap-2 text-[0.95rem] sm:grid-cols-2">
        {([["email_customer", "Email customers their booking confirmation"], ["email_team", "Email the team about new bookings and leads"], ["line_team", "Send new bookings to the team LINE group"], ["line_staff", "Send each cleaner their own new jobs on LINE"]] as const).map(([k, l]) => (
          <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={!!n[k]} onChange={(e) => setN({ ...n, [k]: e.target.checked })} /> {l}</label>
        ))}
      </div>
    </Section>
  );
}
