import { useEffect, useState } from "react";
import { formatTHB } from "../lib/pricing";
import { fmtWhen, sb, STATUS_LABEL, type Booking, type Customer, type Property } from "./data";
import { ContactButtons, Drawer, Empty, Err, Field, PageHead } from "./ui";

type Row = Customer & { bookings: Pick<Booking, "id" | "price" | "status" | "start_at" | "payment_status" | "ref">[]; properties: Property[] };

const live = (b: Pick<Booking, "status">) => b.status !== "cancelled" && b.status !== "no_show";

export default function Customers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Row | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    sb().from("customers").select("*, bookings(id,price,status,start_at,payment_status,ref), properties(*)").order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => {
        const r = (data ?? []) as Row[];
        setRows(r);
        if (open) setOpen(r.find((x) => x.id === open.id) ?? null);
      });
  }, [tick]);

  const s = search.trim().toLowerCase();
  const shown = s ? rows.filter((c) => [c.name, c.phone, c.email, c.whatsapp, c.line_id, ...c.properties.map((p) => p.address)].some((v) => v?.toLowerCase().includes(s))) : rows;
  const ltv = (c: Row) => c.bookings.filter(live).filter((b) => new Date(b.start_at) <= new Date()).reduce((t, b) => t + b.price, 0);
  const last = (c: Row) => c.bookings.filter(live).map((b) => b.start_at).sort().filter((d) => new Date(d) <= new Date()).pop();
  const next = (c: Row) => c.bookings.filter(live).map((b) => b.start_at).sort().find((d) => new Date(d) > new Date());

  return (
    <>
      <PageHead title="Customers">
        <input className="field !w-56 !py-2" placeholder="Search name, phone, address" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search customers" />
      </PageHead>
      {shown.length === 0 ? <Empty>{rows.length ? "No match." : "Customers appear here after their first booking."}</Empty> : (
        <div className="overflow-x-auto rounded-xl border border-sand-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-[0.95rem]">
            <thead className="border-b border-sand-200 text-sm text-ink/55">
              <tr><th className="px-4 py-3 font-semibold">Name</th><th className="px-4 py-3 font-semibold">Cleans</th><th className="px-4 py-3 font-semibold">Last</th><th className="px-4 py-3 font-semibold">Next</th><th className="px-4 py-3 text-right font-semibold">Spent so far</th></tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {shown.map((c) => (
                <tr key={c.id} className="cursor-pointer hover:bg-sand-50" onClick={() => setOpen(c)}>
                  <td className="px-4 py-3"><button className="text-left font-semibold">{c.name}</button><span className="block text-xs text-ink/55">{c.properties[0]?.address}</span></td>
                  <td className="tnum px-4 py-3">{c.bookings.filter(live).length}</td>
                  <td className="px-4 py-3">{last(c) ? fmtWhen(last(c)!) : "None yet"}</td>
                  <td className="px-4 py-3">{next(c) ? fmtWhen(next(c)!) : <span className="text-ink/45">None</span>}</td>
                  <td className="tnum px-4 py-3 text-right font-semibold">{formatTHB(ltv(c))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <CustomerDrawer c={open} onClose={() => setOpen(null)} onChanged={() => setTick((x) => x + 1)} ltv={ltv(open)} />}
    </>
  );
}

function CustomerDrawer({ c, onClose, onChanged, ltv }: { c: Row; onClose: () => void; onChanged: () => void; ltv: number }) {
  const [f, setF] = useState({ name: c.name, phone: c.phone ?? "", whatsapp: c.whatsapp ?? "", line_id: c.line_id ?? "", email: c.email ?? "", notes: c.notes ?? "" });
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = f.name !== c.name || f.phone !== (c.phone ?? "") || f.whatsapp !== (c.whatsapp ?? "") || f.line_id !== (c.line_id ?? "") || f.email !== (c.email ?? "") || f.notes !== (c.notes ?? "");
  const save = async () => {
    const { error } = await sb().from("customers").update({ ...f, phone: f.phone || null, whatsapp: f.whatsapp || null, line_id: f.line_id || null, email: f.email || null }).eq("id", c.id);
    if (error) setErr(error.message); else { setSaved(true); onChanged(); }
  };
  const history = [...c.bookings].sort((a, b) => b.start_at.localeCompare(a.start_at));
  return (
    <Drawer open onClose={onClose} title={c.name}>
      <div className="space-y-6">
        <p className="text-ink/65">Customer since {new Date(c.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}. Spent {formatTHB(ltv)} so far.</p>
        <ContactButtons c={c} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name"><input className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Phone"><input className="field" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="WhatsApp"><input className="field" value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} /></Field>
          <Field label="LINE ID"><input className="field" value={f.line_id} onChange={(e) => setF({ ...f, line_id: e.target.value })} /></Field>
          <div className="col-span-2"><Field label="Email"><input className="field" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field></div>
          <div className="col-span-2"><Field label="Notes" hint="Preferences, key location, anything the team should know."><textarea className="field min-h-24" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field></div>
        </div>
        <Err e={err} />
        {dirty && <button className="btn-primary !py-2" onClick={save}>Save changes</button>}
        {saved && !dirty && <p className="text-sm text-sea-700" role="status">Saved.</p>}

        <section>
          <h3 className="mb-2 font-bold">Properties</h3>
          <ul className="divide-y divide-sand-200 border-y border-sand-200 text-[0.95rem]">
            {c.properties.map((p) => (
              <li key={p.id} className="py-2.5">
                <p className="font-semibold">{p.address}</p>
                <p className="text-ink/65">{p.bedrooms} bed, {p.bathrooms} bath {p.property_type}{p.access_notes ? `. Access: ${p.access_notes}` : ""}</p>
                {p.maps_link && <a href={p.maps_link} target="_blank" rel="noreferrer" className="text-sm font-semibold text-sea-700 underline">Map</a>}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-2 font-bold">Cleans</h3>
          <ul className="divide-y divide-sand-200 border-y border-sand-200 text-[0.95rem]">
            {history.map((b) => (
              <li key={b.id} className="flex justify-between gap-3 py-2.5">
                <span>{fmtWhen(b.start_at)} <span className="text-ink/50">{b.ref}</span></span>
                <span className="text-right"><span className="tnum">{formatTHB(b.price)}</span> <span className="text-ink/55">{STATUS_LABEL[b.status]}</span></span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Drawer>
  );
}
