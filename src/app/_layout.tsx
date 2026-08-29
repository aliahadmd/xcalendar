import React, { useEffect } from "react";
import { Platform, useColorScheme } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";
import { registerWidgetTaskHandler } from "react-native-android-widget";
import widgetTaskHandler from "../../widget-task-handler";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { ThemeProvider } from "@/theme/theme";
import { useSettings } from "@/hooks/use-data";
import { initApp } from "@/core/orchestrator";
import { requestPermissions } from "@/notifications/scheduler";

if (Platform.OS === "android") {
  registerWidgetTaskHandler(widgetTaskHandler);
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const settings = useSettings();
  const systemScheme = useColorScheme();

  useEffect(() => {
    initApp();
    requestPermissions().catch(() => {});
  }, []);

  // "system" follows the OS; light/dark force the palette directly (the native
  // AppearanceModule.setColorScheme crashes on null, so we never touch it).
  const isDark =
    settings.themeMode === "system"
      ? systemScheme === "dark"
      : settings.themeMode === "dark";

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider isDark={isDark}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: false, animation: "default" }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="event/new"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="event/[id]"
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
