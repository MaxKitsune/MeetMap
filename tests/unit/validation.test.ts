import { describe, it, expect } from "vitest";
import { personSchema, memorySchema, placeSchema } from "../../lib/validation";
import { fuzzyMatch, birthdayIn } from "../../lib/utils";
describe("validated private data", () => {
  it("rejects script URLs in person profiles", () => {
    expect(
      personSchema.safeParse({
        name: "Test",
        contextUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });
  it("rejects impossible calendar dates and reversed spans", () => {
    expect(
      personSchema.safeParse({ name: "Test", birthday: "2025-02-30" }).success,
    ).toBe(false);
    expect(
      memorySchema.safeParse({
        title: "Test",
        startAt: "2026-08-15",
        endAt: "2026-08-01",
      }).success,
    ).toBe(false);
  });
  it("does not accept ownerIds from clients", () => {
    const p = personSchema.parse({ name: "Test", ownerId: "attacker" });
    expect(p).not.toHaveProperty("ownerId");
  });
  it("requires finite geographic coordinates", () => {
    expect(
      placeSchema.safeParse({ name: "Test", latitude: NaN, longitude: 11 })
        .success,
    ).toBe(false);
    expect(
      placeSchema.safeParse({ name: "Test", latitude: 88, longitude: 11 })
        .success,
    ).toBe(false);
  });
  it("finds typos and accent-insensitive names", () => {
    expect(fuzzyMatch("Lena Fischer", "Ficher")).toBe(true);
    expect(fuzzyMatch("München", "munchen")).toBe(true);
    expect(fuzzyMatch("Lena", "xyz")).toBe(false);
  });
  it("handles birthdays across a year boundary", () => {
    expect(birthdayIn("1990-01-02", new Date(2026, 11, 30))).toBe(3);
  });
});
