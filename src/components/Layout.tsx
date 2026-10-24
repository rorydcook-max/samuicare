import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { DEMO } from "../lib/api";
import { useConfig } from "./ui";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className={`group flex items-baseline gap-1 text-[1.35rem] font-extrabold tracking-[-0.04em] ${light ? "text-white" : "text-ink"}`} aria-label="Samui Care home">
      samui<span className={light ? "text-sea-200" : "text-sea-600"}>care</span>
      <span className="h-2 w-2 translate-y-[-0.1rem] rounded-full bg-sun" aria-hidden />
    </Link>
  );
}

const nav = [
  ["Prices", "/prices"],
  ["Businesses", "/businesses"],
  ["FAQ", "/faq"],
  ["Contact", "/contact"],
] as const;

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { business: b } = useConfig();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [pathname]);
  const onBook = pathname.startsWith("/book");

  return (
    <div className="flex min-h-screen flex-col">
      {DEMO && <div className="bg-sun py-1.5 text-center text-xs font-semibold">Preview mode: bookings aren't saved.</div>}
      <header className="border-b border-sand-200 bg-white">
        <div className="container-x flex h-16 items-center justify-between gap-6">
          <Logo />
          <nav className="hidden items-center gap-7 md:flex">
            {nav.map(([label, to]) => (
              <NavLink key={to} to={to} className={({ isActive }) => `text-[0.95rem] font-medium hover:text-sea-600 ${isActive ? "text-sea-600" : "text-ink/80"}`}>{label}</NavLink>
            ))}
            <Link to="/book" className="btn-primary !py-2.5">Book a clean</Link>
          </nav>
          <button className="-mr-2 p-2 md:hidden" onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <nav className="container-x grid pb-4 md:hidden">
            {nav.map(([label, to]) => <NavLink key={to} to={to} className="border-t border-sand-200 py-3.5 text-lg font-medium">{label}</NavLink>)}
            <Link to="/book" className="btn-primary mt-3">Book a clean</Link>
          </nav>
        )}
      </header>

      <main className="flex-1"><Outlet /></main>

      <footer className="mt-28 bg-ink text-white/80">
        <div className="container-x grid gap-10 py-14 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo light />
            <p className="mt-3 max-w-xs text-[0.95rem] leading-relaxed text-white/60">Home, villa and condo cleaning anywhere on Koh Samui.</p>
          </div>
          <div className="space-y-2 text-[0.95rem]">
            {nav.map(([label, to]) => <Link key={to} to={to} className="block hover:text-white">{label}</Link>)}
          </div>
          <div className="space-y-2 text-[0.95rem]">
            <a className="block hover:text-white" href={`https://line.me/R/ti/p/${encodeURIComponent(b.line_id)}`}>LINE {b.line_id}</a>
            <a className="block hover:text-white" href={`https://wa.me/${b.whatsapp.replace(/\D/g, "")}`}>WhatsApp {b.whatsapp}</a>
            <a className="block hover:text-white" href={`mailto:${b.email}`}>{b.email}</a>
          </div>
        </div>
        <div className="container-x border-t border-white/10 py-5 text-sm text-white/45">© {new Date().getFullYear()} Samui Care, Koh Samui</div>
      </footer>

      {!onBook && (
        <Link to="/book" className="btn fixed bottom-4 right-4 z-50 bg-ink text-white hover:bg-sea-800 md:hidden">Book a clean</Link>
      )}
    </div>
  );
}
