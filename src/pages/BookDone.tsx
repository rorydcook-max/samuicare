import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import { getBookingStatus, type BookingStatusInfo } from "../lib/api";
import { formatDuration, formatTHB } from "../lib/pricing";
import { useConfig } from "../components/ui";

/** Where Stripe sends customers back to after paying (or giving up on paying). */
export default function BookDone() {
  const [params] = useSearchParams();
  const ref = params.get("ref") ?? "";
  const cancelled = params.get("paid") === "0";
  const [info, setInfo] = useState<BookingStatusInfo | null>(null);
  const [err, setErr] = useState(false);
  const { business: b } = useConfig();

  useEffect(() => {
    let tries = 0;
    let timer: number | undefined;
    const poll = () => getBookingStatus(ref).then((i) => {
      setInfo(i);
      // Card and PromptPay confirmations can arrive a few seconds after the redirect.
      if (!cancelled && i.paymentStatus === "unpaid" && ++tries < 6) timer = window.setTimeout(poll, 2500);
    }).catch(() => setErr(true));
    poll();
    return () => window.clearTimeout(timer);
  }, [ref, cancelled]);

  const when = info && new Date(info.startAt).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" });
  const paid = info?.paymentStatus === "paid_online";

  return (
    <section className="container-x py-16">
      <div className="mx-auto max-w-xl">
        {err ? (
          <p className="text-lg">We couldn't find booking {ref}. Message us on LINE {b.line_id} and we'll sort it out.</p>
        ) : !info ? <p className="text-ink/60">Checking your booking</p> : (
          <>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sea-600 text-white"><Check size={28} /></span>
            <h1 className="mt-6 text-4xl font-bold tracking-[-0.03em]">You're booked in</h1>
            <p className="mt-3 text-lg text-ink/70">Reference <b className="text-ink">{info.ref}</b></p>
            <dl className="mt-8 divide-y divide-sand-200 border-y border-sand-200 text-lg">
              <div className="flex justify-between gap-4 py-3"><dt className="text-ink/60">When</dt><dd className="text-right">{when}</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt className="text-ink/60">Takes about</dt><dd>{formatDuration(info.minutes)}</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt className="text-ink/60">Price</dt><dd className="tnum font-semibold">{formatTHB(info.total)}</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt className="text-ink/60">Payment</dt><dd>{paid ? "Paid, thank you" : cancelled ? "Not paid yet" : "Confirming payment"}</dd></div>
            </dl>
            {cancelled && !paid && (
              <p className="mt-6 rounded-lg bg-sun/40 p-4">Your time is still booked. You can pay your cleaner in cash on the day, or message us for a payment link.</p>
            )}
            <Link to="/" className="btn-ghost mt-8">Back to the home page</Link>
          </>
        )}
      </div>
    </section>
  );
}
