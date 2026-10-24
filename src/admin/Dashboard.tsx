import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatTHB } from "../lib/pricing";
import { addDays } from "../lib/slots";
import BookingDrawer from "./BookingDrawer";
import { ago, BOOKING_SELECT, dayStartIso, endTime, fmtDay, fmtTime, KIND_LABEL, sb, todayBkk, type Booking, type Lead } from "./data";
import { Empty, PageHead, PayPill, StatusPill } from "./ui";

export default function Dashboard() {
  const [today, setToday] = useState<Booking[]>([]);
  const [week, setWeek] = useState<Booking[]>([]);
  const [attention, setAttention] = useState<Booking[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [month, setMonth] = useState({ booked: 0, paid: 0, jobs: 0 });
  const [open, setOpen] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = todayBkk();
    const live = "(cancelled,no_show)";
    const db = sb();
    db.from("bookings").select(BOOKING_SELECT).gte("start_at", dayStartIso(t)).lt("start_at", dayStartIso(addDays(t, 1))).not("status", "in", live).order("start_at")
      .then(({ data }) => setToday((data ?? []) as Booking[]));
    db.from("bookings").select(BOOKING_SELECT).gte("start_at", dayStartIso(addDays(t, 1))).lt("start_at", dayStartIso(addDays(t, 8))).not("status", "in", live).order("start_at")
      .then(({ data }) => setWeek((data ?? []) as Booking[]));
    db.from("bookings").select(BOOKING_SELECT).not("status", "in", live)
      .or(`conflict.eq.true,status.eq.booked,and(payment_status.eq.unpaid,start_at.lt.${new Date().toISOString()})`).order("start_at").limit(20)
      .then(({ data }) => setAttention((data ?? []) as Booking[]));
    db.from("leads").select("*").eq("status", "new").order("created_at", { ascending: false }).limit(8)
      .then(({ data }) => setLeads((data ?? []) as Lead[]));
    const m0 = dayStartIso(t.slice(0, 8) + "01");
    db.from("bookings").select("price,payment_status").gte("start_at", m0).not("status", "in", live)
      .then(({ data }) => setMonth({
        booked: (data ?? []).reduce((s, r) => s + r.price, 0),
        paid: (data ?? []).filter((r) => r.payment_status === "paid_cash" || r.payment_status === "paid_online").reduce((s, r) => s + r.price, 0),
        jobs: (data ?? []).length,
      }));
  }, [tick]);

  const changed = () => setTick((x) => x + 1);

  return (
    <>
      <PageHead title={`Today, ${fmtDay(new Date().toISOString())}`} />
      <dl className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-sand-200 bg-sand-200 sm:grid-cols-4">
        {[
          ["Jobs today", today.length],
          ["Next 7 days", week.length],
          ["Booked this month", formatTHB(month.booked)],
          ["Paid this month", formatTHB(month.paid)],
        ].map(([k, v]) => <div key={k} className="bg-white p-4"><dt className="text-sm text-ink/55">{k}</dt><dd className="tnum mt-1 text-2xl font-bold">{v}</dd></div>)}
      </dl>

      <div className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-3 text-lg font-bold">Today's jobs</h2>
          {today.length ? <JobList items={today} onOpen={setOpen} /> : <Empty>No cleans today.</Empty>}
          <h2 className="mb-3 mt-8 text-lg font-bold">Coming up</h2>
          {week.length ? <JobList items={week} onOpen={setOpen} showDay /> : <Empty>Nothing booked in the next 7 days yet.</Empty>}
        </section>
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-lg font-bold">Needs attention</h2>
            {attention.length ? (
              <ul className="divide-y divide-sand-200 rounded-xl border border-sand-200 bg-white">
                {attention.map((b) => (
                  <li key={b.id}><button className="w-full px-4 py-3 text-left hover:bg-sand-50" onClick={() => setOpen(b.id)}>
                    <p className="font-semibold">{b.customers?.name ?? "Customer"} <span className="font-normal text-ink/55">{fmtDay(b.start_at)} {fmtTime(b.start_at)}</span></p>
                    <p className="text-sm text-coral">{b.conflict ? "Clashes with another job or a blocked day" : b.status === "booked" ? "No cleaner assigned" : "Done but not paid"}</p>
                  </button></li>
                ))}
              </ul>
            ) : <Empty>All clear.</Empty>}
          </section>
          <section>
            <div className="mb-3 flex items-baseline justify-between"><h2 className="text-lg font-bold">New leads</h2><Link to="leads" className="text-sm font-semibold text-sea-700">All leads</Link></div>
            {leads.length ? (
              <ul className="divide-y divide-sand-200 rounded-xl border border-sand-200 bg-white">
                {leads.map((l) => (
                  <li key={l.id} className="px-4 py-3">
                    <p className="font-semibold">{l.name || "No name yet"} <span className="font-normal text-ink/55">{ago(l.updated_at)}</span></p>
                    <p className="text-sm text-ink/65">{KIND_LABEL[l.kind] ?? l.kind}{l.quoted_price ? `, quoted ${formatTHB(l.quoted_price)}` : ""}</p>
                  </li>
                ))}
              </ul>
            ) : <Empty>No new leads.</Empty>}
          </section>
        </div>
      </div>
      <BookingDrawer id={open} onClose={() => setOpen(null)} onChanged={changed} />
    </>
  );
}

export function JobList({ items, onOpen, showDay }: { items: Booking[]; onOpen: (id: string) => void; showDay?: boolean }) {
  return (
    <ul className="divide-y divide-sand-200 rounded-xl border border-sand-200 bg-white">
      {items.map((b) => (
        <li key={b.id}>
          <button className="grid w-full grid-cols-[4.5rem_1fr_auto] items-start gap-3 px-4 py-3 text-left hover:bg-sand-50" onClick={() => onOpen(b.id)}>
            <span className="tnum font-semibold">{showDay && <span className="block text-xs font-normal text-ink/55">{fmtDay(b.start_at)}</span>}{fmtTime(b.start_at)}<span className="block text-xs font-normal text-ink/55">to {endTime(b)}</span></span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{b.customers?.name ?? "Customer"}</span>
              <span className="block truncate text-sm text-ink/65">{b.details?.area}, {b.details?.bedrooms} bed {b.details?.bathrooms} bath{b.staff ? `. ${b.staff.name}` : ""}</span>
            </span>
            <span className="flex flex-col items-end gap-1"><StatusPill s={b.status} /><PayPill s={b.payment_status} /></span>
          </button>
        </li>
      ))}
    </ul>
  );
}
