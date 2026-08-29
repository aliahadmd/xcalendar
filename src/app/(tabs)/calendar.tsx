import React, { useCallback, useMemo, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { ThemedText } from "@/components/themed-text";
import { PressScale } from "@/components/press-scale";
import { SegmentedControl } from "@/components/segmented-control";
import { MonthView } from "@/screens/calendar/month-view";
import { WeekView } from "@/screens/calendar/week-view";
import { DayView } from "@/screens/calendar/day-view";
import { YearView } from "@/screens/calendar/year-view";
import { useCategories, useSettings } from "@/hooks/use-data";
import { addMonths, addDays, addYears, monthTitle, toLocalDateStr, todayStr, startOfWeek } from "@/utils/date";
import { saveSetting } from "@/db/settings";
import { haptic } from "@/utils/haptics";
import { playSound } from "@/utils/sound";
import type { Occurrence } from "@/db/types";

type CalMode = "day" | "week" | "month" | "year";

const SEGMENTS: { value: CalMode; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

export default function CalendarScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const categories = useCategories();

  const [mode, setMode] = useState<CalMode>(settings.lastView ?? "month");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [loadedInitial, setLoadedInitial] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!loadedInitial) {
        setLoadedInitial(true);
        return;
      }
      setMode(settings.lastView ?? "month");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings.lastView]),
  );

  const changeMode = (m: CalMode) => {
    haptic("selection");
    playSound("tick");
    setMode(m);
    saveSetting("lastView", m);
  };

  const step = (delta: number) => {
    haptic("light");
    if (mode === "month") setCursor((c) => addMonths(c, delta));
    else if (mode === "year") setCursor((c) => addYears(c, delta));
    else if (mode === "week") setCursor((c) => addDays(c, delta * 7));
    else setCursor((c) => addDays(c, delta));
  };

  const goToday = () => {
    haptic("light");
    playSound("tick");
    setCursor(new Date());
    setSelectedDate(todayStr());
  };

  const openNew = (date: string, minutes?: number) => {
    const params: Record<string, string> = { date };
    if (minutes != null) {
      params.startTime = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    }
    router.push({ pathname: "/event/new", params });
  };

  const openDetail = (occ: Occurrence) => {
    router.push({ pathname: "/event/[id]", params: { id: occ.event.id, date: occ.date } });
  };

  const title = useMemo(() => {
    if (mode === "year") return `${cursor.getFullYear()}`;
    if (mode === "month") return monthTitle(cursor);
    if (mode === "week") {
      const first = startOfWeek(cursor, { weekStartsOn: settings.weekStartsOn });
      const last = addDays(first, 6);
      if (first.getMonth() === last.getMonth()) {
        return `${first.toLocaleString("en", { month: "short" })} ${first.getDate()} – ${last.getDate()}`;
      }
      return `${first.toLocaleString("en", { month: "short" })} ${first.getDate()} – ${last.toLocaleString("en", { month: "short" })} ${last.getDate()}`;
    }
    return cursor.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" });
  }, [mode, cursor, settings.weekStartsOn]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <ThemedText variant="largeTitle" numberOfLines={1}>
            {title}
          </ThemedText>
        </View>
        <PressScale onPress={goToday} hapticKind="light" scaleTo={0.92}>
          <View style={[styles.todayBtn, { backgroundColor: theme.colors.fill }]}>
            <ThemedText variant="subheadline" style={{ color: theme.colors.accent, fontFamily: theme.fonts.semibold }}>
              Today
            </ThemedText>
          </View>
        </PressScale>
      </View>

      {/* View switcher + arrows */}
      <View style={styles.toolbar}>
        <PressScale onPress={() => step(-1)} hapticKind={null} scaleTo={0.85} style={styles.arrow}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.accent} />
        </PressScale>
        <SegmentedControl options={SEGMENTS} value={mode} onChange={changeMode} style={{ flex: 1 }} />
        <PressScale onPress={() => step(1)} hapticKind={null} scaleTo={0.85} style={styles.arrow}>
          <Ionicons name="chevron-forward" size={22} color={theme.colors.accent} />
        </PressScale>
      </View>

      {/* Body */}
      <View style={{ flex: 1 }}>
        {mode === "month" && (
          <MonthView
            month={cursor}
            selectedDate={selectedDate}
            weekStartsOn={settings.weekStartsOn}
            use24h={settings.use24h}
            categories={categories}
            onSelectDate={(d) => {
              haptic("selection");
              setSelectedDate(d);
            }}
            onLongPressDay={(d) => {
              setSelectedDate(d);
              openNew(d);
            }}
            onPressOccurrence={openDetail}
            onChangeMonth={(delta) => step(delta)}
            onQuickAdd={openNew}
          />
        )}
        {mode === "week" && (
          <WeekView
            weekStart={cursor}
            weekStartsOn={settings.weekStartsOn}
            use24h={settings.use24h}
            categories={categories}
            onPressOccurrence={openDetail}
            onCreateAt={(d, minutes) => openNew(d, minutes)}
            onChangeWeek={(delta) => step(delta)}
          />
        )}
        {mode === "day" && (
          <DayView
            date={toLocalDateStr(cursor)}
            use24h={settings.use24h}
            categories={categories}
            onPressOccurrence={openDetail}
            onCreateAt={(d, minutes) => openNew(d, minutes)}
            onChangeDay={(delta) => step(delta)}
          />
        )}
        {mode === "year" && (
          <YearView
            year={cursor.getFullYear()}
            weekStartsOn={settings.weekStartsOn}
            onSelectMonth={(m) => {
              haptic("medium");
              playSound("tick");
              setCursor(new Date(cursor.getFullYear(), m, 1));
              setSelectedDate(toLocalDateStr(new Date(cursor.getFullYear(), m, 1)));
              setMode("month");
            }}
            onChangeYear={(delta) => step(delta)}
          />
        )}
      </View>

      {/* FAB */}
      <PressScale
        onPress={() => openNew(selectedDate)}
        hapticKind="medium"
        scaleTo={0.88}
        containerStyle={styles.fabContainer}
        style={[styles.fab, { backgroundColor: theme.colors.accent }]}
      >
        <Ionicons name="add" size={28} color={theme.colors.onAccent} />
      </PressScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  todayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderCurve: "continuous",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  arrow: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  fabContainer: {
    position: "absolute",
    right: 16,
    bottom: 16,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
