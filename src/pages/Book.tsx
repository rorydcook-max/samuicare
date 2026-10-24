import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Baby, Building, Building2, CalendarDays, Check, Clock, Dog, Home, Hotel, ImagePlus,
  Loader2, Minus, PartyPopper, Plus, Store, UtensilsCrossed, Warehouse, Wallet, CreditCard, QrCode, Banknote,
} from "lucide-react";
import { useConfig } from "../components/ui";
import { computeQuote, formatDuration, formatTHB, type Condition, type Frequency } from "../lib/pricing";
import { createBooking, DEMO, getAvailability, saveLead, submitRequest, uploadPhoto, type BookingResult } from "../lib/api";
import type { DaySlots, Slot } from "../lib/slots";

/* ------------------------------ form state -------------------------------- */

type PropType = "villa" | "house" | "townhouse" | "condo" | "commercial";
type Payment = "card" | "promptpay" | "cash";

interface FormState {
  propertyType: PropType | null;
  commercialType: string;
  bedrooms: number;
  bathrooms: number;
  sqm: string;
  floors: string;
  condition: Condition | null;
  kids: boolean;
  pets: boolean;
  lastCleaned: string;
  photos: string[];
  addons: string[];
  frequency: Frequency;
  areaId: string;
  address: string;
  mapsLink: string;
  accessNotes: string;
  someoneHome: "yes" | "no" | "";
  slot: Slot | null;
  name: string;
  phone: string;
  whatsapp: string;
  lineId: string;
  email: string;
  preferred: string;
  notes: string;
  payment: Payment;
  commercialDetails: string;
}

const INITIAL: FormState = {
  propertyType: null, commercialType: "", bedrooms: 2, bathrooms: 1, sqm: "", floors: "", condition: null,
  kids: false, pets: false, lastCleaned: "", photos: [], addons: [], frequency: "one_time", areaId: "", address: "",
  mapsLink: "", accessNotes: "", someoneHome: "", slot: null, name: "", phone: "", whatsapp: "", lineId: "",
  email: "", preferred: "whatsapp", notes: "", payment: "cash", commercialDetails: "",
};

type StepId = "type" | "size" | "condition" | "addons" | "frequency" | "location" | "slot" | "contact" | "review" | "commercial";

const STEP_TITLES: Record<StepId, string> = {
  type: "What are we cleaning?", size: "How big is it?", condition: "What condition is it in?",
  addons: "Any extras?", frequency: "How often?", location: "Where is it?", slot: "Pick a time",
  contact: "Your details", review: "Review & pay", commercial: "Tell us about the job",
};

/* -------------------------------- component ------------------------------- */

