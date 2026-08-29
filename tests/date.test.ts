import { describe, expect, it } from "vitest";
import {
  addDateStr,
  diffDateStr,
  formatTime,
  parseLocalDate,
  toLocalDateStr,
  todayStr,
  weekdayIndex,
} from "@/utils/date";

describe("date utils (local-date-string convention)", () => {
  it("round-trips toLocalDateStr / parseLocalDate at local midnight", () => {
    const d = parseLocalDate("2026-09-15");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(toLocalDateStr(d)).toBe("2026-09-15");
  });

  it("addDateStr crosses month and year boundaries", () => {
    expect(addDateStr("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDateStr("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDateStr("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("diffDateStr counts calendar days, sign included", () => {
    expect(diffDateStr("2026-09-10", "2026-09-10")).toBe(0);
    expect(diffDateStr("2026-09-11", "2026-09-10")).toBe(1);
    expect(diffDateStr("2026-09-10", "2026-09-11")).toBe(-1);
    expect(diffDateStr("2026-10-01", "2026-09-01")).toBe(30);
  });

  it("weekdayIndex shifts for Monday-first weeks", () => {
    const monday = parseLocalDate("2026-09-07"); // a Monday
    const sunday = parseLocalDate("2026-09-06"); // a Sunday
    expect(weekdayIndex(monday, 1)).toBe(0);
    expect(weekdayIndex(sunday, 1)).toBe(6);
    expect(weekdayIndex(sunday, 0)).toBe(0);
    expect(weekdayIndex(monday, 0)).toBe(1);
  });

  it("formatTime honors the 24h setting", () => {
    const ms = new Date(2026, 8, 15, 14, 5).getTime();
    expect(formatTime(ms, true)).toBe("14:05");
    expect(formatTime(ms, false)).toBe("2:05 PM");
  });

  it("todayStr returns a well-formed local date", () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
