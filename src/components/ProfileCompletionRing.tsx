import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../theme';

type Props = {
  percent: number;
  size?: number;
  strokeWidth?: number;
};

// Task — მარტივი, circular percentage indicator — ცვლის
// VerificationRequestCard-ის ძველ, ტექსტურ "დაასრულე პროფილი
// მოთხოვნამდე" + აკლია-ველების ჩამონათვალს (მომხმარებლის მოთხოვნით,
// მინიმალისტური "პროცენტი" ვიზუალის სასარგებლოდ). `getVerificationEligibility`-ის
// იმავე 4 შემოწმებაზეა აგებული (`ProviderProfileContext.tsx`).
export function ProfileCompletionRing({ percent, size = 52, strokeWidth = 5 }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.muted} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.primary}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.labelWrap}>
        <Text style={styles.label}>{clamped}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.foreground,
  },
});
