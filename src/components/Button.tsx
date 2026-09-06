import React from 'react';
import {
  ActivityIndicator,
  Animated,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { usePressScale } from '../utils/usePressScale';

export type ButtonVariant =
  | 'primary'
  | 'outline'
  | 'text'
  | 'destructive'
  | 'destructiveOutline';

type Props = {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
  style?: ViewStyle;
  // E2E (Maestro) support — several screens have more than one button with
  // the same label text (e.g. a menu row and its confirmation sheet both
  // saying "გასვლა"), which text-based selectors can't disambiguate.
  testID?: string;
};

// საერთო Button კომპონენტი — იზიარებს ერთსა და იმავე ზომებსა და სტილს
// მთელ აპში (app-states.md: "Use the SAME button dimensions and styling").
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  loadingLabel,
  fullWidth = true,
  style,
  testID,
}: Props) {
  const isDisabled = disabled || loading;
  const { scale, onPressIn: handlePressIn, onPressOut: handlePressOut } = usePressScale();

  return (
    <Animated.View style={[fullWidth && styles.fullWidth, { transform: [{ scale }] }]}>
      <Pressable
        testID={testID}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.base,
          variantStyles[variant],
          isDisabled && styles.disabled,
          pressed && !isDisabled && styles.pressed,
          style,
        ]}
      >
        {loading ? (
          <>
            <ActivityIndicator
              size="small"
              color={textColorFor(variant)}
              style={styles.spinner}
            />
            <Text style={[styles.label, { color: textColorFor(variant) }]}>
              {loadingLabel ?? label}
            </Text>
          </>
        ) : (
          <Text style={[styles.label, { color: textColorFor(variant) }]}>
            {label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

function textColorFor(variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      return colors.primaryForeground;
    case 'destructive':
      return colors.destructiveForeground;
    case 'destructiveOutline':
      return colors.destructive;
    case 'text':
      return colors.primary;
    case 'outline':
    default:
      return colors.foreground;
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  label: {
    ...typography.bodyMedium,
  },
  spinner: {
    marginRight: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});

const variantStyles: Record<ButtonVariant, ViewStyle> = StyleSheet.create({
  primary: {
    backgroundColor: colors.primary,
  },
  outline: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: {
    backgroundColor: 'transparent',
    minHeight: 40,
    paddingHorizontal: 0,
  },
  destructive: {
    backgroundColor: colors.destructive,
  },
  destructiveOutline: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.destructive,
  },
});
