import React, { useState } from 'react';
import {
  KeyboardTypeOptions,
  Pressable,
  ReturnKeyTypeOptions,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AlertCircle, Eye, EyeOff } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../theme';
import { useScrollIntoViewOnFocus } from './KeyboardAwareForm';

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  secureTextEntry?: boolean;
  icon?: IconComponent;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
  // for Maestro: some fields share a placeholder
  testID?: string;
  // red * next to the label
  required?: boolean;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
};

// Text field: label, optional icon, password toggle, error/helper text.
export const TextField = React.forwardRef<TextInput, Props>(function TextField({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  error,
  helperText,
  secureTextEntry,
  icon: Icon,
  keyboardType,
  autoCapitalize = 'sentences',
  maxLength,
  testID,
  required,
  returnKeyType,
  onSubmitEditing,
}, forwardedRef) {
  const [hidden, setHidden] = useState(!!secureTextEntry);
  const { ref: scrollRef, onFocus } = useScrollIntoViewOnFocus();

  return (
    <View>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.requiredMark}> *</Text>}
      </Text>
      <View style={styles.inputWrapper}>
        {Icon && (
          <View style={styles.leftIcon}>
            <Icon size={15} color={colors.mutedForeground} />
          </View>
        )}
        <TextInput
          ref={(node) => {
            scrollRef.current = node;
            if (typeof forwardedRef === 'function') forwardedRef(node);
            else if (forwardedRef) (forwardedRef as React.MutableRefObject<TextInput | null>).current = node;
          }}
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry={secureTextEntry && hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={!onSubmitEditing}
          style={[
            styles.input,
            Icon ? styles.inputWithLeftIcon : null,
            secureTextEntry ? styles.inputWithRightIcon : null,
            error ? styles.inputError : null,
          ]}
        />
        {secureTextEntry && (
          <Pressable style={styles.rightIcon} onPress={() => setHidden((h) => !h)}>
            {hidden ? (
              <Eye size={16} color={colors.mutedForeground} />
            ) : (
              <EyeOff size={16} color={colors.mutedForeground} />
            )}
          </Pressable>
        )}
      </View>
      {error ? (
        <View style={styles.errorRow}>
          <AlertCircle size={11} color={colors.destructive} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  label: {
    ...typography.captionMedium,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  requiredMark: {
    color: colors.destructive,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    ...typography.body,
    color: colors.foreground,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  inputWithLeftIcon: {
    paddingLeft: 40,
  },
  inputWithRightIcon: {
    paddingRight: 44,
  },
  inputError: {
    borderColor: colors.destructive,
  },
  leftIcon: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 1,
  },
  rightIcon: {
    position: 'absolute',
    right: spacing.md,
    padding: spacing.xs,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  errorText: {
    ...typography.small,
    color: colors.destructive,
  },
  helperText: {
    ...typography.small,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
});
