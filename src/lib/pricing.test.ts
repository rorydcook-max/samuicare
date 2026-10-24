import { describe, expect, it } from "vitest";
import { computeQuote, basePrice, DEFAULT_PRICING as S, DEFAULT_ANCHORS as anchors, type AddonDef } from "./pricing";

const addons: AddonDef[] = [
  { slug: "laundry", name: "Laundry", price: 100, minutes: 30, enabled: true },
  { slug: "ironing", name: "Ironing", price: 0, minutes: 0, enabled: false },
];
const q = (o: Partial<Parameters<typeof computeQuote>[0]>) =>
  computeQuote({ bedrooms: 1, bathrooms: 1, condition: "regular", kids: false, pets: false, addons: [], frequency: "one_time", ...o }, S, anchors, addons);

describe("pricing", () => {
  it("uses Rory's anchor prices", () => {
    expect(basePrice(1, 1, anchors, S)).toBe(500);
    expect(basePrice(2, 1, anchors, S)).toBe(700);
    expect(basePrice(2, 2, anchors, S)).toBe(800);
    expect(basePrice(3, 3, anchors, S)).toBe(1000);
    expect(basePrice(4, 3, anchors, S)).toBe(1200);
  });
  it("adds ฿200 per extra bedroom and ฿100 per extra bathroom from nearest lower anchor", () => {
    expect(basePrice(3, 2, anchors, S)).toBe(1000);
    expect(basePrice(5, 4, anchors, S)).toBe(1500);
  });
  it("1 hour per bedroom, minimum 1 hour", () => {
    expect(q({ bedrooms: 3, bathrooms: 3 }).minutes).toBe(180);
    expect(q({}).minutes).toBe(60);
  });
  it("lived-in ×1.25 on price and time", () => {
    const r = q({ bedrooms: 2, bathrooms: 2, condition: "lived_in" });
    expect(r.total).toBe(1000);
    expect(r.minutes).toBe(150);
  });
  it("heavy ×1.5", () => expect(q({ bedrooms: 2, bathrooms: 2, condition: "heavy" }).total).toBe(1200));
  it("very heavy is a custom quote", () => expect(q({ condition: "very_heavy" }).custom).toBe(true));
  it("kids and pets each add 10%", () => expect(q({ bedrooms: 2, bathrooms: 2, kids: true, pets: true }).total).toBe(960));
  it("laundry add-on ฿100 +30 min, disabled add-ons ignored", () => {
    const r = q({ addons: ["laundry", "ironing"] });
    expect(r.total).toBe(600);
    expect(r.minutes).toBe(90);
  });
  it("weekly 10% discount but never below ฿500 minimum", () => {
    expect(q({ bedrooms: 2, bathrooms: 2, frequency: "weekly" }).total).toBe(720);
    expect(q({ frequency: "weekly" }).total).toBe(500);
  });
});
