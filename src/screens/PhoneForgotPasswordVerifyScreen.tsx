import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareForm } from '../components/KeyboardAwareForm';
import { MessageSquare } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { OtpCodeInput } from '../components/OtpCodeInput';
import { RecoveryStepHeader } from '../components/RecoveryStepHeader';
import { colors, spacing, typography } from '../theme';
import { authService, getAuthErrorMessage } from '../services/authService';
import { useResendCooldown } from '../utils/useResendCooldown';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PhoneForgotPasswordVerify'>;

// Phone password reset 2/3: the code. Verifying creates the session; next is ResetPassword.
export function PhoneForgotPasswordVerifyScreen({ navigation, route }: Props) {
  const { phone } = route.params;
  const { secondsLeft, canResend, restart } = useResendCooldown(60);

  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (value?: string) => {
    const otp = value ?? code;
    setError('');
    if (otp.length !== 6 || submitting) return;
    setSubmitting(true);
    try {
      await authService.verifyPhoneOtp(phone, otp);
      navigation.navigate('ResetPassword');
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setCode('');
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || resending) return;
    setError('');
    setResending(true);
    try {
      await authService.sendPhoneOtpForReset(phone);
      restart();
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAwareForm
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <RecoveryStepHeader icon={MessageSquare} step={1} total={3} onBack={() => navigation.goBack()} />

        <Text style={styles.title}>შეამოწმე SMS</Text>
        <Text style={styles.subtitle}>კოდი გავაგზავნეთ {phone}-ზე — შეიყვანე ქვემოთ.</Text>

        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <View style={styles.otpWrap}>
          <OtpCodeInput value={code} onChangeText={setCode} onComplete={handleSubmit} />
        </View>

        <Button
          label="დადასტურება"
          loadingLabel="მოწმდება..."
          onPress={() => handleSubmit()}
          disabled={code.length !== 6}
          loading={submitting}
        />

        <View style={styles.resendRow}>
          {canResend ? (
            <Pressable onPress={handleResend} disabled={resending}>
              <Text style={styles.resendLink}>{resending ? 'იგზავნება...' : 'კოდის ხელახლა გაგზავნა'}</Text>
            </Pressable>
          ) : (
            <Text style={styles.resendMuted}>ხელახლა გაგზავნა — {secondsLeft} წმ</Text>
          )}
        </View>
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
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  otpWrap: {
    marginBottom: spacing.sm,
  },
  errorBanner: {
    backgroundColor: colors.dangerBackground,
    borderRadius: 12,
    padding: spacing.md,
  },
  errorBannerText: {
    ...typography.caption,
    color: colors.destructive,
  },
  resendRow: {
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  resendLink: {
    ...typography.captionMedium,
    color: colors.primary,
  },
  resendMuted: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
});
