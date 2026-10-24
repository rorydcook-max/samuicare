import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { loadConfig, submitRequest } from "../lib/api";
import { DEFAULT_CONFIG, type AppConfig } from "../lib/config";

export function useConfig(): AppConfig {
  const [cfg, setCfg] = useState<AppConfig>(DEFAULT_CONFIG);
  useEffect(() => { loadConfig().then(setCfg); }, []);
  return cfg;
}

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="container-x pb-10 pt-14 sm:pt-20">
      <h1 className="max-w-3xl text-4xl font-bold tracking-[-0.03em] sm:text-5xl">{title}</h1>
      {children && <div className="mt-4 max-w-2xl text-lg leading-relaxed text-ink/70">{children}</div>}
    </section>
  );
}

export function BookBand() {
  return (
    <section className="container-x mt-24">
      <div className="flex flex-col items-start justify-between gap-6 border-t-2 border-ink pt-8 sm:flex-row sm:items-center">
        <p className="text-2xl font-semibold tracking-tight sm:text-3xl">See your price and book a time in about a minute.</p>
        <Link to="/book" className="btn-primary shrink-0">Get my price</Link>
      </div>
    </section>
  );
}

type Field = { name: string; label: string; type?: string; textarea?: boolean; required?: boolean; options?: string[] };

export function RequestForm({ kind, fields, submitLabel, doneText }: {
  kind: "interest" | "contact";
  fields: Field[];
  submitLabel: string;
  doneText: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  if (state === "done") return <p className="rounded-lg bg-sea-50 p-5 font-medium text-sea-800" role="status">{doneText}</p>;
  const set = (k: string, v: string) => setValues({ ...values, [k]: v });
  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        try { await submitRequest(kind, values); setState("done"); } catch { setState("error"); }
      }}
    >
      {fields.map((f) => (
        <label key={f.name} className="block">
          <span className="label">{f.label}{!f.required && <span className="font-normal text-ink/50"> (optional)</span>}</span>
          {f.options ? (
            <select className="field" required={f.required} value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)}>
              <option value="">Choose</option>
              {f.options.map((o) => <option key={o}>{o}</option>)}
            </select>
          ) : f.textarea ? (
            <textarea className="field min-h-28" required={f.required} value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} />
          ) : (
            <input className="field" type={f.type ?? "text"} required={f.required} value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} />
          )}
        </label>
      ))}
      {state === "error" && <p className="text-sm text-coral">That didn't send. Check your connection and try again, or message us on LINE.</p>}
      <button className="btn-primary justify-self-start" disabled={state === "sending"}>{state === "sending" ? "Sending" : submitLabel}</button>
    </form>
  );
}
