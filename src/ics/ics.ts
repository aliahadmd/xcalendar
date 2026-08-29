import ICAL from "ical.js";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { getEvents, importEvents, getCategories } from "@/db/repo";
import type { CalendarEvent, Category } from "@/db/types";
import { toLocalDateStr, todayStr, diffDateStr, addDateStr } from "@/utils/date";

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toIcsLocal(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function toIcsDate(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function toIcsDateStr(s: string): string {
  return s.replace(/-/g, "");
}

/** Add a property with optional IANA params (2-arg addPropertyWithValue is not typed for params). */
function addProp(
  comp: ICAL.Component,
  name: string,
  value: string,
  params?: Record<string, string>,
): void {
  const p = new ICAL.Property(name);
  if (params) {
    for (const [k, v] of Object.entries(params)) p.setParameter(k, v);
  }
  p.setValue(value);
  comp.addProperty(p);
}

/** Export the whole calendar to an .ics file and open the share sheet. */
export async function exportIcs(): Promise<void> {
  const events = await getEvents();
  const cal = new ICAL.Component(["vcalendar", [], []]);
  cal.addPropertyWithValue("prodid", "-//XCalendar//Export 1.0//EN");
  cal.addPropertyWithValue("version", "2.0");
  cal.addPropertyWithValue("calscale", "GREGORIAN");

  const stamp = new Date();
  for (const event of events) {
    const vevent = new ICAL.Component("vevent");
    // Deterministic fallback UID: repeated exports of the same event dedupe on import.
    vevent.addPropertyWithValue("uid", event.uid ?? `${event.id}@xcalendar`);
    vevent.addPropertyWithValue("dtstamp", toIcsLocal(stamp));
    vevent.addPropertyWithValue("summary", event.title || "(untitled)");
    if (event.notes) vevent.addPropertyWithValue("description", event.notes);
    if (event.location) vevent.addPropertyWithValue("location", event.location);

    if (event.type === "countdown" && event.targetDate) {
      addProp(vevent, "dtstart", toIcsDateStr(event.targetDate), { value: "date" });
      addProp(vevent, "x-type", "COUNTDOWN");
    } else if (event.allDay && event.dtstartDate) {
      addProp(vevent, "dtstart", toIcsDateStr(event.dtstartDate), { value: "date" });
      addProp(vevent, "dtend", toIcsDateStr(addDateStr(event.dtstartDate, event.durationDays)), { value: "date" });
    } else if (event.startAt != null) {
      vevent.addPropertyWithValue("dtstart", toIcsLocal(new Date(event.startAt)));
      if (event.endAt != null) {
        vevent.addPropertyWithValue("dtend", toIcsLocal(new Date(event.endAt)));
      }
    }

    if (event.recurrence) {
      let rrule = event.recurrence;
      if (event.recUntil && !/UNTIL/i.test(rrule)) {
        const [y, m, d] = event.recUntil.split("-");
        rrule += `;UNTIL=${y}${m}${d}T235959`;
      }
      vevent.addPropertyWithValue("rrule", rrule);
    }

    if (event.type === "task") {
      if (event.completedAt) {
        vevent.addPropertyWithValue("status", "COMPLETED");
      }
      vevent.addPropertyWithValue("x-type", "TASK");
    } else if (event.type === "birthday") {
      vevent.addPropertyWithValue("x-type", "BIRTHDAY");
    } else if (event.type === "countdown") {
      vevent.addPropertyWithValue("x-type", "COUNTDOWN");
    }

    if (event.reminders.length > 0) {
      for (const minutes of event.reminders) {
        const alarm = new ICAL.Component("valarm");
        alarm.addPropertyWithValue("action", "DISPLAY");
        alarm.addPropertyWithValue("description", event.title || "Reminder");
        alarm.addPropertyWithValue("trigger", `-PT${minutes}M`);
        vevent.addSubcomponent(alarm);
      }
    }

    cal.addSubcomponent(vevent);
  }

  const ics = cal.toString();
  const fileUri = `${FileSystem.cacheDirectory}xcalendar-${todayStr()}.ics`;
  await FileSystem.writeAsStringAsync(fileUri, ics, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: "text/calendar",
      dialogTitle: "Export calendar",
    });
  }
}

