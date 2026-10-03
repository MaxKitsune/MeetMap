import { describe, expect, it } from "vitest";
import { dateInputError, formatDate, parseDateInput } from "../../lib/dates";

describe("uniform calendar dates", () => {
  it("formats full four-digit calendar dates and stored timestamps without locale shifts", () => {
    expect(formatDate("2026-09-12")).toBe("12/09/2026");
    expect(formatDate("2026-03-29T00:00:00.000Z")).toBe("29/03/2026");
    expect(formatDate("2026-10-25T23:00:00.000Z")).toBe("25/10/2026");
    expect(formatDate("2000-01-01T00:00:00+14:00")).toBe("01/01/2000");
    expect(formatDate(null)).toBe("Noch offen");
    expect(formatDate(undefined)).toBe("Noch offen");
    expect(formatDate("")).toBe("Noch offen");
  });
  it("parses day-first input, optional dot separators and native ISO values", () => {
    expect(parseDateInput("12/09/2026")).toBe("2026-09-12");
    expect(parseDateInput(" 1/2/2026 ")).toBe("2026-02-01");
    expect(parseDateInput("01.02.2026")).toBe("2026-02-01");
    expect(parseDateInput("2026-02-01")).toBe("2026-02-01");
    expect(parseDateInput("03/04/2026")).toBe("2026-04-03");
  });
  it("rejects impossible dates, partial edits, ambiguous years and invalid separators", () => {
    for (const input of ["31/02/2026", "31/04/2026", "00/01/2026", "01/13/2026", "01/01/0000", "1/2/26", "12/", "2026-02-30", "12-09-2026", "12/09.2026", "2026-9-12", "2026-09-12T00:00:00Z", ""]) {
      expect(parseDateInput(input), input).toBeNull();
    }
    expect(formatDate("2026-02-30")).toBe("Ungültiges Datum");
  });
  it("uses Gregorian leap years, including century exceptions and early years", () => {
    expect(parseDateInput("29/02/2000")).toBe("2000-02-29");
    expect(parseDateInput("29/02/2024")).toBe("2024-02-29");
    expect(parseDateInput("29/02/1900")).toBeNull();
    expect(parseDateInput("29/02/2100")).toBeNull();
    expect(parseDateInput("01/01/0099")).toBe("0099-01-01");
    expect(formatDate("0001-01-01")).toBe("01/01/0001");
  });
  it("has no DST gap, repeated-hour or month/day locale ambiguity", () => {
    for (const date of ["29/03/2026", "25/10/2026", "08/03/2026", "01/11/2026"]) {
      expect(formatDate(parseDateInput(date))).toBe(date);
    }
  });
  it("validates required input and inclusive min/max ranges with formatted messages", () => {
    expect(dateInputError("")).toBe("");
    expect(dateInputError("", { required: true })).toContain("dd/mm/yyyy");
    expect(dateInputError("12/", {})).toContain("gültiges Datum");
    const rules = { min: "2026-09-10", max: "2026-09-20" };
    expect(dateInputError("10/09/2026", rules)).toBe("");
    expect(dateInputError("20/09/2026", rules)).toBe("");
    expect(dateInputError("09/09/2026", rules)).toContain("10/09/2026");
    expect(dateInputError("21/09/2026", rules)).toContain("20/09/2026");
  });
});