export default function Book() {
  const cfg = useConfig();
  const [params] = useSearchParams();
  const [f, setF] = useState<FormState>(() => {
    const n = (k: string, d: number) => Math.min(12, Math.max(1, Number(params.get(k)) || d));
    const c = params.get("condition");
    return {
      ...INITIAL,
      propertyType: params.get("type") === "commercial" ? "commercial" : null,
      bedrooms: n("beds", INITIAL.bedrooms),
      bathrooms: n("baths", INITIAL.bathrooms),
      condition: c === "regular" || c === "lived_in" || c === "heavy" ? c : null,
    };
  });
  const [stepIdx, setStepIdx] = useState(0);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [done, setDone] = useState<BookingResult | "request" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const isCustom = f.propertyType === "commercial" || f.condition === "very_heavy";
  const steps: StepId[] = f.propertyType === "commercial"
    ? ["type", "commercial", "location", "contact", "review"]
    : f.condition === "very_heavy"
      ? ["type", "size", "condition", "location", "contact", "review"]
      : ["type", "size", "condition", "addons", "frequency", "location", "slot", "contact", "review"];
  const step = steps[Math.min(stepIdx, steps.length - 1)];

  const area = cfg.areas.find((a) => a.id === f.areaId);
  const quote = useMemo(
    () => computeQuote(
      { bedrooms: f.bedrooms, bathrooms: f.bathrooms, condition: f.condition ?? "regular", kids: f.kids, pets: f.pets, addons: f.addons, frequency: f.frequency, surcharge: area?.surcharge ?? 0 },
      cfg.pricing, cfg.anchors, cfg.addons,
    ),
    [f.bedrooms, f.bathrooms, f.condition, f.kids, f.pets, f.addons, f.frequency, area, cfg],
  );

  // Slot must be re-picked if the job length changes.
  useEffect(() => { setF((s) => (s.slot ? { ...s, slot: null } : s)); }, [quote.minutes]);

  const leadPayload = () => ({ ...f, slot: f.slot?.startAt ?? null, quote: isCustom ? null : { total: quote.total, minutes: quote.minutes }, area: area?.name });

  const canNext = (): boolean => {
    switch (step) {
      case "type": return !!f.propertyType;
      case "commercial": return !!f.commercialType && f.commercialDetails.trim().length > 3;
      case "size": return f.bedrooms > 0 && f.bathrooms > 0;
      case "condition": return !!f.condition;
      case "location": return !!f.areaId && f.address.trim().length > 2;
      case "slot": return !!f.slot;
      case "contact": return !!f.name.trim() && !!(f.phone || f.whatsapp || f.lineId || f.email) && (!f.email || /\S+@\S+\.\S+/.test(f.email));
      default: return true;
    }
  };

  const next = async () => {
    if (!canNext()) return;
    // Save the quote as a CRM lead once we know the size, and again as details come in.
    if (["size", "commercial", "condition", "location", "slot", "contact"].includes(step)) {
      saveLead(leadId, stepIdx + 1, leadPayload(), isCustom ? "custom_quote" : "quote").then((id) => id && setLeadId(id));
    }
    setStepIdx((i) => Math.min(i + 1, steps.length - 1));
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const back = () => setStepIdx((i) => Math.max(0, i - 1));

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (isCustom) {
        await submitRequest("custom_quote", { ...leadPayload(), leadId });
        setDone("request");
      } else {
        const res = await createBooking({
          leadId,
          startAt: f.slot!.startAt,
          quote: { bedrooms: f.bedrooms, bathrooms: f.bathrooms, condition: f.condition, kids: f.kids, pets: f.pets, addons: f.addons, frequency: f.frequency },
          property: { type: f.propertyType, sqm: f.sqm, floors: f.floors, areaId: f.areaId, address: f.address, mapsLink: f.mapsLink, accessNotes: f.accessNotes, someoneHome: f.someoneHome, lastCleaned: f.lastCleaned, photos: f.photos },
          customer: { name: f.name, phone: f.phone, whatsapp: f.whatsapp, lineId: f.lineId, email: f.email, preferred: f.preferred },
          notes: f.notes,
          payment: f.payment,
          clientTotal: quote.total,
          origin: window.location.origin,
        });
        if (res.checkoutUrl) { window.location.href = res.checkoutUrl; return; }
        setDone(res);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      if (String(e).toLowerCase().includes("slot")) { set("slot", null); setStepIdx(steps.indexOf("slot")); }
    } finally {
      setSubmitting(false);
    }
  };

  if (done) return <Confirmation result={done} f={f} quote={quote} areaName={area?.name} />;

  const progress = ((stepIdx + 1) / steps.length) * 100;

  return (
    <div ref={topRef} className="container-x scroll-mt-20 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between text-sm">
          <span className="font-semibold text-sea-700">Step {stepIdx + 1} of {steps.length}</span>
          <Link to="/" className="text-ink/60 hover:text-ink">Cancel</Link>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-sand-200">
          <div className="h-full rounded-full bg-sea-600 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">{STEP_TITLES[step]}</h1>
            <div className="mt-6">
              {step === "type" && <StepType f={f} set={set} />}
              {step === "commercial" && <StepCommercial f={f} set={set} />}
              {step === "size" && <StepSize f={f} set={set} />}
              {step === "condition" && <StepCondition f={f} set={set} />}
              {step === "addons" && <StepAddons f={f} set={set} addons={cfg.addons} />}
              {step === "frequency" && <StepFrequency f={f} set={set} discounts={cfg.pricing.discounts} />}
              {step === "location" && <StepLocation f={f} set={set} areas={cfg.areas} />}
              {step === "slot" && <StepSlot f={f} set={set} minutes={quote.minutes} />}
              {step === "contact" && <StepContact f={f} set={set} />}
              {step === "review" && <StepReview f={f} set={set} isCustom={isCustom} quote={quote} areaName={area?.name} />}
            </div>

            {error && <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}

            <div className="mt-8 flex items-center gap-3">
              {stepIdx > 0 && <button className="btn-ghost" onClick={back}><ArrowLeft size={18} /> Back</button>}
              {step !== "review" ? (
                <button className="btn-primary flex-1 sm:flex-none" disabled={!canNext()} onClick={next}>Continue <ArrowRight size={18} /></button>
              ) : (
                <button className="btn-primary flex-1 sm:flex-none" disabled={submitting} onClick={submit}>
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                  {isCustom ? "Request my quote" : f.payment === "cash" ? "Confirm booking" : "Confirm & pay"}
                </button>
              )}
            </div>
          </div>

          <Summary f={f} quote={quote} isCustom={isCustom} areaName={area?.name} />
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- pieces --------------------------------- */

type StepProps = { f: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void };

function Choice({ on, onClick, icon, title, sub, right }: { on: boolean; onClick: () => void; icon?: ReactNode; title: string; sub?: string; right?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`choice ${on ? "choice-on" : ""}`} aria-pressed={on}>
      {icon && <span className={`rounded-xl p-2.5 ${on ? "bg-sea-600 text-white" : "bg-sea-50 text-sea-700"}`}>{icon}</span>}
      <span className="flex-1">
        <span className="block font-semibold">{title}</span>
        {sub && <span className="mt-0.5 block text-sm text-ink/65">{sub}</span>}
      </span>
      {right}
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-sea-600 bg-sea-600 text-white" : "border-sand-300"}`}>{on && <Check size={14} />}</span>
    </button>
  );
}

function StepType({ f, set }: StepProps) {
  const opts: [PropType, string, ReactNode, string][] = [
    ["villa", "Villa", <Home size={20} />, "Private villa or pool villa"],
    ["house", "House", <Warehouse size={20} />, "Detached or family home"],
    ["townhouse", "Townhouse", <Building size={20} />, "Shophouse or townhouse"],
    ["condo", "Condo / Apartment", <Building2 size={20} />, "Apartment or condo unit"],
    ["commercial", "Commercial", <Store size={20} />, "Restaurant, venue, hotel or office — custom quote"],
  ];
  return <div className="grid gap-3 sm:grid-cols-2">{opts.map(([v, t, i, s]) => <Choice key={v} on={f.propertyType === v} onClick={() => set("propertyType", v)} icon={i} title={t} sub={s} />)}</div>;
}

function StepCommercial({ f, set }: StepProps) {
  const types: [string, ReactNode][] = [["Restaurant", <UtensilsCrossed size={20} />], ["Venue", <PartyPopper size={20} />], ["Hotel", <Hotel size={20} />], ["Office", <Building2 size={20} />], ["Other", <Store size={20} />]];
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">{types.map(([t, i]) => <Choice key={t} on={f.commercialType === t} onClick={() => set("commercialType", t)} icon={i} title={t} />)}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label><span className="label">Size (sqm)</span><input className="field" inputMode="numeric" value={f.sqm} onChange={(e) => set("sqm", e.target.value)} /></label>
        <label><span className="label">How often?</span>
          <select className="field" value={f.frequency} onChange={(e) => set("frequency", e.target.value as Frequency)}>
            <option value="one_time">One-time</option><option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option><option value="monthly">Monthly</option>
          </select>
        </label>
      </div>
      <label className="block"><span className="label">What needs cleaning? *</span>
        <textarea className="field min-h-32" placeholder="Rooms, kitchen, number of hotel rooms, preferred times…" value={f.commercialDetails} onChange={(e) => set("commercialDetails", e.target.value)} />
      </label>
      <PhotoUpload f={f} set={set} />
    </div>
  );
}

