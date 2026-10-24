import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { loadConfig, submitRequest } from "../lib/api";
import { DEFAULT_CONFIG, type AppConfig } from "../lib/config";

export function useConfig(): AppConfig {
  const [cfg, setCfg] = useState<AppConfig>(DEFAULT_CONFIG);
  useEffect(() => { loadConfig().then(setCfg); }, []);
  return cfg;
}

export function PageHero({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-sea-50 to-sand-50">
      <Leaves className="pointer-events-none absolute -right-10 -top-6 w-72 opacity-40" />
      <div className="container-x relative py-16 sm:py-20">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold text-sea-950 sm:text-5xl">{title}</h1>
        {children && <div className="mt-5 max-w-2xl text-lg leading-relaxed text-ink/75">{children}</div>}
      </div>
    </section>
  );
}

export function SectionTitle({ eyebrow, title, center }: { eyebrow: string; title: string; center?: boolean }) {
  return (
    <div className={center ? "text-center" : ""}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold text-sea-950 sm:text-4xl">{title}</h2>
    </div>
  );
}

export function CtaBand() {
  return (
    <section className="container-x mt-20">
      <div className="relative overflow-hidden rounded-[2rem] bg-sea-800 px-6 py-12 text-center text-white sm:px-12">
        <Leaves className="pointer-events-none absolute -left-8 -bottom-10 w-64 opacity-20" />
        <h2 className="relative text-3xl font-semibold sm:text-4xl">Your price in under a minute</h2>
        <p className="relative mx-auto mt-3 max-w-xl text-sea-100">Tell us about your place, see the price and time straight away, and pick a slot that suits you.</p>
        <Link to="/book" className="btn relative mt-7 bg-sand-200 text-sea-950 hover:bg-sand-300">Get an instant price <ArrowRight size={18} /></Link>
      </div>
    </section>
  );
}

export function Leaves({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <g fill="none" stroke="currentColor" className="text-sea-400" strokeWidth="1.5">
        <path d="M100 190C100 120 60 70 10 50c40 0 80 30 90 80" />
        <path d="M100 190c0-80 30-130 90-150-30 20-60 60-70 110" />
        <path d="M100 190c-10-60 0-120 20-170 0 50-5 100-10 140" />
      </g>
      <g className="fill-sea-200/60">
        <path d="M10 50c40 0 80 30 90 80-30-20-70-40-90-80z" />
        <path d="M190 40c-30 20-60 60-70 110 10-40 30-80 70-110z" />
      </g>
    </svg>
  );
}

export function RequestForm({ kind, fields, submitLabel, intro }: {
  kind: "interest" | "contact";
  fields: { name: string; label: string; type?: string; textarea?: boolean; required?: boolean; options?: string[] }[];
  submitLabel: string;
  intro?: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  if (state === "done")
    return (
      <div className="card flex items-start gap-3 p-6">
        <span className="rounded-full bg-sea-100 p-2 text-sea-700"><Check size={18} /></span>
        <div><p className="font-semibold">Thanks — we've got it.</p><p className="text-sm text-ink/70">We'll be in touch shortly on your preferred contact.</p></div>
      </div>
    );
  return (
    <form
      className="card grid gap-4 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        try { await submitRequest(kind, values); setState("done"); } catch { setState("error"); }
      }}
    >
      {intro && <p className="text-sm text-ink/70">{intro}</p>}
      {fields.map((f) => (
        <label key={f.name} className="block">
          <span className="label">{f.label}{f.required && " *"}</span>
          {f.options ? (
            <select className="field" required={f.required} value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}>
              <option value="">Select…</option>
              {f.options.map((o) => <option key={o}>{o}</option>)}
            </select>
          ) : f.textarea ? (
            <textarea className="field min-h-28" required={f.required} value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
          ) : (
            <input className="field" type={f.type ?? "text"} required={f.required} value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
          )}
        </label>
      ))}
      {state === "error" && <p className="text-sm text-red-600">Something went wrong — please try again or message us on LINE.</p>}
      <button className="btn-primary" disabled={state === "sending"}>{state === "sending" ? "Sending…" : submitLabel}</button>
    </form>
  );
}
