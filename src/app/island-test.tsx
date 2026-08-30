import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { ThemedText } from "@/components/themed-text";
import { PressScale } from "@/components/press-scale";
import { haptic } from "@/utils/haptics";
import { playSound } from "@/utils/sound";
import XCalendarAlarm, {
  type XAlarmPermissionStates,
  type XShizukuState,
} from "xcalendar-alarm";

/**
 * Super Island harness (HyperOS 3): shows device capability, the Shizuku
 * whitelist-workaround state, and manual island post/cancel controls.
 * Reachable via xcalendar://island-test for on-device debugging.
 */
export default function IslandTestScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [perms, setPerms] = useState<XAlarmPermissionStates | null>(null);
  const [shizuku, setShizuku] = useState<XShizukuState | null>(null);

  const refresh = () => {
    XCalendarAlarm.getPermissionStates()
      .then(setPerms)
      .catch(() => setPerms(null));
    try {
      setShizuku(XCalendarAlarm.getShizukuState());
    } catch {
      setShizuku(null);
    }
  };

  const postIsland = () => {
    haptic("light");
    // Same rich shape the app posts for the real next event.
    XCalendarAlarm.postIsland({
      title: "Dentist appointment",
      subtitle: "Tomorrow · 09:30 AM",
      content: "in 16h 5m",
      subContent: "Then · Team sync · 11:00 AM",
      extraTitle: "Next event",
      ticker: "Dentist appointment · 09:30 AM",
      aod: "Dentist · 09:30 AM",
    });
    setTimeout(refresh, 1500);
  };

  const cancelIsland = () => {
    haptic("light");
    XCalendarAlarm.cancelIsland();
    refresh();
  };

  const fireAlarm = () => {
    haptic("medium");
    playSound("save");
    XCalendarAlarm.fireTestAlarm();
  };

  useEffect(refresh, []);

  const superIsland = (perms?.focusProtocol ?? 0) >= 3;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg, paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Super Island Test",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.label,
          headerLeft: () => (
            <PressScale onPress={() => router.back()} hapticKind={null} scaleTo={0.92}>
              <Ionicons name="chevron-back" size={24} color={theme.colors.label2} />
            </PressScale>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <StatusRow
            label="HyperOS version"
            value={perms ? (perms.focusProtocol >= 3 ? "OS3 (Super Island)" : `focus protocol ${perms.focusProtocol}`) : "…"}
            ok={superIsland}
          />
          <StatusRow
            label="Island hardware"
            value={perms ? (perms.islandSupported ? "Supported" : "Not supported") : "…"}
            ok={perms?.islandSupported ?? false}
          />
          <StatusRow
            label="Focus notification permission"
            value={perms ? (perms.focus ? "Granted" : "Denied") : "…"}
            ok={perms?.focus ?? false}
          />
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <ThemedText variant="title2" style={{ paddingVertical: 10 }}>
            Shizuku whitelist workaround
          </ThemedText>
          <ThemedText variant="subheadline" style={{ color: theme.colors.label2, marginBottom: 6, lineHeight: 19 }}>
            Custom island content normally needs Xiaomi's whitelist. Blocking XMSF's network for the
            second around posting (via Shizuku, no root) makes the check fail open — the same
            technique HyperBridge uses.
          </ThemedText>
          <StatusRow
            label="Shizuku installed"
            value={shizuku ? (shizuku.installed ? "Yes" : "No") : "…"}
            ok={shizuku?.installed ?? false}
          />
          <StatusRow
            label="Shizuku running"
            value={shizuku ? (shizuku.running ? "Yes" : "Stopped") : "…"}
            ok={shizuku?.running ?? false}
          />
          <StatusRow
            label="XCalendar granted"
            value={shizuku ? (shizuku.granted ? "Yes" : "No") : "…"}
            ok={shizuku?.granted ?? false}
          />
          <StatusRow
            label="Workaround ready"
            value={shizuku?.ready ? "Yes" : "No"}
            ok={shizuku?.ready ?? false}
          />
          <Btn
            icon="key-outline"
            label="Grant Shizuku permission"
            disabled={!shizuku?.running}
            onPress={() => {
              haptic("light");
              XCalendarAlarm.requestShizukuPermission();
              setTimeout(refresh, 2000);
            }}
          />
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <ThemedText variant="title2" style={{ paddingVertical: 10 }}>
            Persistent island
          </ThemedText>
          <ThemedText variant="subheadline" style={{ color: theme.colors.label2, marginBottom: 6, lineHeight: 19 }}>
            Posts the same notification the app uses for your next event. In normal use the app
            posts it automatically on every open and data change.
          </ThemedText>
          <Btn icon="pulse-outline" label="Post island (next-event style)" disabled={!superIsland} onPress={postIsland} />
          <Btn icon="close-circle-outline" label="Cancel island" onPress={cancelIsland} />
          <Btn icon="flame-outline" label="Fire 8-second alarm (full pipeline)" onPress={fireAlarm} />
        </View>

        <ThemedText variant="footnote" style={{ color: theme.colors.label3, marginTop: 16, lineHeight: 18 }}>
          If the island still doesn't render, enable “焦点通知 / Focus notifications” for XCalendar
          in the app notification settings, make sure Shizuku is running, then retry.
        </ThemedText>
      </ScrollView>
    </View>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.colors.fill }]}>
      <Ionicons
        name={ok ? "checkmark-circle" : "alert-circle"}
        size={20}
        color={ok ? "#34C759" : theme.colors.destructive}
      />
      <ThemedText variant="body" style={{ flex: 1, marginLeft: 10 }}>
        {label}
      </ThemedText>
      <ThemedText variant="subheadline" style={{ color: theme.colors.label2 }}>
        {value}
      </ThemedText>
    </View>
  );
}

function Btn({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <PressScale
      onPress={onPress}
      hapticKind={null}
      scaleTo={0.98}
      containerStyle={{ width: "100%", opacity: disabled ? 0.4 : 1 }}
      disabled={disabled}
    >
      <View style={[styles.btn, { borderBottomColor: theme.colors.fill }]}>
        <View style={styles.btnIcon}>
          <Ionicons name={icon} size={20} color={theme.colors.accent} />
        </View>
        <ThemedText variant="body" style={{ flex: 1, color: theme.colors.accent }}>
          {label}
        </ThemedText>
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    borderRadius: 14,
    borderCurve: "continuous",
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 46,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  btnIcon: {
    width: 30,
    alignItems: "center",
    marginRight: 8,
  },
});
