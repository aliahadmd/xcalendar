import XCalendarAlarm from "xcalendar-alarm";
import { buildOccurrences } from "@/calendar/expand";
import { getEvents } from "@/db/repo";
import { loadSettings } from "@/db/settings";
import { todayStr, dateStrFromEpoch, format, differenceInCalendarDays } from "@/utils/date";

const HORIZON_DAYS = 7;

function countdownLabel(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 1) return "Starting now";
  if (min < 60) return `in ${min} min`;
  if (min < 1440) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
  }
  return `in ${Math.floor(min / 1440)}d`;
}

/**
 * Route C1: keep the next upcoming event on the native Super Island via a
 * persistent focus notification. Custom content normally requires Xiaomi's
 * focus-notification whitelist; the native side applies the XMSF network
 * workaround through Shizuku (no root) to render anyway.
 *
 * The card shows: label ("Next event"), title, date · time, countdown, and
 * the following event. Refreshed on every app open and data change.
 */
export async function updateIsland(): Promise<void> {
  try {
    if (!XCalendarAlarm.isIslandSupported()) return;

    const settings = await loadSettings();
    const now = Date.now();
    const events = await getEvents();
    const occMap = buildOccurrences(events, {
      startDate: todayStr(),
      endDate: dateStrFromEpoch(now + HORIZON_DAYS * 86400000),
    });

    // All upcoming occurrences in the next 7 days, soonest first.
    const upcoming: { start: number; title: string }[] = [];
    for (const occs of occMap.values()) {
      for (const occ of occs) {
        if (occ.event.type === "task" && occ.event.completedAt) continue;
        const t = occ.start.getTime();
        if (t <= now) continue;
        upcoming.push({ start: t, title: occ.event.title || "Untitled" });
      }
    }
    upcoming.sort((a, b) => a.start - b.start);

    if (upcoming.length === 0) {
      XCalendarAlarm.cancelIsland();
      return;
    }

    const time = (ms: number) => format(new Date(ms), settings.use24h ? "HH:mm" : "h:mm a");
    const next = upcoming[0];
    const after = upcoming[1];

    const days = differenceInCalendarDays(new Date(next.start), new Date());
    const dateLabel =
      days === 0 ? "Today" : days === 1 ? "Tomorrow" : format(new Date(next.start), "EEE, d MMM");

    XCalendarAlarm.postIsland({
      title: next.title,
      subtitle: `${dateLabel} · ${time(next.start)}`,
      content: countdownLabel(next.start - now),
      subContent: after
        ? `Then · ${after.title} · ${time(after.start)}`
        : "Nothing else scheduled",
      extraTitle: "Next event",
      ticker: `${next.title} · ${time(next.start)}`,
      aod: `${next.title} · ${time(next.start)}`,
    });
  } catch {
    // the island is best-effort — never break alarm scheduling
  }
}