function Counter({ label, value, onChange, min = 1, max = 12 }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <div className="card flex items-center justify-between p-5">
      <span className="text-lg font-semibold">{label}</span>
      <div className="flex items-center gap-4">
        <button type="button" aria-label={`Fewer ${label}`} className="flex h-11 w-11 items-center justify-center rounded-full border border-sand-300 hover:border-sea-400 disabled:opacity-30" disabled={value <= min} onClick={() => onChange(value - 1)}><Minus size={18} /></button>
        <span className="w-8 text-center text-2xl font-semibold tabular-nums">{value}</span>
        <button type="button" aria-label={`More ${label}`} className="flex h-11 w-11 items-center justify-center rounded-full border border-sand-300 hover:border-sea-400 disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)}><Plus size={18} /></button>
      </div>
    </div>
  );
}

function StepSize({ f, set }: StepProps) {
  return (
    <div className="space-y-4">
      <Counter label="Bedrooms" value={f.bedrooms} onChange={(n) => set("bedrooms", n)} />
      <Counter label="Bathrooms" value={f.bathrooms} onChange={(n) => set("bathrooms", n)} />
      <p className="text-sm text-ink/65">Kitchen and living areas are included.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label><span className="label">Size in sqm (optional)</span><input className="field" inputMode="numeric" value={f.sqm} onChange={(e) => set("sqm", e.target.value)} /></label>
        <label><span className="label">Floors (optional)</span><input className="field" inputMode="numeric" value={f.floors} onChange={(e) => set("floors", e.target.value)} /></label>
      </div>
    </div>
  );
}

