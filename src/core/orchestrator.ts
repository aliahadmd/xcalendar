import { onDataChanged } from "@/db/changes";
import { seedIfEmpty } from "@/db/repo";
import { loadSettings } from "@/db/settings";
import { rescheduleAll } from "@/notifications/scheduler";
import { refreshWidgets } from "@/widget/refresh";

let initialized = false;

/** Debounced side-effects on any data change. */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSideEffects() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    rescheduleAll().catch(() => {});
    refreshWidgets().catch(() => {});
  }, 400);
}

export async function initApp(): Promise<void> {
  if (initialized) return;
  initialized = true;
  await seedIfEmpty();
  await loadSettings();
  onDataChanged(scheduleSideEffects);
  try {
    await rescheduleAll();
    await refreshWidgets();
  } catch {
    // alarms may fail before permissions granted; non-fatal
  }
}
