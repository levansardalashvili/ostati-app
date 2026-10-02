import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareForm, ScrollAwareTextInput } from '../components/KeyboardAwareForm';
import { Phone } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { RecoveryStepHeader } from '../components/RecoveryStepHeader';
import { TurnstileCaptcha, type TurnstileCaptchaHandle } from '../components/TurnstileCaptcha';
import { colors, radius, spacing, typography } from '../theme';
import { authService, getAuthErrorMessage } from '../services/authService';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PhoneForgotPassword'>;

const PHONE_RE = /^5\d{8}$/;

// ForgotPasswordScreen.tsx-ის (email) ანალოგიური, ტელეფონის ანგარიშისთვის
// — 3-ნაბიჯიანი ეზარდის 1/3 (#170). `sendPhoneOtpForReset` (არა
// `sendPhoneOtp`) — `shouldCreateUser: false`, არარსებულ ნომერზე ახალ
// ცარიელ ანგარიშს არასდროს ქმნის.
export function PhoneForgotPasswordScreen({ navigation }: Props) {
  const [phoneDigits, setPhoneDigits] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const captchaRef = useRef<TurnstileCaptchaHandle>(null);

  const phoneError = touched && !PHONE_RE.test(phoneDigits) ? 'შეიყვანე სწორი მობილურის ნომერი' : '';
  const canSubmit = PHONE_RE.test(phoneDigits) && !!captchaToken && !loading;

  const handleSend = async () => {
    setTouched(true);
    setError('');
    if (!canSubmit) return;
    setLoading(true);
    try {
      const e164 = `+995${phoneDigits}`;
      await authService.sendPhoneOtpForReset(e164, { captchaToken });
      navigation.navigate('PhoneForgotPasswordVerify', { phone: e164 });
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setCaptchaToken('');
      captchaRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAwareForm
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <RecoveryStepHeader icon={Phone} step={0} total={3} onBack={() => navigation.goBack()} />

        <Text style={styles.title}>პაროლი დაგავიწყდა?</Text>
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
            <ScrollAwareTextInput
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

        <View style={styles.field}>
          <TurnstileCaptcha
            ref={captchaRef}
            onVerify={setCaptchaToken}
            onExpire={() => setCaptchaToken('')}
          />
        </View>

        <Button
          label="კოდის გაგზავნა"
          loadingLabel="იგზავნება..."
          onPress={handleSend}
          disabled={!canSubmit}
          loading={loading}
        />
      </KeyboardAwareForm>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
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