function StepCondition({ f, set }: StepProps) {
  const opts: [Condition, string, string][] = [
    ["regular", "Regular", "Tidy, cleaned in the last few weeks"],
    ["lived_in", "Lived-in", "Everyday mess, a bit overdue"],
    ["heavy", "Heavy", "Needs a proper deep clean"],
    ["very_heavy", "Very heavy", "Move-out, post-construction or after a party — custom quote"],
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-3">{opts.map(([v, t, s]) => <Choice key={v} on={f.condition === v} onClick={() => set("condition", v)} title={t} sub={s} />)}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Choice on={f.kids} onClick={() => set("kids", !f.kids)} icon={<Baby size={20} />} title="Kids at home" />
        <Choice on={f.pets} onClick={() => set("pets", !f.pets)} icon={<Dog size={20} />} title="Pets at home" />
      </div>
      <label className="block"><span className="label">When was it last professionally cleaned?</span>
        <select className="field" value={f.lastCleaned} onChange={(e) => set("lastCleaned", e.target.value)}>
          <option value="">Choose…</option><option>Within 2 weeks</option><option>Within a month</option><option>1–3 months ago</option><option>Over 3 months ago</option><option>Never / not sure</option>
        </select>
      </label>
      <PhotoUpload f={f} set={set} />
    </div>
  );
}

function PhotoUpload({ f, set }: StepProps) {
  const [busy, setBusy] = useState(false);
  if (DEMO) return null;
  return (
    <div>
      <span className="label">Photos (optional)</span>
      <label className="choice cursor-pointer border-dashed">
        {busy ? <Loader2 className="animate-spin text-sea-600" /> : <ImagePlus className="text-sea-600" />}
        <span className="text-sm">{f.photos.length ? `${f.photos.length} photo(s) added — tap to add more` : "Add photos to help us quote accurately"}</span>
        <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
          const files = [...(e.target.files ?? [])].slice(0, 6);
          if (!files.length) return;
          setBusy(true);
          const paths: string[] = [];
          for (const file of files) {
            const path = await uploadPhoto(file);
            if (path) paths.push(path);
          }
          set("photos", [...f.photos, ...paths]);
          setBusy(false);
        }} />
      </label>
    </div>
  );
}

function StepAddons({ f, set, addons }: StepProps & { addons: { slug: string; name: string; description?: string; price: number; minutes: number }[] }) {
  const toggle = (slug: string) => set("addons", f.addons.includes(slug) ? f.addons.filter((s) => s !== slug) : [...f.addons, slug]);
  return (
    <div className="grid gap-3">
      {addons.map((a) => (
        <Choice key={a.slug} on={f.addons.includes(a.slug)} onClick={() => toggle(a.slug)} title={a.name} sub={a.description}
          right={<span className="shrink-0 text-right"><b className="block text-sea-800">+{formatTHB(a.price)}</b><span className="text-xs text-ink/55">+{a.minutes} min</span></span>} />
      ))}
      <p className="text-sm text-ink/60">Nothing extra? Just continue.</p>
    </div>
  );
}

