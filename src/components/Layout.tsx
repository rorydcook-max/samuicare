import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu, X, Sparkles, MessageCircle, Mail, Phone } from "lucide-react";
import { DEMO } from "../lib/api";
import { DEFAULT_BUSINESS as B } from "../lib/config";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="Samui Care home">
      <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden>
        <circle cx="20" cy="20" r="20" className={light ? "fill-white/15" : "fill-sea-700"} />
        <path d="M20 9c5 6 8 10 8 14a8 8 0 0 1-16 0c0-4 3-8 8-14z" className="fill-sand-200" />
        <path d="M16.5 24.5c1 2 2.3 3 4.5 3.3" stroke="#0f6a60" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
      <span className={`font-display text-xl font-semibold ${light ? "text-white" : "text-sea-900"}`}>
        Samui <span className={light ? "text-sand-200" : "text-sea-600"}>Care</span>
      </span>
    </Link>
  );
}

const nav = [
  ["Services", "/services"],
  ["Pricing", "/pricing"],
  ["Areas", "/areas"],
  ["How it works", "/how-it-works"],
  ["FAQ", "/faq"],
  ["About", "/about"],
  ["Contact", "/contact"],
] as const;

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);
  const onBook = pathname.startsWith("/book");

  return (
    <div className="flex min-h-screen flex-col">
      {DEMO && (
        <div className="bg-sand-200 py-1.5 text-center text-xs font-medium text-sea-900">
          Preview mode — bookings aren't saved yet.
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-sand-100 bg-sand-50/90 backdrop-blur">
        <div className="container-x flex h-16 items-center justify-between">
          <Logo />
          <nav className="hidden items-center gap-6 lg:flex">
            {nav.map(([label, to]) => (
              <NavLink key={to} to={to} className={({ isActive }) => `text-sm font-medium transition hover:text-sea-700 ${isActive ? "text-sea-700" : "text-ink/75"}`}>
                {label}
              </NavLink>
            ))}
            <Link to="/book" className="btn-primary !py-2.5 !px-5 text-sm">Get an instant price</Link>
          </nav>
          <button className="rounded-full p-2 lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <nav className="container-x grid gap-1 pb-4 lg:hidden">
            {nav.map(([label, to]) => (
              <NavLink key={to} to={to} className="rounded-xl px-3 py-3 font-medium hover:bg-sea-50">{label}</NavLink>
            ))}
            <Link to="/book" className="btn-primary mt-2">Get an instant price</Link>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-24 bg-sea-950 text-sea-100">
        <div className="container-x grid gap-10 py-14 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo light />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-sea-100/70">
              Reliable, fairly priced cleaning for villas, homes and condos across all of Koh Samui.
              Instant prices, real availability, book in under two minutes.
            </p>
          </div>
          <div>
            <h4 className="mb-3 font-sans text-sm font-bold uppercase tracking-wider text-sand-200">Explore</h4>
            <ul className="space-y-2 text-sm">
              {nav.map(([label, to]) => <li key={to}><Link className="hover:text-white" to={to}>{label}</Link></li>)}
            </ul>
          </div>
          <div>
            <h4 className="mb-3 font-sans text-sm font-bold uppercase tracking-wider text-sand-200">Get in touch</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2"><MessageCircle size={16} /> LINE {B.line_id}</li>
              <li className="flex items-center gap-2"><Phone size={16} /> {B.phone}</li>
              <li className="flex items-center gap-2"><Mail size={16} /> {B.email}</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-sea-100/50">
          © {new Date().getFullYear()} Samui Care · Koh Samui, Thailand
        </div>
      </footer>

      {!onBook && (
        <Link to="/book" className="btn fixed bottom-5 right-5 z-50 bg-coral text-white shadow-soft hover:brightness-105">
          <Sparkles size={18} /> Book a clean
        </Link>
      )}
    </div>
  );
}
