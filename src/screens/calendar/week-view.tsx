import React, { useMemo, useCallback } from "react";
import { View } from "react-native";
import { SwipePager } from "./swipe-pager";
import { Timeline } from "./timeline";
import { useOccurrences } from "@/hooks/use-occurrences";
import type { Occurrence, Category } from "@/db/types";
import { startOfWeek, addDays, toLocalDateStr } from "@/utils/date";

interface WeekViewProps {
  weekStart: Date;
  weekStartsOn: 0 | 1;
  use24h: boolean;
  categories: Category[];
  onPressOccurrence: (occ: Occurrence) => void;
  onCreateAt: (date: string, minutes: number) => void;
  onChangeWeek: (delta: number) => void;
}

export function WeekView(props: WeekViewProps) {
  const { weekStart, weekStartsOn } = props;
  const first = useMemo(() => startOfWeek(weekStart, { weekStartsOn }), [weekStart, weekStartsOn]);
  const dates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => toLocalDateStr(addDays(first, i))),
    [first],
  );
  const occMap = useOccurrences(dates[0], dates[6]);

  // Swipe left = next week (matches Day/Year views and the pager animation).
  const left = useCallback(() => props.onChangeWeek(1), [props]);
  const right = useCallback(() => props.onChangeWeek(-1), [props]);

  return (
    <SwipePager onSwipeLeft={left} onSwipeRight={right} style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {occMap && (
          <Timeline
            dates={dates}
            occurrences={occMap}
            categories={props.categories}
            use24h={props.use24h}
            onPressOccurrence={props.onPressOccurrence}
            onCreateAt={props.onCreateAt}
          />
        )}
      </View>
    </SwipePager>
  );
}
