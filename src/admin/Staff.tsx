import { useEffect, useState } from "react";
import { formatTHB } from "../lib/pricing";
import { addDays } from "../lib/slots";
import { dayStartIso, DAYS, sb, todayBkk, type Staff } from "./data";
import { Drawer, Empty, Err, Field, PageHead, Tabs } from "./ui";

const COLORS = ["#0A6C74", "#B4471F", "#5B5BD6", "#C58A00", "#2F8F4E", "#B0397A"];
const blank = (): Omit<Staff, "id" | "user_id"> => ({
  name: "", email: "", phone: "", line_user_id: "", color: COLORS[0], active: true, payout_type: "default", payout_value: 0,
  working_days: [1, 2, 3, 4, 5, 6], start_window_start: "09:30", start_window_end: "12:00",
});

export default function StaffPage() {
  const [rows, setRows] = useState<Staff[]>([]);
  const [edit, setEdit] = useState<(Partial<Staff> & ReturnType<typeof blank>) | null>(null);
  const [period, setPeriod] = useState<"this" | "last">("this");
  const [pay, setPay] = useState<Record<string, { jobs: number; payout: number; revenue: number }>>({});
  const [tick, setTick] = useState(0);

  useEffect(() => { sb().from("staff").select("*").order("created_at").then(({ data }) => setRows((data ?? []) as Staff[])); }, [tick]);

  useEffect(() => {
    const t = todayBkk();
    const thisStart = t.slice(0, 8) + "01";
    const lastStart = (() => { const d = new Date(thisStart + "T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 10); })();
    const [from, to] = period === "this" ? [thisStart, addDays(t, 1)] : [lastStart, thisStart];
    sb().from("bookings").select("staff_id,payout,price").in("status", ["completed", "paid"]).gte("start_at", dayStartIso(from)).lt("start_at", dayStartIso(to))
      .then(({ data }) => {
        const acc: typeof pay = {};
        for (const r of data ?? []) {
          if (!r.staff_id) continue;
          acc[r.staff_id] ??= { jobs: 0, payout: 0, revenue: 0 };
          acc[r.staff_id].jobs++; acc[r.staff_id].payout += r.payout; acc[r.staff_id].revenue += r.price;
        }
        setPay(acc);
      });
  }, [period, tick]);

  const hours = (s: Staff) => `${s.working_days.map((d) => DAYS[d]).join(", ")}, starts ${s.start_window_start.slice(0, 5)} to ${s.start_window_end.slice(0, 5)}`;

  return (
    <>
      <PageHead title="Staff"><button className="btn-primary !py-2" onClick={() => setEdit({ ...blank(), color: COLORS[rows.length % COLORS.length] })}>Add cleaner</button></PageHead>
      <p className="-mt-3 mb-5 max-w-2xl text-ink/65">Each cleaner's days and start times decide which slots customers can book. Add a cleaner's email and they can sign in to see their own jobs.</p>
      {rows.length === 0 ? <Empty>No cleaners yet.</Empty> : (
        <ul className="divide-y divide-sand-200 rounded-xl border border-sand-200 bg-white">
          {rows.map((s) => (
            <li key={s.id}>
              <button className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-sand-50" onClick={() => setEdit({ ...s })}>
                <span className="mt-1.5 h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{s.name} {!s.active && <span className="font-normal text-ink/50">(inactive)</span>}</span>
                  <span className="block text-sm text-ink/65">{hours(s)}</span>
                  <span className="block text-sm text-ink/50">{s.email ? (s.user_id ? `Signed in as ${s.email}` : `Invited as ${s.email}, not signed in yet`) : "No login"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mb-3 mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Pay owed</h2>
        <Tabs value={period} onChange={setPeriod} options={[["this", "This month"], ["last", "Last month"]]} />
      </div>
      <p className="mb-3 text-sm text-ink/60">From jobs marked done.</p>
      <div className="overflow-x-auto rounded-xl border border-sand-200 bg-white">
        <table className="w-full text-left text-[0.95rem]">
          <thead className="border-b border-sand-200 text-sm text-ink/55"><tr><th className="px-4 py-3 font-semibold">Cleaner</th><th className="px-4 py-3 font-semibold">Jobs</th><th className="px-4 py-3 text-right font-semibold">Job value</th><th className="px-4 py-3 text-right font-semibold">Pay</th></tr></thead>
          <tbody className="divide-y divide-sand-200">
            {rows.map((s) => (
              <tr key={s.id}><td className="px-4 py-3">{s.name}</td><td className="tnum px-4 py-3">{pay[s.id]?.jobs ?? 0}</td><td className="tnum px-4 py-3 text-right">{formatTHB(pay[s.id]?.revenue ?? 0)}</td><td className="tnum px-4 py-3 text-right font-semibold">{formatTHB(pay[s.id]?.payout ?? 0)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && <StaffForm s={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); setTick((x) => x + 1); }} />}
    </>
  );
}

function StaffForm({ s, onClose, onSaved }: { s: Partial<Staff> & ReturnType<typeof blank>; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(s);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const save = async () => {
    if (!f.name.trim()) return setErr("Add a name.");
    if (f.start_window_end < f.start_window_start) return setErr("The last start time must be after the first.");
    const row = {
      name: f.name.trim(), email: f.email?.trim().toLowerCase() || null, phone: f.phone || null, line_user_id: f.line_user_id || null, color: f.color, active: f.active,
      payout_type: f.payout_type, payout_value: Number(f.payout_value) || 0, working_days: [...f.working_days].sort(),
      start_window_start: f.start_window_start, start_window_end: f.start_window_end,
    };
    const { error } = s.id ? await sb().from("staff").update(row).eq("id", s.id) : await sb().from("staff").insert(row);
    if (error) setErr(error.message); else onSaved();
  };
  return (
    <Drawer open onClose={onClose} title={s.id ? `Edit ${s.name}` : "Add cleaner"}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><input className="field" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Phone"><input className="field" value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
          <div className="col-span-2"><Field label="Email for signing in" hint="They create an account with this email to see their jobs."><input className="field" type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field></div>
          <div className="col-span-2"><Field label="LINE user ID" hint="Lets new-job alerts go to this cleaner on LINE once LINE is connected."><input className="field" value={f.line_user_id ?? ""} onChange={(e) => set("line_user_id", e.target.value)} /></Field></div>
        </div>
        <fieldset>
          <legend className="label">Working days</legend>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const on = f.working_days.includes(d);
              return <button key={d} type="button" aria-pressed={on} onClick={() => set("working_days", on ? f.working_days.filter((x) => x !== d) : [...f.working_days, d])}
                className={`w-12 rounded-md border py-2 text-sm font-semibold ${on ? "border-sea-600 bg-sea-600 text-white" : "border-sand-300"}`}>{DAYS[d]}</button>;
            })}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First start time"><input type="time" step={1800} className="field" value={f.start_window_start.slice(0, 5)} onChange={(e) => set("start_window_start", e.target.value)} /></Field>
          <Field label="Last start time"><input type="time" step={1800} className="field" value={f.start_window_end.slice(0, 5)} onChange={(e) => set("start_window_end", e.target.value)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pay per job">
            <select className="field" value={f.payout_type} onChange={(e) => set("payout_type", e.target.value)}>
              <option value="default">Use the default rule</option><option value="percent">% of job price</option><option value="fixed">Fixed ฿ per job</option>
            </select>
          </Field>
          {f.payout_type !== "default" && <Field label={f.payout_type === "percent" ? "Percent" : "Baht per job"}><input className="field" inputMode="numeric" value={f.payout_value} onChange={(e) => set("payout_value", Number(e.target.value.replace(/[^\d.]/g, "")))} /></Field>}
        </div>
        <div className="flex items-center gap-3">
          <span className="label !mb-0">Colour</span>
          {COLORS.map((c) => <button key={c} type="button" onClick={() => set("color", c)} aria-label={`Colour ${c}`} aria-pressed={f.color === c} className={`h-7 w-7 rounded-md ${f.color === c ? "ring-2 ring-ink ring-offset-2" : ""}`} style={{ background: c }} />)}
        </div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Taking bookings</label>
        <Err e={err} />
        <button className="btn-primary" onClick={save}>{s.id ? "Save changes" : "Add cleaner"}</button>
      </div>
    </Drawer>
  );
}
