import React from "react";
import { View, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { PressScale } from "@/components/press-scale";
const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap }> = {
  today: { on: "today", off: "today-outline" },
  calendar: { on: "calendar", off: "calendar-outline" },
  settings: { on: "settings", off: "settings-outline" },
};

const LABELS: Record<string, string> = {
  today: "Today",
  calendar: "Calendar",
  settings: "Settings",
};

function TabBar({ state, navigation }: { state: any; navigation: any }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.separator,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {state.routes.map((route: any, index: number) => {
        const focused = state.index === index;
        const icon = ICONS[route.name];
        const color = focused ? theme.colors.accent : theme.colors.label3;
        return (
          <PressScale
            key={route.key}
            scaleTo={0.85}
            containerStyle={styles.tab}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
          >
            <Ionicons name={focused ? icon.on : icon.off} size={24} color={color} />
          </PressScale>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, animation: "none" }}
    >
      <Tabs.Screen name="today" />
      <Tabs.Screen name="calendar" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    height: 58,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },
});
