import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../theme';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onComplete: (code: string) => void;
  error?: string;
};

const CODE_LENGTH = 6;

// Six boxes over one hidden TextInput (native focus, keyboard and SMS autofill);
// the boxes only display the value.
export function OtpCodeInput({ value, onChangeText, onComplete, error }: Props) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  // Fire onComplete once per code — retyping the same code must not verify twice.
  const firedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (value.length === CODE_LENGTH && firedForRef.current !== value) {
      firedForRef.current = value;
      onComplete(value);
    }
    if (value.length < CODE_LENGTH) {
      firedForRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <View>
      <Pressable style={styles.row} onPress={() => inputRef.current?.focus()}>
        {Array.from({ length: CODE_LENGTH }).map((_, i) => {
          const filled = i < value.length;
          const active = focused && i === value.length;
          return (
            <View
              key={i}
              style={[
                styles.box,
                filled && styles.boxFilled,
                active && styles.boxActive,
                error && styles.boxError,
              ]}
            >
              <Text style={styles.boxText}>{value[i] ?? ''}</Text>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        testID="otp-code-input"
        ref={inputRef}
        value={value}
        onChangeText={(v) => onChangeText(v.replace(/\D/g, '').slice(0, CODE_LENGTH))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        maxLength={CODE_LENGTH}
        style={styles.hiddenInput}
        autoFocus
      />
      {error ? (
        <View style={styles.errorRow}>
          <AlertCircle size={11} color={colors.destructive} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const BOX_SIZE = 48;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  box: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.secondary,
  },
  boxActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  boxError: {
    borderColor: colors.destructive,
  },
  boxText: {
    ...typography.h3,
    color: colors.foreground,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
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
});
