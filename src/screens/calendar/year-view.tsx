import React, { useMemo, useCallback } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useTheme } from "@/theme/theme";
import { ThemedText } from "@/components/themed-text";
import { PressScale } from "@/components/press-scale";
import { SwipePager } from "./swipe-pager";
import { useOccurrences } from "@/hooks/use-occurrences";
import type { Occurrence } from "@/db/types";
import { toLocalDateStr, addDays, startOfWeek, isSameDay } from "@/utils/date";

const MINI_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

interface YearViewProps {
  year: number;
  weekStartsOn: 0 | 1;
  onSelectMonth: (monthIndex: number) => void;
  onChangeYear: (delta: number) => void;
}

export function YearView({ year, weekStartsOn, onSelectMonth, onChangeYear }: YearViewProps) {
  const start = useMemo(() => toLocalDateStr(new Date(year, 0, 1)), [year]);
  const end = useMemo(() => toLocalDateStr(new Date(year, 11, 31)), [year]);
  const occMap = useOccurrences(start, end);

  const left = useCallback(() => onChangeYear(1), [onChangeYear]);
  const right = useCallback(() => onChangeYear(-1), [onChangeYear]);

  return (
    <SwipePager onSwipeLeft={left} onSwipeRight={right} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {Array.from({ length: 12 }, (_, m) => (
          <MiniMonth
            key={m}
            year={year}
            month={m}
            weekStartsOn={weekStartsOn}
            occMap={occMap}
            onPress={() => onSelectMonth(m)}
          />
        ))}
      </ScrollView>
    </SwipePager>
  );
}

function MiniMonth({
  year,
  month,
  weekStartsOn,
  occMap,
  onPress,
}: {
  year: number;
  month: number;
  weekStartsOn: 0 | 1;
  occMap: Map<string, Occurrence[]> | null;
  onPress: () => void;
}) {
  const theme = useTheme();
  const first = new Date(year, month, 1);
  const gridStart = startOfWeek(first, { weekStartsOn });
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  return (
    <PressScale onPress={onPress} hapticKind="light" scaleTo={0.94} containerStyle={styles.monthCard}>
      <ThemedText
        variant="subheadline"
        style={{
          textAlign: "center",
          marginBottom: 6,
          color: isCurrentMonth ? theme.colors.accent : theme.colors.label,
          fontFamily: isCurrentMonth ? theme.fonts.bold : theme.fonts.semibold,
        }}
      >
        {first.toLocaleString("en", { month: "short" }).toUpperCase()}
      </ThemedText>
      <View style={styles.miniGrid}>
        {Array.from({ length: 7 }, (_, i) => (
          <ThemedText key={`h${i}`} variant="caption2" style={[styles.miniCell, { color: theme.colors.label3 }]}>
            {MINI_LETTERS[(i + weekStartsOn) % 7]}
          </ThemedText>
        ))}
        {days.map((d, i) => {
          const inMonth = d.getMonth() === month;
          const key = toLocalDateStr(d);
          const hasEvents = (occMap?.get(key) ?? []).length > 0;
          const isToday = isSameDay(d, today);
          return (
            <View key={i} style={styles.miniCell}>
              {inMonth ? (
                <View
                  style={[
                    styles.miniDay,
                    isToday && { backgroundColor: theme.colors.today, borderRadius: 8 },
                  ]}
                >
                  <ThemedText
                    variant="caption2"
                    style={{
                      color: isToday
                        ? theme.colors.onAccent
                        : hasEvents
                          ? theme.colors.label
                          : theme.colors.label2,
                      fontFamily: isToday ? theme.fonts.bold : theme.fonts.regular,
                    }}
                  >
                    {d.getDate()}
                  </ThemedText>
                </View>
              ) : (
                <ThemedText variant="caption2" style={{ color: theme.colors.label3, opacity: 0 }}>
                  {d.getDate()}
                </ThemedText>
              )}
            </View>
          );
        })}
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 24,
  },
  monthCard: {
    width: "32.5%",
    padding: 4,
  },
  miniGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
  },
  miniCell: {
    width: "14%",
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  miniDay: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
