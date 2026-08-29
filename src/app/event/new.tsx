import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Switch,
  Platform,
  Pressable,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { ThemedText } from "@/components/themed-text";
import { PressScale } from "@/components/press-scale";
import { useCategories, useSettings } from "@/hooks/use-data";
import { defaultEvent, getEvents, saveEvent, deleteEvent } from "@/db/repo";
import type { CalendarEvent, EventType } from "@/db/types";
import { eventColor } from "@/calendar/display";
import { haptic } from "@/utils/haptics";
import { playSound } from "@/utils/sound";
import { toLocalDateStr, parseLocalDate, todayStr, addDateStr } from "@/utils/date";

const TYPE_OPTIONS: { type: EventType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: "event", label: "Event", icon: "calendar-outline" },
  { type: "task", label: "Task", icon: "checkbox-outline" },
  { type: "birthday", label: "Birthday", icon: "gift-outline" },
  { type: "countdown", label: "Countdown", icon: "hourglass-outline" },
];

const RECURRENCE_OPTIONS = [
  { value: null, label: "None" },
  { value: "FREQ=DAILY", label: "Daily" },
  { value: "FREQ=WEEKLY", label: "Weekly" },
  { value: "FREQ=MONTHLY", label: "Monthly" },
  { value: "FREQ=YEARLY", label: "Yearly" },
];

