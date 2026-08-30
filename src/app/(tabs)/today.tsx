import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { ThemedText } from "@/components/themed-text";
import { PressScale } from "@/components/press-scale";
import { EventRow } from "@/components/event-row";
import { useCategories, useSettings, useEvents } from "@/hooks/use-data";
import { useOccurrences } from "@/hooks/use-occurrences";
import { getOverdueTasks } from "@/db/repo";
import type { Occurrence, CalendarEvent } from "@/db/types";
import { todayStr, format } from "@/utils/date";

function useOverdueTasks(events: ReturnType<typeof useEvents>, date: string): CalendarEvent[] {
  const [overdue, setOverdue] = useState<CalendarEvent[]>([]);
  useEffect(() => {
    if (!events) return;
    let mounted = true;
    getOverdueTasks(date).then((t) => {
      if (mounted) setOverdue(t);
    });
    return () => {
      mounted = false;
    };
  }, [events, date]);
  return overdue;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function TodayScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const categories = useCategories();
  const events = useEvents();
  const date = todayStr();
  const occMap = useOccurrences(date, date);

  const overdue = useOverdueTasks(events, date);
  const today = occMap?.get(date) ?? [];
  const tasksToday = today.filter((o) => o.event.type === "task" && o.isStart);
  const doneCount = tasksToday.filter((o) => o.event.completedAt).length;

  const openDetail = (occ: Occurrence) => {
    router.push({ pathname: "/event/[id]", params: { id: occ.event.id, date: occ.date } });
  };

  const openNew = () => router.push({ pathname: "/event/new", params: { date } });

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.header}>
          <ThemedText variant="largeTitle">{greeting()}</ThemedText>
          <ThemedText variant="subheadline" style={{ color: theme.colors.label2, marginTop: 2 }}>
            {format(new Date(), "EEEE, MMMM d")}
          </ThemedText>
        </View>

        {tasksToday.length > 0 && (
          <View style={styles.progressRow}>
            <View style={[styles.progressCard, { backgroundColor: theme.colors.card }]}>
              <View style={styles.ring}>
                <ThemedText variant="headline" style={{ color: doneCount === tasksToday.length ? theme.colors.accent : theme.colors.label }}>
                  {doneCount}/{tasksToday.length}
                </ThemedText>
              </View>
              <ThemedText variant="subheadline" style={{ color: theme.colors.label2 }}>
                {doneCount === tasksToday.length ? "All done 🎉" : "tasks today"}
              </ThemedText>
            </View>
          </View>
        )}

        {overdue.length > 0 && (
          <Section title="Overdue" accent={theme.colors.destructive}>
            {overdue.map((e) => (
              <EventRow
                key={e.id}
                occ={{
                  instanceId: `${e.id}#${e.dtstartDate}`,
                  event: e,
                  date: e.dtstartDate!,
                  start: new Date(),
                  end: new Date(),
                  isAllDay: true,
                  isStart: true,
                  spanDays: 1,
                }}
                categories={categories}
                use24h={settings.use24h}
                onPress={openDetail}
                showTime={false}
              />
            ))}
          </Section>
        )}

        <Section
          title="Today"
          accent={theme.colors.accent}
          action={
            <PressScale onPress={openNew} scaleTo={0.9}>
              <Ionicons name="add-circle-outline" size={26} color={theme.colors.accent} />
            </PressScale>
          }
        >
          {today.length === 0 ? (
            <ThemedText variant="subheadline" style={{ color: theme.colors.label3, paddingVertical: 8 }}>
              Nothing scheduled — enjoy your day.
            </ThemedText>
          ) : (
            today.map((occ) => (
              <EventRow
                key={occ.instanceId}
                occ={occ}
                categories={categories}
                use24h={settings.use24h}
                onPress={openDetail}
              />
            ))
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  accent,
  children,
  action,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionDot, { backgroundColor: accent }]} />
        <ThemedText variant="title2" style={{ flex: 1 }}>
          {title}
        </ThemedText>
        {action}
      </View>
      <View style={[styles.sectionCard, { backgroundColor: theme.colors.card }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  progressRow: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  progressCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    borderCurve: "continuous",
    padding: 14,
  },
  ring: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginTop: 18,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionCard: {
    borderRadius: 16,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
