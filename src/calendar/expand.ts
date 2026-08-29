import { RRule } from "rrule";
import type { CalendarEvent, Occurrence } from "@/db/types";
import {
  parseLocalDate,
  toLocalDateStr,
  addDateStr,
  diffDateStr,
  todayStr,
} from "@/utils/date";

const MAX_OCCURRENCES = 500;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Build a UTC-anchored date so rrule keeps the same wall clock across DST. */
function utcAnchor(
  y: number,
  m: number,
  d: number,
  h = 0,
  min = 0,
): Date {
  return new Date(Date.UTC(y, m, d, h, min));
}

function utcAnchorFromLocal(d: Date): Date {
  return utcAnchor(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
  );
}

/** Convert a UTC-anchored rrule result back to the local wall clock. */
function fromUtcAnchor(d: Date): Date {
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
  );
}

function rruleWithDtstart(event: CalendarEvent): RRule | null {
  if (!event.recurrence) return null;
  const anchor = event.allDay
    ? utcAnchorFromLocal(parseLocalDate(event.dtstartDate ?? todayStr()))
    : utcAnchorFromLocal(new Date(event.startAt ?? Date.now()));
  const dtstartLine = `DTSTART:${anchor.getUTCFullYear()}${pad(
    anchor.getUTCMonth() + 1,
  )}${pad(anchor.getUTCDate())}T${pad(anchor.getUTCHours())}${pad(
    anchor.getUTCMinutes(),
  )}00Z`;
  let rruleLine = event.recurrence;
  if (event.recUntil && !/UNTIL/i.test(rruleLine)) {
    const until = parseLocalDate(event.recUntil);
    rruleLine += `;UNTIL=${until.getUTCFullYear()}${pad(
      until.getUTCMonth() + 1,
    )}${pad(until.getUTCDate())}T235959Z`;
  }
  try {
    return RRule.fromString(`${dtstartLine}\nRRULE:${rruleLine}`);
  } catch {
    return null;
  }
}

export interface OccurrenceWindow {
  startDate: string;
  endDate: string; // inclusive
}

/**
 * rrule matches for the window. The end anchor is 23:59 of the end date:
 * anchoring at midnight would drop every timed occurrence on the last day
 * (Day view passes startDate === endDate, so recurring events would vanish).
 */
function ruleMatches(rule: RRule, window: OccurrenceWindow): Date[] {
  const winStart = parseLocalDate(window.startDate);
  const winEnd = parseLocalDate(window.endDate);
  const utcStart = utcAnchorFromLocal(winStart);
  const utcEnd = utcAnchor(
    winEnd.getFullYear(),
    winEnd.getMonth(),
    winEnd.getDate(),
    23,
    59,
  );
  try {
    return rule.between(utcStart, utcEnd, true, () => true);
  } catch {
    return [];
  }
}

/**
 * Expand events into per-day occurrences for [window.startDate, window.endDate].
 * Multi-day all-day events yield one occurrence per covered day.
 */
