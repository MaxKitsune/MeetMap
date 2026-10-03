import { describe, expect, it } from "vitest";
import { timelineGeometry, timelineTicks } from "../../components/timeline";

describe("dynamic timeline geometry", () => {
  it("fits the available width at 1x and expands the date track at 8x without scaling sticky labels", () => {
    const fit = timelineGeometry(920, 1);
    const enlarged = timelineGeometry(920, 8);
    expect(fit.width).toBe(920);
    expect(enlarged.labelWidth).toBe(fit.labelWidth);
    expect(enlarged.trackWidth).toBe(fit.trackWidth * 8);
    expect(enlarged.width).toBe(fit.labelWidth + fit.available * 8);
  });
  it("provides a real fit on narrow screens and caps zoom", () => {
    const mobile = timelineGeometry(320, 1);
    expect(mobile.width).toBe(320);
    expect(mobile.available).toBeGreaterThan(190);
    expect(timelineGeometry(220, 1).width).toBe(220);
    expect(timelineGeometry(320, 20)).toEqual(timelineGeometry(320, 8));
  });
  it("adds calendar ticks as the same date interval gets more space", () => {
    const start = Date.UTC(2020, 0, 1),
      end = Date.UTC(2026, 11, 31);
    const fit = timelineTicks(start, end, 750);
    const enlarged = timelineTicks(start, end, 6000);
    expect(enlarged.length).toBeGreaterThan(fit.length * 3);
    expect(enlarged.some((tick) => /2026/.test(tick.label))).toBe(true);
    expect(
      enlarged.every(
        (tick) =>
          tick.at >= start &&
          tick.at <= end &&
          tick.left >= 0 &&
          tick.left <= 6000,
      ),
    ).toBe(true);
    for (let index = 1; index < enlarged.length; index++)
      expect(enlarged[index].left - enlarged[index - 1].left).toBeGreaterThan(
        90,
      );
  });
  it("uses slash dates at daily detail and handles empty domains", () => {
    const detailed = timelineTicks(
      Date.UTC(2026, 8, 1),
      Date.UTC(2026, 8, 6),
      1000,
    );
    expect(detailed[0].label).toBe("01/09/2026");
    expect(timelineTicks(0, 0, 800)).toEqual([]);
    expect(timelineTicks(NaN, 1000, 800)).toEqual([]);
  });
});
