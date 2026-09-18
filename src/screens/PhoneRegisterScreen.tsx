import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Phone } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AddressAutocompleteField } from '../components/AddressAutocompleteField';
import { Button } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../theme';
import { authService, getAuthErrorMessage } from '../services/authService';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PhoneRegister'>;

const PHONE_RE = /^5\d{8}$/;

// #107 — ტელეფონის ნომრით რეგისტრაცია, RegisterScreen.tsx-ის იგივე
// structure (email/password-ის ნაცვლად — ტელეფონის ველი). განზრახ
// განსხვავდება Google/AppleComplete-ის "ჯერ auth, მერე პროფილის
// დასრულების" ნიმუშისგან — აქ ყველა ველი **წინასწარ** იკრიბება, OTP
// მხოლოდ ვერიფიკაციის ბოლო ნაბიჯია (იხ. PhoneRegisterVerifyScreen-ის
// თავზე სრული მიზეზი).
export function PhoneRegisterScreen({ navigation, route }: Props) {
  const { role } = route.params;
  const isProvider = role === 'provider';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  // Task — ეს პაროლი ინახება Supabase-ის ანგარიშზე OTP-ვერიფიკაციის
  // წარმატების შემდეგ (PhoneRegisterVerifyScreen-ის `setPhonePassword`)
  // — რომ login-ისას (PhoneLoginScreen) ყოველ ჯერზე ახალი SMS-კოდი აღარ
  // დასჭირდეს, RegisterScreen-ის (email) იგივე პაროლის პრინციპით.
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  const errors = {
    firstName: touched.firstName && !firstName.trim() ? 'ეს ველი სავალდებულოა' : '',
    lastName: touched.lastName && !lastName.trim() ? 'ეს ველი სავალდებულოა' : '',
    address: !isProvider && touched.address && !address.trim() ? 'ეს ველი სავალდებულოა' : '',
    phone:
      touched.phone && !phoneDigits
        ? 'ეს ველი სავალდებულოა'
        : touched.phone && !PHONE_RE.test(phoneDigits)
          ? 'შეიყვანე სწორი მობილურის ნომერი (9 ციფრი, დაწყებული 5-ით)'
          : '',
    password:
      touched.password && !password
        ? 'ეს ველი სავალდებულოა'
        : touched.password && password.length < 8
          ? 'პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს'
          : '',
    confirmPassword:
      touched.confirmPassword && !confirmPassword
        ? 'ეს ველი სავალდებულოა'
        : touched.confirmPassword && confirmPassword !== password
          ? 'პაროლები არ ემთხვევა'
          : '',
  };

  const nameValid = !!firstName.trim() && !!lastName.trim();
  const allValid =
    nameValid &&
    (isProvider || address.trim()) &&
    PHONE_RE.test(phoneDigits) &&
    password.length >= 8 &&
    password === confirmPassword;

  const handleSendCode = async () => {
    setTouched({
      firstName: true,
      lastName: true,
      address: !isProvider,
      phone: true,
      password: true,
      confirmPassword: true,
    });
    setSubmitError('');
    if (!allValid || loading) return;
    setLoading(true);
    try {
      const e164 = `+995${phoneDigits}`;
      await authService.sendPhoneOtp(e164);
      navigation.navigate('PhoneRegisterVerify', {
        role,
        phone: e164,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        defaultAddress: isProvider ? '' : address.trim(),
        password,
      });
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
              <ArrowLeft size={18} color={colors.foreground} />
            </Pressable>
            <ProgressBar step={0} total={role === 'provider' ? 3 : 2} />
            <View style={styles.headerSpacer} />
          </View>

          <Text style={styles.title}>ტელეფონის ნომრით რეგისტრაცია</Text>
          <Text style={styles.subtitle}>დაადასტურეთ SMS-კოდი</Text>

          {submitError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{submitError}</Text>
            </View>
          ) : null}

          <View style={styles.fields}>
            <View style={styles.nameRow}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="სახელი"
                  required
                  value={firstName}
                  onChangeText={setFirstName}
                  onBlur={() => touch('firstName')}
                  placeholder={role === 'provider' ? 'მაგ. გიორგი' : 'მაგ. ნინო'}
                  error={errors.firstName}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label="გვარი"
                  required
                  value={lastName}
                  onChangeText={setLastName}
                  onBlur={() => touch('lastName')}
                  placeholder={role === 'provider' ? 'მაგ. ბერიძე' : 'მაგ. სულაბერიძე'}
                  error={errors.lastName}
                />
              </View>
            </View>

            {!isProvider && (
              <AddressAutocompleteField
                label="მისამართი"
                required
                value={address}
                onChangeText={setAddress}
                onBlur={() => touch('address')}
                placeholder="მაგ. ჭავჭავაძის 48"
                error={errors.address}
              />
            )}

            <View>
              <Text style={styles.phoneLabel}>
                ტელეფონის ნომერი<Text style={styles.requiredMark}> *</Text>
              </Text>
              <View style={[styles.phoneRow, errors.phone && styles.phoneRowError]}>
                <View style={styles.phonePrefix}>
                  <Text style={styles.phonePrefixText}>+995</Text>
                </View>
                <TextInput
                  value={phoneDigits}
                  onChangeText={(v) => setPhoneDigits(v.replace(/\D/g, '').slice(0, 9))}
                  onBlur={() => touch('phone')}
                  placeholder="5XX XX XX XX"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  maxLength={9}
                  style={styles.phoneInput}
                />
              </View>
              {!!errors.phone && <Text style={styles.phoneErrorText}>{errors.phone}</Text>}
            </View>

            <TextField
              label="პაროლი"
              required
              value={password}
              onChangeText={setPassword}
              onBlur={() => touch('password')}
              placeholder="••••••••"
              error={errors.password}
              helperText={errors.password ? undefined : 'მინიმუმ 8 სიმბოლო'}
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
              error={errors.confirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <Button
              label="კოდის გაგზავნა"
              loadingLabel="იგზავნება..."
              onPress={handleSendCode}
              disabled={!allValid}
              loading={loading}
            />

            <Text style={styles.loginText}>უკვე გაქვს ანგარიში?</Text>
            <Pressable
              style={({ pressed }) => [styles.phoneButton, pressed && styles.phoneButtonPressed]}
              onPress={() => navigation.navigate('PhoneLogin')}
            >
              <Phone size={18} color={colors.foreground} />
              <Text style={styles.phoneButtonText}>შესვლა ტელეფონით</Text>
            </Pressable>
          </View>
        </ScrollView>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  title: {
    ...typography.h1,
    color: colors.foreground,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.lg,
    textAlign: 'center',
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
  fields: {
    gap: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
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
  loginText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  // Task — RegisterScreen.tsx-ის იგივე ცვლილება: GoogleButton-ის ზუსტად
  // იგივე ზომა/ვიზუალი, Phone აიქონით.
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  phoneButtonPressed: {
    opacity: 0.85,
  },
  phoneButtonText: {
    ...typography.bodyMedium,
    color: colors.foreground,
  },
});
