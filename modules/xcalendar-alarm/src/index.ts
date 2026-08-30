import { requireNativeModule } from "expo-modules-core";

export interface XAlarmItem {
  id: string;
  /** Epoch ms */
  fireAt: number;
  title: string;
  body: string;
  kind: "reminder" | "countdown";
}

export interface XAlarmPermissionStates {
  notifications: boolean;
  fullScreenIntent: boolean;
  overlay: boolean;
  exactAlarm: boolean;
  focus: boolean;
  batteryIgnoring: boolean;
  isXiaomi: boolean;
  /** HyperOS focus-notification protocol: 0 none · 1 OS1 · 2 OS2 · 3 OS3 Super Island. */
  focusProtocol: number;
  /** Whether the device reports island hardware support (persist.sys.feature.island). */
  islandSupported: boolean;
}

export interface XShizukuState {
  installed: boolean;
  running: boolean;
  granted: boolean;
  ready: boolean;
}

/** Rich content for the persistent next-event Super Island. */
export interface XIslandData {
  /** Event title, e.g. "Dentist appointment". */
  title: string;
  /** Date + time line, e.g. "Tomorrow · 09:30". */
  subtitle: string;
  /** Countdown, e.g. "in 16h 5m". */
  content: string;
  /** Following event line, e.g. "Then · Team sync · 11:00". */
  subContent?: string;
  /** Card label above the title. */
  extraTitle?: string;
  /** Status-bar ticker text. */
  ticker?: string;
  /** Always-On Display text. */
  aod?: string;
}

export default requireNativeModule("XCalendarAlarm") as {
  scheduleAlarms(alarms: XAlarmItem[]): Promise<void>;
  cancelAllAlarms(): Promise<void>;
  getPermissionStates(): Promise<XAlarmPermissionStates>;
  openAutostart(): boolean;
  openOverlaySettings(): boolean;
  openAppNotificationSettings(): boolean;
  openExactAlarmSettings(): boolean;
  openBatterySettings(): boolean;
  fireTestAlarm(): number;
  postIslandTest(title: string, body: string): boolean;
  cancelIslandTest(): boolean;
  /** Route C1: post the persistent next-event Super Island (XMSF workaround via Shizuku). */
  postIsland(data: XIslandData): boolean;
  cancelIsland(): boolean;
  getShizukuState(): XShizukuState;
  requestShizukuPermission(): boolean;
  isIslandSupported(): boolean;
};
