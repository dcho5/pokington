import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

/** Native peek-indicator eye icon. Three states: 0 = closed, 1 = half, 2+ = open. */
export function PeekEyeIcon({
  count,
  size = 14,
  strokeWidth = 2,
  color = "currentColor",
}: {
  count: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}): React.ReactElement {
  const sw = strokeWidth;
  if (count === 0) {
    // Closed: gentle upward arc + three downward lash ticks
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M3 13 Q12 8 21 13" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <Path d="M8 14 L7 17 M12 14.5 L12 17.5 M16 14 L17 17" fill="none" stroke={color} strokeWidth={sw - 0.5} strokeLinecap="round" />
      </Svg>
    );
  }
  if (count === 1) {
    // Half-open: top arc + shallower bottom arc + horizontal slit pupil
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M3 12 Q12 6 21 12" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <Path d="M4 12 Q12 16 20 12" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <Path d="M9.5 12 L14.5 12" fill="none" stroke={color} strokeWidth={sw + 0.5} strokeLinecap="round" />
      </Svg>
    );
  }
  // Open: tall eye outline (deep arcs) + filled pupil
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 12 Q12 4 21 12 Q12 20 3 12 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="12" r={3.5} fill={color} />
    </Svg>
  );
}
