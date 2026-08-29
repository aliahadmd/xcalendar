import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useTheme } from "@/theme/theme";
import { ThemedText } from "@/components/themed-text";
import { PressScale } from "@/components/press-scale";
import type { Occurrence, Category } from "@/db/types";
import { eventColor } from "@/calendar/display";
import { formatTime, parseLocalDate, toLocalDateStr, addDays, format } from "@/utils/date";

const HOUR_H = 56;
const LABEL_W = 50;

interface TimelineProps {
  dates: string[];
  occurrences: Map<string, Occurrence[]>;
  categories: Category[];
  use24h: boolean;
  onPressOccurrence: (occ: Occurrence) => void;
  onCreateAt: (date: string, minutes: number) => void;
  showAllDay?: boolean;
}

interface LaneBlock {
  occ: Occurrence;
  lane: number;
  lanes: number;
  topMin: number;
  durMin: number;
}

function layoutLanes(occs: Occurrence[]): LaneBlock[] {
  const timed = occs.filter((o) => !o.isAllDay).sort((a, b) => a.start.getTime() - b.start.getTime());
  const blocks: LaneBlock[] = [];
  let active: LaneBlock[] = [];
  for (const occ of timed) {
    const startMin = occ.start.getHours() * 60 + occ.start.getMinutes();
    const durMin = Math.max(
      15,
      Math.round(((occ.end?.getTime() ?? occ.start.getTime()) - occ.start.getTime()) / 60000),
    );
    active = active.filter((b) => b.topMin + b.durMin > startMin);
    const lane = active.length;
    const block: LaneBlock = { occ, lane, lanes: lane + 1, topMin: startMin, durMin };
    active.push(block);
    blocks.push(block);
  }
  // Normalize lane counts across overlapping runs.
  for (const b of blocks) {
    const overlaps = blocks.filter(
      (o) => o !== b && o.topMin < b.topMin + b.durMin && o.topMin + o.durMin > b.topMin,
    );
    b.lanes = Math.max(1, ...overlaps.map((o) => o.lane + 1), b.lane + 1);
  }
  return blocks;
}

