import { useMemo } from "react";
import { buildOccurrences, type OccurrenceWindow } from "@/calendar/expand";
import type { Occurrence } from "@/db/types";
import { useEvents } from "./use-data";
import type { DateStr } from "@/utils/date";

/** Memoized per-day occurrence map for the given window. */
export function useOccurrences(
  start: DateStr,
  end: DateStr,
): Map<string, Occurrence[]> | null {
  const events = useEvents();
  return useMemo(() => {
    if (!events) return null;
    const window: OccurrenceWindow = { startDate: start, endDate: end };
    return buildOccurrences(events, window);
  }, [events, start, end]);
}

export function dayOccurrences(
  map: Map<string, Occurrence[]> | null,
  date: DateStr,
): Occurrence[] {
  return map?.get(date) ?? [];
}