function StepFrequency({ f, set, discounts }: StepProps & { discounts: Record<Frequency, number> }) {
  const opts: [Frequency, string, string][] = [["one_time", "One-time", "A single clean"], ["weekly", "Weekly", "Same day & time each week"], ["fortnightly", "Fortnightly", "Every two weeks"], ["monthly", "Monthly", "Once a month"]];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {opts.map(([v, t, s]) => (
        <Choice key={v} on={f.frequency === v} onClick={() => set("frequency", v)} title={t} sub={s}
          right={discounts[v] ? <span className="rounded bg-sun px-2 py-0.5 text-xs font-bold text-ink">{discounts[v]}% off</span> : undefined} />
      ))}
    </div>
  );
}

function StepLocation({ f, set, areas }: StepProps & { areas: { id: string; name: string }[] }) {
  return (
    <div className="grid gap-4">
      <label><span className="label">Area *</span>
        <select className="field" value={f.areaId} onChange={(e) => set("areaId", e.target.value)}>
          <option value="">Choose your area…</option>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <label><span className="label">Address or villa name *</span><input className="field" value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="e.g. Villa Lotus, Soi 5, Bophut" /></label>
      <label><span className="label">Google Maps link</span><input className="field" value={f.mapsLink} onChange={(e) => set("mapsLink", e.target.value)} placeholder="Paste a pin from Google Maps" />
        <span className="mt-1 block text-xs text-ink/55">In Google Maps, drop a pin → Share → Copy link.</span>
      </label>
      <label><span className="label">Access notes</span><textarea className="field min-h-24" value={f.accessNotes} onChange={(e) => set("accessNotes", e.target.value)} placeholder="Gate code, key safe, key collection, parking, dogs…" /></label>
      <div>
        <span className="label">Will someone be home?</span>
        <div className="grid grid-cols-2 gap-3">
          <Choice on={f.someoneHome === "yes"} onClick={() => set("someoneHome", "yes")} title="Yes" />
          <Choice on={f.someoneHome === "no"} onClick={() => set("someoneHome", "no")} title="No" />
        </div>
      </div>
    </div>
  );
}

