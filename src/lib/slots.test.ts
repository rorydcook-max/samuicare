import { describe, expect, it } from "vitest";
import { slotsForDate, pickLeastBusy, bangkokToUtc, type StaffAvail } from "./slots";

const cfg = { slot_interval: 30, travel_buffer: 30, min_notice_hours: 12, max_days_ahead: 60 };
const staff: StaffAvail[] = [
  { id: "a", working_days: [1, 2, 3, 4, 5, 6], start_window_start: "09:30", start_window_end: "12:00", active: true },
];
const now = new Date("2026-10-24T00:00:00Z"); // Sat 07:00 Bangkok

describe("availability", () => {
  it("offers 30-min start slots 9:30–12:00", () => {
    const s = slotsForDate("2026-10-26", 60, staff, [], cfg, now);
    expect(s.map((x) => x.time)).toEqual(["09:30", "10:00", "10:30", "11:00", "11:30", "12:00"]);
  });
  it("Sunday is off", () => expect(slotsForDate("2026-10-25", 60, staff, [], cfg, now)).toHaveLength(0));
  it("respects 12h minimum notice", () => {
    const late = new Date("2026-10-25T23:00:00Z");
    expect(slotsForDate("2026-10-26", 60, staff, [], cfg, late)).toHaveLength(0);
  });
  it("blocks job duration + 30 min travel buffer", () => {
    const jobs = [{ staff_id: "a", start_at: bangkokToUtc("2026-10-26", 9 * 60 + 30).toISOString(), duration_min: 60 }];
    const s = slotsForDate("2026-10-26", 60, staff, jobs, cfg, now);
    expect(s.map((x) => x.time)).toEqual(["11:00", "11:30", "12:00"]);
  });
  it("blocked dates have no slots", () => expect(slotsForDate("2026-10-26", 60, staff, [], cfg, now, ["2026-10-26"])).toHaveLength(0));
  it("more staff opens more slots and least busy is picked", () => {
    const two = [...staff, { ...staff[0], id: "b" }];
    const jobs = [{ staff_id: "a", start_at: bangkokToUtc("2026-10-26", 9 * 60 + 30).toISOString(), duration_min: 60 }];
    const s = slotsForDate("2026-10-26", 60, two, jobs, cfg, now);
    expect(s[0].time).toBe("09:30");
    expect(pickLeastBusy(["a", "b"], "2026-10-26", jobs)).toBe("b");
  });
});
