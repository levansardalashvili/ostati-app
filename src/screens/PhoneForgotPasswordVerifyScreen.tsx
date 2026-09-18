import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { OtpCodeInput } from '../components/OtpCodeInput';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../theme';
import { authService, getAuthErrorMessage } from '../services/authService';
import { userService } from '../services/userService';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import { useProviderProfile } from '../state/ProviderProfileContext';
import { useResendCooldown } from '../utils/useResendCooldown';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PhoneForgotPasswordVerify'>;

// Task — OTP-კოდი + ახალი პაროლი ერთ ეკრანზე. `OtpCodeInput`-ის
// `onComplete` 6 ციფრზე ავტომატურად ეშვება (`OtpCodeInput.tsx`) — მანამდე,
// სანამ პაროლის ველები შევსებულია, ეს ავტომატური გაშვება `canSubmit`-ის
// (კოდი + ორივე პაროლის ვალიდურობა) გუარდით უვნებელი no-op-ია, submit
// ღილაკიც ზუსტად იმავე `handleSubmit`-ს იძახებს.
export function PhoneForgotPasswordVerifyScreen({ navigation, route }: Props) {
  const { phone } = route.params;
  const { setProfile } = useCustomerProfile();
  const { setProfile: setProviderProfile } = useProviderProfile();
  const { secondsLeft, canResend, restart } = useResendCooldown(60);

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');

  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  const passwordError =
    touched.password && !password
      ? 'ეს ველი სავალდებულოა'
      : touched.password && password.length < 8
        ? 'პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს'
        : '';
  const confirmPasswordError =
    touched.confirmPassword && !confirmPassword
      ? 'ეს ველი სავალდებულოა'
      : touched.confirmPassword && confirmPassword !== password
        ? 'პაროლები არ ემთხვევა'
        : '';

  const canSubmit = code.length === 6 && password.length >= 8 && password === confirmPassword && !submitting;

  const completeSignIn = async (uid: string) => {
    const record = await userService.getUserRecord(uid);
    if (!record) {
      await authService.signOut();
      setError('ეს ანგარიში ვერ მოიძებნა — სცადე თავიდან.');
      return;
    }
    if (record.role === 'provider') {
      setProviderProfile({ firstName: record.firstName, lastName: record.lastName });
      const providerProfile = await userService.getProviderProfileRecord(uid);
      if (providerProfile) setProviderProfile(providerProfile);
      navigation.reset({ index: 0, routes: [{ name: 'ProviderHome' }] });
    } else {
      setProfile({
        firstName: record.firstName,
        lastName: record.lastName,
        email: record.email,
        defaultAddress: record.defaultAddress,
        phone: record.phone,
      });
      navigation.reset({ index: 0, routes: [{ name: 'CustomerHome' }] });
    }
  };

  const handleSubmit = async () => {
    setTouched({ password: true, confirmPassword: true });
    setError('');
    if (code.length !== 6 || password.length < 8 || password !== confirmPassword || submitting) return;
    setSubmitting(true);
    try {
      const { uid } = await authService.verifyPhoneOtp(phone, code);
      await authService.setPhonePassword(password);
      await completeSignIn(uid);
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
      await authService.sendPhoneOtp(phone);
      restart();
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
              <ArrowLeft size={18} color={colors.foreground} />
            </Pressable>
          </View>

          <Text style={styles.title}>ახალი პაროლის დაყენება</Text>
          <Text style={styles.subtitle}>SMS გავაგზავნეთ {phone}-ზე — შეიყვანე კოდი და ახალი პაროლი.</Text>

          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          <OtpCodeInput value={code} onChangeText={setCode} onComplete={handleSubmit} />

          <TextField
            label="ახალი პაროლი"
            required
            value={password}
            onChangeText={setPassword}
            onBlur={() => touch('password')}
            placeholder="••••••••"
            error={passwordError}
            helperText={passwordError ? undefined : 'მინიმუმ 8 სიმბოლო'}
            secureTextEntry
            autoCapitalize="none"
          />
          <TextField
            label="გაიმეორე პაროლი"
            required
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            onBlur={() => touch('confirmPassword')}
            placeholder="••••••••"
            error={confirmPasswordError}
            secureTextEntry
            autoCapitalize="none"
          />

          <Button
            label="დადასტურება"
            loadingLabel="მოწმდება..."
            onPress={handleSubmit}
            disabled={!canSubmit}
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
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h1,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  errorBanner: {
    backgroundColor: colors.dangerBackground,
    borderRadius: radius.md,
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
