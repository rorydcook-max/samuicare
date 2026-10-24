import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import type { BookingStatus, PaymentStatus, ContactLike } from "./data";
import { contactLinks, PAYMENT_LABEL, STATUS_LABEL } from "./data";

export function PageHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-2xl font-bold tracking-[-0.02em]">{title}</h1>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

const STATUS_TONE: Record<BookingStatus, string> = {
  booked: "bg-sun text-ink", assigned: "bg-sea-100 text-sea-800", in_progress: "bg-sea-600 text-white",
  completed: "bg-sand-200 text-ink", paid: "bg-sand-200 text-ink", cancelled: "bg-white text-ink/50 line-through border border-sand-300", no_show: "bg-white text-coral border border-coral/40",
};
export const StatusPill = ({ s }: { s: BookingStatus }) => <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[s]}`}>{STATUS_LABEL[s]}</span>;
export const PayPill = ({ s }: { s: PaymentStatus }) => (
  <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${s === "unpaid" ? "border border-coral/40 text-coral" : "bg-sand-100 text-ink/70"}`}>{PAYMENT_LABEL[s]}</span>
);
export const Placeholder = () => <span className="ml-2 rounded bg-sun px-1.5 py-0.5 align-middle text-[0.7rem] font-bold text-ink">placeholder</span>;

export function ContactButtons({ c }: { c: ContactLike }) {
  const links = contactLinks(c);
  if (!links.length) return <span className="text-sm text-ink/50">No contact details</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="rounded-md border border-sand-300 px-3 py-1.5 text-sm font-semibold hover:border-sea-600">{l.label}</a>)}
    </div>
  );
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-ink/40" onClick={onClose} aria-label="Close" />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-white">
        <div className="flex items-center justify-between border-b border-sand-200 px-5 py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="-mr-2 p-2" aria-label="Close"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

export const Field = ({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) => (
  <label className="block"><span className="label">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-ink/55">{hint}</span>}</label>
);

export const Row = ({ k, children }: { k: string; children: ReactNode }) => (
  <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-2"><dt className="text-ink/55">{k}</dt><dd className="min-w-0 break-words">{children}</dd></div>
);

export const Empty = ({ children }: { children: ReactNode }) => <p className="rounded-lg bg-sand-100 px-5 py-8 text-center text-ink/65">{children}</p>;

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string, number?][] }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-sand-100 p-1">
      {options.map(([v, l, n]) => (
        <button key={v} onClick={() => onChange(v)} aria-pressed={value === v}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${value === v ? "bg-white text-ink" : "text-ink/60 hover:text-ink"}`}>
          {l}{n != null && <span className="tnum ml-1.5 text-ink/45">{n}</span>}
        </button>
      ))}
    </div>
  );
}

export const Err = ({ e }: { e: string | null }) => (e ? <p className="rounded-lg bg-coral/10 p-3 text-sm text-coral" role="alert">{e}</p> : null);
