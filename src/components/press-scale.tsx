import React, { useCallback } from "react";
import { Pressable, PressableProps, StyleProp, ViewStyle, Animated, useAnimatedValue } from "react-native";

interface Props extends Omit<PressableProps, "onPress"> {
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Style for the outer touchable (layout/position); `style` stays on the scaling view. */
  containerStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  children: React.ReactNode;
}

/** Apple-like pressable: springs down on press, merges style last. */
export function PressScale({
  onPress,
  onLongPress,
  style,
  containerStyle,
  scaleTo = 0.96,
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
      onPress={() => onPress?.()}
      onLongPress={() => onLongPress?.()}
      onPressIn={() => animate(scaleTo)}
      onPressOut={() => animate(1)}
      style={containerStyle}
      {...rest}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}
