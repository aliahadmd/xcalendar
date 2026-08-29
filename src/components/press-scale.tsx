import React, { useCallback } from "react";
import { Pressable, PressableProps, StyleProp, ViewStyle, Animated, useAnimatedValue } from "react-native";
import { useTheme } from "@/theme/theme";
import { haptic, type HapticKind } from "@/utils/haptics";

interface Props extends Omit<PressableProps, "onPress"> {
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Style for the outer touchable (layout/position); `style` stays on the scaling view. */
  containerStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  hapticKind?: HapticKind | null;
  children: React.ReactNode;
}

/** Apple-like pressable: springs down on press, haptic feedback, merges style last. */
export function PressScale({
  onPress,
  onLongPress,
  style,
  containerStyle,
  scaleTo = 0.96,
  hapticKind = "light",
  children,
  ...rest
}: Props) {
  const scale = useAnimatedValue(1);

  const animate = useCallback(
    (to: number, cb?: () => void) =>
      Animated.spring(scale, {
        toValue: to,
        useNativeDriver: true,
        speed: 40,
        bounciness: 6,
      }).start(cb),
    [scale],
  );

  return (
    <Pressable
      onPress={() => {
        if (hapticKind) haptic(hapticKind);
        onPress?.();
      }}
      onLongPress={() => {
        if (hapticKind) haptic("medium");
        onLongPress?.();
      }}
      onPressIn={() => animate(scaleTo)}
      onPressOut={() => animate(1)}
      style={containerStyle}
      {...rest}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}
