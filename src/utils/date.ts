import {
  addDays,
  addMonths,
  addYears,
  format,
  parse,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  isSameDay,
  differenceInCalendarDays,
  getHours,
  getMinutes,
  getDaysInMonth,
  getDate,
  getMonth,
  getYear,
  isEqual,
} from "date-fns";

export type DateStr = string; // 'YYYY-MM-DD' local calendar date

export function toLocalDateStr(d: Date): DateStr {
  return format(d, "yyyy-MM-dd");
}

export function parseLocalDate(s: DateStr): Date {
  // Local midnight — never UTC, avoids the classic off-by-one-day bug.
  return parse(s, "yyyy-MM-dd", new Date());
}

export function dateStrFromEpoch(ms: number): DateStr {
  return toLocalDateStr(new Date(ms));
}

export {
  addDays,
  addMonths,
  addYears,
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  isSameDay,
  differenceInCalendarDays,
  getHours,
  getMinutes,
  getDaysInMonth,
  getDate,
  getMonth,
  getYear,
};

export function addDateStr(s: DateStr, days: number): DateStr {
  return toLocalDateStr(addDays(parseLocalDate(s), days));
}

export function diffDateStr(a: DateStr, b: DateStr): number {
  return differenceInCalendarDays(parseLocalDate(a), parseLocalDate(b));
}

export function todayStr(): DateStr {
  return toLocalDateStr(new Date());
}

export function isPastDateStr(s: DateStr): boolean {
  return diffDateStr(s, todayStr()) < 0;
}

/** Sunday-first day index 0..6 → shifted index for any week start. */
export function weekdayIndex(d: Date, weekStartsOn: 0 | 1): number {
  const raw = d.getDay(); // 0=Sun..6=Sat
  return weekStartsOn === 1 ? (raw + 6) % 7 : raw;
}

export function formatTime(ms: number, use24h: boolean): string {
  return format(new Date(ms), use24h ? "HH:mm" : "h:mm a");
}

export function formatTimeRange(
  startMs: number,
  endMs: number | null,
  use24h: boolean,
): string {
  if (!endMs) return formatTime(startMs, use24h);
  const end = format(new Date(endMs), use24h ? "HH:mm" : "h:mm a");
  return `${formatTime(startMs, use24h)} – ${end}`;
}

export function monthTitle(d: Date): string {
  return format(d, "MMMM yyyy");
}

export { isEqual as datesEqual };
