export type EventType = "event" | "birthday" | "countdown" | "task";

export interface CalendarEvent {
  id: string;
  title: string;
  notes: string | null;
  location: string | null;
  type: EventType;
  categoryId: string | null;
  /** Timed events: epoch ms. Null for all-day. */
  startAt: number | null;
  endAt: number | null;
  allDay: boolean;
  /** All-day: local 'YYYY-MM-DD' start date. */
  dtstartDate: string | null;
  /** All-day duration in days (>=1). */
  durationDays: number;
  /** RRULE string, e.g. 'FREQ=WEEKLY;BYDAY=MO,WE'. Null = one-off. */
  recurrence: string | null;
  /** Recurrence end 'YYYY-MM-DD' or null. */
  recUntil: string | null;
  /** Tasks: completion epoch ms or null. */
  completedAt: number | null;
  /** Minutes before start: e.g. [30, 1440]. */
  reminders: number[];
  /** Countdown target 'YYYY-MM-DD'. */
  targetDate: string | null;
  /** ICS UID for dedupe on import. */
  uid: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
  colorKey: string;
  icon: string;
  sortOrder: number;
}

export interface Occurrence {
  instanceId: string;
  event: CalendarEvent;
  /** Local date this occurrence lands on. */
  date: string;
  /** Wall-clock start (local midnight for all-day). */
  start: Date;
  end: Date;
  isAllDay: boolean;
  isStart: boolean;
  spanDays: number;
  /** Countdown only. */
  daysRemaining?: number;
}

export interface AppSettings {
  themeMode: "system" | "light" | "dark";
  soundsOn: boolean;
  hapticsOn: boolean;
  use24h: boolean;
  weekStartsOn: 0 | 1;
  defaultReminders: number[];
  defaultCategoryId: string | null;
  lastView: "day" | "week" | "month" | "year";
  batterySetupDone: boolean;
  scheduledNotificationIds: string[];
}
