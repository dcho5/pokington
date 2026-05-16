import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import ReAnimated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

interface FeltReconnectDimProps {
  visible: boolean;
}

export default function FeltReconnectDim({ visible }: FeltReconnectDimProps) {
  const { width: screenWidth } = useWindowDimensions();
  const shimmerWidth = Math.round(screenWidth * 0.65 + 100);

  const overlayOpacity = useSharedValue(0);
  const shimmerX = useSharedValue(-shimmerWidth);

  useEffect(() => {
    if (!visible) {
      overlayOpacity.value = withTiming(0, { duration: 450 });
      cancelAnimation(shimmerX);
      return;
    }

    overlayOpacity.value = withTiming(1, { duration: 500 });

    shimmerX.value = -shimmerWidth;
    shimmerX.value = withRepeat(
      withTiming(screenWidth, { duration: 3200, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const rootStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  return (
    <ReAnimated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, styles.root, rootStyle]}
    >
      <View style={styles.dim} />
      <ReAnimated.View style={[styles.shimmerWrap, { width: shimmerWidth }, shimmerStyle]}>
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.04)", "rgba(255,255,255,0.09)", "rgba(255,255,255,0.04)", "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </ReAnimated.View>
    </ReAnimated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 5,
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6,15,30,0.52)",
  },
  shimmerWrap: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
});
