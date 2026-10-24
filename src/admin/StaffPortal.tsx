import { useEffect, useState } from "react";
import { formatDuration, formatTHB } from "../lib/pricing";
import { supabase } from "../lib/client";
import { Logo } from "../components/Layout";
import { BOOKING_SELECT, dayStartIso, DAYS, endTime, fmtDayLong, fmtTime, todayBkk, type Booking, type Staff } from "./data";
import { ContactButtons, Empty, Err, Field, PayPill, StatusPill } from "./ui";

/** What a cleaner sees after signing in: their own jobs, earnings and availability. */
export default function StaffPortal({ email }: { email: string }) {
  const db = supabase!;
  const [me, setMe] = useState<Staff | null>(null);
  const [jobs, setJobs] = useState<Booking[]>([]);
  const [earned, setEarned] = useState({ jobs: 0, pay: 0 });
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    db.from("staff").select("*").limit(1).maybeSingle().then(({ data }) => setMe(data as Staff | null));
    const t = todayBkk();
    db.from("bookings").select(BOOKING_SELECT).gte("start_at", dayStartIso(t)).not("status", "in", "(cancelled,no_show)").order("start_at").limit(50)
      .then(({ data }) => setJobs((data ?? []) as Booking[]));
    db.from("bookings").select("payout").in("status", ["completed", "paid"]).gte("start_at", dayStartIso(t.slice(0, 8) + "01"))
      .then(({ data }) => setEarned({ jobs: (data ?? []).length, pay: (data ?? []).reduce((s, r) => s + r.payout, 0) }));
  }, [tick]);

  const update = async (id: string, patch: Partial<Booking>) => {
    setErr(null);
    const { error } = await db.from("bookings").update(patch).eq("id", id);
    if (error) setErr(error.message); else setTick((x) => x + 1);
  };

  return (
    <div className="min-h-screen bg-sand-50">
      <header className="flex h-14 items-center justify-between border-b border-sand-200 bg-white px-4">
        <Logo />
        <button className="text-sm font-semibold text-ink/70" onClick={() => db.auth.signOut()}>Sign out</button>
      </header>
      <main className="mx-auto max-w-2xl space-y-8 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold">Hi {me?.name ?? email}</h1>
          <p className="mt-1 text-ink/65">This month: {earned.jobs} jobs done, {formatTHB(earned.pay)} earned.</p>
        </div>
        <Err e={err} />
        <section>
          <h2 className="mb-3 text-lg font-bold">Your jobs</h2>
          {jobs.length === 0 ? <Empty>No jobs booked for you yet.</Empty> : (
            <ul className="space-y-3">
              {jobs.map((b) => {
                const d = b.details ?? {};
                return (
                  <li key={b.id} className="rounded-xl border border-sand-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold">{fmtDayLong(b.start_at)}</p>
                        <p>{fmtTime(b.start_at)} to {endTime(b)} ({formatDuration(b.duration_min)})</p>
                      </div>
                      <div className="flex flex-col items-end gap-1"><StatusPill s={b.status} /><PayPill s={b.payment_status} /></div>
                    </div>
                    <p className="mt-3 font-semibold">{b.customers?.name}</p>
                    <p className="text-ink/75">{b.properties?.address ?? d.address}, {d.area}</p>
                    <p className="text-ink/75">{d.bedrooms} bed, {d.bathrooms} bath{d.addonNames?.length ? `. Extras: ${d.addonNames.join(", ")}` : ""}</p>
                    {(b.properties?.access_notes ?? d.access_notes) && <p className="mt-1 text-ink/75">Access: {b.properties?.access_notes ?? d.access_notes}</p>}
                    {b.payment_method === "cash" && b.payment_status === "unpaid" && <p className="mt-1 font-semibold">Collect {formatTHB(b.price)} in cash</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(b.properties?.maps_link ?? d.maps_link) && <a className="rounded-md border border-sand-300 px-3 py-1.5 text-sm font-semibold" href={b.properties?.maps_link ?? d.maps_link} target="_blank" rel="noreferrer">Map</a>}
                      {b.customers && <ContactButtons c={b.customers} />}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-sand-200 pt-3">
                      {b.status !== "in_progress" && !["completed", "paid"].includes(b.status) && <button className="btn-ghost !py-2" onClick={() => update(b.id, { status: "in_progress" })}>Start job</button>}
                      {!["completed", "paid"].includes(b.status) && <button className="btn-primary !py-2" onClick={() => update(b.id, { status: b.payment_status === "unpaid" ? "completed" : "paid" })}>Job done</button>}
                      {b.payment_method === "cash" && b.payment_status === "unpaid" && <button className="btn-ghost !py-2" onClick={() => update(b.id, { payment_status: "paid_cash", ...(["completed", "in_progress"].includes(b.status) ? { status: "paid" as const } : {}) })}>Cash collected</button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        {me && <Availability me={me} onSaved={() => setTick((x) => x + 1)} />}
      </main>
    </div>
  );
}

function Availability({ me, onSaved }: { me: Staff; onSaved: () => void }) {
  const [f, setF] = useState({ working_days: me.working_days, start_window_start: me.start_window_start.slice(0, 5), start_window_end: me.start_window_end.slice(0, 5), line_user_id: me.line_user_id ?? "", phone: me.phone ?? "" });
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    const { error } = await supabase!.from("staff").update({ ...f, line_user_id: f.line_user_id || null, phone: f.phone || null }).eq("id", me.id);
    setMsg(error ? error.message : "Saved. Customers now see these times.");
    if (!error) onSaved();
  };
  return (
    <section className="rounded-xl border border-sand-200 bg-white p-4">
      <h2 className="text-lg font-bold">When you can work</h2>
      <p className="mt-1 text-sm text-ink/60">Customers can only book start times inside these hours.</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => {
          const on = f.working_days.includes(d);
          return <button key={d} type="button" aria-pressed={on} onClick={() => setF({ ...f, working_days: on ? f.working_days.filter((x) => x !== d) : [...f.working_days, d] })}
            className={`w-12 rounded-md border py-2 text-sm font-semibold ${on ? "border-sea-600 bg-sea-600 text-white" : "border-sand-300"}`}>{DAYS[d]}</button>;
        })}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="First start time"><input type="time" step={1800} className="field" value={f.start_window_start} onChange={(e) => setF({ ...f, start_window_start: e.target.value })} /></Field>
        <Field label="Last start time"><input type="time" step={1800} className="field" value={f.start_window_end} onChange={(e) => setF({ ...f, start_window_end: e.target.value })} /></Field>
        <Field label="Phone"><input className="field" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="LINE user ID"><input className="field" value={f.line_user_id} onChange={(e) => setF({ ...f, line_user_id: e.target.value })} /></Field>
      </div>
      <button className="btn-primary mt-4 !py-2" onClick={save}>Save</button>
      {msg && <p className="mt-2 text-sm text-ink/70" role="status">{msg}</p>}
    </section>
  );
}