const DURATION_RE = /([+-]?)P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/;

function parseIcsDurationSeconds(raw: string): { seconds: number; negative: boolean } | null {
  const m = DURATION_RE.exec(raw.trim().toUpperCase());
  if (!m) return null;
  const [, sign, w, d, h, mi, s] = m;
  if (!w && !d && !h && !mi && !s) return null;
  const total =
    Number(w ?? 0) * 7 * 86400 +
    Number(d ?? 0) * 86400 +
    Number(h ?? 0) * 3600 +
    Number(mi ?? 0) * 60 +
    Number(s ?? 0);
  return { seconds: total, negative: sign === "-" };
}

interface ParsedEvent {
  event: CalendarEvent;
}

/** Pick an .ics file, parse it, and merge into the database (UID dedupe). */
export async function importIcs(): Promise<{ inserted: number; skipped: number }> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["text/calendar", "application/octet-stream", "*/*"],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) {
    throw new Error("cancelled");
  }
  const asset = result.assets[0];
  const content = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const parsed = ICAL.parse(content);
  const comp = new ICAL.Component(parsed);
  const categories = await getCategories();
  const now = Date.now();

  const toImport: CalendarEvent[] = [];

  const mapComponent = (vevent: ICAL.Component, isTodo: boolean) => {
    try {
      const summary = vevent.getFirstPropertyValue("summary") ?? "(untitled)";
      const description = vevent.getFirstPropertyValue("description") ?? null;
      const location = vevent.getFirstPropertyValue("location") ?? null;
      const uidProp = vevent.getFirstProperty("uid");
      const uid = uidProp ? String(uidProp.getFirstValue()) : null;

      const dtstartProp = vevent.getFirstProperty("dtstart");
      let dtstartVal: any = dtstartProp ? dtstartProp.getFirstValue() : null;

      const event: CalendarEvent = {
        id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
        title: String(summary),
        notes: description ? String(description) : null,
        location: location ? String(location) : null,
        type: "event",
        categoryId: null,
        startAt: null,
        endAt: null,
        allDay: false,
        dtstartDate: null,
        durationDays: 1,
        recurrence: null,
        recUntil: null,
        completedAt: null,
        reminders: [],
        targetDate: null,
        uid,
        createdAt: now,
        updatedAt: now,
      };

      const status = vevent.getFirstPropertyValue("status");
      const completedProp = vevent.getFirstPropertyValue("completed");
      if (isTodo) {
        event.type = "task";
        if (status === "COMPLETED" || completedProp) {
          event.completedAt = completedProp ? (completedProp as any).toJSDate?.().getTime() ?? now : now;
        }
        if (dtstartVal) {
          event.dtstartDate = toLocalDateStr((dtstartVal as any).toJSDate());
          event.allDay = true;
        }
      } else if (dtstartVal && dtstartProp) {
        const dtAny = dtstartVal as any;
        const isDate = dtAny.isDate === true || (dtstartProp.getParameter("value") === "DATE");
        if (isDate) {
          event.allDay = true;
          event.dtstartDate = toLocalDateStr(dtAny.toJSDate());
        } else {
          const js = dtAny.toJSDate();
          event.startAt = js.getTime();
        }
      }

      // Duration / end
      const durationProp = vevent.getFirstProperty("duration");
      const dtendProp = vevent.getFirstProperty("dtend");
      if (event.allDay && event.dtstartDate) {
        let endStr: string | null = null;
        if (dtendProp) {
          const v = dtendProp.getFirstValue() as any;
          if (v && (v.isDate === true || dtendProp.getParameter("value") === "DATE")) {
            endStr = toLocalDateStr(v.toJSDate());
          }
        }
        if (endStr) {
          event.durationDays = Math.max(1, diffDateStr(endStr, event.dtstartDate));
        }
      } else if (durationProp) {
        const raw = String(durationProp.getFirstValue());
        const parsed = parseIcsDurationSeconds(raw);
        if (parsed && parsed.seconds > 0 && event.startAt != null) {
          event.endAt = event.startAt + parsed.seconds * 1000;
        }
      } else if (dtendProp && event.startAt != null) {
        const v = dtendProp.getFirstValue() as any;
        if (v && v.toJSDate) {
          const end = v.toJSDate().getTime();
          if (end > event.startAt) event.endAt = end;
        }
      }

      // Recurrence
      const rruleProp = vevent.getFirstProperty("rrule");
      if (rruleProp) {
        const v = rruleProp.getFirstValue();
        const parts: string[] = [];
        const f = (v as any).freq;
        if (f) parts.push(`FREQ=${f.toUpperCase()}`);
        if ((v as any).interval && (v as any).interval > 1) parts.push(`INTERVAL=${(v as any).interval}`);
        if ((v as any).parts?.BYDAY) {
          parts.push(`BYDAY=${(v as any).parts.BYDAY.join(",")}`);
        }
        if ((v as any).parts?.BYMONTHDAY) {
          parts.push(`BYMONTHDAY=${(v as any).parts.BYMONTHDAY.join(",")}`);
        }
        event.recurrence = parts.length > 0 ? parts.join(";") : "FREQ=DAILY";
        if ((v as any).until) {
          const until = (v as any).until;
          const jsDate = until.toJSDate ? until.toJSDate() : null;
          if (jsDate) event.recUntil = toLocalDateStr(jsDate);
        }
      }

      // Reminders from VALARMs
      const alarms = vevent.getAllSubcomponents("valarm");
      for (const alarm of alarms) {
        const triggerProp = alarm.getFirstProperty("trigger");
        if (!triggerProp) continue;
        const raw = String(triggerProp.getFirstValue());
        const parsed = parseIcsDurationSeconds(raw);
        if (!parsed) continue;
        if (!parsed.negative && parsed.seconds > 0) continue; // fires after the event — not a reminder
        const minutes = Math.round(parsed.seconds / 60);
        if (minutes >= 0 && minutes <= 10080 && !event.reminders.includes(minutes)) {
          event.reminders.push(minutes);
        }
      }

      // Type & category mapping
      const cats = vevent.getFirstPropertyValue("categories");
      const catNames: string[] = [];
      if (cats) {
        for (const c of Array.isArray(cats) ? cats : [cats]) {
          catNames.push(String(c).toLowerCase());
        }
      }
      const matchCategory = (name: string): Category | undefined =>
        categories.find((c) => c.name.toLowerCase() === name);
      for (const name of catNames) {
        const match = matchCategory(name);
        if (match) {
          event.categoryId = match.id;
          break;
        }
      }
      if (catNames.some((c) => c.includes("birthday"))) {
        event.type = "birthday";
        if (!event.recurrence) event.recurrence = "FREQ=YEARLY";
        event.allDay = true;
        if (!event.dtstartDate && event.startAt != null) {
          event.dtstartDate = toLocalDateStr(new Date(event.startAt));
          event.startAt = null;
          event.endAt = null;
        }
      }
      const xType = vevent.getFirstPropertyValue("x-type");
      if (xType) {
        const t = String(xType).toLowerCase();
        if (t === "task") event.type = "task";
        else if (t === "birthday") event.type = "birthday";
        else if (t === "countdown") {
          event.type = "countdown";
          event.targetDate = event.dtstartDate ?? event.targetDate;
        }
      }

      toImport.push(event);
    } catch {
      // skip malformed component
    }
  };

  for (const vevent of comp.getAllSubcomponents("vevent")) {
    mapComponent(vevent, false);
  }
  for (const vtodo of comp.getAllSubcomponents("vtodo")) {
    mapComponent(vtodo, true);
  }

  if (toImport.length === 0) return { inserted: 0, skipped: 0 };
  return importEvents(toImport);
}
