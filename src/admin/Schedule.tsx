import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, weekdayOf } from "../lib/slots";
import BookingDrawer, { useStaffList } from "./BookingDrawer";
import { BOOKING_SELECT, bangkokDate, dayStartIso, DAYS, endTime, fmtTime, sb, todayBkk, type Booking } from "./data";
import { PageHead } from "./ui";

/** Week view, Monday first. Each job is a block coloured by its cleaner. */
export default function Schedule() {
  const [weekStart, setWeekStart] = useState(() => { const t = todayBkk(); return addDays(t, -((weekdayOf(t) + 6) % 7)); });
  const [jobs, setJobs] = useState<Booking[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [showCancelled, setShowCancelled] = useState(false);
  const staff = useStaffList();
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  useEffect(() => {
    let q = sb().from("bookings").select(BOOKING_SELECT).gte("start_at", dayStartIso(weekStart)).lt("start_at", dayStartIso(addDays(weekStart, 7))).order("start_at");
    if (!showCancelled) q = q.not("status", "in", "(cancelled,no_show)");
    q.then(({ data }) => setJobs((data ?? []) as Booking[]));
    sb().from("blocked_dates").select("date").gte("date", weekStart).lte("date", addDays(weekStart, 6)).then(({ data }) => setBlocked((data ?? []).map((d) => d.date)));
  }, [weekStart, tick, showCancelled]);

  const byDay = (d: string) => jobs.filter((j) => bangkokDate(new Date(j.start_at)) === d);
  const today = todayBkk();
  const label = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <>
      <PageHead title="Schedule">
        <label className="mr-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> Show cancelled</label>
        <button className="btn-ghost !p-2" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week"><ChevronLeft size={18} /></button>
        <button className="btn-ghost !py-2" onClick={() => { const t = todayBkk(); setWeekStart(addDays(t, -((weekdayOf(t) + 6) % 7))); }}>This week</button>
        <button className="btn-ghost !p-2" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week"><ChevronRight size={18} /></button>
      </PageHead>
      <p className="-mt-3 mb-4 text-ink/60">{label(days[0])} to {label(days[6])}</p>

      {staff.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-4 text-sm">
          {staff.filter((s) => s.active).map((s) => <span key={s.id} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: s.color }} />{s.name}</span>)}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-7 lg:gap-2">
        {days.map((d) => {
          const items = byDay(d);
          const isBlocked = blocked.includes(d);
          return (
            <section key={d} className={`min-h-28 rounded-xl border bg-white p-2.5 ${d === today ? "border-sea-600" : "border-sand-200"}`}>
              <h2 className="mb-2 flex items-baseline justify-between px-1 text-sm">
                <span className="font-bold">{DAYS[weekdayOf(d)]} {label(d)}</span>
                {isBlocked && <span className="text-xs font-semibold text-coral">Blocked</span>}
              </h2>
              {items.length === 0 ? <p className="px-1 text-sm text-ink/40">Free</p> : (
                <ul className="space-y-2">
                  {items.map((j) => (
                    <li key={j.id}>
                      <button onClick={() => setOpen(j.id)} className={`w-full rounded-md border-l-4 bg-sand-50 px-2.5 py-2 text-left text-sm hover:bg-sand-100 ${j.status === "cancelled" ? "opacity-50 line-through" : ""}`}
                        style={{ borderLeftColor: j.staff?.color ?? "#F2C14E" }}>
                        <span className="tnum block font-bold">{fmtTime(j.start_at)} to {endTime(j)}</span>
                        <span className="block truncate">{j.customers?.name ?? "Customer"}</span>
                        <span className="block truncate text-ink/60">{j.details?.area}, {j.details?.bedrooms}b/{j.details?.bathrooms}b</span>
                        {!j.staff && <span className="block text-xs font-semibold text-coral">No cleaner</span>}
                        {j.conflict && <span className="block text-xs font-semibold text-coral">Needs attention</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <BookingDrawer id={open} onClose={() => setOpen(null)} onChanged={() => setTick((x) => x + 1)} />
    </>
  );
}
