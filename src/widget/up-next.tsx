import React from "react";
import { Appearance } from "react-native";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { ColorProp } from "react-native-android-widget";
import { buildOccurrences } from "@/calendar/expand";
import { getEvents, getCategories } from "@/db/repo";
import { resolveCategoryColor } from "@/theme/colors";
import { todayStr, addDateStr, diffDateStr, parseLocalDate, format } from "@/utils/date";

interface WidgetItem {
  title: string;
  timeLabel: string;
  color: ColorProp;
  daysRemaining?: number;
}

interface WidgetPalette {
  bg: ColorProp;
  label: ColorProp;
  label2: ColorProp;
  label3: ColorProp;
}

const palette = (isDark: boolean): WidgetPalette =>
  isDark
    ? { bg: "#EE1C1C1E", label: "#FFFFFF", label2: "#9A9AA3", label3: "#6A6A72" }
    : { bg: "#EEFFFFFF", label: "#000000", label2: "#6B6B75", label3: "#9A9AA3" };

function tint(color: ColorProp, alpha: string): ColorProp {
  return (color + alpha) as ColorProp;
}

async function loadUpcoming(count: number, isDark: boolean): Promise<WidgetItem[]> {
  const events = await getEvents();
  const categories = await getCategories();
  const t = todayStr();
  const occurrences = buildOccurrences(events, {
    startDate: t,
    endDate: addDateStr(t, 30),
  });

  const flat: { date: string; occ: any }[] = [];
  for (const [date, occs] of occurrences) {
    for (const occ of occs) {
      if (!occ.isStart && occ.isAllDay) continue;
      flat.push({ date, occ });
    }
  }
  flat.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.occ.isAllDay !== b.occ.isAllDay) return a.occ.isAllDay ? -1 : 1;
    return a.occ.start.getTime() - b.occ.start.getTime();
  });

  const items: WidgetItem[] = [];
  for (const { date, occ } of flat) {
    if (items.length >= count) break;
    const event = occ.event;
    if (event.type === "task" && event.completedAt && date > t) continue;
    const cat = categories.find((c) => c.id === event.categoryId);
    const color = (cat
      ? resolveCategoryColor(cat.colorKey, isDark)
      : isDark
        ? "#0A84FF"
        : "#007AFF") as ColorProp;
    let timeLabel: string;
    if (event.type === "countdown") {
      const days = diffDateStr(event.targetDate ?? date, t);
      timeLabel = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
    } else if (occ.isAllDay) {
      timeLabel = date === t ? "All day" : format(parseLocalDate(date), "EEE d MMM");
    } else {
      const time = format(occ.start, "HH:mm");
      timeLabel = date === t ? time : `${format(parseLocalDate(date), "EEE d")} ${time}`;
    }
    items.push({
      title: event.title || "(untitled)",
      timeLabel,
      color,
      daysRemaining: event.type === "countdown" ? diffDateStr(event.targetDate ?? date, t) : undefined,
    });
  }
  return items;
}

export async function renderUpNextWidget(props: {
  renderWidget: (element: React.ReactElement) => void;
  widgetInfo: { width: number; height: number };
  large: boolean;
}) {
  const isDark = Appearance.getColorScheme() === "dark";
  const c = palette(isDark);
  const big = props.large || props.widgetInfo.width > 500;
  const items = await loadUpcoming(big ? 5 : 3, isDark);
  const day = new Date();

  props.renderWidget(
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        flex: 1,
        backgroundColor: c.bg,
        borderRadius: 24,
        padding: 14,
        flexDirection: "column",
        justifyContent: "flex-start",
      }}
    >
      <FlexWidget style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "match_parent" }}>
        <TextWidget
          text="UP NEXT"
          style={{ color: c.label3, fontSize: 10, fontWeight: "700", letterSpacing: 1.2 }}
        />
        <TextWidget
          text={format(day, "EEE d MMM").toUpperCase()}
          style={{ color: c.label3, fontSize: 10, fontWeight: "600", letterSpacing: 0.8 }}
        />
      </FlexWidget>
      {items.length === 0 ? (
        <TextWidget
          text="Nothing coming up"
          style={{ color: c.label2, fontSize: big ? 13 : 12, marginTop: 12 }}
        />
      ) : (
        items.map((item, i) => (
          <FlexWidget
            key={i}
            style={{
              flexDirection: "row",
              alignItems: "center",
              width: "match_parent",
              marginTop: big ? 9 : 8,
            }}
          >
            <FlexWidget
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: item.color,
                marginRight: 9,
              }}
            />
            <FlexWidget style={{ flexDirection: "column", flex: 1 }}>
              <TextWidget
                text={item.title}
                style={{ color: c.label, fontSize: big ? 14 : 13, fontWeight: "600" }}
                maxLines={1}
                truncate="END"
              />
              <TextWidget
                text={item.timeLabel}
                style={{ color: c.label2, fontSize: big ? 11 : 10, marginTop: 1 }}
                maxLines={1}
                truncate="END"
              />
            </FlexWidget>
            {item.daysRemaining != null && item.daysRemaining >= 0 && (
              <FlexWidget
                style={{
                  backgroundColor: tint(item.color, "2E"),
                  borderRadius: 12,
                  paddingLeft: 8,
                  paddingRight: 8,
                  paddingTop: 3,
                  paddingBottom: 3,
                  marginLeft: 6,
                }}
              >
                <TextWidget
                  text={item.daysRemaining === 0 ? "Today" : `${item.daysRemaining}d`}
                  style={{ color: item.color, fontSize: 11, fontWeight: "700" }}
                />
              </FlexWidget>
            )}
          </FlexWidget>
        ))
      )}
    </FlexWidget>,
  );
}
