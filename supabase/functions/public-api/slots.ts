// Pure availability engine. All business times are Asia/Bangkok (UTC+7, no DST).
// Ported from the tested Lovable version. Keep supabase/functions/public-api/slots.ts in sync (npm run sync).
export const TZ_OFFSET_MIN = 7 * 60;

export interface StaffAvail {
  id: string;
  working_days: number[]; // 0=Sun … 6=Sat
  start_window_start: string; // "09:30" or "09:30:00"
  start_window_end: string;
  active: boolean;
}
export interface BusyJob {
  id?: string;
  staff_id: string | null;
  start_at: string;
  duration_min: number;
}
export interface SchedulingSettings {
  slot_interval: number;
  travel_buffer: number;
  min_notice_hours: number;
  max_days_ahead: number;
}
export interface Slot {
  time: string; // "09:30" Bangkok
  startAt: string; // ISO UTC
  staffIds: string[];
}
export interface DaySlots {
  date: string;
  slots: Slot[];
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const pad = (n: number) => String(n).padStart(2, "0");

/** UTC Date for a Bangkok wall-clock date + minutes since midnight. */
export function bangkokToUtc(date: string, minutes: number): Date {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 0, minutes) - TZ_OFFSET_MIN * 60000);
}
/** Bangkok YYYY-MM-DD for a UTC instant. */
export function bangkokDate(d: Date): string {
  const b = new Date(d.getTime() + TZ_OFFSET_MIN * 60000);
  return `${b.getUTCFullYear()}-${pad(b.getUTCMonth() + 1)}-${pad(b.getUTCDate())}`;
}
export function bangkokTime(d: Date): string {
  const b = new Date(d.getTime() + TZ_OFFSET_MIN * 60000);
  return `${pad(b.getUTCHours())}:${pad(b.getUTCMinutes())}`;
}
export function weekdayOf(date: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}
export function addDays(date: string, n: number): string {
  const [y, mo, d] = date.split("-").map(Number);
  const x = new Date(Date.UTC(y, mo - 1, d + n));
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}

export function isStaffFree(
  staffId: string, start: Date, durationMin: number, jobs: BusyJob[], bufferMin: number, ignoreId?: string,
): boolean {
  const s = start.getTime();
  const e = s + (durationMin + bufferMin) * 60000;
  return !jobs.some((j) => {
    if (j.staff_id !== staffId || (ignoreId && j.id === ignoreId)) return false;
    const js = new Date(j.start_at).getTime();
    const je = js + (j.duration_min + bufferMin) * 60000;
    return s < je && js < e;
  });
}

export function slotsForDate(
  date: string, durationMin: number, staff: StaffAvail[], jobs: BusyJob[], cfg: SchedulingSettings,
  now: Date, blocked: string[] = [],
): Slot[] {
  if (blocked.includes(date)) return [];
  const earliest = now.getTime() + cfg.min_notice_hours * 3600000;
  const latest = now.getTime() + cfg.max_days_ahead * 86400000;
  const wd = weekdayOf(date);
  const byTime = new Map<number, string[]>();
  for (const st of staff) {
    if (!st.active || !st.working_days.includes(wd)) continue;
    for (let m = toMin(st.start_window_start); m <= toMin(st.start_window_end); m += cfg.slot_interval) {
      const start = bangkokToUtc(date, m);
      if (start.getTime() < earliest || start.getTime() > latest) continue;
      if (!isStaffFree(st.id, start, durationMin, jobs, cfg.travel_buffer)) continue;
      byTime.set(m, [...(byTime.get(m) ?? []), st.id]);
    }
  }
  return [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([m, ids]) => ({
      time: `${pad(Math.floor(m / 60))}:${pad(m % 60)}`,
      startAt: bangkokToUtc(date, m).toISOString(),
      staffIds: ids,
    }));
}

export function availability(
  durationMin: number, staff: StaffAvail[], jobs: BusyJob[], cfg: SchedulingSettings, now: Date,
  blocked: string[] = [],
): DaySlots[] {
  const today = bangkokDate(now);
  const out: DaySlots[] = [];
  for (let i = 0; i <= cfg.max_days_ahead; i++) {
    const date = addDays(today, i);
    out.push({ date, slots: slotsForDate(date, durationMin, staff, jobs, cfg, now, blocked) });
  }
  return out;
}

/** Pick the free staff member with the fewest jobs that day. */
export function pickLeastBusy(staffIds: string[], date: string, jobs: BusyJob[]): string | null {
  if (!staffIds.length) return null;
  const count = (id: string) =>
    jobs.filter((j) => j.staff_id === id && bangkokDate(new Date(j.start_at)) === date).length;
  return [...staffIds].sort((a, b) => count(a) - count(b))[0];
}

export function seriesDates(start: Date, frequency: string, horizonDays = 90): Date[] {
  const step = frequency === "weekly" ? 7 : frequency === "fortnightly" ? 14 : frequency === "monthly" ? 0 : -1;
  const out = [start];
  if (step < 0) return out;
  const end = start.getTime() + horizonDays * 86400000;
  for (let i = 1; ; i++) {
    let d: Date;
    if (step === 0) {
      d = new Date(start);
      d.setUTCMonth(d.getUTCMonth() + i);
    } else d = new Date(start.getTime() + i * step * 86400000);
    if (d.getTime() > end) break;
    out.push(d);
  }
  return out;
}
