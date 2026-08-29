import type { CalendarEvent, Category, EventType } from "@/db/types";
import { resolveCategoryColor } from "@/theme/colors";
import { todayStr, diffDateStr } from "@/utils/date";

export const TYPE_META: Record<EventType, { label: string; icon: string }> = {
  event: { label: "Event", icon: "calendar-outline" },
  birthday: { label: "Birthday", icon: "gift-outline" },
  countdown: { label: "Countdown", icon: "hourglass-outline" },
  task: { label: "Task", icon: "checkbox-outline" },
};

export function eventColor(event: CalendarEvent, categories: Category[], isDark: boolean): string {
  const cat = categories.find((c) => c.id === event.categoryId);
  if (cat) return resolveCategoryColor(cat.colorKey, isDark);
  const fallback: Record<EventType, string> = {
    event: isDark ? "#0A84FF" : "#007AFF",
    birthday: isDark ? "#FF375F" : "#FF2D55",
    countdown: isDark ? "#5E5CE6" : "#5856D6",
    task: isDark ? "#30D158" : "#34C759",
  };
  return fallback[event.type];
}

export function ageForBirthday(event: CalendarEvent): number | null {
  if (event.type !== "birthday" || !event.dtstartDate) return null;
  const birthYear = parseInt(event.dtstartDate.slice(0, 4), 10);
  if (isNaN(birthYear) || birthYear <= 1900) return null;
  return new Date().getFullYear() - birthYear;
}

export function countdownLabel(event: CalendarEvent): string | null {
  if (event.type !== "countdown" || !event.targetDate) return null;
  const days = diffDateStr(event.targetDate, todayStr());
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 0) return `${Math.abs(days)}d ago`;
  return `${days} days`;
}

export function isTaskOverdue(event: CalendarEvent): boolean {
  return (
    event.type === "task" &&
    !event.completedAt &&
    !!event.dtstartDate &&
    event.dtstartDate < todayStr()
  );
}
