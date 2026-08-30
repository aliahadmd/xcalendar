import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Switch } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/theme";
import { ThemedText } from "@/components/themed-text";
import { PressScale } from "@/components/press-scale";
import { SegmentedControl } from "@/components/segmented-control";
import { useSettings } from "@/hooks/use-data";
import { saveSetting } from "@/db/settings";
import { exportIcs, importIcs } from "@/ics/ics";
import XCalendarAlarm, {
  type XAlarmPermissionStates,
} from "xcalendar-alarm";
import type { ThemeMode } from "@/theme/theme";

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const [perms, setPerms] = useState<XAlarmPermissionStates | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      XCalendarAlarm.getPermissionStates()
        .then(setPerms)
        .catch(() => setPerms(null));
    }, []),
  );

  const openBatterySettings = () => {
    XCalendarAlarm.openBatterySettings();
  };

  const openAutoStart = () => {
    XCalendarAlarm.openAutostart();
  };

  const fireTest = () => {
    XCalendarAlarm.fireTestAlarm();
  };

  const doExport = async () => {
    setBusy(true);
    try {
      await exportIcs();
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    setBusy(true);
    try {
      const result = await importIcs();
      setImportResult(`Imported ${result.inserted} event${result.inserted === 1 ? "" : "s"}${result.skipped ? `, skipped ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"}` : ""}`);
      setTimeout(() => setImportResult(null), 5000);
    } catch {
      setImportResult("Import cancelled or failed");
      setTimeout(() => setImportResult(null), 5000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={styles.header}>
          <ThemedText variant="largeTitle">Settings</ThemedText>
        </View>

        <Group title="Appearance">
          <Row icon="contrast-outline" label="Theme">
            <SegmentedControl
              options={[
                { value: "system", label: "Auto" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              value={settings.themeMode}
              onChange={(v) => {
                saveSetting("themeMode", v as ThemeMode);
              }}
              style={{ width: 190 }}
            />
          </Row>
          <RowSwitch
            icon="text-outline"
            label="24-hour time"
            value={settings.use24h}
            onChange={(v) => {
              saveSetting("use24h", v);
            }}
          />
          <RowSwitch
            icon="calendar-outline"
            label="Week starts Monday"
            value={settings.weekStartsOn === 1}
            onChange={(v) => {
              saveSetting("weekStartsOn", v ? 1 : 0);
            }}
          />
        </Group>

        <Group title="Alarms & reminders — make them bulletproof">
          <StatusRow
            label="Notifications"
            ok={perms?.notifications}
            onPress={() => XCalendarAlarm.openAppNotificationSettings()}
          />
          <StatusRow
            label="Full-screen alarms (show at exact time)"
            ok={perms?.fullScreenIntent}
            onPress={() => XCalendarAlarm.openAppNotificationSettings()}
          />
          <StatusRow
            label="Alarms & reminders access"
            ok={perms?.exactAlarm}
            onPress={() => XCalendarAlarm.openExactAlarmSettings()}
          />
          <StatusRow
            label="Display over other apps"
            ok={perms?.overlay}
            onPress={() => XCalendarAlarm.openOverlaySettings()}
          />
          {perms?.isXiaomi && (
            <StatusRow label="Autostart (HyperOS)" ok={null} onPress={openAutoStart} />
          )}
          <StatusRow
            label="Battery optimization off"
            ok={perms?.batteryIgnoring}
            onPress={openBatterySettings}
          />
          <ActionRow icon="flame-outline" label="🔔 Send test alarm (8 seconds)" onPress={fireTest} />
          {perms && !perms.notifications && (
            <ThemedText variant="footnote" style={{ color: theme.colors.destructive, padding: 12, paddingTop: 4 }}>
              Turn every switch green — each one closes a way HyperOS can swallow a reminder.
            </ThemedText>
          )}
        </Group>

        <Group title="Data">
          <ActionRow icon="share-outline" label={busy ? "Working…" : "Export calendar (.ics)"} onPress={doExport} />
          <ActionRow icon="download-outline" label={busy ? "Working…" : "Import from .ics file"} onPress={doImport} />
          {importResult && (
            <ThemedText variant="footnote" style={{ color: theme.colors.accent, padding: 12 }}>
              {importResult}
            </ThemedText>
          )}
        </Group>

        <ThemedText variant="footnote" style={{ textAlign: "center", color: theme.colors.label3, marginTop: 24 }}>
          XCalendar 1.0 · Made for you
        </ThemedText>
      </ScrollView>
    </View>
  );
}

function StatusRow({
  label,
  ok,
  onPress,
}: {
  label: string;
  ok: boolean | null | undefined;
  onPress: () => void;
}) {
  const theme = useTheme();
  const state = ok === null || ok === undefined ? "unknown" : ok ? "ok" : "off";
  return (
    <PressScale onPress={onPress} scaleTo={0.99} containerStyle={{ width: "100%" }}>
      <View style={[styles.row, { borderBottomColor: theme.colors.fill }]}>
        <Ionicons
          name={state === "ok" ? "checkmark-circle" : state === "off" ? "alert-circle" : "help-circle"}
          size={20}
          color={state === "ok" ? "#34C759" : state === "off" ? theme.colors.destructive : theme.colors.label3}
        />
        <ThemedText
          variant="subheadline"
          style={{
            flex: 1,
            marginLeft: 10,
            color: state === "off" ? theme.colors.label : theme.colors.label2,
          }}
          numberOfLines={2}
        >
          {label}
        </ThemedText>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.label3} />
      </View>
    </PressScale>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      <ThemedText variant="caption" style={{ color: theme.colors.label2, marginLeft: 18, marginBottom: 6 }}>
        {title.toUpperCase()}
      </ThemedText>
      <View style={[styles.groupCard, { backgroundColor: theme.colors.card }]}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.colors.fill }]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={theme.colors.label2} />
      </View>
      <ThemedText variant="body" style={{ flex: 1 }}>
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

function RowSwitch({
  icon,
  label,
  value,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.colors.fill }]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={theme.colors.label2} />
      </View>
      <ThemedText variant="body" style={{ flex: 1 }}>
        {label}
      </ThemedText>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.colors.accent, false: theme.colors.fill }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressScale onPress={onPress} scaleTo={0.99} containerStyle={{ width: "100%" }}>
      <View style={[styles.row, { borderBottomColor: theme.colors.fill }]}>
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={20} color={theme.colors.accent} />
        </View>
        <ThemedText variant="body" style={{ flex: 1, color: theme.colors.accent }}>
          {label}
        </ThemedText>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.label3} />
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  group: {
    marginBottom: 20,
  },
  groupCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderCurve: "continuous",
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 30,
    alignItems: "center",
    marginRight: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 2,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
