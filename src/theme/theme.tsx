import React, { createContext, useContext, useMemo, useState } from "react";
import { light, dark, resolveCategoryColor, type Palette } from "./colors";
import { spacing, radius, motion } from "./tokens";
import { type, type TypeVariant, fontFamilies } from "./typography";

export type ThemeMode = "system" | "light" | "dark";

interface Theme {
  isDark: boolean;
  colors: Palette;
  categoryColor: (key: string) => string;
  spacing: typeof spacing;
  radius: typeof radius;
  motion: typeof motion;
  type: Record<TypeVariant, import("react-native").TextStyle>;
  fonts: typeof fontFamilies;
}

const ThemeContext = createContext<Theme | null>(null);

interface ThemeProviderProps {
  children: React.ReactNode;
  isDark: boolean;
}

export function ThemeProvider({ children, isDark }: ThemeProviderProps) {
  const value = useMemo<Theme>(() => {
    const colors = isDark ? dark : light;
    return {
      isDark,
      colors,
      categoryColor: (key: string) => resolveCategoryColor(key, isDark),
      spacing,
      radius,
      motion,
      type,
      fonts: fontFamilies,
    };
  }, [isDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
