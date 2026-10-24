import { useEffect, useState } from "react";
import { formatDuration, formatTHB } from "../lib/pricing";
import { useStaffList } from "./BookingDrawer";
import { ago, bangkokToUtc, fmtWhen, KIND_LABEL, LEAD_LABEL, sb, todayBkk, type Lead, type LeadStatus } from "./data";
import { ContactButtons, Drawer, Empty, Err, Field, PageHead, Row, Tabs } from "./ui";

type View = "open" | LeadStatus | "all";

export default function Leads() {
  const [view, setView] = useState<View>("open");
  const [rows, setRows] = useState<Lead[]>([]);
  const [open, setOpen] = useState<Lead | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let q = sb().from("leads").select("*").order("updated_at", { ascending: false }).limit(300);
    if (view === "open") q = q.in("status", ["new", "contacted", "quoted"]);
    else if (view !== "all") q = q.eq("status", view);
    q.then(({ data }) => setRows((data ?? []) as Lead[]));
  }, [view, tick]);

  const reload = async (id?: string) => {
    setTick((x) => x + 1);
    if (id) {
      const { data } = await sb().from("leads").select("*").eq("id", id).single();
      setOpen(data as Lead);
    }
  };

  return (
    <>
      <PageHead title="Leads" />
      <p className="-mt-3 mb-5 max-w-2xl text-ink/65">Everyone who started a quote, asked for a custom quote, registered interest or sent a message. Unfinished quotes are worth a quick follow-up.</p>
      <div className="mb-4"><Tabs value={view} onChange={setView} options={[["open", "Open"], ["new", "New"], ["contacted", "Contacted"], ["quoted", "Quoted"], ["won", "Booked"], ["lost", "Lost"], ["all", "All"]]} /></div>
      {rows.length === 0 ? <Empty>No leads here.</Empty> : (
        <ul className="divide-y divide-sand-200 rounded-xl border border-sand-200 bg-white">
          {rows.map((l) => (
            <li key={l.id}>
              <button onClick={() => setOpen(l)} className="grid w-full gap-1 px-4 py-3 text-left hover:bg-sand-50 sm:grid-cols-[1.2fr_1fr_auto] sm:items-center sm:gap-4">
                <span><span className="block font-semibold">{l.name || "No name yet"}</span><span className="block text-sm text-ink/60">{KIND_LABEL[l.kind] ?? l.kind}, {ago(l.updated_at)}</span></span>
                <span className="text-sm text-ink/70">{summary(l)}</span>
                <span className="text-sm font-semibold">{LEAD_LABEL[l.status]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && <LeadDrawer lead={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}

function summary(l: Lead) {
  const d = l.data ?? {};
  if (l.kind === "interest") return `${d.service ?? "Interest"}${d.area ? `, ${d.area}` : ""}`;
  if (l.kind === "contact") return String(d.message ?? "").slice(0, 70);
  const bits = [d.propertyType === "commercial" ? d.commercialType : d.propertyType, d.bedrooms && d.propertyType !== "commercial" ? `${d.bedrooms} bed ${d.bathrooms} bath` : null, d.area].filter(Boolean);
  const price = l.quoted_price ?? d.quote?.total;
  return `${bits.join(", ")}${price ? `, ${formatTHB(price)}` : ""}`;
}

function LeadDrawer({ lead, onClose, onChanged }: { lead: Lead; onClose: () => void; onChanged: (id?: string) => void }) {
  const d = lead.data ?? {};
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [price, setPrice] = useState(String(lead.quoted_price ?? d.quote?.total ?? ""));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [convert, setConvert] = useState(false);
  useEffect(() => { setNotes(lead.notes ?? ""); setPrice(String(lead.quoted_price ?? d.quote?.total ?? "")); setConvert(false); }, [lead.id]);

  const save = async (patch: Partial<Lead>) => {
    setBusy(true); setErr(null);
    const { error } = await sb().from("leads").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", lead.id);
    setBusy(false);
    if (error) setErr(error.message); else onChanged(lead.id);
  };
  const contact = { phone: lead.phone ?? d.phone ?? (d.contact && /\d{6,}/.test(d.contact) ? d.contact : null), whatsapp: lead.whatsapp ?? d.whatsapp, line_id: lead.line_id ?? d.lineId, email: lead.email ?? d.email ?? (d.contact?.includes?.("@") ? d.contact : null) };

  return (
    <Drawer open onClose={onClose} title={lead.name || "Lead"}>
      <div className="space-y-6">
        <p className="text-ink/65">{KIND_LABEL[lead.kind] ?? lead.kind}, created {ago(lead.created_at)}. {lead.kind === "quote" && lead.status === "new" && `Stopped at step ${lead.step} of the booking form.`}</p>
        <ContactButtons c={contact} />
        <Err e={err} />

        <dl className="divide-y divide-sand-200 border-y border-sand-200 text-[0.95rem]">
          {d.contact && <Row k="Contact">{d.contact}</Row>}
          {d.service && <Row k="Service">{d.service}</Row>}
          {d.message && <Row k="Message"><span className="whitespace-pre-wrap">{d.message}</span></Row>}
          {d.propertyType && <Row k="Property">{d.propertyType === "commercial" ? `${d.commercialType} (business)` : `${d.bedrooms} bed, ${d.bathrooms} bath ${d.propertyType}`}{d.sqm ? `, ${d.sqm} m²` : ""}</Row>}
          {d.commercialDetails && <Row k="Details"><span className="whitespace-pre-wrap">{d.commercialDetails}</span></Row>}
          {d.condition && <Row k="Condition">{String(d.condition).replace("_", " ")}{d.kids ? ", kids" : ""}{d.pets ? ", pets" : ""}</Row>}
          {d.frequency && <Row k="How often">{String(d.frequency).replace("_", " ")}</Row>}
          {(d.area || d.address) && <Row k="Where">{[d.address, d.area].filter(Boolean).join(", ")}</Row>}
          {d.mapsLink && <Row k="Map"><a href={d.mapsLink} className="font-semibold text-sea-700 underline" target="_blank" rel="noreferrer">Open</a></Row>}
          {d.accessNotes && <Row k="Access">{d.accessNotes}</Row>}
          {d.quote?.total && <Row k="Online price">{formatTHB(d.quote.total)}, about {formatDuration(d.quote.minutes)}</Row>}
          {d.slot && <Row k="Time picked">{fmtWhen(d.slot)}</Row>}
          {d.notes && <Row k="Their notes">{d.notes}</Row>}
          {d.photos?.length > 0 && <Row k="Photos">{d.photos.length} uploaded</Row>}
        </dl>

        <div>
          <span className="label">Status</span>
          <div className="flex flex-wrap gap-2">
            {(["new", "contacted", "quoted", "lost"] as LeadStatus[]).map((s) => (
              <button key={s} disabled={busy || lead.status === s} onClick={() => save({ status: s })}
                className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${lead.status === s ? "border-sea-600 bg-sea-50 text-sea-800" : "border-sand-300 hover:border-sea-600"}`}>{LEAD_LABEL[s]}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <Field label="Price you quoted (฿)"><input className="field" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} /></Field>
          <button className="btn-ghost !py-3" disabled={busy || !price} onClick={() => save({ quoted_price: Number(price), status: lead.status === "new" || lead.status === "contacted" ? "quoted" : lead.status })}>Save</button>
        </div>

        <div>
          <Field label="Notes"><textarea className="field min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          {notes !== (lead.notes ?? "") && <button className="btn-primary mt-2 !py-2" disabled={busy} onClick={() => save({ notes })}>Save notes</button>}
        </div>

        {lead.status !== "won" && lead.kind !== "contact" && (
          convert ? <ConvertForm lead={lead} defaultPrice={Number(price) || 0} onDone={() => { setConvert(false); onChanged(lead.id); }} />
            : <button className="btn-primary" onClick={() => setConvert(true)}>Create a booking from this lead</button>
        )}
        {lead.status === "won" && <p className="rounded-lg bg-sea-50 p-4 text-sea-800">Booked. Find it under Bookings.</p>}
      </div>
    </Drawer>
  );
}

function ConvertForm({ lead, defaultPrice, onDone }: { lead: Lead; defaultPrice: number; onDone: () => void }) {
  const d = lead.data ?? {};
  const staff = useStaffList();
  const [f, setF] = useState({
    date: todayBkk(), time: "09:30", staffId: "", duration: String(d.quote?.minutes ?? 120), price: String(defaultPrice || ""),
    method: "cash", name: lead.name ?? d.name ?? "", address: d.address ?? "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });

  const create = async () => {
    if (!f.name.trim() || !f.price || !f.address.trim()) return setErr("Add a name, address and price.");
    setBusy(true); setErr(null);
    const db = sb();
    try {
      const { data: cust, error: e1 } = await db.from("customers").insert({
        name: f.name.trim(), phone: lead.phone ?? d.phone ?? null, whatsapp: lead.whatsapp ?? d.whatsapp ?? null,
        line_id: lead.line_id ?? d.lineId ?? null, email: lead.email ?? d.email ?? null, preferred_contact: d.preferred ?? null,
      }).select("id").single();
      if (e1) throw e1;
      const commercial = d.propertyType === "commercial";
      const { data: prop, error: e2 } = await db.from("properties").insert({
        customer_id: cust.id, property_type: commercial ? `business: ${d.commercialType ?? "other"}` : d.propertyType ?? "house",
        bedrooms: Number(d.bedrooms) || 1, bathrooms: Number(d.bathrooms) || 1, sqm: Number(d.sqm) || null,
        area_id: d.areaId && /^[0-9a-f-]{36}$/.test(d.areaId) ? d.areaId : null, address: f.address.trim(), maps_link: d.mapsLink || null, access_notes: d.accessNotes || null,
      }).select("id").single();
      if (e2) throw e2;
      const [h, m] = f.time.split(":").map(Number);
      const start = bangkokToUtc(f.date, h * 60 + m).toISOString();
      const { data: pay } = await db.from("settings").select("value").eq("key", "payout").single();
      const pv = (pay?.value ?? { type: "percent", value: 40 }) as { type: string; value: number };
      const priceN = Number(f.price);
      const { data: bk, error: e3 } = await db.from("bookings").insert({
        customer_id: cust.id, property_id: prop.id, staff_id: f.staffId || null, lead_id: lead.id, start_at: start,
        duration_min: Number(f.duration) || 120, status: f.staffId ? "assigned" : "booked", price: priceN,
        payout: Math.round(pv.type === "fixed" ? pv.value : (priceN * pv.value) / 100), payment_method: f.method,
        frequency: d.frequency ?? "one_time",
        details: { area: d.area, address: f.address.trim(), bedrooms: d.bedrooms, bathrooms: d.bathrooms, condition: d.condition, kids: d.kids, pets: d.pets,
          property_type: commercial ? d.commercialType : d.propertyType, maps_link: d.mapsLink, access_notes: d.accessNotes, commercial_details: d.commercialDetails, from_lead: true },
      }).select("id").single();
      if (e3) throw e3;
      await db.from("leads").update({ status: "won", booking_id: bk.id, quoted_price: priceN, updated_at: new Date().toISOString() }).eq("id", lead.id);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String((e as { message?: string }).message ?? e));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3 rounded-lg bg-sand-100 p-4">
      <h3 className="font-bold">New booking</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Customer name"><input className="field" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Address"><input className="field" value={f.address} onChange={(e) => set("address", e.target.value)} /></Field>
        <Field label="Date"><input type="date" className="field" value={f.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="Start time"><input type="time" step={900} className="field" value={f.time} onChange={(e) => set("time", e.target.value)} /></Field>
        <Field label="Cleaner">
          <select className="field" value={f.staffId} onChange={(e) => set("staffId", e.target.value)}>
            <option value="">Unassigned</option>
            {staff.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Duration (min)"><input type="number" step={15} className="field" value={f.duration} onChange={(e) => set("duration", e.target.value)} /></Field>
        <Field label="Price (฿)"><input className="field" inputMode="numeric" value={f.price} onChange={(e) => set("price", e.target.value.replace(/\D/g, ""))} /></Field>
        <Field label="Payment">
          <select className="field" value={f.method} onChange={(e) => set("method", e.target.value)}>
            <option value="cash">Cash</option><option value="promptpay">PromptPay</option><option value="card">Card</option>
          </select>
        </Field>
      </div>
      <Err e={err} />
      <button className="btn-primary" disabled={busy} onClick={create}>{busy ? "Creating" : "Create booking"}</button>
      <p className="text-xs text-ink/55">Adds the customer and booking. Message the customer to confirm the time.</p>
    </div>
  );
}
