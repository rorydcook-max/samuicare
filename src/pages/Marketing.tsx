import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BedDouble, Building2, CalendarCheck, Check, ChevronDown, Clock, CreditCard, Home as HomeIcon,
  KeyRound, MapPin, Shirt, Sparkles, Sprout, Waves, Wallet, Briefcase, Calculator,
} from "lucide-react";
import { CtaBand, Leaves, PageHero, RequestForm, SectionTitle, useConfig } from "../components/ui";
import { basePrice, formatDuration, formatTHB } from "../lib/pricing";
import { AREA_NAMES } from "../lib/config";

/* ---------------------------------- Home ---------------------------------- */

export function Home() {
  const cfg = useConfig();
  const from = Math.min(...cfg.anchors.map((a) => a.price), cfg.pricing.min_price);
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-sea-50 via-sand-50 to-sand-100">
        <Leaves className="pointer-events-none absolute -right-16 top-0 w-[28rem] opacity-50" />
        <div className="container-x relative grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.15fr_.85fr]">
          <div>
            <p className="eyebrow">Koh Samui · Whole island</p>
            <h1 className="mt-4 text-5xl font-semibold leading-[1.05] text-sea-950 sm:text-6xl">
              A spotless home, <span className="italic text-sea-600">without the back-and-forth.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/75">
              Villas, houses and condos cleaned properly. See your exact price and how long it'll take,
              then pick a real time slot — all in under two minutes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/book" className="btn-primary">Get an instant price <ArrowRight size={18} /></Link>
              <Link to="/pricing" className="btn-ghost">See prices</Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink/70">
              {["Prices from " + formatTHB(from), "Pay by card, PromptPay or cash", "One-off or regular"].map((t) => (
                <li key={t} className="flex items-center gap-1.5"><Check size={16} className="text-sea-600" /> {t}</li>
              ))}
            </ul>
          </div>
          <QuotePreview />
        </div>
      </section>

      <section className="container-x mt-20">
        <SectionTitle eyebrow="What we do" title="Cleaning made simple" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.slice(0, 4).map((s) => <ServiceCard key={s.title} {...s} />)}
        </div>
      </section>

      <HowSteps />

      <section className="container-x mt-20 grid gap-8 lg:grid-cols-2">
        <div className="card p-8">
          <SectionTitle eyebrow="Fair & clear" title="Prices you can see before you book" />
          <p className="mt-4 text-ink/75">
            Your price is based on bedrooms, bathrooms and the condition of the place — no surprise
            call-out fees. Homes with kids or pets, or that haven't been cleaned in a while, take
            a little longer, so the estimate adjusts honestly.
          </p>
          <Link to="/pricing" className="mt-6 inline-flex items-center gap-2 font-semibold text-sea-700">See the full price list <ArrowRight size={16} /></Link>
        </div>
        <div className="card p-8">
          <SectionTitle eyebrow="Island-wide" title="Every corner of Samui" />
          <div className="mt-5 flex flex-wrap gap-2">
            {AREA_NAMES.map((a) => <span key={a} className="rounded-full bg-sea-50 px-3 py-1.5 text-sm text-sea-800">{a}</span>)}
          </div>
        </div>
      </section>
      <CtaBand />
    </>
  );
}

