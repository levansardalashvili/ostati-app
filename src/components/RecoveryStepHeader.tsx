import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { ProgressBar } from './ProgressBar';
import { colors, radius, spacing } from '../theme';

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

type Props = {
  icon: IconComponent;
  step: number;
  total: number;
  onBack: () => void;
};

// Password reset header: back + progress + step icon.
export function RecoveryStepHeader({ icon: Icon, step, total, onBack }: Props) {
  return (
    <View>
      <View style={styles.topRow}>
        <Pressable testID="recovery-back-button" style={styles.backButton} onPress={onBack}>
          <ArrowLeft size={18} color={colors.foreground} />
        </Pressable>
        <ProgressBar step={step} total={total} />
        <View style={styles.spacer} />
      </View>
      <View style={styles.iconCircle}>
        <Icon size={26} color={colors.primary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    width: 36,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
});
