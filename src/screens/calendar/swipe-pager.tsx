import React, { useCallback } from "react";
import { ViewStyle, StyleProp, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useSharedValue, withTiming, withSpring } from "react-native-reanimated";

interface Props {
  children: React.ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Horizontal pager for calendar period navigation: content follows the finger,
 * then slides out and the next period slides in from the opposite side.
 */
export function SwipePager({ children, onSwipeLeft, onSwipeRight, style }: Props) {
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const animating = useSharedValue(false);

  const nextLeft = useCallback(() => onSwipeLeft(), [onSwipeLeft]);
  const nextRight = useCallback(() => onSwipeRight(), [onSwipeRight]);

  const pan = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      if (animating.value) return;
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (animating.value) return;
      const threshold = width * 0.18;
      const flung = Math.abs(e.velocityX) > 700;
      const left = translateX.value < -threshold || (flung && e.velocityX < 0);
      const right = translateX.value > threshold || (flung && e.velocityX > 0);
      if (left) {
        animating.value = true;
        translateX.value = withTiming(-width, { duration: 140 }, (finished) => {
          if (finished) {
            runOnJS(nextLeft)();
            translateX.value = width;
            translateX.value = withTiming(0, { duration: 140 }, (done) => {
              if (done) animating.value = false;
            });
          } else {
            animating.value = false;
            translateX.value = withSpring(0);
          }
        });
      } else if (right) {
        animating.value = true;
        translateX.value = withTiming(width, { duration: 140 }, (finished) => {
          if (finished) {
            runOnJS(nextRight)();
            translateX.value = -width;
            translateX.value = withTiming(0, { duration: 140 }, (done) => {
              if (done) animating.value = false;
            });
          } else {
            animating.value = false;
            translateX.value = withSpring(0);
          }
        });
      } else {
        translateX.value = withSpring(0, { damping: 30, stiffness: 300 });
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[style, { transform: [{ translateX }] }]}>{children}</Animated.View>
    </GestureDetector>
  );
}