const REMINDER_OPTIONS = [
  { value: 0, label: "At time" },
  { value: 5, label: "5 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 1440, label: "1 day" },
];

function fmtTime(d: Date, use24h: boolean) {
  return d.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit", hour12: !use24h });
}

export default function EventFormScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; date?: string; startTime?: string; type?: string }>();
  const settings = useSettings();
  const categories = useCategories();

  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    (async () => {
      if (params.id) {
        const all = await getEvents();
        const existing = all.find((e) => e.id === params.id);
        if (existing) {
          setEvent({ ...existing });
          return;
        }
      }
      const fresh = defaultEvent((params.type as EventType) ?? "event");
      const date = params.date ?? todayStr();
      if (fresh.type === "countdown") {
        fresh.targetDate = date;
        fresh.dtstartDate = null;
      } else if ((params.type as EventType) === "birthday") {
        fresh.dtstartDate = date;
        fresh.recurrence = "FREQ=YEARLY";
        fresh.categoryId = "birthday";
      } else {
        fresh.dtstartDate = date;
        fresh.reminders = settings.defaultReminders;
        fresh.categoryId = settings.defaultCategoryId;
      }
      if (params.startTime) {
        const [h, m] = params.startTime.split(":").map(Number);
        const start = parseLocalDate(date);
        start.setHours(h, m, 0, 0);
        fresh.allDay = false;
        fresh.dtstartDate = null;
        fresh.startAt = start.getTime();
        fresh.endAt = start.getTime() + 60 * 60000;
      }
      setEvent(fresh);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, params.date, params.startTime, params.type]);

  const patch = (p: Partial<CalendarEvent>) => setEvent((e) => (e ? { ...e, ...p } : e));

  const isEdit = !!params.id;
  const canSave = !!event && event.title.trim().length > 0;

  const discard = () => {
    haptic("light");
    router.back();
  };

  const save = async () => {
    if (!event || !canSave) return;
    haptic("success");
    playSound("save");
    await saveEvent({ ...event, title: event.title.trim(), updatedAt: Date.now() });
    router.back();
  };

  const remove = async () => {
    if (!event) return;
    haptic("warning");
    playSound("delete");
    await deleteEvent(event.id);
    router.back();
  };

  const changeType = (type: EventType) => {
    if (!event) return;
    haptic("selection");
    playSound("tick");
    if (type === "countdown") {
      patch({ type, targetDate: event.dtstartDate ?? todayStr(), dtstartDate: null, startAt: null, endAt: null, reminders: [] });
    } else if (type === "birthday") {
      patch({ type, allDay: true, dtstartDate: event.dtstartDate ?? todayStr(), startAt: null, endAt: null, recurrence: event.recurrence ?? "FREQ=YEARLY" });
    } else if (type === "task") {
      patch({ type, allDay: true, dtstartDate: event.dtstartDate ?? todayStr(), targetDate: null });
    } else {
      patch({ type, allDay: true, dtstartDate: event.dtstartDate ?? todayStr(), targetDate: null });
    }
  };

  if (!event) return <View style={{ flex: 1, backgroundColor: theme.colors.bgElevated }} />;

  const color = eventColor(event, categories, theme.isDark);
  const startDate = event.allDay ? parseLocalDate(event.dtstartDate ?? todayStr()) : new Date(event.startAt ?? Date.now());
  const endDate = new Date(event.endAt ?? (event.startAt ?? Date.now()) + 3600000);

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: theme.colors.bgElevated }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "",
          headerTransparent: false,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.colors.bgElevated },
          headerTintColor: theme.colors.label,
          headerLeft: () => (
            <PressScale onPress={discard} hapticKind={null} scaleTo={0.92}>
              <ThemedText variant="body" style={{ color: theme.colors.accent }}>
                Cancel
              </ThemedText>
            </PressScale>
          ),
          headerRight: () => (
            <PressScale
              onPress={save}
              hapticKind={null}
              scaleTo={0.92}
              style={{ opacity: canSave ? 1 : 0.4 }}
            >
              <ThemedText variant="headline" style={{ color: theme.colors.accent }}>
                {isEdit ? "Done" : "Add"}
              </ThemedText>
            </PressScale>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        {/* Title */}
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <TextInput
            value={event.title}
            onChangeText={(t) => patch({ title: t })}
            placeholder="Title"
            placeholderTextColor={theme.colors.label3}
            style={[styles.titleInput, { color: theme.colors.label }]}
            autoFocus={!isEdit}
            returnKeyType="done"
          />
        </View>

        {/* Type */}
        <View style={styles.section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {TYPE_OPTIONS.map((t) => {
              const active = event.type === t.type;
              return (
                <Chip
                  key={t.type}
                  active={active}
                  color={active ? theme.colors.accent : undefined}
                  icon={t.icon}
                  label={t.label}
                  onPress={() => changeType(t.type)}
                />
              );
            })}
          </ScrollView>
        </View>

        {/* Category */}
        <View style={styles.section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {categories.map((c) => {
              const active = event.categoryId === c.id;
              return (
                <Chip
                  key={c.id}
                  active={active}
                  color={active ? theme.categoryColor(c.colorKey) : undefined}
                  icon={c.icon as any}
                  label={c.name}
                  onPress={() => {
                    haptic("selection");
                    patch({ categoryId: active ? null : c.id });
                  }}
                />
              );
            })}
          </ScrollView>
        </View>

        {/* Date & time */}
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          {event.type === "countdown" ? (
            <Row
              label="Target date"
              value={event.targetDate ? parseLocalDate(event.targetDate).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : ""}
              onPress={() => setShowDatePicker(true)}
              icon="flag-outline"
            />
          ) : (
            <>
              <RowSwitch
                label="All-day"
                value={event.allDay}
                onChange={(v) => {
                  haptic("selection");
                  if (v) {
                    patch({
                      allDay: true,
                      dtstartDate: event.startAt ? toLocalDateStr(new Date(event.startAt)) : event.dtstartDate ?? todayStr(),
                      startAt: null,
                      endAt: null,
                    });
                  } else {
                    const base = parseLocalDate(event.dtstartDate ?? todayStr());
                    const now = new Date();
                    base.setHours(now.getHours() + 1, 0, 0, 0);
                    patch({ allDay: false, startAt: base.getTime(), endAt: base.getTime() + 3600000 });
                  }
                }}
                icon="sunny-outline"
              />
              <Row
                label="Starts"
                value={
                  event.allDay
                    ? parseLocalDate(event.dtstartDate ?? todayStr()).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
                    : `${startDate.toLocaleDateString("en", { month: "short", day: "numeric" })}, ${fmtTime(startDate, settings.use24h)}`
                }
                onPress={() => setShowDatePicker(true)}
                icon="calendar-outline"
              />
              {!event.allDay && (
                <Row
                  label="Time"
                  value={`${fmtTime(startDate, settings.use24h)} – ${fmtTime(endDate, settings.use24h)}`}
                  onPress={() => setShowStartPicker(true)}
                  icon="time-outline"
                />
              )}
              {event.allDay && event.durationDays > 1 && (
                <Row
                  label="Duration"
                  value={`${event.durationDays} days`}
                  onPress={() => {}}
                  icon="resize-outline"
                />
              )}
            </>
          )}
        </View>

        {/* Recurrence (not for countdown) */}
        {event.type !== "countdown" && (
          <View style={styles.section}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {RECURRENCE_OPTIONS.map((r) => {
                const active = event.recurrence === r.value;
                return (
                  <Chip
                    key={r.label}
                    active={active}
                    color={active ? theme.colors.accent : undefined}
                    icon="repeat-outline"
                    label={r.label}
                    onPress={() => {
                      haptic("selection");
                      patch({ recurrence: r.value });
                    }}
                  />
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Reminders */}
        {event.type !== "countdown" && (
          <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
            <View style={styles.rowStatic}>
              <View style={styles.rowIcon}>
                <Ionicons name="notifications-outline" size={20} color={theme.colors.label2} />
              </View>
              <ThemedText variant="body">Reminders</ThemedText>
            </View>
            <View style={styles.reminderWrap}>
              {REMINDER_OPTIONS.map((r) => {
                const active = event.reminders.includes(r.value);
                return (
                  <Chip
                    key={r.value}
                    active={active}
                    color={active ? theme.colors.accent : undefined}
                    label={r.label}
                    onPress={() => {
                      haptic("selection");
                      patch({
                        reminders: active
                          ? event.reminders.filter((x) => x !== r.value)
                          : [...event.reminders, r.value].sort((a, b) => a - b),
                      });
                    }}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* Notes */}
        <View style={[styles.card, { backgroundColor: theme.colors.card, minHeight: 88 }]}>
          <TextInput
            value={event.notes ?? ""}
            onChangeText={(t) => patch({ notes: t })}
            placeholder="Notes"
            placeholderTextColor={theme.colors.label3}
            style={[styles.notesInput, { color: theme.colors.label }]}
            multiline
            textAlignVertical="top"
          />
        </View>

        {isEdit && (
          <PressScale onPress={remove} hapticKind={null} scaleTo={0.98} containerStyle={{ marginHorizontal: 16, marginTop: 16 }}>
            <View style={[styles.card, { backgroundColor: `${theme.colors.destructive}18`, paddingVertical: 14 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Ionicons name="trash-outline" size={18} color={theme.colors.destructive} />
                <ThemedText variant="body" style={{ color: theme.colors.destructive }}>
                  Delete
                </ThemedText>
              </View>
            </View>
          </PressScale>
        )}
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={event.allDay || event.type === "countdown" ? parseLocalDate(event.dtstartDate ?? event.targetDate ?? todayStr()) : startDate}
          mode="date"
          display={Platform.OS === "android" ? "default" : "compact"}
          onChange={(_, d) => {
            if (Platform.OS === "android") setShowDatePicker(false);
            if (!d) return;
            haptic("selection");
            if (event.type === "countdown") patch({ targetDate: toLocalDateStr(d) });
            else if (event.allDay) patch({ dtstartDate: toLocalDateStr(d) });
            else {
              const s = new Date(event.startAt ?? Date.now());
              s.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
              const dur = (event.endAt ?? s.getTime()) - (event.startAt ?? 0);
              patch({ startAt: s.getTime(), endAt: s.getTime() + dur });
            }
          }}
        />
      )}
      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="time"
          is24Hour={settings.use24h}
          display={Platform.OS === "android" ? "default" : "compact"}
          onChange={(_, d) => {
            if (Platform.OS === "android") setShowStartPicker(false);
            if (!d) return;
            haptic("selection");
            const s = new Date(event.startAt ?? Date.now());
            s.setHours(d.getHours(), d.getMinutes(), 0, 0);
            patch({ startAt: s.getTime(), endAt: s.getTime() + 3600000 });
            setShowEndPicker(true);
          }}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="time"
          is24Hour={settings.use24h}
          display={Platform.OS === "android" ? "default" : "compact"}
          onChange={(_, d) => {
            if (Platform.OS === "android") setShowEndPicker(false);
            if (!d) return;
            haptic("selection");
            const e2 = new Date(d);
            if (e2.getTime() <= (event.startAt ?? 0)) {
              e2.setDate(e2.getDate() + 1);
            }
            patch({ endAt: e2.getTime() });
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function Chip({
  active,
  color,
  onPress,
  icon,
  label,
}: {
  active: boolean;
  color?: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  const theme = useTheme();
  return (
    <PressScale onPress={onPress} hapticKind={null} scaleTo={0.94}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          height: 32,
          borderRadius: 16,
          borderCurve: "continuous",
          backgroundColor: active ? (color ?? theme.colors.accent) : theme.colors.fill,
        }}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={14}
            color={active ? theme.colors.onAccent : theme.colors.label2}
            style={{ marginRight: 6 }}
          />
        )}
        <ThemedText
          variant="subheadline"
          style={{ color: active ? theme.colors.onAccent : theme.colors.label }}
        >
          {label}
        </ThemedText>
      </View>
    </PressScale>
  );
}

function Row({
  label,
  value,
  onPress,
  icon,
}: {
  label: string;
  value: string;
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const theme = useTheme();
  return (
    <PressScale onPress={onPress} hapticKind="selection" scaleTo={0.99} containerStyle={{ width: "100%" }}>
      <View style={[styles.row, { borderBottomColor: theme.colors.fill }]}>
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={20} color={theme.colors.label2} />
        </View>
        <ThemedText variant="body" style={{ flex: 1 }}>
          {label}
        </ThemedText>
        <ThemedText variant="body" style={{ color: theme.colors.label2 }} numberOfLines={1}>
          {value}
        </ThemedText>
      </View>
    </PressScale>
  );
}

function RowSwitch({
  label,
  value,
  onChange,
  icon,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.colors.fill }]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={theme.colors.label2} />
      </View>
      <ThemedText variant="body" style={{ flex: 1 }}>
        {label}
      </ThemedText>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.colors.accent, false: theme.colors.fill }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    borderCurve: "continuous",
    paddingHorizontal: 14,
  },
  section: {
    marginTop: 12,
  },
  titleInput: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    paddingVertical: 14,
  },
  notesInput: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    paddingVertical: 14,
    minHeight: 80,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 46,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowStatic: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 40,
  },
  rowIcon: {
    width: 30,
    alignItems: "center",
    marginRight: 8,
  },
  reminderWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingLeft: 38,
    paddingBottom: 12,
  },
});
