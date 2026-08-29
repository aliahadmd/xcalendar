import React from "react";
import { Text, TextProps, I18nManager } from "react-native";
import { useTheme } from "@/theme/theme";
import type { TypeVariant } from "@/theme/typography";

interface Props extends TextProps {
  variant?: TypeVariant;
  color?: string;
  children?: React.ReactNode;
}

export function ThemedText({ variant = "body", color, style, children, ...rest }: Props) {
  const theme = useTheme();
  return (
    <Text style={[theme.type[variant], { color: color ?? theme.colors.label }, style]} {...rest}>
      {children}
    </Text>
  );
}