export function Timeline({
  dates,
  occurrences,
  categories,
  use24h,
  onPressOccurrence,
  onCreateAt,
  showAllDay = true,
}: TimelineProps) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const initialOffset = useMemo(() => {
    const minutes = now.getHours() * 60 + now.getMinutes();
    return Math.max(0, ((minutes - 90) / 60) * HOUR_H);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: initialOffset, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todayStr = toLocalDateStr(now);
  const showNow = dates.includes(todayStr);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  const allDayRows = useMemo(() => {
    if (!showAllDay) return 0;
    let max = 0;
    for (const d of dates) {
      const n = (occurrences.get(d) ?? []).filter((o) => o.isAllDay).length;
      if (n > max) max = n;
    }
    return Math.min(max, 3);
  }, [dates, occurrences, showAllDay]);

  const scrollY = initialOffset;

  return (
    <View style={{ flex: 1 }}>
      {/* Day headers */}
      <View style={[styles.headerRow, { borderBottomColor: theme.colors.separator }]}>
        <View style={{ width: LABEL_W }} />
        <View style={{ flex: 1, flexDirection: "row" }}>
          {dates.map((d) => {
            const date = parseLocalDate(d);
            const isToday = d === todayStr;
            return (
              <View key={d} style={[styles.headerCell, { width: `${100 / dates.length}%` }]}>
                <ThemedText variant="caption" style={{ color: theme.colors.label2 }}>
                  {format(date, "EEE").toUpperCase()}
                </ThemedText>
                <View
                  style={[
                    styles.dayBadge,
                    isToday && { backgroundColor: theme.colors.today },
                  ]}
                >
                  <ThemedText
                    variant="body"
                    style={{
                      color: isToday ? theme.colors.onAccent : theme.colors.label,
                      fontFamily: isToday ? theme.fonts.bold : theme.fonts.regular,
                    }}
                  >
                    {date.getDate()}
                  </ThemedText>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* All-day strip */}
      {showAllDay && allDayRows > 0 && (
        <View
          style={[
            styles.allDayStrip,
            { height: allDayRows * 22 + 8, borderBottomColor: theme.colors.separator },
          ]}
        >
          <ThemedText
            variant="caption2"
            style={{ color: theme.colors.label3, width: LABEL_W, textAlign: "center" }}
          >
            ALL
          </ThemedText>
          <View style={{ flex: 1, flexDirection: "row" }}>
            {dates.map((d) => (
              <View key={d} style={{ width: `${100 / dates.length}%`, paddingHorizontal: 1 }}>
                {(occurrences.get(d) ?? [])
                  .filter((o) => o.isAllDay)
                  .slice(0, allDayRows)
                  .map((o) => (
                    <AllDayChip
                      key={o.instanceId}
                      occ={o}
                      categories={categories}
                      compact={dates.length > 1}
                      onPress={() => onPressOccurrence(o)}
                    />
                  ))}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Scrollable hour grid */}
      <ScrollView
        ref={scrollRef}
        contentOffset={{ x: 0, y: scrollY }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: 24 * HOUR_H, flexDirection: "row" }}>
          {/* Hour labels */}
          <View style={{ width: LABEL_W }}>
            {hours.map((h) => (
              <View key={h} style={{ height: HOUR_H }}>
                {h > 0 && (
                  <ThemedText
                    variant="caption2"
                    style={[
                      styles.hourLabel,
                      { color: theme.colors.label3, top: -6, fontFamily: theme.fonts.regular },
                    ]}
                  >
                    {formatTime(new Date(2000, 0, 1, h, 0).getTime(), use24h).replace(":00", "")}
                  </ThemedText>
                )}
              </View>
            ))}
          </View>

          {/* Day columns */}
          <View style={{ flex: 1, flexDirection: "row" }}>
            {dates.map((d) => (
              <DayColumn
                key={d}
                date={d}
                isToday={d === todayStr}
                nowMinutes={showNow ? nowMinutes : null}
                occurrences={occurrences.get(d) ?? []}
                colCount={dates.length}
                categories={categories}
                theme={theme}
                use24h={use24h}
                onPressOccurrence={onPressOccurrence}
                onCreateAt={onCreateAt}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function DayColumn({
  date,
  isToday,
  nowMinutes,
  occurrences,
  colCount,
  categories,
  theme,
  use24h,
  onPressOccurrence,
  onCreateAt,
}: {
  date: string;
  isToday: boolean;
  nowMinutes: number | null;
  occurrences: Occurrence[];
  colCount: number;
  categories: Category[];
  theme: ReturnType<typeof useTheme>;
  use24h: boolean;
  onPressOccurrence: (o: Occurrence) => void;
  onCreateAt: (date: string, minutes: number) => void;
}) {
  const blocks = useMemo(() => layoutLanes(occurrences), [occurrences]);
  const colTheme = theme;

  return (
    <View
      style={{
        width: `${100 / colCount}%`,
        borderLeftWidth: colCount > 1 ? StyleSheet.hairlineWidth : 0,
        borderLeftColor: colTheme.colors.separator,
      }}
    >
      <View style={{ height: 24 * HOUR_H }}>
        {/* Hour lines */}
        {Array.from({ length: 24 }, (_, h) => (
          <View
            key={`line${h}`}
            style={[styles.hourLine, { top: h * HOUR_H, borderTopColor: colTheme.colors.fill2 }]}
          />
        ))}

        {/* 24 pressable hour rows — minute derives from the row + small offset */}
        {Array.from({ length: 24 }, (_, hour) => (
          <Pressable
            key={hour}
            style={{ height: HOUR_H, zIndex: 1 }}
            onPress={(e) => {
              const raw = e.nativeEvent.locationY ?? 0;
              const quarter = Math.max(0, Math.min(3, Math.floor(raw / (HOUR_H / 4))));
              onCreateAt(date, hour * 60 + quarter * 15);
            }}
          />
        ))}

        {/* Current time line */}
        {isToday && nowMinutes != null && (
          <View style={[styles.nowLine, { top: (nowMinutes / 60) * HOUR_H }]}>
            <View style={[styles.nowDot, { backgroundColor: colTheme.colors.today }]} />
            <View style={{ flex: 1, height: 1.5, backgroundColor: colTheme.colors.today }} />
          </View>
        )}

        {/* Event blocks */}
        {blocks.map((b) => {
          const color = eventColor(b.occ.event, categories, colTheme.isDark);
          const blockHeight = Math.max(18, (b.durMin / 60) * HOUR_H - 2);
          return (
            <PressScale
              key={b.occ.instanceId}
              hapticKind="selection"
              onPress={() => onPressOccurrence(b.occ)}
              scaleTo={0.97}
              containerStyle={{
                position: "absolute",
                top: (b.topMin / 60) * HOUR_H + 1,
                height: blockHeight,
                left: `${(b.lane / b.lanes) * 100}%`,
                width: `${(1 / b.lanes) * 100}%`,
                paddingLeft: 2,
                paddingRight: 2,
                zIndex: 2,
              }}
              style={{ flex: 1 }}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: `${color}22`,
                  borderLeftWidth: 3,
                  borderLeftColor: color,
                  borderRadius: 6,
                  borderCurve: "continuous",
                  paddingHorizontal: 4,
                  paddingTop: 1,
                  overflow: "hidden",
                }}
              >
                <ThemedText
                  variant="caption2"
                  style={{ color: colTheme.colors.label }}
                  numberOfLines={1}
                >
                  {b.occ.event.title}
                </ThemedText>
                {blockHeight > 34 && (
                  <ThemedText
                    variant="caption2"
                    style={{ color: colTheme.colors.label2, fontFamily: colTheme.fonts.regular }}
                    numberOfLines={1}
                  >
                    {formatTime(b.occ.start.getTime(), use24h)}
                  </ThemedText>
                )}
              </View>
            </PressScale>
          );
        })}
      </View>
    </View>
  );
}

function AllDayChip({
  occ,
  categories,
  compact,
  onPress,
}: {
  occ: Occurrence;
  categories: Category[];
  compact: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const color = eventColor(occ.event, categories, theme.isDark);
  return (
    <PressScale hapticKind="selection" onPress={onPress} scaleTo={0.96}>
      <View
        style={{
          backgroundColor: `${color}33`,
          borderRadius: 4,
          height: 20,
          justifyContent: "center",
          paddingHorizontal: 4,
          marginBottom: 2,
        }}
      >
        <ThemedText variant="caption2" style={{ color: theme.colors.label }} numberOfLines={1}>
          {occ.event.title}
        </ThemedText>
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCell: {
    alignItems: "center",
    gap: 2,
  },
  dayBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderCurve: "continuous",
  },
  allDayStrip: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hourLabel: {
    position: "absolute",
    right: 6,
    fontVariant: ["tabular-nums"],
  },
  hourLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  nowLine: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 3,
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
  },
});
