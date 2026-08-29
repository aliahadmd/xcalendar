import { useEffect, useState } from "react";
import type { CalendarEvent, Category, AppSettings } from "@/db/types";
import { getEvents, getCategories } from "@/db/repo";
import { loadSettings, DEFAULT_SETTINGS } from "@/db/settings";
import { onDataChanged } from "@/db/changes";

export function useEvents(): CalendarEvent[] | null {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  useEffect(() => {
    let mounted = true;
    const load = () => {
      getEvents().then((e) => {
        if (mounted) setEvents([...e]);
      });
    };
    load();
    const off = onDataChanged(load);
    return () => {
      mounted = false;
      off();
    };
  }, []);
  return events;
}

export function useCategories(): Category[] {
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    let mounted = true;
    const load = () => {
      getCategories().then((c) => {
        if (mounted) setCategories([...c]);
      });
    };
    load();
    const off = onDataChanged(load);
    return () => {
      mounted = false;
      off();
    };
  }, []);
  return categories;
}

export function useSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    let mounted = true;
    const load = () => {
      loadSettings().then((s) => {
        if (mounted) setSettings({ ...s });
      });
    };
    load();
    const off = onDataChanged(load);
    return () => {
      mounted = false;
      off();
    };
  }, []);
  return settings;
}
