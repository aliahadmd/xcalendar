import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { ThemedText } from "@/components/themed-text";
import { PressScale } from "@/components/press-scale";
import { useCategories, useEvents, useSettings } from "@/hooks/use-data";
import { eventColor, ageForBirthday, countdownLabel } from "@/calendar/display";
import type { CalendarEvent } from "@/db/types";
import { parseLocalDate, format, formatTime, formatTimeRange } from "@/utils/date";
import { setTaskCompleted } from "@/db/repo";
import { haptic } from "@/utils/haptics";
import { playSound } from "@/utils/sound";

function recurrenceLabel(rrule: string | null): string | null {
  if (!rrule) return null;
  if (rrule.startsWith("FREQ=DAILY")) return "Repeats daily";
  if (rrule.startsWith("FREQ=WEEKLY")) return "Repeats weekly";
  if (rrule.startsWith("FREQ=MONTHLY")) return "Repeats monthly";
  if (rrule.startsWith("FREQ=YEARLY")) return "Repeats yearly";
  return "Repeats";
}

function reminderLabel(minutes: number): string {
  if (minutes === 0) return "At time of event";
  if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes > 1440 ? "s" : ""} before`;
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes > 60 ? "s" : ""} before`;
  return `${minutes} min before`;
}

export default function EventDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; date?: string }>();
  const events = useEvents();
  const categories = useCategories();
  const settings = useSettings();

  const event: CalendarEvent | undefined = events?.find((e) => e.id === params.id);

  if (!events) return <View style={{ flex: 1, backgroundColor: theme.colors.bgElevated }} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bgElevated }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.colors.bgElevated },
          headerTintColor: theme.colors.label,
          headerLeft: () => (
            <PressScale onPress={() => router.back()} hapticKind={null} scaleTo={0.92}>
              <Ionicons name="close" size={24} color={theme.colors.label2} />
            </PressScale>
          ),
          headerRight: () =>
            event ? (
              <PressScale
                onPress={() => {
                  haptic("light");
                  router.push({ pathname: "/event/new", params: { id: event.id } });
                }}
                hapticKind={null}
                scaleTo={0.92}
              >
                <ThemedText variant="headline" style={{ color: theme.colors.accent }}>
                  Edit
                </ThemedText>
              </PressScale>
            ) : null,
        }}
      />
      {event ? (
        <Detail event={event} categories={categories} use24h={settings.use24h} />
      ) : (
        <View style={{ padding: 24 }}>
          <ThemedText variant="body" style={{ color: theme.colors.label2 }}>
            Event not found
          </ThemedText>
        </View>
      )}
    </View>
  );
}

function Detail({
  event,
  categories,
  use24h,
}: {
  event: CalendarEvent;
  categories: ReturnType<typeof useCategories>;
  use24h: boolean;
}) {
  const theme = useTheme();
  const color = eventColor(event, categories, theme.isDark);
  const cat = categories.find((c) => c.id === event.categoryId);
  const rec = recurrenceLabel(event.recurrence);
  const age = ageForBirthday(event);
  const cd = countdownLabel(event);

  const whenLines: string[] = [];
  if (event.type === "countdown" && event.targetDate) {
    whenLines.push(
      parseLocalDate(event.targetDate).toLocaleDateString("en", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    );
  } else if (event.allDay && event.dtstartDate) {
    whenLines.push(
      parseLocalDate(event.dtstartDate).toLocaleDateString("en", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    );
    if (event.durationDays > 1) whenLines.push(`${event.durationDays} days`);
  } else if (event.startAt != null) {
    whenLines.push(format(new Date(event.startAt), "EEEE, MMMM d, yyyy"));
    whenLines.push(formatTimeRange(event.startAt, event.endAt, use24h));
  }

  const isTask = event.type === "task";
  const done = isTask && !!event.completedAt;

  const toggleDone = () => {
    if (!isTask) return;
    haptic(done ? "light" : "medium");
    playSound(done ? "tick" : "complete");
    setTaskCompleted(event.id, done ? null : Date.now());
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <View style={styles.titleRow}>
          {isTask && (
            <PressScale onPress={toggleDone} hapticKind={null} scaleTo={0.8} style={{ marginRight: 12 }}>
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  borderWidth: 2,
                  borderColor: done ? theme.colors.accent : theme.colors.label3,
                  backgroundColor: done ? theme.colors.accent : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {done && <Ionicons name="checkmark-sharp" size={18} color={theme.colors.onAccent} />}
              </View>
            </PressScale>
          )}
          <ThemedText
            variant="title"
            style={{
              flex: 1,
              color: done ? theme.colors.label3 : theme.colors.label,
              textDecorationLine: done ? "line-through" : "none",
            }}
          >
            {event.title}
          </ThemedText>
        </View>
        <View style={[styles.metaRow, { borderTopColor: theme.colors.fill }]}>
          <Ionicons name={cat?.icon as any ?? "calendar-outline"} size={16} color={color} />
          <ThemedText variant="subheadline" style={{ color }}>
            {cat?.name ?? event.type.charAt(0).toUpperCase() + event.type.slice(1)}
          </ThemedText>
          {cd && (
            <ThemedText variant="subheadline" style={{ color: theme.colors.label2, marginLeft: 8 }}>
              · {cd}
            </ThemedText>
          )}
          {age != null && (
            <ThemedText variant="subheadline" style={{ color: theme.colors.label2, marginLeft: 8 }}>
              · Turns {age}
            </ThemedText>
          )}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={20} color={theme.colors.label2} />
          <View style={{ marginLeft: 10 }}>
            {whenLines.map((l, i) => (
              <ThemedText key={i} variant={i === 0 ? "body" : "subheadline"} style={i === 0 ? undefined : { color: theme.colors.label2 }}>
                {l}
              </ThemedText>
            ))}
          </View>
        </View>
        {rec && (
          <View style={styles.infoRow}>
            <Ionicons name="repeat-outline" size={20} color={theme.colors.label2} />
            <ThemedText variant="body" style={{ marginLeft: 10 }}>
              {rec}
            </ThemedText>
          </View>
        )}
        {event.reminders.length > 0 && (
          <View style={styles.infoRow}>
            <Ionicons name="notifications-outline" size={20} color={theme.colors.label2} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              {[...event.reminders].sort((a, b) => a - b).map((m) => (
                <ThemedText key={m} variant="body">
                  {reminderLabel(m)}
                </ThemedText>
              ))}
            </View>
          </View>
        )}
      </View>

      {event.notes ? (
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <ThemedText variant="body" style={{ color: theme.colors.label2, lineHeight: 22 }}>
            {event.notes}
          </ThemedText>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderCurve: "continuous",
    padding: 16,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    marginTop: 12,
    gap: 6,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 7,
  },
});