function QuotePreview() {
  return (
    <div className="card relative mx-auto w-full max-w-sm p-6">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ink/60">Example quote</span>
        <span className="rounded-full bg-sea-50 px-3 py-1 text-xs font-semibold text-sea-700">Villa · Bophut</span>
      </div>
      <div className="mt-5 space-y-3 text-sm">
        <Row l="3 bed / 3 bath clean" r="฿1,000" />
        <Row l="Laundry & linen" r="฿100" />
        <div className="border-t border-dashed border-sand-200 pt-3"><Row l={<b>Total</b>} r={<b className="text-lg text-sea-800">฿1,100</b>} /></div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-sand-50 p-3"><Clock size={16} className="text-sea-600" /><p className="mt-1 font-semibold">About 3 h 30 min</p><p className="text-xs text-ink/60">estimated time</p></div>
        <div className="rounded-2xl bg-sand-50 p-3"><CalendarCheck size={16} className="text-sea-600" /><p className="mt-1 font-semibold">Tue 10:00</p><p className="text-xs text-ink/60">next free slot</p></div>
      </div>
      <Link to="/book" className="btn-primary mt-5 w-full">Get my price</Link>
    </div>
  );
}
const Row = ({ l, r }: { l: React.ReactNode; r: React.ReactNode }) => (
  <div className="flex items-center justify-between"><span>{l}</span><span>{r}</span></div>
);

/* -------------------------------- Services -------------------------------- */

const SERVICES = [
  { icon: HomeIcon, title: "Home cleaning", text: "A thorough clean of bedrooms, bathrooms, kitchen and living areas. One-off or weekly, fortnightly or monthly." },
  { icon: Sparkles, title: "Deep clean", text: "For places that need extra attention — lived-in homes, after guests, or when it's been a while." },
  { icon: KeyRound, title: "Holiday-let turnovers", text: "Airbnb and villa changeovers: clean, fresh linen on the beds and laundry on, ready for the next guests." },
  { icon: Shirt, title: "Laundry & linen", text: "Add it to any clean: we hang out a load, run a wash, strip beds and remake them with fresh sets. Ironing isn't included." },
];

function ServiceCard({ icon: Icon, title, text }: { icon: typeof HomeIcon; title: string; text: string }) {
  return (
    <div className="card p-6">
      <span className="inline-flex rounded-2xl bg-sea-50 p-3 text-sea-700"><Icon size={22} /></span>
      <h3 className="mt-4 text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink/70">{text}</p>
    </div>
  );
}

