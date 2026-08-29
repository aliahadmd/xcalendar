import * as SQLite from "expo-sqlite";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        color_key TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT 'folder-outline',
        sort_order INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        notes TEXT,
        location TEXT,
        type TEXT NOT NULL DEFAULT 'event',
        category_id TEXT,
        start_at INTEGER,
        end_at INTEGER,
        all_day INTEGER NOT NULL DEFAULT 0,
        dtstart_date TEXT,
        duration_days INTEGER NOT NULL DEFAULT 1,
        recurrence TEXT,
        rec_until TEXT,
        completed_at INTEGER,
        reminders TEXT NOT NULL DEFAULT '[]',
        target_date TEXT,
        uid TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_at);
      CREATE INDEX IF NOT EXISTS idx_events_dtstart ON events(dtstart_date);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
      CREATE INDEX IF NOT EXISTS idx_events_uid ON events(uid);

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT
      );
    `,
  },
];

export async function openDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("xcalendar.db");
      await db.execAsync("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
      const { user_version } = await db.getFirstAsync<{ user_version: number }>(
        "PRAGMA user_version",
      ).then((r) => r ?? { user_version: 0 });
      for (const m of MIGRATIONS) {
        if (m.version > user_version) {
          await db.execAsync(m.sql);
          await db.execAsync(`PRAGMA user_version=${m.version};`);
        }
      }
      return db;
    })();
  }
  return dbPromise;
}
