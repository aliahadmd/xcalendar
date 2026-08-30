import React, { useMemo, useCallback } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useTheme } from "@/theme/theme";
import { ThemedText } from "@/components/themed-text";
import { PressScale } from "@/components/press-scale";
import { EventRow } from "@/components/event-row";
import { eventColor } from "@/calendar/display";
import { SwipePager } from "./swipe-pager";
import type { Occurrence } from "@/db/types";
import type { Category } from "@/db/types";
import { useOccurrences } from "@/hooks/use-occurrences";
import {
  format,
  startOfWeek,
  addDays,
  toLocalDateStr,
  parseLocalDate,
  isSameDay,
} from "@/utils/date";

interface MonthViewProps {
  month: Date;
  selectedDate: string;
  weekStartsOn: 0 | 1;
  use24h: boolean;
  categories: Category[];
  onSelectDate: (date: string) => void;
  onLongPressDay: (date: string) => void;
  onPressOccurrence: (occ: Occurrence) => void;
  onChangeMonth: (delta: number) => void;
  onQuickAdd: (date: string) => void;
}

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export function MonthView(props: MonthViewProps) {
  const { month, weekStartsOn } = props;
  const theme = useTheme();

  const gridStart = useMemo(
    () => startOfWeek(new Date(month.getFullYear(), month.getMonth(), 1), { weekStartsOn }),
    [month, weekStartsOn],
  );
  const windowStart = toLocalDateStr(gridStart);
  const windowEnd = toLocalDateStr(addDays(gridStart, 41));
  const occMap = useOccurrences(windowStart, windowEnd);

  const cells = useMemo(
    () => Array.from({ length: 42 }, (_, i) => toLocalDateStr(addDays(gridStart, i))),
    [gridStart],
  );

  const weekdays = useMemo(() => {
    const first = startOfWeek(new Date(2024, 0, 7), { weekStartsOn });
    return Array.from({ length: 7 }, (_, i) => WEEKDAY_LETTERS[addDays(first, i).getDay()]);
  }, [weekStartsOn]);

  // Swipe left = next month (matches Day/Year views and the pager animation).
  const pagerLeft = useCallback(() => props.onChangeMonth(1), [props]);
  const pagerRight = useCallback(() => props.onChangeMonth(-1), [props]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.weekdayRow}>
        {weekdays.map((d, i) => (
          <ThemedText key={i} variant="caption" style={[styles.weekday, { color: theme.colors.label3 }]}>
            {d}
          </ThemedText>
        ))}
      </View>
      <SwipePager onSwipeLeft={pagerLeft} onSwipeRight={pagerRight} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={styles.grid}>
            {cells.map((date) => (
              <DayCell
                key={date}
                date={date}
                month={month}
                occurrences={occMap?.get(date) ?? []}
                selected={date === props.selectedDate}
                categories={props.categories}
                onSelect={() => props.onSelectDate(date)}
                onLongPress={() => props.onLongPressDay(date)}
              />
            ))}
          </View>
          <DayAgenda
            date={props.selectedDate}
            occurrences={occMap?.get(props.selectedDate) ?? []}
            categories={props.categories}
            use24h={props.use24h}
            onPressOccurrence={props.onPressOccurrence}
            onQuickAdd={() => props.onQuickAdd(props.selectedDate)}
          />
        </ScrollView>
      </SwipePager>
    </View>
  );
}

function DayCell({
  date,
  month,
  occurrences,
  selected,
  categories,
  onSelect,
  onLongPress,
}: {
  date: string;
  month: Date;
  occurrences: Occurrence[];
  selected: boolean;
  categories: Category[];
  onSelect: () => void;
  onLongPress: () => void;
}) {
  const theme = useTheme();
  const d = parseLocalDate(date);
  const inMonth = d.getMonth() === month.getMonth();
  const today = isSameDay(d, new Date());
  const dots = occurrences.filter((o) => o.isStart).slice(0, 4);

  return (
    <PressScale
      onPress={onSelect}
      onLongPress={onLongPress}
      scaleTo={0.9}
      containerStyle={styles.cell}
    >
      <View style={[styles.dayNum, selected && { backgroundColor: theme.colors.accent }]}>
        <ThemedText
          variant="body"
          style={{
            color: selected
              ? theme.colors.onAccent
              : today
                ? theme.colors.today
                : inMonth
                  ? theme.colors.label
                  : theme.colors.label3,
            fontFamily: today && !selected ? theme.fonts.bold : undefined,
          }}
        >
          {d.getDate()}
        </ThemedText>
      </View>
      <View style={styles.dots}>
        {dots.map((o) => (
          <View
            key={o.instanceId}
            style={[styles.dot, { backgroundColor: eventColor(o.event, categories, theme.isDark) }]}
          />
        ))}
      </View>
    </PressScale>
  );
}

function DayAgenda({
  date,
  occurrences,
  categories,
  use24h,
  onPressOccurrence,
  onQuickAdd,
}: {
  date: string;
  occurrences: Occurrence[];
  categories: Category[];
  use24h: boolean;
  onPressOccurrence: (o: Occurrence) => void;
  onQuickAdd: () => void;
}) {
  const theme = useTheme();
  const d = parseLocalDate(date);
  const title = isSameDay(d, new Date())
    ? `Today, ${format(d, "MMMM d")}`
    : format(d, "EEEE, MMMM d");

  return (
    <View style={[styles.agendaCard, { backgroundColor: theme.colors.card }]}>
      <View style={styles.agendaHeader}>
        <ThemedText variant="title2">{title}</ThemedText>
        <PressScale onPress={onQuickAdd} style={{ padding: 4 }}>
          <ThemedText variant="subheadline" style={{ color: theme.colors.accent }}>
            + Add
          </ThemedText>
        </PressScale>
      </View>
      {occurrences.length === 0 ? (
        <ThemedText variant="subheadline" style={{ color: theme.colors.label3, paddingVertical: 12 }}>
          No events
        </ThemedText>
      ) : (
        occurrences.map((occ) => (
          <EventRow
            key={occ.instanceId}
            occ={occ}
            categories={categories}
            use24h={use24h}
            onPress={onPressOccurrence}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  weekdayRow: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingBottom: 4,
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: "center",
    textTransform: "uppercase",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 6,
  },
  cell: {
    width: `${100 / 7}%`,
    height: 52,
    alignItems: "center",
    paddingTop: 4,
  },
  dayNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
  },
  dots: {
    flexDirection: "row",
    gap: 3,
    marginTop: 2,
    height: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  agendaCard: {
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 16,
    borderCurve: "continuous",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  agendaHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 4,
  },
});
