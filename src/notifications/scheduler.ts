import type { CalendarEvent } from "@/db/types";
import { buildOccurrences } from "@/calendar/expand";
import { getEvents } from "@/db/repo";
import { dateStrFromEpoch, todayStr, diffDateStr, parseLocalDate } from "@/utils/date";
import XCalendarAlarm, { type XAlarmItem } from "xcalendar-alarm";

const WINDOW_DAYS = 14;
const MAX_SCHEDULED = 60;

interface FireItem {
  fireAt: number;
  eventId: string;
  title: string;
  body: string;
  kind: "reminder" | "countdown";
}

/** All-day reminders anchor at 9:00 local (like countdowns) — never midnight. */
function at9am(date: string): number {
  const d = parseLocalDate(date);
  d.setHours(9, 0, 0, 0);
  return d.getTime();
}

function buildFireItems(events: CalendarEvent[]): FireItem[] {
  const now = Date.now();
  const windowEnd = now + WINDOW_DAYS * 86400000;
  const items: FireItem[] = [];

  const occurrences = buildOccurrences(events, {
    startDate: todayStr(),
    endDate: dateStrFromEpoch(windowEnd),
  });

  for (const [date, occs] of occurrences) {
    for (const occ of occs) {
      const event = occ.event;
      if (event.type === "countdown") {
        if (!occ.isStart) continue;
        // Morning-of alarm at 9:00 local.
        const nine = parseLocalDate(date);
        nine.setHours(9, 0, 0, 0);
        const days = diffDateStr(date, todayStr());
        const when =
          days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
        if (nine.getTime() > now && nine.getTime() <= windowEnd) {
          items.push({
            fireAt: nine.getTime(),
            eventId: event.id,
            title: `⏳ ${event.title}`,
            body: `${when} — countdown reaches zero`,
            kind: "countdown",
          });
        }
        continue;
      }
      if (event.type === "task" && event.completedAt) continue;
      // One reminder set per instance: continuation days of a multi-day span
      // must not each fire their own alarm.
      if (!occ.isStart) continue;
      for (const minutes of event.reminders) {
        const base = occ.isAllDay ? at9am(occ.date) : occ.start.getTime();
        const fireAt = base - minutes * 60000;
        if (fireAt <= now || fireAt > windowEnd) continue;
        const timeLabel = occ.isAllDay ? "All-day event" : "";
        items.push({
          fireAt,
          eventId: event.id,
          title: event.title || "Reminder",
          body: timeLabel || dateStrFromEpoch(fireAt),
          kind: "reminder",
        });
      }
    }
  }

  items.sort((a, b) => a.fireAt - b.fireAt);
  return items.slice(0, MAX_SCHEDULED);
}

let lastSignature = "";

/**
 * Push the next 14 days of reminders into the native alarm pipeline
 * (AlarmManager.setAlarmClock + full-screen alarm screen + HyperIsland).
 * Native side atomically replaces its whole pending set.
 */
export async function rescheduleAll(): Promise<void> {
  try {
    const events = await getEvents();
    const items = buildFireItems(events);
    const alarms: XAlarmItem[] = items.map((item) => ({
      id: `${item.eventId}#${item.fireAt}`,
      fireAt: item.fireAt,
      title: item.title,
      body: item.body,
      kind: item.kind,
    }));
    // Skip no-op reschedules — saving settings after scheduling would re-trigger
    // the data-changed listeners and loop forever.
    // Signature covers content too: editing an event's title/body must re-arm
    // its alarms, not just moving its times.
    const signature = JSON.stringify(alarms);
    if (signature === lastSignature) return;
    lastSignature = signature;
    await XCalendarAlarm.scheduleAlarms(alarms);
  } catch (e) {
    // native module unavailable — non-fatal
  }
}

export async function requestPermissions(): Promise<boolean> {
  const Notifications = await import("expo-notifications");
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}
