import { describe, expect, it } from "vitest";
import { buildOccurrences } from "@/calendar/expand";
import type { CalendarEvent } from "@/db/types";
import { addDays, format, todayStr } from "@/utils/date";

function ev(p: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: "e1",
    title: "Test event",
    notes: null,
    location: null,
    type: "event",
    categoryId: null,
    startAt: null,
    endAt: null,
    allDay: false,
    dtstartDate: null,
    durationDays: 1,
    recurrence: null,
    recUntil: null,
    completedAt: null,
    reminders: [],
    targetDate: null,
    uid: null,
    createdAt: 0,
    updatedAt: 0,
    ...p,
  };
}

const win = (startDate: string, endDate: string) => ({ startDate, endDate });

describe("buildOccurrences", () => {
  it("lands a one-off timed event on its local start date", () => {
    const start = new Date(2026, 8, 15, 10, 0).getTime(); // Sep 15 2026, 10:00 local
    const map = buildOccurrences(
      [ev({ id: "t1", startAt: start, endAt: start + 3600000 })],
      win("2026-09-01", "2026-09-30"),
    );
    const occs = map.get("2026-09-15") ?? [];
    expect(occs).toHaveLength(1);
    expect(occs[0].isAllDay).toBe(false);
    expect(occs[0].start.getTime()).toBe(start);
    expect(occs[0].end.getTime()).toBe(start + 3600000);
  });

  it("spans multi-day all-day events one occurrence per day, isStart only on the first", () => {
    const map = buildOccurrences(
      [ev({ id: "a1", allDay: true, dtstartDate: "2026-09-10", durationDays: 3 })],
      win("2026-09-01", "2026-09-30"),
    );
    expect(map.get("2026-09-10")?.[0].isStart).toBe(true);
    expect(map.get("2026-09-11")?.[0].isStart).toBe(false);
    expect(map.get("2026-09-12")?.[0].isStart).toBe(false);
    expect(map.get("2026-09-13")).toBeUndefined();
  });

  it("expands daily RRULE across the whole window", () => {
    const map = buildOccurrences(
      [ev({ id: "r1", allDay: true, dtstartDate: "2026-09-01", recurrence: "FREQ=DAILY" })],
      win("2026-09-01", "2026-09-05"),
    );
    expect([...map.keys()].sort()).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
    ]);
  });

  it("expands weekly RRULE with a UTC-anchored wall clock (DST-safe round trip)", () => {
    const start = new Date(2026, 2, 2, 9, 30).getTime(); // Mar 2 2026, 09:30 local
    const map = buildOccurrences(
      [ev({ id: "w1", startAt: start, endAt: start + 1800000, recurrence: "FREQ=WEEKLY" })],
      win("2026-03-02", "2026-03-16"),
    );
    // 09:30 local must survive the UTC anchor round trip on every occurrence.
    for (const d of ["2026-03-02", "2026-03-09", "2026-03-16"]) {
      const occ = map.get(d)?.[0];
      expect(occ, d).toBeDefined();
      expect(occ!.start.getHours()).toBe(9);
      expect(occ!.start.getMinutes()).toBe(30);
    }
  });

  it("expands recurring tasks onto each due date (H1 regression)", () => {
    const open = ev({
      id: "rt1",
      type: "task",
      allDay: true,
      dtstartDate: "2026-09-01",
      recurrence: "FREQ=DAILY",
    });
    const map = buildOccurrences([open], win("2026-09-01", "2026-09-04"));
    expect([...map.keys()].sort()).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
    ]);

    // A completed series expands nowhere (completion is series-level).
    const done = ev({ ...open, id: "rt2", completedAt: Date.now() });
    expect(buildOccurrences([done], win("2026-09-01", "2026-09-04")).size).toBe(0);
  });

  it("keeps past-due uncompleted one-off tasks, drops completed past tasks", () => {
    const open = ev({ id: "ot1", type: "task", allDay: true, dtstartDate: "2026-09-05" });
    const map = buildOccurrences([open], win("2026-09-10", "2026-09-20"));
    expect(map.get("2026-09-05")).toHaveLength(1);

    const done = ev({
      id: "ot2",
      type: "task",
      allDay: true,
      dtstartDate: "2026-09-05",
      completedAt: 1,
    });
    expect(buildOccurrences([done], win("2026-09-10", "2026-09-20")).size).toBe(0);
  });

  it("expands countdowns on the target date with daysRemaining", () => {
    const target = format(addDays(new Date(), 5), "yyyy-MM-dd");
    const map = buildOccurrences(
      [ev({ id: "c1", type: "countdown", targetDate: target })],
      win(todayStr(), format(addDays(new Date(), 30), "yyyy-MM-dd")),
    );
    const occ = map.get(target)?.[0];
    expect(occ).toBeDefined();
    expect(occ!.daysRemaining).toBe(5);
  });

  it("sorts all-day occurrences before timed ones on the same day", () => {
    const timed = new Date(2026, 8, 15, 8, 0).getTime(); // 08:00
    const map = buildOccurrences(
      [
        ev({ id: "t1", startAt: timed, endAt: timed + 3600000 }),
        ev({ id: "a1", allDay: true, dtstartDate: "2026-09-15" }),
      ],
      win("2026-09-01", "2026-09-30"),
    );
    const occs = map.get("2026-09-15") ?? [];
    expect(occs).toHaveLength(2);
    expect(occs[0].isAllDay).toBe(true);
    expect(occs[1].isAllDay).toBe(false);
  });
});