export function buildOccurrences(
  events: CalendarEvent[],
  window: OccurrenceWindow,
): Map<string, Occurrence[]> {
  const byDate = new Map<string, Occurrence[]>();
  const today = todayStr();

  const push = (occ: Occurrence) => {
    const arr = byDate.get(occ.date);
    if (arr) arr.push(occ);
    else byDate.set(occ.date, [occ]);
  };

  for (const event of events) {
    if (event.type === "task") {
      // Tasks land on their due date.
      if (!event.dtstartDate) continue;
      // Recurring tasks (imported VTODOs — the form doesn't create them):
      // one occurrence per due date. Completion is series-level, and a
      // recurring task is never "overdue" — it simply recurs.
      if (event.recurrence) {
        if (event.completedAt) continue;
        const rule = rruleWithDtstart(event);
        if (!rule) continue;
        const matches = ruleMatches(rule, window);
        for (const m of matches.slice(0, MAX_OCCURRENCES)) {
          const d = toLocalDateStr(fromUtcAnchor(m));
          const s = parseLocalDate(d);
          push({
            instanceId: `${event.id}#${d}`,
            event,
            date: d,
            start: s,
            end: s,
            isAllDay: true,
            isStart: true,
            spanDays: 1,
          });
        }
        continue;
      }
      if (event.dtstartDate > window.endDate) continue;
      // Past-due uncompleted tasks still expand (Today shows them as overdue).
      const due = event.dtstartDate;
      if (due < window.startDate) {
        if (event.completedAt) continue;
      }
      const start = parseLocalDate(due);
      push({
        instanceId: `${event.id}#${due}`,
        event,
        date: due,
        start,
        end: start,
        isAllDay: true,
        isStart: true,
        spanDays: 1,
      });
      continue;
    }

    if (event.type === "countdown") {
      if (!event.targetDate) continue;
      if (event.targetDate < window.startDate || event.targetDate > window.endDate)
        continue;
      const start = parseLocalDate(event.targetDate);
      push({
        instanceId: `${event.id}#${event.targetDate}`,
        event,
        date: event.targetDate,
        start,
        end: start,
        isAllDay: true,
        isStart: true,
        spanDays: 1,
        daysRemaining: diffDateStr(event.targetDate, today),
      });
      continue;
    }

    if (event.recurrence) {
      const rule = rruleWithDtstart(event);
      if (!rule) continue;
      const matches = ruleMatches(rule, window).slice(0, MAX_OCCURRENCES);
      for (const m of matches) {
        const localStart = fromUtcAnchor(m);
        const date = toLocalDateStr(localStart);
        if (event.allDay) {
          const span = Math.max(1, event.durationDays);
          for (let i = 0; i < span; i++) {
            const d = addDateStr(date, i);
            if (d < window.startDate || d > window.endDate) continue;
            const s = parseLocalDate(d);
            push({
              instanceId: `${event.id}#${d}${i > 0 ? `~${i}` : ""}`,
              event,
              date: d,
              start: s,
              end: s,
              isAllDay: true,
              isStart: i === 0,
              spanDays: span,
            });
          }
        } else {
          const dur = (event.endAt ?? event.startAt ?? 0) - (event.startAt ?? 0);
          const start = localStart.getTime();
          push({
            instanceId: `${event.id}#${date}`,
            event,
            date,
            start: localStart,
            end: new Date(start + Math.max(0, dur)),
            isAllDay: false,
            isStart: true,
            spanDays: 1,
          });
        }
      }
      continue;
    }

    // One-off events
    if (event.allDay) {
      if (!event.dtstartDate) continue;
      const span = Math.max(1, event.durationDays);
      for (let i = 0; i < span; i++) {
        const d = addDateStr(event.dtstartDate, i);
        if (d < window.startDate || d > window.endDate) continue;
        const s = parseLocalDate(d);
        push({
          instanceId: `${event.id}#${d}${i > 0 ? `~${i}` : ""}`,
          event,
          date: d,
          start: s,
          end: s,
          isAllDay: true,
          isStart: i === 0,
          spanDays: span,
        });
      }
    } else {
      if (event.startAt == null) continue;
      const start = new Date(event.startAt);
      const date = toLocalDateStr(start);
      if (date < window.startDate || date > window.endDate) continue;
      push({
        instanceId: `${event.id}#${date}`,
        event,
        date,
        start,
        end: event.endAt ? new Date(event.endAt) : start,
        isAllDay: false,
        isStart: true,
        spanDays: 1,
      });
    }
  }

  for (const arr of byDate.values()) {
    arr.sort((a, b) => {
      if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;
      return a.start.getTime() - b.start.getTime();
    });
  }
  return byDate;
}

/** Deduplicate per-day occurrences that belong to the same instance id (spans). */
export function dedupeInstances(occs: Occurrence[]): Occurrence[] {
  const seen = new Set<string>();
  return occs.filter((o) => {
    const key = o.instanceId;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
