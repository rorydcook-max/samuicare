import { useEffect, useState } from "react";
import { formatTHB } from "../lib/pricing";
import BookingDrawer from "./BookingDrawer";
import { BOOKING_SELECT, fmtWhen, METHOD_LABEL, sb, type Booking } from "./data";
import { Empty, PageHead, PayPill, StatusPill, Tabs } from "./ui";

type View = "upcoming" | "unpaid" | "past" | "cancelled";

export default function Bookings() {
  const [view, setView] = useState<View>("upcoming");
  const [rows, setRows] = useState<Booking[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const now = new Date().toISOString();
    let q = sb().from("bookings").select(BOOKING_SELECT);
    if (view === "upcoming") q = q.gte("start_at", now).not("status", "in", "(cancelled,no_show)").order("start_at");
    if (view === "unpaid") q = q.lt("start_at", now).eq("payment_status", "unpaid").not("status", "in", "(cancelled,no_show)").order("start_at", { ascending: false });
    if (view === "past") q = q.lt("start_at", now).not("status", "in", "(cancelled)").order("start_at", { ascending: false });
    if (view === "cancelled") q = q.in("status", ["cancelled", "no_show"]).order("start_at", { ascending: false });
    q.limit(300).then(({ data }) => setRows((data ?? []) as Booking[]));
  }, [view, tick]);

  const s = search.trim().toLowerCase();
  const shown = s ? rows.filter((b) => [b.ref, b.customers?.name, b.customers?.phone, b.details?.area, b.details?.address].some((v) => v?.toLowerCase().includes(s))) : rows;

  return (
    <>
      <PageHead title="Bookings">
        <input className="field !w-56 !py-2" placeholder="Search name, ref or area" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search bookings" />
      </PageHead>
      <div className="mb-4"><Tabs value={view} onChange={setView} options={[["upcoming", "Upcoming"], ["unpaid", "Unpaid"], ["past", "Past"], ["cancelled", "Cancelled"]]} /></div>
      {shown.length === 0 ? <Empty>{view === "upcoming" ? "No upcoming bookings yet. They appear here as soon as a customer books." : "Nothing here."}</Empty> : (
        <div className="overflow-x-auto rounded-xl border border-sand-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-[0.95rem]">
            <thead className="border-b border-sand-200 text-sm text-ink/55">
              <tr><th className="px-4 py-3 font-semibold">When</th><th className="px-4 py-3 font-semibold">Customer</th><th className="px-4 py-3 font-semibold">Where</th><th className="px-4 py-3 font-semibold">Cleaner</th><th className="px-4 py-3 text-right font-semibold">Price</th><th className="px-4 py-3 font-semibold">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {shown.map((b) => (
                <tr key={b.id} className="cursor-pointer hover:bg-sand-50" onClick={() => setOpen(b.id)}>
                  <td className="tnum whitespace-nowrap px-4 py-3">{fmtWhen(b.start_at)}<span className="block text-xs text-ink/50">{b.ref}</span></td>
                  <td className="px-4 py-3"><button className="text-left font-semibold" onClick={() => setOpen(b.id)}>{b.customers?.name ?? "Customer"}</button></td>
                  <td className="px-4 py-3">{b.details?.area}<span className="block text-xs text-ink/55">{b.details?.bedrooms} bed, {b.details?.bathrooms} bath</span></td>
                  <td className="px-4 py-3">{b.staff?.name ?? <span className="text-coral">None</span>}</td>
                  <td className="tnum px-4 py-3 text-right">{formatTHB(b.price)}<span className="block text-xs text-ink/55">{METHOD_LABEL[b.payment_method]}</span></td>
                  <td className="space-y-1 px-4 py-3"><StatusPill s={b.status} /><br /><PayPill s={b.payment_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <BookingDrawer id={open} onClose={() => setOpen(null)} onChanged={() => setTick((x) => x + 1)} />
    </>
  );
}
