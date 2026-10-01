import React, { useEffect, useRef, useState } from 'react';
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

// 6-ცალკე-ყუთიანი OTP-ველი (Phone*/ForgotPassword*VerifyScreen-ების
// გაზიარებული, #170-ის ვიდეო-რეფერენსის სტილი). ერთი დამალული TextInput
// იტევს რეალურ input-ს (native focus/keyboard/autofill-ისთვის), 6 ვიზუალური
// ყუთი კი უბრალოდ value-ს თითო სიმბოლოს რენდერავს — 6 ცალკე ref/auto-advance
// ლოგიკის გარეშე, გაცილებით მარტივი და საიმედო.
export function OtpCodeInput({ value, onChangeText, onComplete, error }: Props) {
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  // `onComplete`-ის ერთხელ-გამოძახება ერთსა და იმავე 6-ციფრიან კოდზე —
  // მომხმარებელს რომ არასწორი კოდის შემდეგ backspace-ით ერთი ციფრი
  // წაეშალა და იგივე 6 ციფრი ხელახლა აეკრიფა, ორმაგი verify-ის ცდა არ
  // გაეშვას.
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
  // ვიზუალურად უხილავი, მაგრამ ფუნქციონალურად რეალური TextInput — native
  // focus/keyboard/SMS-autofill მთლიანად მასზეა, ყუთები მხოლოდ ასახავენ.
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
