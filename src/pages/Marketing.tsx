import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Minus, Plus } from "lucide-react";
import { BookBand, PageTitle, RequestForm, useConfig } from "../components/ui";
import { basePrice, computeQuote, formatDuration, formatTHB, type Condition } from "../lib/pricing";
import { AREA_NAMES } from "../lib/config";

/* ---------------------------------- Home ---------------------------------- */

const CONDITIONS: [Condition, string][] = [["regular", "Regular"], ["lived_in", "Lived-in"], ["heavy", "Heavy"]];

function Stepper({ label, value, set }: { label: string; value: number; set: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-lg font-medium">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" className="flex h-11 w-11 items-center justify-center rounded-lg border border-sand-300 hover:border-sea-600 disabled:opacity-30" onClick={() => set(value - 1)} disabled={value <= 1} aria-label={`Fewer ${label.toLowerCase()}`}><Minus size={18} /></button>
        <output className="tnum w-12 text-center text-2xl font-semibold" aria-live="polite">{value}</output>
        <button type="button" className="flex h-11 w-11 items-center justify-center rounded-lg border border-sand-300 hover:border-sea-600 disabled:opacity-30" onClick={() => set(value + 1)} disabled={value >= 10} aria-label={`More ${label.toLowerCase()}`}><Plus size={18} /></button>
      </div>
    </div>
  );
}

function HeroCalculator() {
  const cfg = useConfig();
  const [beds, setBeds] = useState(2);
  const [baths, setBaths] = useState(1);
  const [condition, setCondition] = useState<Condition>("regular");
  const q = useMemo(
    () => computeQuote({ bedrooms: beds, bathrooms: baths, condition, kids: false, pets: false, addons: [], frequency: "one_time" }, cfg.pricing, cfg.anchors, cfg.addons),
    [beds, baths, condition, cfg],
  );
  return (
    <div className="rounded-2xl bg-sand-100 p-5 sm:p-7">
      <div className="divide-y divide-sand-200">
        <Stepper label="Bedrooms" value={beds} set={setBeds} />
        <Stepper label="Bathrooms" value={baths} set={setBaths} />
      </div>
      <fieldset className="mt-3">
        <legend className="mb-2 text-sm font-semibold text-ink/60">How does it look right now?</legend>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-white p-1">
          {CONDITIONS.map(([v, l]) => (
            <button key={v} type="button" onClick={() => setCondition(v)} aria-pressed={condition === v}
              className={`rounded-md py-2.5 text-[0.95rem] font-semibold transition-colors ${condition === v ? "bg-ink text-white" : "text-ink/70 hover:text-ink"}`}>{l}</button>
          ))}
        </div>
      </fieldset>
      <div className="mt-6 flex items-end justify-between gap-4">
        <p className="tnum text-price font-extrabold">
          <span className="bg-[linear-gradient(transparent_62%,#F2C14E_62%,#F2C14E_90%,transparent_90%)] px-1">{formatTHB(q.total)}</span>
        </p>
        <p className="pb-2 text-right text-ink/70">about<br /><span className="text-xl font-semibold text-ink">{formatDuration(q.minutes)}</span></p>
      </div>
      <Link to={`/book?beds=${beds}&baths=${baths}&condition=${condition}`} className="btn-primary mt-5 w-full py-3.5 text-lg">Choose a time</Link>
      <p className="mt-3 text-center text-sm text-ink/55">Kitchen and living areas included. Extras added on the next step.</p>
    </div>
  );
}

const ROOMS: [string, string[]][] = [
  ["Bedrooms", ["Dust surfaces, sills and fans", "Make beds", "Vacuum and mop floors", "Empty bins"]],
  ["Bathrooms", ["Clean toilet, shower and sink", "Descale taps and glass", "Wipe mirrors and tiles", "Mop floors"]],
  ["Kitchen", ["Wipe counters and cupboard fronts", "Clean hob and outside of appliances", "Clean the sink", "Empty bins"]],
  ["Living areas", ["Dust and wipe surfaces", "Plump cushions, tidy up", "Vacuum and mop floors", "Wipe door handles and switches"]],
];

