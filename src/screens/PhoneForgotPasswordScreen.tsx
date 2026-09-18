import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Shield } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { colors, radius, spacing, typography } from '../theme';
import { authService, getAuthErrorMessage } from '../services/authService';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PhoneForgotPassword'>;

const PHONE_RE = /^5\d{8}$/;

// Task — ForgotPasswordScreen.tsx-ის (email) ანალოგიური, ტელეფონის
// ანგარიშისთვის — "ბმულის გაგზავნის" ნაცვლად OTP-კოდის გაგზავნა
// (ტელეფონს ბმული ფიზიკურად არ შეესაბამება).
export function PhoneForgotPasswordScreen({ navigation }: Props) {
  const [phoneDigits, setPhoneDigits] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const phoneError = touched && !PHONE_RE.test(phoneDigits) ? 'შეიყვანე სწორი მობილურის ნომერი' : '';
  const canSubmit = PHONE_RE.test(phoneDigits) && !loading;

  const handleSend = async () => {
    setTouched(true);
    setError('');
    if (!canSubmit) return;
    setLoading(true);
    try {
      const e164 = `+995${phoneDigits}`;
      await authService.sendPhoneOtp(e164);
      navigation.navigate('PhoneForgotPasswordVerify', { phone: e164 });
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.content}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={18} color={colors.foreground} />
          </Pressable>

          <View style={styles.headerIcon}>
            <Shield size={24} color={colors.primary} />
          </View>
          <Text style={styles.title}>პაროლის აღდგენა</Text>
          <Text style={styles.subtitle}>შეიყვანე ტელეფონის ნომერი — გამოგიგზავნით დასადასტურებელ SMS-კოდს.</Text>

          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.phoneLabel}>
              ტელეფონის ნომერი<Text style={styles.requiredMark}> *</Text>
            </Text>
            <View style={[styles.phoneRow, phoneError && styles.phoneRowError]}>
              <View style={styles.phonePrefix}>
                <Text style={styles.phonePrefixText}>+995</Text>
              </View>
              <TextInput
                value={phoneDigits}
                onChangeText={(v) => setPhoneDigits(v.replace(/\D/g, '').slice(0, 9))}
                onBlur={() => setTouched(true)}
                placeholder="5XX XX XX XX"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                maxLength={9}
                style={styles.phoneInput}
              />
            </View>
            {!!phoneError && <Text style={styles.phoneErrorText}>{phoneError}</Text>}
          </View>

          <Button
            label="კოდის გაგზავნა"
            loadingLabel="იგზავნება..."
            onPress={handleSend}
            disabled={!canSubmit}
            loading={loading}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.lg,
  },
  errorBanner: {
    backgroundColor: colors.dangerBackground,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    ...typography.caption,
    color: colors.destructive,
  },
  field: {
    marginBottom: spacing.lg,
  },
  phoneLabel: {
    ...typography.captionMedium,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  requiredMark: {
    color: colors.destructive,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  phoneRowError: {
    borderColor: colors.destructive,
  },
  phonePrefix: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  phonePrefixText: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '600',
  },
  phoneInput: {
    ...typography.body,
    color: colors.foreground,
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  phoneErrorText: {
    ...typography.small,
    color: colors.destructive,
    marginTop: spacing.xs,
  },
});
