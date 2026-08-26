import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

type Props = {
  initials: string;
  color?: string;
  size?: number;
  online?: boolean;
};

// მრგვალი ავატარი ინიციალებით (დიზაინის რეფერენსის Avi კომპონენტის მიხედვით) —
// გამოიყენება პროფილში, ჩატში, Google-ის ანგარიშის ბარათში და ა.შ.
export function Avatar({ initials, color = colors.primary, size = 44, online = false }: Props) {
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: radius.full, backgroundColor: color },
        ]}
      >
        <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initials}</Text>
      </View>
      {online && (
        <View
          style={[
            styles.onlineDot,
            {
              width: size * 0.27,
              height: size * 0.27,
              borderRadius: radius.full,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.card,
  },
});