export function Home() {
  const { pricing: p, addons } = useConfig();
  const laundry = addons.find((a) => a.slug === "laundry");
  return (
    <>
      <section className="container-x grid items-center gap-10 pb-8 pt-12 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div>
          <h1 className="text-hero font-extrabold">House cleaning on Koh Samui, priced before you book.</h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink/70">
            Villas, houses and condos, anywhere on the island. Set the size of your place and the price is right there.
            Pick a time that's actually free, then pay by card, PromptPay or cash.
          </p>
        </div>
        <HeroCalculator />
      </section>

      <section className="container-x mt-20">
        <h2 className="text-3xl tracking-[-0.02em]">What gets cleaned</h2>
        <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {ROOMS.map(([room, items]) => (
            <div key={room} className="border-t border-ink pt-4">
              <h3 className="text-lg">{room}</h3>
              <ul className="mt-3 space-y-1.5 text-ink/75">{items.map((i) => <li key={i}>{i}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      <section className="container-x mt-20 grid gap-12 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl tracking-[-0.02em]">Extras</h2>
          <p className="mt-3 text-ink/70">Add any of these when you book. Ironing isn't offered yet.</p>
          <dl className="mt-6 divide-y divide-sand-200 border-y border-sand-200">
            {addons.filter((a) => a.enabled).map((a) => (
              <div key={a.slug} className="flex justify-between gap-6 py-3"><dt>{a.name}</dt><dd className="tnum font-semibold">+{formatTHB(a.price)}</dd></div>
            ))}
          </dl>
          {laundry && <p className="mt-4 text-sm leading-relaxed text-ink/60">Laundry means we hang out one full washer load, run one wash from your laundry baskets, and change the bed linen if fresh sets are out.</p>}
        </div>
        <div>
          <h2 className="text-3xl tracking-[-0.02em]">Regular cleans cost less</h2>
          <p className="mt-3 text-ink/70">Book weekly or fortnightly and we keep the same day and time for you.</p>
          <dl className="mt-6 divide-y divide-sand-200 border-y border-sand-200">
            <div className="flex justify-between py-3"><dt>Weekly</dt><dd className="font-semibold">{p.discounts.weekly}% off each clean</dd></div>
            <div className="flex justify-between py-3"><dt>Fortnightly</dt><dd className="font-semibold">{p.discounts.fortnightly}% off each clean</dd></div>
            <div className="flex justify-between py-3"><dt>Monthly</dt><dd className="font-semibold">{p.discounts.monthly ? `${p.discounts.monthly}% off` : "Normal price"}</dd></div>
          </dl>
        </div>
      </section>

      <section className="container-x mt-20">
        <h2 className="text-3xl tracking-[-0.02em]">How booking works</h2>
        <ol className="mt-8 grid gap-8 sm:grid-cols-3">
          {[
            ["Tell us about the place", "Bedrooms, bathrooms, how it looks today, kids or pets, and any extras."],
            ["Pick a free time", "You only see times a cleaner is actually available. Start times run from 9:30 in the morning."],
            ["Pay how you like", "Card or PromptPay online, or cash to your cleaner when the job's done."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span className="tnum text-4xl font-extrabold text-sea-600">{i + 1}</span>
              <div><h3 className="text-lg">{t}</h3><p className="mt-1 text-ink/70">{d}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="container-x mt-20 grid gap-6 rounded-2xl bg-sea-900 p-7 text-white sm:p-10 lg:grid-cols-[1fr_1.4fr]">
        <h2 className="text-3xl tracking-[-0.02em]">Anywhere on the island</h2>
        <p className="leading-relaxed text-white/75">{AREA_NAMES.join(", ")}. Same prices everywhere. Drop a Google Maps pin when you book and tell us how to get in if you won't be home.</p>
      </section>

      <BookBand />
    </>
  );
}

/* --------------------------------- Prices --------------------------------- */

export function Prices() {
  const { pricing: p, anchors } = useConfig();
  const rows: [number, number][] = [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3], [4, 3], [5, 4]];
  return (
    <>
      <PageTitle title="Prices">
        For a home in regular condition. The booking form works out your exact price, including extras and any regular-clean discount.
      </PageTitle>
      <section className="container-x grid gap-14 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <table className="w-full text-left">
            <thead className="border-b-2 border-ink text-sm text-ink/60">
              <tr><th className="pb-3 font-semibold">Home</th><th className="pb-3 font-semibold">Takes about</th><th className="pb-3 text-right font-semibold">Price</th></tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {rows.map(([b, ba]) => (
                <tr key={`${b}-${ba}`} className="text-lg">
                  <td className="py-4">{b} bed, {ba} bath</td>
                  <td className="py-4 text-ink/70">{formatDuration(Math.max(p.min_minutes, b * p.minutes_per_bedroom))}</td>
                  <td className="tnum py-4 text-right font-semibold">{formatTHB(Math.max(p.min_price, basePrice(b, ba, anchors, p)))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-5 text-ink/65">Bigger than that? Add {formatTHB(p.extra_bedroom)} for each extra bedroom and {formatTHB(p.extra_bathroom)} for each extra bathroom. The smallest job is {formatTHB(p.min_price)}.</p>
        </div>
        <div className="space-y-10">
          <div>
            <h2 className="text-2xl">If it needs more work</h2>
            <dl className="mt-4 divide-y divide-sand-200 border-y border-sand-200">
              <div className="flex justify-between py-3"><dt>Lived-in, a bit overdue</dt><dd className="font-semibold">+{Math.round((p.multipliers.lived_in - 1) * 100)}%</dd></div>
              <div className="flex justify-between py-3"><dt>Heavy, needs a deep clean</dt><dd className="font-semibold">+{Math.round((p.multipliers.heavy - 1) * 100)}%</dd></div>
              <div className="flex justify-between py-3"><dt>Kids at home</dt><dd className="font-semibold">+{p.kids_pct}%</dd></div>
              <div className="flex justify-between py-3"><dt>Pets at home</dt><dd className="font-semibold">+{p.pets_pct}%</dd></div>
            </dl>
            <p className="mt-3 text-sm text-ink/60">Time goes up by the same amount. Move-out, post-construction and after-party cleans get a quote after a quick look.</p>
          </div>
        </div>
      </section>
      <BookBand />
    </>
  );
}

/* ------------------------------- Businesses ------------------------------- */

export function Businesses() {
  return (
    <>
      <PageTitle title="Cleaning for businesses">
        Restaurants, venues, hotels and offices. Every place is different, so tell us what you need and we'll send a price, usually the same day.
      </PageTitle>
      <section className="container-x grid gap-14 lg:grid-cols-2">
        <dl className="divide-y divide-sand-200 border-y border-sand-200 text-lg">
          {[
            ["Restaurants", "Kitchen degreasing, dining areas, washrooms, before or after service."],
            ["Venues", "Clean-ups after weddings, parties and events."],
            ["Hotels and resorts", "Extra hands for room turnovers in high season."],
            ["Offices and shops", "Regular cleans outside opening hours."],
          ].map(([t, d]) => (
            <div key={t} className="py-4"><dt className="font-semibold">{t}</dt><dd className="mt-1 text-base text-ink/70">{d}</dd></div>
          ))}
        </dl>
        <div>
          <p className="text-lg text-ink/75">The quote form takes two minutes and you can add photos.</p>
          <Link to="/book?type=commercial" className="btn-primary mt-5">Ask for a quote</Link>
        </div>
      </section>
      <section className="container-x mt-24">
        <h2 className="text-3xl tracking-[-0.02em]">Pools, gardens and property management</h2>
        <p className="mt-3 max-w-2xl text-ink/70">We're adding pool care, garden care and full property management for villa owners. Leave your details and we'll tell you when they start.</p>
        <div className="mt-8 max-w-lg">
          <RequestForm
            kind="interest"
            submitLabel="Tell me when it starts"
            doneText="Thanks. We'll message you when it's available."
            fields={[
              { name: "service", label: "Service", options: ["Pool care", "Garden care", "Property management"], required: true },
              { name: "name", label: "Name", required: true },
              { name: "contact", label: "Phone, WhatsApp, LINE or email", required: true },
              { name: "area", label: "Area", options: AREA_NAMES },
            ]}
          />
        </div>
      </section>
    </>
  );
}

/* ----------------------------------- FAQ ---------------------------------- */

const FAQS: [string, string][] = [
  ["How is the price worked out?", "From the number of bedrooms and bathrooms, then adjusted for how much work the place needs and whether there are kids or pets. You see every line of the price before you book."],
  ["How long does a clean take?", "About an hour per bedroom for a home in regular condition, with the kitchen, bathrooms and living areas included. The booking form shows the time for your place."],
  ["Do I need to be home?", "No. Tell us how to get in when you book: gate code, key safe or where to collect a key."],
  ["Do you bring cleaning products?", "Tell us in the booking notes if you'd like us to use your own products and equipment."],
  ["How do I pay?", "By card or PromptPay QR when you book, or in cash to your cleaner when the job is finished."],
  ["Can I change or cancel a booking?", "Yes. Message us on LINE, WhatsApp or email as early as you can."],
  ["Do you clean holiday rentals between guests?", "Yes. Add laundry and linen to get the beds changed and a wash on."],
];

export function Faq() {
  return (
    <>
      <PageTitle title="Questions" />
      <section className="container-x max-w-3xl">
        <div className="divide-y divide-sand-200 border-y border-sand-200">
          {FAQS.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-semibold">
                {q}<Plus size={20} className="shrink-0 transition-transform group-open:rotate-45" />
              </summary>
              <p className="mt-3 leading-relaxed text-ink/75">{a}</p>
            </details>
          ))}
        </div>
      </section>
      <BookBand />
    </>
  );
}

/* --------------------------------- Contact -------------------------------- */

export function Contact() {
  const { business: b } = useConfig();
  return (
    <>
      <PageTitle title="Contact">LINE and WhatsApp get the quickest reply. For a price, the booking form is faster than asking.</PageTitle>
      <section className="container-x grid gap-14 lg:grid-cols-2">
        <dl className="divide-y divide-sand-200 border-y border-sand-200 text-lg">
          <div className="flex justify-between gap-4 py-4"><dt className="text-ink/60">LINE</dt><dd><a className="font-semibold underline-offset-4 hover:underline" href={`https://line.me/R/ti/p/${encodeURIComponent(b.line_id)}`}>{b.line_id}</a></dd></div>
          <div className="flex justify-between gap-4 py-4"><dt className="text-ink/60">WhatsApp</dt><dd><a className="font-semibold underline-offset-4 hover:underline" href={`https://wa.me/${b.whatsapp.replace(/\D/g, "")}`}>{b.whatsapp}</a></dd></div>
          <div className="flex justify-between gap-4 py-4"><dt className="text-ink/60">Phone</dt><dd><a className="font-semibold underline-offset-4 hover:underline" href={`tel:${b.phone.replace(/\s/g, "")}`}>{b.phone}</a></dd></div>
          <div className="flex justify-between gap-4 py-4"><dt className="text-ink/60">Email</dt><dd><a className="font-semibold underline-offset-4 hover:underline" href={`mailto:${b.email}`}>{b.email}</a></dd></div>
        </dl>
        <RequestForm
          kind="contact"
          submitLabel="Send message"
          doneText="Message sent. We'll reply on the contact you gave."
          fields={[
            { name: "name", label: "Name", required: true },
            { name: "contact", label: "Phone, WhatsApp, LINE or email", required: true },
            { name: "message", label: "Message", textarea: true, required: true },
          ]}
        />
      </section>
    </>
  );
}

export function NotFound() {
  return (
    <PageTitle title="There's nothing at this address">
      <Link to="/" className="btn-primary mt-2">Go to the home page</Link>
    </PageTitle>
  );
}

export const Redirect = ({ to }: { to: string }) => <Navigate to={to} replace />;
