import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "@/theme/theme";
import { ThemedText } from "./themed-text";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
}

/** Apple-style segmented control with sliding thumb. */
export function SegmentedControl<T extends string>({ options, value, onChange, style }: Props<T>) {
  const theme = useTheme();
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const anim = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: index,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  }, [index, anim]);

  const segmentW = 100 / options.length;

  return (
    <View
      style={[
        {
          flexDirection: "row",
          backgroundColor: theme.colors.fill,
          borderRadius: theme.radius.sm,
          padding: 2,
          borderCurve: "continuous",
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.thumb,
          {
            width: `${segmentW}%`,
            backgroundColor: theme.colors.card,
            shadowColor: "#000",
            shadowOpacity: 0.12,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2,
            transform: [
              {
                translateX: anim.interpolate({
                  inputRange: [0, options.length - 1],
                  outputRange: ["0%", `${(options.length - 1) * 100}%`],
                }),
              },
            ],
          },
        ]}
      />
      {options.map((o) => (
        <Animated.Text
          key={o.value}
          onPress={() => onChange(o.value)}
          style={[
            styles.label,
            {
              width: `${segmentW}%`,
              color: o.value === value ? theme.colors.label : theme.colors.label2,
              fontFamily: o.value === value ? theme.fonts.semibold : theme.fonts.regular,
            },
          ]}
          allowFontScaling={false}
        >
          {o.label}
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    position: "absolute",
    top: 2,
    bottom: 2,
    left: 2,
    borderRadius: 8,
    borderCurve: "continuous",
  },
  label: {
    fontSize: 13,
    lineHeight: 22,
    textAlign: "center",
  },
});
