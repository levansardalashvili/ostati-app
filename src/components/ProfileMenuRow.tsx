import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../theme';
import { usePressScale } from '../utils/usePressScale';

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

type Props = {
  icon: IconComponent;
  label: string;
  iconBg: string;
  iconColor: string;
  badge?: number;
  badgeVariant?: 'solid' | 'tint';
  onPress: () => void;
};

// პროფილის მენიუს რიგი (დიზაინის რეფერენსის Customer/ProviderProfile-ის
// მენიუს item-ების მიხედვით) — გამოიყენება E1/E2-ში.
export function ProfileMenuRow({ icon: Icon, label, iconBg, iconColor, badge, badgeVariant = 'solid', onPress }: Props) {
  const { scale, onPressIn, onPressOut } = usePressScale(0.98);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable style={styles.row} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <View style={styles.left}>
          <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
            <Icon size={17} color={iconColor} />
          </View>
          <Text style={styles.label}>{label}</Text>
        </View>
        <View style={styles.right}>
          {!!badge && (
            <View style={[styles.badge, badgeVariant === 'tint' && styles.badgeTint]}>
              <Text style={[styles.badgeText, badgeVariant === 'tint' && styles.badgeTextTint]}>{badge}</Text>
            </View>
          )}
          <ChevronRight size={15} color={colors.mutedForeground} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '600',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeTint: {
    backgroundColor: colors.secondary,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryForeground,
  },
  badgeTextTint: {
    color: colors.secondaryForeground,
  },
});
