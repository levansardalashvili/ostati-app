import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAwareForm, ScrollAwareTextInput } from '../components/KeyboardAwareForm';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AddressAutocompleteField } from '../components/AddressAutocompleteField';
import { AddressDetailsField, type AddressDetails } from '../components/AddressDetailsField';
import { Button } from '../components/Button';
import { CurvedAuthHeader } from '../components/CurvedAuthHeader';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';
import { ProgressBar } from '../components/ProgressBar';
import { Reveal } from '../components/Reveal';
import { TextField } from '../components/TextField';
import { TurnstileCaptcha, type TurnstileCaptchaHandle } from '../components/TurnstileCaptcha';
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
  const [addressDetails, setAddressDetails] = useState<AddressDetails>({
    entrance: '',
    apartment: '',
    doorCode: '',
    isPrivateHouse: false,
  });
  const [phoneDigits, setPhoneDigits] = useState('');
  // Task — ეს პაროლი ინახება Supabase-ის ანგარიშზე OTP-ვერიფიკაციის
  // წარმატების შემდეგ (PhoneRegisterVerifyScreen-ის `setNewPassword`)
  // — რომ login-ისას (PhoneLoginScreen) ყოველ ჯერზე ახალი SMS-კოდი აღარ
  // დასჭირდეს, RegisterScreen-ის (email) იგივე პაროლის პრინციპით.
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const captchaRef = useRef<TurnstileCaptchaHandle>(null);

  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  const errors = {
    firstName: touched.firstName && !firstName.trim() ? 'ეს ველი სავალდებულოა' : '',
    lastName: touched.lastName && !lastName.trim() ? 'ეს ველი სავალდებულოა' : '',
    address: !isProvider && touched.address && !address.trim() ? 'ეს ველი სავალდებულოა' : '',
    entrance:
      !isProvider &&
      touched.entrance &&
      !addressDetails.isPrivateHouse &&
      (!addressDetails.entrance.trim() || !addressDetails.apartment.trim()),
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
    (isProvider ||
      addressDetails.isPrivateHouse ||
      (addressDetails.entrance.trim() && addressDetails.apartment.trim())) &&
    PHONE_RE.test(phoneDigits) &&
    password.length >= 8 &&
    password === confirmPassword &&
    !!captchaToken;

  const handleSendCode = async () => {
    setTouched({
      firstName: true,
      lastName: true,
      address: !isProvider,
      entrance: !isProvider,
      phone: true,
      password: true,
      confirmPassword: true,
    });
    setSubmitError('');
    if (!allValid || loading) return;
    setLoading(true);
    try {
      const e164 = `+995${phoneDigits}`;
      await authService.sendPhoneOtp(e164, { captchaToken });
      navigation.navigate('PhoneRegisterVerify', {
        role,
        phone: e164,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        defaultAddress: isProvider ? '' : address.trim(),
        entrance: isProvider ? '' : addressDetails.entrance,
        apartment: isProvider ? '' : addressDetails.apartment,
        doorCode: isProvider ? '' : addressDetails.doorCode,
        isPrivateHouse: isProvider ? false : addressDetails.isPrivateHouse,
        password,
      });
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error));
      setCaptchaToken('');
      captchaRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar style="light" />
      <CurvedAuthHeader
        onBack={() => navigation.goBack()}
        brand={isProvider ? 'ოსტატი' : 'მომხმარებელი'}
        emoji={isProvider ? '🔧' : '🏠'}
      />
      <KeyboardAwareForm
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
          <ProgressBar step={0} total={role === 'provider' ? 3 : 2} />

          <Reveal delay={260}>
            <Text style={styles.subtitle}>შეიყვანეთ თქვენი მონაცემები რეგისტრაციის გასაგრძელებლად</Text>
          </Reveal>

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
              <>
                <AddressAutocompleteField
                  label="მისამართი"
                  required
                  value={address}
                  onChangeText={setAddress}
                  onBlur={() => touch('address')}
                  placeholder="მაგ. ჭავჭავაძის 48"
                  error={errors.address}
                />
                <AddressDetailsField
                  address={address}
                  value={addressDetails}
                  onChange={setAddressDetails}
                  error={errors.entrance}
                />
              </>
            )}

            <View>
              <Text style={styles.phoneLabel}>
                ტელეფონის ნომერი<Text style={styles.requiredMark}> *</Text>
              </Text>
              <View style={[styles.phoneRow, errors.phone && styles.phoneRowError]}>
                <View style={styles.phonePrefix}>
                  <Text style={styles.phonePrefixText}>+995</Text>
                </View>
                <ScrollAwareTextInput
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
            <PasswordStrengthMeter password={password} />
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

            <TurnstileCaptcha
              ref={captchaRef}
              onVerify={setCaptchaToken}
              onExpire={() => setCaptchaToken('')}
            />

            <Button
              label="კოდის გაგზავნა"
              loadingLabel="იგზავნება..."
              onPress={handleSendCode}
              disabled={!allValid}
              loading={loading}
            />

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>უკვე გაქვს ანგარიში? </Text>
              <Pressable onPress={() => navigation.navigate('PhoneLogin')}>
                <Text style={styles.loginLink}>შესვლა</Text>
              </Pressable>
            </View>
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  subtitle: {
    ...typography.body,
    color: colors.foreground,
    marginTop: spacing.lg,
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
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: spacing.xs,
  },
  loginText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  loginLink: {
    ...typography.captionMedium,
    color: colors.primary,
  },
});
