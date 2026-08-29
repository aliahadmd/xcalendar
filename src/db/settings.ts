import { openDb } from "./client";
import { notifyDataChanged } from "./changes";
import type { AppSettings } from "./types";

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: "system",
  soundsOn: true,
  hapticsOn: true,
  use24h: false,
  weekStartsOn: 1,
  defaultReminders: [30],
  defaultCategoryId: "personal",
  lastView: "month",
  batterySetupDone: false,
  scheduledNotificationIds: [],
};

type SettingsListener = (s: AppSettings) => void;
const listeners = new Set<SettingsListener>();
let settingsCache: AppSettings | null = null;

/** Synchronous read of last-known settings (null before first load). */
export const settingsRef: { current: AppSettings | null } = {
  get current() {
    return settingsCache;
  },
};

export async function loadSettings(): Promise<AppSettings> {
  if (settingsCache) return settingsCache;
  const db = await openDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    "SELECT * FROM settings",
  );
  const merged: AppSettings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.value);
      (merged as any)[row.key] = parsed;
    } catch {
      // ignore malformed entries
    }
  }
  settingsCache = merged;
  return merged;
}

export async function saveSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
): Promise<void> {
  const db = await openDb();
  await db.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    key,
    JSON.stringify(value),
  );
  if (!settingsCache) await loadSettings();
  else settingsCache = { ...settingsCache, [key]: value };
  notifyDataChanged();
}

export async function updateSettings(
  patch: Partial<AppSettings>,
): Promise<void> {
  for (const [k, v] of Object.entries(patch)) {
    await saveSetting(k as keyof AppSettings, v as any);
  }
}

export function onSettingsChanged(listener: SettingsListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
