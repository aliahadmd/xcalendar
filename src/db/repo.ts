import { openDb } from "./client";
import type { CalendarEvent, Category, EventType } from "./types";
import { notifyDataChanged } from "./changes";
import type { DateStr } from "@/utils/date";
import { todayStr } from "@/utils/date";

const DEFAULT_CATEGORIES: Omit<Category, "id">[] & { id: string }[] = [
  { id: "personal", name: "Personal", colorKey: "blue", icon: "person-outline", sortOrder: 0 },
  { id: "work", name: "Work", colorKey: "indigo", icon: "briefcase-outline", sortOrder: 1 },
  { id: "study", name: "Study", colorKey: "green", icon: "book-outline", sortOrder: 2 },
  { id: "business", name: "Business", colorKey: "orange", icon: "trending-up-outline", sortOrder: 3 },
  { id: "birthday", name: "Birthday", colorKey: "pink", icon: "gift-outline", sortOrder: 4 },
  { id: "health", name: "Health", colorKey: "red", icon: "heart-outline", sortOrder: 5 },
] as any;

function rowToEvent(row: any): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes ?? null,
    location: row.location ?? null,
    type: row.type as EventType,
    categoryId: row.category_id ?? null,
    startAt: row.start_at ?? null,
    endAt: row.end_at ?? null,
    allDay: row.all_day === 1,
    dtstartDate: row.dtstart_date ?? null,
    durationDays: row.duration_days ?? 1,
    recurrence: row.recurrence ?? null,
    recUntil: row.rec_until ?? null,
    completedAt: row.completed_at ?? null,
    reminders: JSON.parse(row.reminders ?? "[]"),
    targetDate: row.target_date ?? null,
    uid: row.uid ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// In-memory cache: a personal calendar fits comfortably; every view reads from it.
let cache: CalendarEvent[] | null = null;
let categoryCache: Category[] | null = null;

export async function seedIfEmpty(): Promise<void> {
  const db = await openDb();
  const catCount = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) as c FROM categories",
  );
  if ((catCount?.c ?? 0) === 0) {
    for (const c of DEFAULT_CATEGORIES as any[]) {
      await db.runAsync(
        "INSERT OR IGNORE INTO categories (id, name, color_key, icon, sort_order) VALUES (?,?,?,?,?)",
        c.id,
        c.name,
        c.colorKey,
        c.icon,
        c.sortOrder,
      );
    }
  }
}

export async function getCategories(): Promise<Category[]> {
  if (categoryCache) return categoryCache;
  const db = await openDb();
  const rows = await db.getAllAsync<any>(
    "SELECT * FROM categories ORDER BY sort_order",
  );
  categoryCache = rows.map((r) => ({
    id: r.id,
    name: r.name,
    colorKey: r.color_key,
    icon: r.icon,
    sortOrder: r.sort_order,
  }));
  return categoryCache;
}

export async function getCategory(id: string | null): Promise<Category | null> {
  if (!id) return null;
  const cats = await getCategories();
  return cats.find((c) => c.id === id) ?? null;
}

export async function getEvents(): Promise<CalendarEvent[]> {
  if (cache) return cache;
  const db = await openDb();
  const rows = await db.getAllAsync<any>("SELECT * FROM events");
  cache = rows.map(rowToEvent);
  return cache;
}

function invalidate() {
  cache = null;
  categoryCache = null;
  notifyDataChanged();
}

export async function saveEvent(
  event: CalendarEvent,
): Promise<void> {
  const db = await openDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO events
      (id, title, notes, location, type, category_id, start_at, end_at, all_day,
       dtstart_date, duration_days, recurrence, rec_until, completed_at, reminders,
       target_date, uid, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    event.id,
    event.title,
    event.notes,
    event.location,
    event.type,
    event.categoryId,
    event.startAt,
    event.endAt,
    event.allDay ? 1 : 0,
    event.dtstartDate,
    event.durationDays,
    event.recurrence,
    event.recUntil,
    event.completedAt,
    JSON.stringify(event.reminders),
    event.targetDate,
    event.uid,
    event.createdAt,
    event.updatedAt,
  );
  invalidate();
}

export async function setTaskCompleted(
  id: string,
  completedAt: number | null,
): Promise<void> {
  const db = await openDb();
  await db.runAsync(
    "UPDATE events SET completed_at=?, updated_at=? WHERE id=?",
    completedAt,
    Date.now(),
    id,
  );
  invalidate();
}

export async function deleteEvent(id: string): Promise<void> {
  const db = await openDb();
  await db.runAsync("DELETE FROM events WHERE id=?", id);
  invalidate();
}

export async function findEventByUid(uid: string): Promise<CalendarEvent | null> {
  const db = await openDb();
  const row = await db.getFirstAsync<any>(
    "SELECT * FROM events WHERE uid=? LIMIT 1",
    uid,
  );
  return row ? rowToEvent(row) : null;
}

/** Bulk import inside a transaction; skips UIDs already present. */
export async function importEvents(
  events: CalendarEvent[],
): Promise<{ inserted: number; skipped: number }> {
  const db = await openDb();
  let inserted = 0;
  let skipped = 0;
  await db.withTransactionAsync(async () => {
    for (const event of events) {
      if (event.uid) {
        const existing = await db.getFirstAsync<{ id: string }>(
          "SELECT id FROM events WHERE uid=? LIMIT 1",
          event.uid,
        );
        if (existing) {
          skipped++;
          continue;
        }
      }
      await db.runAsync(
        `INSERT OR REPLACE INTO events
          (id, title, notes, location, type, category_id, start_at, end_at, all_day,
           dtstart_date, duration_days, recurrence, rec_until, completed_at, reminders,
           target_date, uid, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        event.id,
        event.title,
        event.notes,
        event.location,
        event.type,
        event.categoryId,
        event.startAt,
        event.endAt,
        event.allDay ? 1 : 0,
        event.dtstartDate,
        event.durationDays,
        event.recurrence,
        event.recUntil,
        event.completedAt,
        JSON.stringify(event.reminders),
        event.targetDate,
        event.uid,
        event.createdAt,
        event.updatedAt,
      );
      inserted++;
    }
  });
  invalidate();
  return { inserted, skipped };
}

/** Tasks due on or before `date` that are not completed. */
export async function getOverdueTasks(
  date: DateStr,
): Promise<CalendarEvent[]> {
  const all = await getEvents();
  return all.filter(
    (e) =>
      e.type === "task" &&
      !e.completedAt &&
      e.dtstartDate &&
      e.dtstartDate < date,
  );
}

export async function getUpcomingCountdowns(): Promise<CalendarEvent[]> {
  const all = await getEvents();
  const t = todayStr();
  return all
    .filter((e) => e.type === "countdown" && e.targetDate && e.targetDate >= t)
    .sort((a, b) => (a.targetDate! < b.targetDate! ? -1 : 1));
}

export function newEventId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultEvent(type: EventType): CalendarEvent {
  const now = Date.now();
  return {
    id: newEventId(),
    title: "",
    notes: null,
    location: null,
    type,
    categoryId: null,
    startAt: null,
    endAt: null,
    allDay: true,
    dtstartDate: todayStr(),
    durationDays: 1,
    recurrence: null,
    recUntil: null,
    completedAt: null,
    reminders: [],
    targetDate: todayStr(),
    uid: null,
    createdAt: now,
    updatedAt: now,
  };
}
