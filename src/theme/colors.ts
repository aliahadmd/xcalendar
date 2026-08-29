// Apple-style semantic palette, explicit light/dark pairs for full control.
export interface Palette {
  bg: string;
  bgElevated: string;
  card: string;
  cardElevated: string;
  label: string;
  label2: string;
  label3: string;
  separator: string;
  accent: string;
  onAccent: string;
  today: string;
  destructive: string;
  fill: string;
  fill2: string;
  tabBar: string;
  headerBlur: string;
}

export const light: Palette = {
  bg: "#F2F2F7",
  bgElevated: "#E9E9EE",
  card: "#FFFFFF",
  cardElevated: "#FFFFFF",
  label: "#000000",
  label2: "rgba(60,60,67,0.6)",
  label3: "rgba(60,60,67,0.3)",
  separator: "rgba(60,60,67,0.29)",
  accent: "#007AFF",
  onAccent: "#FFFFFF",
  today: "#FF3B30",
  destructive: "#FF3B30",
  fill: "rgba(120,120,128,0.12)",
  fill2: "rgba(120,120,128,0.08)",
  tabBar: "rgba(249,249,249,0.94)",
  headerBlur: "rgba(242,242,247,0.85)",
};

export const dark: Palette = {
  bg: "#000000",
  bgElevated: "#1C1C1E",
  card: "#1C1C1E",
  cardElevated: "#2C2C2E",
  label: "#FFFFFF",
  label2: "rgba(235,235,245,0.6)",
  label3: "rgba(235,235,245,0.3)",
  separator: "rgba(84,84,88,0.65)",
  accent: "#0A84FF",
  onAccent: "#FFFFFF",
  today: "#FF453A",
  destructive: "#FF453A",
  fill: "rgba(120,120,128,0.24)",
  fill2: "rgba(120,120,128,0.18)",
  tabBar: "rgba(22,22,24,0.94)",
  headerBlur: "rgba(10,10,10,0.85)",
};

// Category colors — Apple Calendar palette with light/dark variants.
export const categoryColors = {
  red: { light: "#FF3B30", dark: "#FF453A" },
  orange: { light: "#FF9500", dark: "#FF9F0A" },
  yellow: { light: "#E6A700", dark: "#FFD60A" },
  green: { light: "#34C759", dark: "#30D158" },
  mint: { light: "#00A896", dark: "#63E6E2" },
  teal: { light: "#2196A6", dark: "#40C8E0" },
  cyan: { light: "#2290C4", dark: "#64D2FF" },
  blue: { light: "#007AFF", dark: "#0A84FF" },
  indigo: { light: "#5856D6", dark: "#5E5CE6" },
  purple: { light: "#AF52DE", dark: "#BF5AF2" },
  pink: { light: "#FF2D55", dark: "#FF375F" },
  brown: { light: "#A2845E", dark: "#AC8E68" },
} as const;

export type ColorKey = keyof typeof categoryColors;

export function resolveCategoryColor(key: string, isDark: boolean): string {
  const entry = categoryColors[key as ColorKey];
  if (!entry) return isDark ? "#0A84FF" : "#007AFF";
  return isDark ? entry.dark : entry.light;
}
