import React from 'react';
import { DimensionValue, View } from 'react-native';
import { colors, radius } from '../theme';

type Props = {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: object;
};

// ჩატვირთვის skeleton ბლოკი (app-states.md: "skeleton placeholders that
// match the final card/component shapes")
export function Skeleton({ width = '100%', height = 16, borderRadius: r = radius.sm, style }: Props) {
  return (
    <View
      style={[
        { width, height, borderRadius: r, backgroundColor: colors.muted },
        style,
      ]}
    />
  );
}
