import React from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { usePressScale } from '../utils/usePressScale';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** outline — ღია ფონი + ლურჯი ჩარჩო არჩეულობისას (Provider Setup-ის რაიონები).
   *  filled — სავსე ლურჯი ფონი არჩეულობისას (Home-ის ფილტრის ჩიპები). */
  variant?: 'outline' | 'filled';
};

// მრავალარჩევანის ჩიპი (დიზაინის რეფერენსის area/category toggle ღილაკების
// მიხედვით) — გამოიყენება Provider Setup-ის სამუშაო რაიონებში და Customer/
// Provider Home-ის ფილტრებში (product-spec.md, C1).
export function Chip({ label, selected, onPress, variant = 'outline' }: Props) {
  const { scale, onPressIn, onPressOut } = usePressScale(0.93);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[
          styles.chip,
          variant === 'outline' && selected && styles.outlineSelected,
          variant === 'filled' && styles.filled,
          variant === 'filled' && selected && styles.filledSelected,
        ]}
      >
        <Text
          style={[
            styles.label,
            variant === 'outline' && selected && styles.labelOutlineSelected,
            variant === 'filled' && styles.labelFilled,
            variant === 'filled' && selected && styles.labelFilledSelected,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  outlineSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.secondary,
  },
  filled: {
    borderWidth: 1,
    paddingVertical: spacing.sm - 2,
  },
  filledSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  label: {
    ...typography.captionMedium,
    color: colors.mutedForeground,
  },
  labelOutlineSelected: {
    color: colors.secondaryForeground,
  },
  labelFilled: {
    color: colors.mutedForeground,
  },
  labelFilledSelected: {
    color: colors.primaryForeground,
  },
});
