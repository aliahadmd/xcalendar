import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme/theme";
import { ThemedText } from "./themed-text";
import { PressScale } from "./press-scale";
import type { Occurrence } from "@/db/types";
import type { Category } from "@/db/types";
import { eventColor, ageForBirthday, countdownLabel, isTaskOverdue } from "@/calendar/display";
import { formatTime, formatTimeRange } from "@/utils/date";
import { setTaskCompleted } from "@/db/repo";
import { playSound } from "@/utils/sound";
import { haptic } from "@/utils/haptics";

interface Props {
  occ: Occurrence;
  categories: Category[];
  use24h: boolean;
  onPress: (occ: Occurrence) => void;
  showTime?: boolean;
}

/** Agenda list row: time | colored bar + title | task checkbox. */
export function EventRow({ occ, categories, use24h, onPress, showTime = true }: Props) {
  const theme = useTheme();
  const { event } = occ;
  const color = eventColor(event, categories, theme.isDark);
  const done = event.type === "task" && !!event.completedAt;
  const overdue = isTaskOverdue(event);
  const age = ageForBirthday(event);
  const cdLabel = countdownLabel(event);

  const timeLabel = occ.isAllDay
    ? event.type === "countdown"
      ? "Countdown"
      : "All-day"
    : event.endAt
      ? formatTimeRange(event.startAt!, event.endAt, use24h)
      : formatTime(event.startAt!, use24h);

  const toggleTask = () => {
    if (event.type !== "task") return;
    const completed = !event.completedAt;
    haptic(completed ? "medium" : "light");
    playSound(completed ? "complete" : "tick");
    setTaskCompleted(event.id, completed ? Date.now() : null);
  };

  return (
    <PressScale
      hapticKind="selection"
      onPress={() => onPress(occ)}
      scaleTo={0.98}
      containerStyle={{ width: "100%" }}
      style={styles.wrap}
    >
      <View style={styles.timeCol}>
        {showTime && (
          <ThemedText
            variant="footnote"
            style={{ color: theme.colors.label2, fontVariant: ["tabular-nums"] }}
          >
            {timeLabel}
          </ThemedText>
        )}
      </View>
      <View style={[styles.bar, { backgroundColor: color, opacity: done ? 0.4 : 1 }]} />
      <View style={styles.content}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          {event.type === "birthday" && (
            <Ionicons name="gift-outline" size={14} color={color} style={{ marginRight: 6 }} />
          )}
          {event.type === "countdown" && (
            <Ionicons name="hourglass-outline" size={14} color={color} style={{ marginRight: 6 }} />
          )}
          <ThemedText
            variant="body"
            style={{
              color: done ? theme.colors.label3 : overdue ? theme.colors.destructive : theme.colors.label,
              textDecorationLine: done ? "line-through" : "none",
              flexShrink: 1,
            }}
            numberOfLines={1}
          >
            {event.title}
          </ThemedText>
          {age != null && age > 0 && (
            <ThemedText variant="callout" style={{ color: theme.colors.label2, marginLeft: 6 }}>
              · {age}
            </ThemedText>
          )}
          {event.recurrence && (
            <Ionicons
              name="repeat-outline"
              size={13}
              color={theme.colors.label3}
              style={{ marginLeft: 6 }}
            />
          )}
          {event.reminders.length > 0 && (
            <Ionicons
              name="notifications-outline"
              size={13}
              color={theme.colors.label3}
              style={{ marginLeft: 6 }}
            />
          )}
        </View>
        {cdLabel && (
          <ThemedText variant="footnote" style={{ color }}>
            {cdLabel}
          </ThemedText>
        )}
        {event.type === "task" && <TaskCheck done={done} onToggle={toggleTask} />}
      </View>
    </PressScale>
  );
}

function TaskCheck({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  const theme = useTheme();
  return (
    <PressScale
      onPress={onToggle}
      hapticKind={null}
      scaleTo={0.8}
      style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 1.5,
          borderColor: done ? theme.colors.accent : theme.colors.label3,
          backgroundColor: done ? theme.colors.accent : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {done && <Ionicons name="checkmark-sharp" size={14} color={theme.colors.onAccent} />}
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingVertical: 8,
  },
  timeCol: {
    width: 76,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  bar: {
    width: 3,
    height: 24,
    borderRadius: 2,
    marginRight: 10,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 26,
  },
});
