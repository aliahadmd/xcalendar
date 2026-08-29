import { beforeEach, describe, expect, it, vi } from "vitest";
import type { XAlarmItem } from "xcalendar-alarm";

const { scheduleAlarms, getEvents } = vi.hoisted(() => ({
  scheduleAlarms: vi.fn().mockResolvedValue(undefined),
  getEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock("xcalendar-alarm", () => ({
  default: { scheduleAlarms },
}));

vi.mock("@/db/repo", () => ({ getEvents }));

import { rescheduleAll } from "@/notifications/scheduler";
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

/** Local Date N days from now at the given time. */
function at(daysFromNow: number, h: number, m = 0): Date {
  const d = addDays(new Date(), daysFromNow);
  d.setHours(h, m, 0, 0);
  return d;
}

const dateStr = (d: Date) => format(d, "yyyy-MM-dd");

function scheduledItems(): XAlarmItem[] {
  expect(scheduleAlarms).toHaveBeenCalled();
  return scheduleAlarms.mock.calls.at(-1)![0] as XAlarmItem[];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("rescheduleAll / buildFireItems", () => {
  it("anchors all-day reminders at 9:00 local, never midnight (H3)", async () => {
    const tomorrow = dateStr(at(1, 0));
    getEvents.mockResolvedValue([
      ev({ id: "a1", title: "Trip", allDay: true, dtstartDate: tomorrow, reminders: [0, 30] }),
    ]);
    await rescheduleAll();

    const items = scheduledItems();
    expect(items).toHaveLength(2);
    const fireTimes = items.map((i) => i.fireAt).sort((a, b) => a - b);
    const nine = at(1, 9).getTime();
    expect(fireTimes[0]).toBe(nine - 30 * 60000); // 8:30
    expect(fireTimes[1]).toBe(nine); // 9:00
  });

  it("fires only one reminder set per multi-day span, on its start day (H3)", async () => {
    const tomorrow = dateStr(at(1, 0));
    getEvents.mockResolvedValue([
      ev({
        id: "a1",
        title: "Conference",
        allDay: true,
        dtstartDate: tomorrow,
        durationDays: 3,
        reminders: [0],
      }),
    ]);
    await rescheduleAll();

    const items = scheduledItems();
    expect(items).toHaveLength(1);
    expect(items[0].fireAt).toBe(at(1, 9).getTime());
  });

  it("computes timed reminder offsets from the occurrence start", async () => {
    const start = at(1, 10).getTime();
    getEvents.mockResolvedValue([
      ev({ id: "t1", title: "Dentist", startAt: start, endAt: start + 3600000, reminders: [30] }),
    ]);
    await rescheduleAll();

    const items = scheduledItems();
    expect(items).toHaveLength(1);
    expect(items[0].fireAt).toBe(start - 30 * 60000);
    expect(items[0].title).toBe("Dentist");
  });

  it("re-arms alarms when an event's title changes, not only when times move (H4)", async () => {
    const start = at(3, 10).getTime();
    const event = ev({
      id: "t1",
      title: "Dentist",
      startAt: start,
      endAt: start + 3600000,
      reminders: [0],
    });

    getEvents.mockResolvedValue([event]);
    await rescheduleAll();
    expect(scheduleAlarms).toHaveBeenCalledTimes(1);

    // Same data again: no-op reschedule must be skipped.
    await rescheduleAll();
    expect(scheduleAlarms).toHaveBeenCalledTimes(1);

    // Same id and time, new title → must re-arm with fresh content.
    getEvents.mockResolvedValue([{ ...event, title: "Doctor" }]);
    await rescheduleAll();
    expect(scheduleAlarms).toHaveBeenCalledTimes(2);
    expect(scheduledItems()[0].title).toBe("Doctor");
  });

  it("caps the native alarm set at 60 items", async () => {
    const start = at(1, 10).getTime();
    getEvents.mockResolvedValue(
      Array.from({ length: 70 }, (_, i) =>
        ev({ id: `t${i}`, title: `E${i}`, startAt: start, endAt: start + 3600000, reminders: [0] }),
      ),
    );
    await rescheduleAll();
    expect(scheduledItems()).toHaveLength(60);
  });

  it("schedules the countdown morning alarm at 9:00 local", async () => {
    const target = format(addDays(new Date(), 2), "yyyy-MM-dd");
    getEvents.mockResolvedValue([ev({ id: "c1", title: "Launch", type: "countdown", targetDate: target })]);
    await rescheduleAll();

    const items = scheduledItems().filter((i) => i.kind === "countdown");
    expect(items).toHaveLength(1);
    expect(items[0].fireAt).toBe(at(2, 9).getTime());
  });

  it("clears the native alarm set for a completed task (empty payload)", async () => {
    getEvents.mockResolvedValue([
      ev({
        id: "k1",
        type: "task",
        allDay: true,
        dtstartDate: todayStr(),
        completedAt: Date.now(),
        reminders: [0],
      }),
    ]);
    await rescheduleAll();
    // An empty set is still pushed — it atomically clears native alarms.
    expect(scheduledItems()).toHaveLength(0);
  });
});