export function Services() {
  return (
    <>
      <PageHero eyebrow="Services" title="Cleaning for every kind of Samui home">
        Book online with an instant price, or ask us for a custom quote for businesses and bigger jobs.
      </PageHero>
      <section className="container-x mt-12 grid gap-5 sm:grid-cols-2">
        {SERVICES.map((s) => <ServiceCard key={s.title} {...s} />)}
      </section>

      <section className="container-x mt-16">
        <div className="card grid gap-8 p-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <span className="inline-flex rounded-2xl bg-sand-100 p-3 text-sea-800"><Building2 size={22} /></span>
            <h2 className="mt-4 text-3xl font-semibold">Commercial cleaning</h2>
            <p className="mt-3 text-ink/75">Restaurants, venues, hotels and offices. Every business is different, so tell us what you need and we'll send a tailored quote.</p>
            <Link to="/book?type=commercial" className="btn-primary mt-6">Request a custom quote</Link>
          </div>
          <ul className="grid gap-3 self-center text-sm">
            {["Restaurant & kitchen cleaning", "Venue clean-ups after events", "Hotel and resort room support", "Office and retail cleaning"].map((t) => (
              <li key={t} className="flex items-center gap-2"><Check size={16} className="text-sea-600" /> {t}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-x mt-16">
        <SectionTitle eyebrow="Coming soon" title="More ways to look after your property" />
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            { icon: Waves, title: "Pool care", text: "Regular cleaning, chemical balancing and green-pool recovery." },
            { icon: Sprout, title: "Garden care", text: "Lawns, hedges, palms and green-waste removal." },
            { icon: Briefcase, title: "Property management", text: "Key holding, inspections, guest changeovers and maintenance coordination." },
          ].map((s) => (
            <div key={s.title} className="card relative p-6">
              <span className="absolute right-5 top-5 rounded-full bg-sand-100 px-2.5 py-1 text-xs font-semibold text-sea-800">Coming soon</span>
              <span className="inline-flex rounded-2xl bg-sea-50 p-3 text-sea-700"><s.icon size={22} /></span>
              <h3 className="mt-4 text-xl font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-ink/70">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-8 max-w-xl">
          <RequestForm
            kind="interest"
            intro="Want pool, garden or property management when it launches? Leave your details and we'll let you know first."
            submitLabel="Register interest"
            fields={[
              { name: "service", label: "Service", options: ["Pool care", "Garden care", "Property management"], required: true },
              { name: "name", label: "Name", required: true },
              { name: "contact", label: "Phone, WhatsApp, LINE or email", required: true },
              { name: "area", label: "Area", options: AREA_NAMES },
            ]}
          />
        </div>
      </section>
      <CtaBand />
    </>
  );
}

/* --------------------------------- Pricing -------------------------------- */

export function Pricing() {
  const { pricing: p, anchors, addons } = useConfig();
  const rows = [[1, 1], [2, 1], [2, 2], [3, 2], [3, 3], [4, 3], [5, 4]] as const;
  return (
    <>
      <PageHero eyebrow="Pricing" title="Simple, honest prices">
        Prices for a regular-condition clean. Your exact price — including condition, add-ons and any
        regular-clean discount — is shown instantly when you book.
      </PageHero>
      <section className="container-x mt-12 grid gap-8 lg:grid-cols-[1.2fr_.8fr]">
        <div className="card overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-sea-50 text-sm text-sea-900">
              <tr><th className="px-6 py-4">Property</th><th className="px-6 py-4">Estimated time</th><th className="px-6 py-4 text-right">Price</th></tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {rows.map(([b, ba]) => (
                <tr key={`${b}-${ba}`}>
                  <td className="px-6 py-4 font-medium"><BedDouble size={16} className="mr-2 inline text-sea-600" />{b} bed · {ba} bath</td>
                  <td className="px-6 py-4 text-ink/70">{formatDuration(Math.max(p.min_minutes, b * p.minutes_per_bedroom))}</td>
                  <td className="px-6 py-4 text-right font-semibold text-sea-800">{formatTHB(Math.max(p.min_price, basePrice(b, ba, anchors, p)))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-sand-100 px-6 py-4 text-sm text-ink/65">
            Bigger home? Add {formatTHB(p.extra_bedroom)} per extra bedroom and {formatTHB(p.extra_bathroom)} per extra bathroom.
            Minimum job {formatTHB(p.min_price)}.
          </p>
        </div>
        <div className="grid gap-5 self-start">
          <div className="card p-6">
            <h3 className="text-xl font-semibold">Condition</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex justify-between"><span>Regular</span><b>Standard price</b></li>
              <li className="flex justify-between"><span>Lived-in</span><b>+{Math.round((p.multipliers.lived_in - 1) * 100)}%</b></li>
              <li className="flex justify-between"><span>Heavy</span><b>+{Math.round((p.multipliers.heavy - 1) * 100)}%</b></li>
              <li className="flex justify-between"><span>Kids or pets at home</span><b>+{p.kids_pct}% each</b></li>
              <li className="flex justify-between"><span>Move-out / post-build</span><b>Custom quote</b></li>
            </ul>
          </div>
          <div className="card p-6">
            <h3 className="text-xl font-semibold">Regular cleans</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex justify-between"><span>Weekly</span><b>{p.discounts.weekly}% off</b></li>
              <li className="flex justify-between"><span>Fortnightly</span><b>{p.discounts.fortnightly}% off</b></li>
              <li className="flex justify-between"><span>Monthly</span><b>{p.discounts.monthly ? `${p.discounts.monthly}% off` : "Standard price"}</b></li>
            </ul>
          </div>
        </div>
      </section>
      <section className="container-x mt-12">
        <SectionTitle eyebrow="Extras" title="Add-ons" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {addons.filter((a) => a.enabled).map((a) => (
            <div key={a.slug} className="card p-5">
              <div className="flex items-baseline justify-between gap-3"><h3 className="font-sans font-semibold">{a.name}</h3><b className="text-sea-800">+{formatTHB(a.price)}</b></div>
              <p className="mt-2 text-sm text-ink/70">{a.description}</p>
            </div>
          ))}
        </div>
      </section>
      <CtaBand />
    </>
  );
}

/* ---------------------------------- Areas --------------------------------- */

export function Areas() {
  return (
    <>
      <PageHero eyebrow="Areas" title="We clean all over Koh Samui">
        From Bophut to Taling Ngam, Chaweng to Laem Set — one price list for the whole island.
      </PageHero>
      <section className="container-x mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {AREA_NAMES.map((a) => (
          <div key={a} className="card flex items-center gap-3 p-5"><MapPin size={18} className="text-sea-600" /><span className="font-semibold">{a}</span></div>
        ))}
      </section>
      <p className="container-x mt-6 text-sm text-ink/65">Not sure if you're covered? If you're on Samui, you are. Choose the nearest area when booking and drop a Google Maps pin.</p>
      <CtaBand />
    </>
  );
}

/* ------------------------------- How it works ----------------------------- */

function HowSteps() {
  const steps = [
    { icon: Calculator, title: "Tell us about your place", text: "Property type, bedrooms, bathrooms, condition and any extras." },
    { icon: Clock, title: "See your price & time", text: "Your exact price and how long the clean will take — instantly." },
    { icon: CalendarCheck, title: "Pick a real slot", text: "Choose from live availability. You'll get a confirmation straight away." },
    { icon: Wallet, title: "Pay your way", text: "Card or PromptPay online, or cash when the job's done." },
  ];
  return (
    <section className="container-x mt-20">
      <SectionTitle eyebrow="How it works" title="Booked in four quick steps" />
      <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className="card p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sea-700 font-semibold text-white">{i + 1}</span>
              <s.icon size={20} className="text-sea-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
            <p className="mt-1.5 text-sm text-ink/70">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function HowItWorks() {
  return (
    <>
      <PageHero eyebrow="How it works" title="From quote to clean in minutes">
        No phone tag, no waiting for a quote. Here's what happens when you book with Samui Care.
      </PageHero>
      <HowSteps />
      <section className="container-x mt-16 grid gap-5 md:grid-cols-3">
        {[
          { icon: CreditCard, title: "On the day", text: "Your cleaner arrives at the booked start time. Let us know about gate codes, key collection or parking when you book." },
          { icon: Check, title: "After the clean", text: "We'll let you know when the job's done. If you chose cash, simply pay your cleaner." },
          { icon: CalendarCheck, title: "Regular cleans", text: "Choose weekly, fortnightly or monthly and we'll reserve the same day and time for you." },
        ].map((s) => (
          <div key={s.title} className="card p-6"><s.icon size={20} className="text-sea-600" /><h3 className="mt-3 text-lg font-semibold">{s.title}</h3><p className="mt-1.5 text-sm text-ink/70">{s.text}</p></div>
        ))}
      </section>
      <CtaBand />
    </>
  );
}

/* ----------------------------------- FAQ ---------------------------------- */

const FAQS = [
  ["How is my price worked out?", "It's based on bedrooms and bathrooms, adjusted for the condition of the home and whether there are kids or pets. Add-ons are priced separately. You see the full breakdown before you book."],
  ["How long will the clean take?", "Roughly an hour per bedroom for a regular clean (kitchen, bathrooms and living areas included). Lived-in or heavy cleans take longer, and the estimate adjusts automatically."],
  ["Do I need to provide cleaning products?", "Tell us in the booking notes whether you'd like us to use your own products and equipment."],
  ["What's included in laundry & linen?", "We hang out one full washer load, run one wash from your laundry baskets, strip beds into the laundry cycle and change bed linen if fresh sets are available. Ironing isn't included."],
  ["How can I pay?", "By card or PromptPay QR online, or in cash to your cleaner when the job is finished."],
  ["Do I need to be home?", "No. Just tell us how to get in — gate code, key safe or key collection — when you book."],
  ["Can I reschedule or cancel?", "Yes — message us on LINE, WhatsApp or email as early as possible and we'll sort it."],
  ["Do you clean businesses?", "Yes — restaurants, venues, hotels and offices get a custom quote. Choose ‘Commercial’ when you start your quote."],
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <>
      <PageHero eyebrow="FAQ" title="Questions, answered" />
      <section className="container-x mt-12 max-w-3xl space-y-3">
        {FAQS.map(([q, a], i) => (
          <div key={q} className="card overflow-hidden">
            <button className="flex w-full items-center justify-between gap-4 p-5 text-left font-semibold" onClick={() => setOpen(open === i ? null : i)}>
              {q}<ChevronDown size={18} className={`shrink-0 transition ${open === i ? "rotate-180" : ""}`} />
            </button>
            {open === i && <p className="px-5 pb-5 text-ink/75">{a}</p>}
          </div>
        ))}
      </section>
      <CtaBand />
    </>
  );
}

/* ---------------------------------- About --------------------------------- */

export function About() {
  return (
    <>
      <PageHero eyebrow="About" title="Local cleaning, done properly">
        Samui Care was started on the island to make getting a reliable clean as easy as it should be.
      </PageHero>
      <section className="container-x mt-12 grid gap-8 lg:grid-cols-2">
        <div className="space-y-4 text-lg leading-relaxed text-ink/80">
          <p>Finding a cleaner on Samui usually means messages back and forth, vague prices and no idea when someone can actually come. We built Samui Care to fix that.</p>
          <p>You get a clear price and time estimate up front, a real slot you can book straight away, and a team that turns up when they say they will.</p>
          <p>We're starting with home cleaning and growing into pool care, gardens and full property management — so one team can look after your whole property.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[["Clear pricing", "See exactly what you'll pay before you book."], ["Real availability", "Book a slot that's genuinely free."], ["Whole island", "Every area of Koh Samui covered."], ["Flexible payment", "Card, PromptPay or cash."]].map(([t, d]) => (
            <div key={t} className="card p-5"><h3 className="font-sans font-semibold">{t}</h3><p className="mt-1 text-sm text-ink/70">{d}</p></div>
          ))}
        </div>
      </section>
      <CtaBand />
    </>
  );
}

/* --------------------------------- Contact -------------------------------- */

export function Contact() {
  const { business: b } = useConfig();
  return (
    <>
      <PageHero eyebrow="Contact" title="Talk to us">
        Fastest is LINE or WhatsApp. For a price, the instant quote is quicker than asking!
      </PageHero>
      <section className="container-x mt-12 grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <a href={`https://line.me/R/ti/p/${encodeURIComponent(b.line_id)}`} className="card flex items-center gap-4 p-5 hover:border-sea-300"><span className="rounded-2xl bg-[#06C755] px-3 py-2 text-sm font-bold text-white">LINE</span><span className="font-semibold">{b.line_id}</span></a>
          <a href={`https://wa.me/${b.whatsapp.replace(/\D/g, "")}`} className="card flex items-center gap-4 p-5 hover:border-sea-300"><span className="rounded-2xl bg-[#25D366] px-3 py-2 text-sm font-bold text-white">WhatsApp</span><span className="font-semibold">{b.whatsapp}</span></a>
          <a href={`mailto:${b.email}`} className="card flex items-center gap-4 p-5 hover:border-sea-300"><span className="rounded-2xl bg-sea-700 px-3 py-2 text-sm font-bold text-white">Email</span><span className="font-semibold">{b.email}</span></a>
        </div>
        <RequestForm
          kind="contact"
          submitLabel="Send message"
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
    <PageHero eyebrow="404" title="That page has been swept away">
      <Link to="/" className="btn-primary mt-2">Back home</Link>
    </PageHero>
  );
}
