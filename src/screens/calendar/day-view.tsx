import React, { useCallback } from "react";
import { View } from "react-native";
import { SwipePager } from "./swipe-pager";
import { Timeline } from "./timeline";
import { useOccurrences } from "@/hooks/use-occurrences";
import type { Occurrence, Category } from "@/db/types";

interface DayViewProps {
  date: string;
  use24h: boolean;
  categories: Category[];
  onPressOccurrence: (occ: Occurrence) => void;
  onCreateAt: (date: string, minutes: number) => void;
  onChangeDay: (delta: number) => void;
}

export function DayView(props: DayViewProps) {
  const occMap = useOccurrences(props.date, props.date);
  const left = useCallback(() => props.onChangeDay(1), [props]);
  const right = useCallback(() => props.onChangeDay(-1), [props]);

  return (
    <SwipePager onSwipeLeft={left} onSwipeRight={right} style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {occMap && (
          <Timeline
            dates={[props.date]}
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