function StepSlot({ f, set, minutes }: StepProps & { minutes: number }) {
  const [days, setDays] = useState<DaySlots[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(f.slot ? null : null);
  useEffect(() => {
    let live = true;
    setDays(null);
    getAvailability(minutes).then((d) => {
      if (!live) return;
      setDays(d);
      setDate((cur) => cur ?? d.find((x) => x.slots.length)?.date ?? null);
    }).catch((e) => live && setErr(String(e.message ?? e)));
    return () => { live = false; };
  }, [minutes]);

  if (err) return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">Couldn't load availability: {err}</p>;
  if (!days) return <div className="flex items-center gap-2 text-ink/60"><Loader2 className="animate-spin" size={18} /> Checking availability…</div>;
  const open = days.filter((d) => d.slots.length);
  if (!open.length) return <p className="card p-5">We're fully booked for now — message us on LINE or WhatsApp and we'll fit you in.</p>;
  const selected = days.find((d) => d.date === date);

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink/70"><Clock size={16} className="-mt-0.5 mr-1.5 inline text-sea-600" />Your clean takes about <b>{formatDuration(minutes)}</b>. Times shown are start times.</p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
        {open.slice(0, 21).map((d) => {
          const dt = new Date(d.date + "T00:00:00");
          const on = d.date === date;
          return (
            <button key={d.date} onClick={() => setDate(d.date)} className={`flex w-16 shrink-0 flex-col items-center rounded-lg border-2 py-3 transition ${on ? "border-sea-600 bg-sea-600 text-white" : "border-sand-200 bg-white hover:border-sea-300"}`}>
              <span className="text-xs font-semibold uppercase">{dt.toLocaleDateString("en-GB", { weekday: "short" })}</span>
              <span className="text-xl font-semibold">{dt.getDate()}</span>
              <span className="text-xs">{dt.toLocaleDateString("en-GB", { month: "short" })}</span>
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {selected.slots.map((s) => {
            const on = f.slot?.startAt === s.startAt;
            return (
              <button key={s.startAt} onClick={() => set("slot", s)} className={`rounded-lg border-2 py-3 font-semibold transition ${on ? "border-sea-600 bg-sea-600 text-white" : "border-sand-200 bg-white hover:border-sea-300"}`}>{s.time}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StepContact({ f, set }: StepProps) {
  return (
    <div className="grid gap-4">
      <label><span className="label">Full name *</span><input className="field" autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label><span className="label">Phone</span><input className="field" type="tel" autoComplete="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></label>
        <label><span className="label">WhatsApp</span><input className="field" type="tel" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></label>
        <label><span className="label">LINE ID</span><input className="field" value={f.lineId} onChange={(e) => set("lineId", e.target.value)} /></label>
        <label><span className="label">Email</span><input className="field" type="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></label>
      </div>
      <p className="text-xs text-ink/55">Give us at least one way to reach you. Add an email to get your confirmation by email.</p>
      <div>
        <span className="label">Preferred contact</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {["whatsapp", "line", "phone", "email"].map((m) => (
            <button key={m} type="button" onClick={() => set("preferred", m)} className={`rounded-lg border-2 py-2.5 text-sm font-semibold capitalize ${f.preferred === m ? "border-sea-600 bg-sea-50" : "border-sand-200 bg-white"}`}>{m === "line" ? "LINE" : m}</button>
          ))}
        </div>
      </div>
      <label><span className="label">Anything else we should know?</span><textarea className="field min-h-24" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></label>
    </div>
  );
}

function StepReview({ f, set, isCustom, quote, areaName }: StepProps & { isCustom: boolean; quote: ReturnType<typeof computeQuote>; areaName?: string }) {
  if (isCustom)
    return (
      <div className="card p-6">
        <p className="text-ink/80">This one needs a quick look from our team, so we'll send you a custom quote — usually within a few hours on {f.preferred === "line" ? "LINE" : f.preferred}.</p>
        <dl className="mt-4 grid gap-2 text-sm">
          <Detail k="Property" v={f.propertyType === "commercial" ? `${f.commercialType} (commercial)` : `${f.bedrooms} bed / ${f.bathrooms} bath ${f.propertyType}`} />
          <Detail k="Location" v={`${f.address}, ${areaName}`} />
          <Detail k="Contact" v={f.name} />
        </dl>
      </div>
    );
  const pays: [Payment, string, string, ReactNode][] = [
    ["card", "Card", "Pay securely online now", <CreditCard size={20} />],
    ["promptpay", "PromptPay QR", "Scan with any Thai banking app", <QrCode size={20} />],
    ["cash", "Cash on completion", "Pay your cleaner when the job's done", <Banknote size={20} />],
  ];
  const when = f.slot ? new Date(f.slot.startAt) : null;
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <dl className="grid gap-2 text-sm">
          <Detail k="When" v={when ? `${when.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Bangkok" })} at ${f.slot!.time}` : "—"} />
          <Detail k="Duration" v={`About ${formatDuration(quote.minutes)}`} />
          <Detail k="Where" v={`${f.address}, ${areaName}`} />
          <Detail k="Repeats" v={{ one_time: "One-time", weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly" }[f.frequency]} />
          <Detail k="Contact" v={[f.name, f.phone || f.whatsapp || f.lineId || f.email].filter(Boolean).join(" · ")} />
        </dl>
      </div>
      <div>
        <span className="label flex items-center gap-2"><Wallet size={16} /> How would you like to pay?</span>
        <div className="grid gap-3">{pays.map(([v, t, s, i]) => <Choice key={v} on={f.payment === v} onClick={() => set("payment", v)} icon={i} title={t} sub={s} />)}</div>
      </div>
      <p className="text-xs text-ink/55">By booking you agree to let us know as early as possible if you need to cancel or reschedule.</p>
    </div>
  );
}

const Detail = ({ k, v }: { k: string; v: ReactNode }) => (
  <div className="flex gap-4"><dt className="w-24 shrink-0 text-ink/55">{k}</dt><dd className="font-medium">{v}</dd></div>
);

function Summary({ f, quote, isCustom, areaName }: { f: FormState; quote: ReturnType<typeof computeQuote>; isCustom: boolean; areaName?: string }) {
  const show = f.propertyType && f.propertyType !== "commercial";
  return (
    <>
      <aside className="card sticky top-24 hidden self-start p-6 lg:block">
        <SummaryBody f={f} quote={quote} isCustom={isCustom} areaName={areaName} show={!!show} />
      </aside>
      {show && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-sand-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-ink/55">{isCustom ? "Custom quote" : "Your price"}</p>
              <p className="text-xl font-semibold text-sea-800">{isCustom ? "We'll quote you" : formatTHB(quote.total)}</p>
            </div>
            {!isCustom && <p className="flex items-center gap-1.5 text-sm font-medium text-ink/70"><Clock size={16} className="text-sea-600" /> {formatDuration(quote.minutes)}</p>}
          </div>
        </div>
      )}
      <div className="h-16 lg:hidden" />
    </>
  );
}

function SummaryBody({ f, quote, isCustom, areaName, show }: { f: FormState; quote: ReturnType<typeof computeQuote>; isCustom: boolean; areaName?: string; show: boolean }) {
  if (!show)
    return f.propertyType === "commercial"
      ? <><p className="eyebrow">Commercial</p><p className="mt-2 text-sm text-ink/70">Tell us about the job and we'll send a tailored quote.</p></>
      : <><p className="eyebrow">Your quote</p><p className="mt-2 text-sm text-ink/70">Choose a property type to see your price build up live.</p></>;
  return (
    <>
      <p className="eyebrow">Your quote</p>
      {isCustom ? (
        <p className="mt-3 text-sm text-ink/75">Very heavy cleans need a custom quote — we'll send one after a quick look.</p>
      ) : (
        <>
          <ul className="mt-4 space-y-2 text-sm">
            {quote.lines.map((l) => <li key={l.label} className="flex justify-between gap-3"><span className="text-ink/75">{l.label}</span><span className="tabular-nums">{l.amount < 0 ? "−" : ""}{formatTHB(Math.abs(l.amount))}</span></li>)}
          </ul>
          <div className="mt-4 flex items-end justify-between border-t border-dashed border-sand-200 pt-4">
            <span className="font-semibold">Total{f.frequency !== "one_time" ? " per clean" : ""}</span>
            <span className="tnum text-3xl font-extrabold">{formatTHB(quote.total)}</span>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-sand-50 p-3 text-sm"><Clock size={16} className="text-sea-600" /> About <b>{formatDuration(quote.minutes)}</b></div>
          {f.slot && <div className="mt-2 flex items-center gap-2 rounded-lg bg-sand-50 p-3 text-sm"><CalendarDays size={16} className="text-sea-600" /> {new Date(f.slot.startAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Bangkok" })}, {f.slot.time}</div>}
          {areaName && <p className="mt-3 text-xs text-ink/55">{areaName}</p>}
        </>
      )}
    </>
  );
}

function Confirmation({ result, f, quote, areaName }: { result: BookingResult | "request"; f: FormState; quote: ReturnType<typeof computeQuote>; areaName?: string }) {
  const isRequest = result === "request";
  return (
    <div className="container-x py-16">
      <div className="card mx-auto max-w-xl p-8 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sea-100 text-sea-700"><Check size={32} /></span>
        <h1 className="mt-5 text-3xl font-semibold">{isRequest ? "Request received" : "You're booked in!"}</h1>
        {isRequest ? (
          <p className="mt-3 text-ink/75">Thanks {f.name.split(" ")[0]} — we'll send your custom quote shortly.</p>
        ) : (
          <>
            <p className="mt-3 text-ink/75">Booking reference <b className="text-sea-800">{result.ref}</b></p>
            <div className="mt-6 grid gap-2 rounded-lg bg-sand-50 p-5 text-left text-sm">
              <Detail k="When" v={`${new Date(result.startAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Bangkok" })} at ${f.slot?.time}`} />
              <Detail k="Where" v={`${f.address}, ${areaName}`} />
              <Detail k="Price" v={formatTHB(result.total || quote.total)} />
              <Detail k="Payment" v={{ card: "Card", promptpay: "PromptPay", cash: "Cash on completion" }[f.payment]} />
              {result.series > 1 && <Detail k="Repeats" v={`${result.series} cleans reserved`} />}
            </div>
            {f.payment !== "cash" && <p className="mt-4 rounded-lg bg-sun/40 p-3 text-sm">Online payment isn't switched on yet, so we'll message you a payment link before the clean. You can also pay your cleaner in cash.</p>}
            {f.email && <p className="mt-4 text-sm text-ink/60">A confirmation is on its way to {f.email}.</p>}
          </>
        )}
        <Link to="/" className="btn-ghost mt-8">Back to home</Link>
      </div>
    </div>
  );
}
