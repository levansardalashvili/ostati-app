import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
};

// SqmPriceField — ერთი სპეციალობის "ფასი კვ.მ-ზე" ველი (რიცხვის ინფუთი +
// "₾ / მ²" სუფიქსი). გამოიყენება მხოლოდ იმ სპეციალობებზე, სადაც
// pricePerSqm === true (`src/data/specialties.ts`).
export function SqmPriceField({ label, value, onChangeText }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={(v) => onChangeText(v.replace(/[^0-9]/g, ''))}
          placeholder="ჩაწერეთ თანხა"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="numeric"
          style={styles.input}
        />
        <Text style={styles.suffix}>₾ / მ²</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.xs + 2,
  },
  label: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '600',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: {
    ...typography.caption,
    color: colors.foreground,
    flex: 1,
    paddingVertical: spacing.md,
  },
  suffix: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
});
