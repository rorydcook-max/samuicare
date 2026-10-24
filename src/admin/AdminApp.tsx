import { useEffect, useState } from "react";
import { NavLink, Route, Routes, Link } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { CalendarDays, Inbox, LayoutGrid, ListChecks, LogOut, Settings as Cog, Users, UserRound } from "lucide-react";
import { supabase } from "../lib/client";
import { Logo } from "../components/Layout";
import Dashboard from "./Dashboard";
import Schedule from "./Schedule";
import Bookings from "./Bookings";
import Leads from "./Leads";
import Customers from "./Customers";
import StaffPage from "./Staff";
import Settings from "./Settings";
import StaffPortal from "./StaffPortal";

type Role = "owner" | "admin" | "staff";

export default function AdminApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [roles, setRoles] = useState<Role[] | null>(null);

  useEffect(() => {
    if (!supabase) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !supabase) { setRoles(null); return; }
    supabase.from("user_roles").select("role").eq("user_id", session.user.id).then(({ data }) => setRoles((data ?? []).map((r) => r.role as Role)));
  }, [session]);

  if (!supabase) return <Center>The database isn't connected in this build.</Center>;
  if (session === undefined || (session && roles === null)) return <Center>Loading</Center>;
  if (!session) return <Login />;
  const isAdmin = roles!.some((r) => r === "owner" || r === "admin");
  if (!isAdmin && roles!.includes("staff")) return <StaffPortal email={session.user.email ?? ""} />;
  if (!isAdmin)
    return (
      <Center>
        <p className="font-semibold">{session.user.email} doesn't have access yet.</p>
        <p className="mt-2 text-ink/65">Ask the owner to add this email as staff, then sign in again.</p>
        <button className="btn-ghost mt-5" onClick={() => supabase!.auth.signOut()}>Sign out</button>
      </Center>
    );
  return <Shell email={session.user.email ?? ""} />;
}

const NAV = [
  ["", "Today", LayoutGrid],
  ["schedule", "Schedule", CalendarDays],
  ["bookings", "Bookings", ListChecks],
  ["leads", "Leads", Inbox],
  ["customers", "Customers", UserRound],
  ["staff", "Staff", Users],
  ["settings", "Settings", Cog],
] as const;

function Shell({ email }: { email: string }) {
  return (
    <div className="min-h-screen bg-sand-50 lg:grid lg:grid-cols-[220px_1fr]">
      <aside className="border-b border-sand-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex h-14 items-center justify-between px-4 lg:h-16 lg:px-5">
          <Logo />
          <Link to="/" className="text-sm text-ink/55 hover:text-ink lg:hidden">View site</Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 lg:flex-col lg:px-3 lg:pb-0">
          {NAV.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === ""} className={({ isActive }) =>
              `flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-[0.95rem] font-medium ${isActive ? "bg-sea-50 text-sea-700" : "text-ink/70 hover:bg-sand-100 hover:text-ink"}`}>
              <Icon size={18} aria-hidden />{label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-sand-200 p-4 text-sm lg:block">
          <p className="truncate text-ink/55">{email}</p>
          <div className="mt-2 flex items-center justify-between">
            <Link to="/" className="text-ink/70 hover:text-ink">View site</Link>
            <button onClick={() => supabase!.auth.signOut()} className="flex items-center gap-1.5 text-ink/70 hover:text-ink"><LogOut size={15} /> Sign out</button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8 lg:py-8">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="schedule" element={<Schedule />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="leads" element={<Leads />} />
          <Route path="customers" element={<Customers />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-sand-50 p-6"><div className="max-w-sm text-center">{children}</div></div>;
}

function Login() {
  const [mode, setMode] = useState<"in" | "up" | "link">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const redirect = `${window.location.origin}/admin`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const a = supabase!.auth;
    const { error } =
      mode === "in" ? await a.signInWithPassword({ email, password })
      : mode === "up" ? await a.signUp({ email, password, options: { emailRedirectTo: redirect } })
      : await a.signInWithOtp({ email, options: { emailRedirectTo: redirect, shouldCreateUser: false } });
    setBusy(false);
    if (error) setMsg({ ok: false, text: error.message });
    else if (mode !== "in") setMsg({ ok: true, text: `Check ${email} for a link to finish signing in.` });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-sand-200 bg-white p-6">
        <Logo />
        <h1 className="mt-6 text-2xl font-bold">{mode === "up" ? "Create your account" : "Sign in to the team area"}</h1>
        {mode === "up" && <p className="mt-2 text-sm text-ink/65">The first account created becomes the owner. Staff use the email the owner added for them.</p>}
        <div className="mt-6 grid gap-4">
          <label><span className="label">Email</span><input className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          {mode !== "link" && (
            <label><span className="label">Password</span><input className="field" type="password" autoComplete={mode === "up" ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          )}
          {msg && <p className={`text-sm ${msg.ok ? "text-sea-700" : "text-coral"}`} role="status">{msg.text}</p>}
          <button className="btn-primary" disabled={busy}>{mode === "in" ? "Sign in" : mode === "up" ? "Create account" : "Email me a sign-in link"}</button>
        </div>
        <div className="mt-5 flex flex-wrap justify-between gap-2 text-sm">
          {mode !== "in" && <button type="button" className="font-semibold text-sea-700" onClick={() => setMode("in")}>Sign in with password</button>}
          {mode !== "link" && <button type="button" className="font-semibold text-sea-700" onClick={() => setMode("link")}>Email me a link instead</button>}
          {mode !== "up" && <button type="button" className="font-semibold text-sea-700" onClick={() => setMode("up")}>Create account</button>}
        </div>
      </form>
    </div>
  );
}
