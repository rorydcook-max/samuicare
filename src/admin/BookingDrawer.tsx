import { useEffect, useState } from "react";
import { formatDuration, formatTHB } from "../lib/pricing";
import { isStaffFree } from "../lib/slots";
import {
  bangkokDate, bangkokToUtc, BOOKING_SELECT, FREQ_LABEL, fmtDayLong, fmtTime, endTime, METHOD_LABEL, sb,
  type Booking, type BookingStatus, type PaymentStatus, type Staff,
} from "./data";
import { ContactButtons, Drawer, Err, Field, PayPill, Row, StatusPill } from "./ui";

export function useStaffList() {
  const [staff, setStaff] = useState<Staff[]>([]);
  useEffect(() => { sb().from("staff").select("*").order("name").then(({ data }) => setStaff((data ?? []) as Staff[])); }, []);
  return staff;
}

export default function BookingDrawer({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const [b, setB] = useState<Booking | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const staff = useStaffList();
  const [resched, setResched] = useState<{ date: string; time: string; staffId: string; duration: number } | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [tellCustomer, setTellCustomer] = useState(true);
  const [sent, setSent] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    const { data, error } = await sb().from("bookings").select(BOOKING_SELECT).eq("id", id).single();
    if (error) setErr(error.message);
    else { setB(data as Booking); setNotes((data as Booking).notes ?? ""); }
  };
  useEffect(() => { setB(null); setResched(null); setErr(null); setWarning(null); load(); }, [id]);

  type Change = "rescheduled" | "reassigned" | "cancelled" | "restored";
  /** Ask the server to message the team, cleaner(s) and optionally the customer, and sync the calendar. */
  const announce = async (change: Change, prevStaffId: string | null) => {
    if (!b) return;
    const prevStaffLineId = staff.find((s) => s.id === prevStaffId)?.line_user_id ?? null;
    const { data, error } = await sb().functions.invoke("ops?route=admin", { body: { id: b.id, change, notifyCustomer: tellCustomer, prevStaffLineId } });
    setSent(error ? "Saved, but the alerts didn't send." : data?.emailed ? "Saved. Team and customer notified." : "Saved. Team notified.");
  };

  const update = async (patch: Partial<Booking>, scope: "one" | "future" = "one", change?: Change) => {
    if (!b) return;
    setBusy(true); setErr(null); setSent(null);
    const prevStaff = b.staff_id;
    let q = sb().from("bookings").update(patch);
    q = scope === "future" && b.series_id ? q.eq("series_id", b.series_id).gte("start_at", b.start_at) : q.eq("id", b.id);
    const { error } = await q;
    setBusy(false);
    if (error) return setErr(error.message);
    if (change) await announce(change, prevStaff);
    await load();
    onChanged();
  };

  const startResched = () => {
    if (!b) return;
    const d = new Date(b.start_at);
    setResched({ date: bangkokDate(d), time: fmtTime(b.start_at), staffId: b.staff_id ?? "", duration: b.duration_min });
    setWarning(null);
  };

  const saveResched = async (force = false) => {
    if (!b || !resched) return;
    const [h, m] = resched.time.split(":").map(Number);
    const start = bangkokToUtc(resched.date, h * 60 + m);
    if (resched.staffId && !force) {
      const from = new Date(start.getTime() - 86400000).toISOString();
      const to = new Date(start.getTime() + 86400000).toISOString();
      const { data } = await sb().from("bookings").select("id,staff_id,start_at,duration_min").eq("staff_id", resched.staffId)
        .gte("start_at", from).lte("start_at", to).not("status", "in", "(cancelled,no_show)");
      const { data: cfg } = await sb().from("settings").select("value").eq("key", "scheduling").single();
      const buffer = (cfg?.value as { travel_buffer?: number })?.travel_buffer ?? 30;
      if (!isStaffFree(resched.staffId, start, resched.duration, data ?? [], buffer, b.id)) {
        setWarning("That cleaner already has a job overlapping this time (including travel time). Save anyway?");
        return;
      }
    }
    setWarning(null);
    const moved = start.toISOString() !== new Date(b.start_at).toISOString() || resched.duration !== b.duration_min;
    const change: Change = moved ? "rescheduled" : "reassigned";
    await update({ start_at: start.toISOString(), staff_id: resched.staffId || null, duration_min: resched.duration, conflict: false, status: resched.staffId ? (b.status === "booked" ? "assigned" : b.status) : "booked" }, "one", change);
    setResched(null);
  };

  const d = b?.details ?? {};
  const p = b?.properties;
  const c = b?.customers;
  const setStatus = (s: BookingStatus) => update({ status: s });
  const setPay = (s: PaymentStatus) => update({ payment_status: s });

  return (
    <Drawer open={!!id} onClose={onClose} title={b ? `Booking ${b.ref}` : "Booking"}>
      {!b ? <p className="text-ink/60">{err ?? "Loading"}</p> : (
        <div className="space-y-7">
          <div className="flex flex-wrap items-center gap-2"><StatusPill s={b.status} /><PayPill s={b.payment_status} />{b.conflict && <span className="rounded bg-coral px-2 py-0.5 text-xs font-semibold text-white">Needs attention</span>}</div>

          <div>
            <p className="text-xl font-bold">{fmtDayLong(b.start_at)}</p>
            <p className="text-lg">{fmtTime(b.start_at)} to {endTime(b)} <span className="text-ink/55">({formatDuration(b.duration_min)})</span></p>
            <p className="mt-1 text-ink/70">{b.staff?.name ? `Cleaner: ${b.staff.name}` : "No cleaner assigned"}{b.frequency !== "one_time" && `, repeats ${FREQ_LABEL[b.frequency].toLowerCase()}`}</p>
          </div>

          <Err e={err} />
          {sent && <p className="rounded-lg bg-sea-50 p-3 text-sm text-sea-800" role="status">{sent}</p>}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tellCustomer} onChange={(e) => setTellCustomer(e.target.checked)} /> Email the customer when I move or cancel this clean</label>

          {!resched ? (
            <div className="flex flex-wrap gap-2">
              {b.status !== "in_progress" && !["completed", "paid", "cancelled"].includes(b.status) && <button className="btn-ghost !py-2" disabled={busy} onClick={() => setStatus("in_progress")}>Mark started</button>}
              {!["completed", "paid", "cancelled"].includes(b.status) && <button className="btn-primary !py-2" disabled={busy} onClick={() => setStatus(b.payment_status === "unpaid" ? "completed" : "paid")}>Mark done</button>}
              {b.payment_status === "unpaid" && <button className="btn-ghost !py-2" disabled={busy} onClick={() => update({ payment_status: "paid_cash", status: ["completed", "in_progress"].includes(b.status) ? "paid" : b.status })}>Cash received</button>}
              <button className="btn-ghost !py-2" disabled={busy} onClick={startResched}>Reschedule or reassign</button>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg bg-sand-100 p-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date"><input type="date" className="field" value={resched.date} onChange={(e) => setResched({ ...resched, date: e.target.value })} /></Field>
                <Field label="Start time"><input type="time" step={900} className="field" value={resched.time} onChange={(e) => setResched({ ...resched, time: e.target.value })} /></Field>
                <Field label="Cleaner">
                  <select className="field" value={resched.staffId} onChange={(e) => setResched({ ...resched, staffId: e.target.value })}>
                    <option value="">Unassigned</option>
                    {staff.filter((s) => s.active || s.id === b.staff_id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="Duration (min)"><input type="number" step={15} min={30} className="field" value={resched.duration} onChange={(e) => setResched({ ...resched, duration: Number(e.target.value) })} /></Field>
              </div>
              {warning && <p className="text-sm font-medium text-coral">{warning}</p>}
              <div className="flex gap-2">
                <button className="btn-primary !py-2" disabled={busy} onClick={() => saveResched(!!warning)}>{warning ? "Save anyway" : "Save"}</button>
                <button className="btn-ghost !py-2" onClick={() => { setResched(null); setWarning(null); }}>Cancel</button>
              </div>
              <p className="text-xs text-ink/55">Changes this booking only. Let the customer know about the new time.</p>
            </div>
          )}

          <section>
            <h3 className="mb-2 font-bold">Customer</h3>
            <dl className="divide-y divide-sand-200 border-y border-sand-200 text-[0.95rem]">
              <Row k="Name">{c?.name ?? "Unknown"}</Row>
              {c?.phone && <Row k="Phone">{c.phone}</Row>}
              {c?.whatsapp && <Row k="WhatsApp">{c.whatsapp}</Row>}
              {c?.line_id && <Row k="LINE">{c.line_id}</Row>}
              {c?.email && <Row k="Email">{c.email}</Row>}
            </dl>
            {c && <div className="mt-3"><ContactButtons c={c} /></div>}
          </section>

          <section>
            <h3 className="mb-2 font-bold">The job</h3>
            <dl className="divide-y divide-sand-200 border-y border-sand-200 text-[0.95rem]">
              <Row k="Address">{p?.address ?? d.address}{d.area ? `, ${d.area}` : ""}</Row>
              {(p?.maps_link || d.maps_link) && <Row k="Map"><a className="font-semibold text-sea-700 underline" href={p?.maps_link ?? d.maps_link} target="_blank" rel="noreferrer">Open in Google Maps</a></Row>}
              <Row k="Property">{d.bedrooms} bed, {d.bathrooms} bath {p?.property_type ?? d.property_type ?? ""}</Row>
              <Row k="Condition">{String(d.condition ?? "").replace("_", "-")}{d.kids ? ", kids" : ""}{d.pets ? ", pets" : ""}{d.last_cleaned ? `. Last cleaned: ${d.last_cleaned}` : ""}</Row>
              {d.addonNames?.length > 0 && <Row k="Extras">{d.addonNames.join(", ")}</Row>}
              {(p?.access_notes || d.access_notes) && <Row k="Access">{p?.access_notes ?? d.access_notes}</Row>}
              {d.someone_home && <Row k="Someone home">{d.someone_home === "yes" ? "Yes" : "No"}</Row>}
              {d.photos?.length > 0 && <Row k="Photos">{d.photos.length} uploaded</Row>}
            </dl>
          </section>

          <section>
            <h3 className="mb-2 font-bold">Money</h3>
            <dl className="divide-y divide-sand-200 border-y border-sand-200 text-[0.95rem]">
              {(d.lines ?? []).map((l: { label: string; amount: number }) => <Row key={l.label} k="">{l.label}: {l.amount < 0 ? "−" : ""}{formatTHB(Math.abs(l.amount))}</Row>)}
              <Row k="Price"><b>{formatTHB(b.price)}</b> by {METHOD_LABEL[b.payment_method].toLowerCase()}</Row>
              <Row k="Cleaner pay">{formatTHB(b.payout)}</Row>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {(["unpaid", "paid_cash", "paid_online", "refunded"] as PaymentStatus[]).filter((s) => s !== b.payment_status).map((s) => (
                <button key={s} className="rounded-md border border-sand-300 px-3 py-1.5 font-semibold hover:border-sea-600" disabled={busy} onClick={() => setPay(s)}>
                  Set {s === "unpaid" ? "unpaid" : s === "paid_cash" ? "paid in cash" : s === "paid_online" ? "paid online" : "refunded"}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-2 font-bold">Notes</h3>
            <textarea className="field min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} />
            {notes !== (b.notes ?? "") && <button className="btn-primary mt-2 !py-2" disabled={busy} onClick={() => update({ notes })}>Save notes</button>}
          </section>

          {!["cancelled", "completed", "paid"].includes(b.status) && (
            <section className="border-t border-sand-200 pt-5">
              <div className="flex flex-wrap gap-2">
                <button className="rounded-md border border-coral/50 px-3 py-2 text-sm font-semibold text-coral hover:bg-coral/5" disabled={busy}
                  onClick={() => confirm("Cancel this booking?") && update({ status: "cancelled" }, "one", "cancelled")}>Cancel this clean</button>
                {b.series_id && <button className="rounded-md border border-coral/50 px-3 py-2 text-sm font-semibold text-coral hover:bg-coral/5" disabled={busy}
                  onClick={() => confirm("Cancel this and every later clean in the series?") && update({ status: "cancelled" }, "future", "cancelled")}>Cancel this and later cleans</button>}
                <button className="rounded-md border border-sand-300 px-3 py-2 text-sm font-semibold" disabled={busy} onClick={() => setStatus("no_show")}>No-show</button>
              </div>
            </section>
          )}
          {b.status === "cancelled" && <button className="btn-ghost !py-2" disabled={busy} onClick={() => update({ status: b.staff_id ? "assigned" : "booked" }, "one", "restored")}>Restore booking</button>}
        </div>
      )}
    </Drawer>
  );
}
