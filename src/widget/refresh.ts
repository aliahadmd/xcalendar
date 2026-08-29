import { Platform } from "react-native";

let reloadWidgets: (() => Promise<void>) | null = null;

if (Platform.OS === "android") {
  try {
    const rnaw = require("react-native-android-widget");
    if (rnaw?.reloadWidgets) {
      reloadWidgets = () => rnaw.reloadWidgets();
    }
  } catch {
    // widget lib unavailable
  }
}

export async function refreshWidgets(): Promise<void> {
  try {
    await reloadWidgets?.();
  } catch {
    // best effort
  }
}
