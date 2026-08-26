import React from 'react';
import { View } from 'react-native';
import { colors } from '../theme';

type Props = {
  step: number;
  total: number;
};

// Onboarding-ის პროგრესის ინდიკატორი (დიზაინის რეფერენსის ProgressBar-ის მიხედვით)
export function ProgressBar({ step, total }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            height: 6,
            borderRadius: 3,
            width: i === step ? 24 : 8,
            backgroundColor: i <= step ? colors.primary : '#E2E8F0',
          }}
        />
      ))}
    </View>
  );
}
