import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAwareForm } from '../components/KeyboardAwareForm';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Mail } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AddressAutocompleteField } from '../components/AddressAutocompleteField';
import { AddressDetailsField, type AddressDetails } from '../components/AddressDetailsField';
import { Button } from '../components/Button';
import { CurvedAuthHeader } from '../components/CurvedAuthHeader';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';
import { ProgressBar } from '../components/ProgressBar';
import { Reveal } from '../components/Reveal';
import { SocialAuthRow } from '../components/SocialAuthRow';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../theme';
import { authService, getAuthErrorMessage } from '../services/authService';
import { userService } from '../services/userService';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import { useProviderProfile } from '../state/ProviderProfileContext';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Email registration. Address only for customers (providers pick a work area in setup).
export function RegisterScreen({ navigation, route }: Props) {
  const { role } = route.params;
  const isProvider = role === 'provider';
  const { setProfile } = useCustomerProfile();
  const { setProfile: setProviderProfile } = useProviderProfile();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [addressDetails, setAddressDetails] = useState<AddressDetails>({
    entrance: '',
    apartment: '',
    doorCode: '',
    isPrivateHouse: false,
  });
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  // "Next" key chains the fields.
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [aLoading, setALoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  const errors = {
    firstName: touched.firstName && !firstName.trim() ? 'ეს ველი სავალდებულოა' : '',
    lastName: touched.lastName && !lastName.trim() ? 'ეს ველი სავალდებულოა' : '',
    email:
      touched.email && !email
        ? 'ეს ველი სავალდებულოა'
        : touched.email && !isEmail(email)
          ? 'შეიყვანე სწორი ელ. ფოსტა'
          : '',
    address: !isProvider && touched.address && !address.trim() ? 'ეს ველი სავალდებულოა' : '',
    entrance:
      !isProvider &&
      touched.entrance &&
      !addressDetails.isPrivateHouse &&
      (!addressDetails.entrance.trim() || !addressDetails.apartment.trim()),
    pass:
      touched.pass && !pass
        ? 'ეს ველი სავალდებულოა'
        : touched.pass && pass.length < 8
          ? 'პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს'
          : '',
    confirm:
      touched.confirm && !confirm
        ? 'ეს ველი სავალდებულოა'
        : touched.confirm && confirm !== pass
          ? 'პაროლები არ ემთხვევა'
          : '',
  };

  const nameValid = !!firstName.trim() && !!lastName.trim();
  const allValid =
    nameValid &&
    isEmail(email) &&
    (isProvider || address.trim()) &&
    (isProvider ||
      addressDetails.isPrivateHouse ||
      (addressDetails.entrance.trim() && addressDetails.apartment.trim())) &&
    pass.length >= 8 &&
    pass === confirm;

  const handleSubmit = async () => {
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      address: !isProvider,
      entrance: !isProvider,
      pass: true,
      confirm: true,
    });
    setSubmitError('');
    if (!allValid || loading) return;
    setLoading(true);
    try {
      // signUp created an unconfirmed account and sent the code; the users row is
      // written after verification (RegisterVerifyEmailScreen).
      const goToVerify = () => {
        setLoading(false);
        navigation.navigate('RegisterVerifyEmail', {
          role,
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          defaultAddress: isProvider ? '' : address.trim(),
          entrance: isProvider ? '' : addressDetails.entrance,
          apartment: isProvider ? '' : addressDetails.apartment,
          doorCode: isProvider ? '' : addressDetails.doorCode,
          isPrivateHouse: isProvider ? false : addressDetails.isPrivateHouse,
        });
      };

      const completeWithUid = async (uid: string) => {
        const record = {
          role,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          defaultAddress: isProvider ? '' : address.trim(),
          phone: '',
          entrance: isProvider ? '' : addressDetails.entrance,
          apartment: isProvider ? '' : addressDetails.apartment,
          doorCode: isProvider ? '' : addressDetails.doorCode,
          isPrivateHouse: isProvider ? false : addressDetails.isPrivateHouse,
        };
        try {
          await userService.createUserRecord(uid, record);
        } catch {
          // One retry for a brief network drop.
          await new Promise((resolve) => setTimeout(resolve, 800));
          await userService.createUserRecord(uid, record);
        }
        // This screen stays in the stack (navigate) — reset loading for when the user comes back.
        setLoading(false);
        if (role === 'provider') {
          setProviderProfile({ firstName: firstName.trim(), lastName: lastName.trim() });
          // navigate, not replace, so ProviderSetup's back arrow returns here.
          navigation.navigate('ProviderSetup');
        } else {
          setProfile({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            defaultAddress: address.trim(),
            entrance: addressDetails.entrance,
            apartment: addressDetails.apartment,
            doorCode: addressDetails.doorCode,
            isPrivateHouse: addressDetails.isPrivateHouse,
          });
          navigation.navigate('CustomerSetup', { userName: `${firstName.trim()} ${lastName.trim()}` });
        }
      };

      try {
        const { uid, needsEmailVerification } = await authService.registerWithEmail({
          email: email.trim(),
          password: pass,
          role,
        });
        if (needsEmailVerification) {
          goToVerify();
        } else {
          // "Confirm email" is off — finish right away.
          await completeWithUid(uid);
        }
        return;
      } catch (registerError) {
        if ((registerError as { message?: string } | null)?.message !== 'User already registered') {
          throw registerError;
        }
        // A half-finished earlier attempt: email not confirmed yet → continue to verify;
        // confirmed but no users row → finish now. Anything else → "already registered".
        let existingUid: string;
        try {
          existingUid = (await authService.signInWithEmail({ email: email.trim(), password: pass })).uid;
        } catch (signInError) {
          if ((signInError as { message?: string } | null)?.message === 'Email not confirmed') {
            await authService.resendRegistrationOtp(email.trim()).catch(() => {});
            goToVerify();
            return;
          }
          throw registerError;
        }
        if (await userService.getUserRecord(existingUid)) {
          await authService.signOut().catch(() => {});
          throw registerError;
        }
        await completeWithUid(existingUid);
      }
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error));
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setSubmitError('');
    setGLoading(true);
    try {
      await authService.signInWithGoogle();
      navigation.navigate('SocialComplete', { role, provider: 'google' });
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error));
    } finally {
      setGLoading(false);
    }
  };

  const handleApple = async () => {
    setSubmitError('');
    setALoading(true);
    try {
      const { appleFullName } = await authService.signInWithApple();
      navigation.navigate('SocialComplete', { role, provider: 'apple', appleFullName });
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error));
    } finally {
      setALoading(false);
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
                  testID="register-first-name"
                  label="სახელი"
                  required
                  value={firstName}
                  onChangeText={setFirstName}
                  onBlur={() => touch('firstName')}
                  placeholder={role === 'provider' ? 'მაგ. გიორგი' : 'მაგ. ნინო'}
                  error={errors.firstName}
                  returnKeyType="next"
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  ref={lastNameRef}
                  testID="register-last-name"
                  label="გვარი"
                  required
                  value={lastName}
                  onChangeText={setLastName}
                  onBlur={() => touch('lastName')}
                  placeholder={role === 'provider' ? 'მაგ. ბერიძე' : 'მაგ. სულაბერიძე'}
                  error={errors.lastName}
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </View>
            </View>
            <TextField
              ref={emailRef}
              testID="register-email"
              label="ელ. ფოსტა"
              required
              value={email}
              onChangeText={setEmail}
              onBlur={() => touch('email')}
              placeholder="example@email.com"
              error={errors.email}
              icon={Mail}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => (isProvider ? passRef : addressRef).current?.focus()}
            />
            {!isProvider && (
              <>
                <AddressAutocompleteField
                  ref={addressRef}
                  label="მისამართი"
                  required
                  value={address}
                  onChangeText={setAddress}
                  onBlur={() => touch('address')}
                  placeholder="მაგ. ჭავჭავაძის 48"
                  error={errors.address}
                  onSubmitEditing={() => passRef.current?.focus()}
                />
                <AddressDetailsField
                  address={address}
                  value={addressDetails}
                  onChange={setAddressDetails}
                  error={errors.entrance}
                />
              </>
            )}
            <TextField
              ref={passRef}
              testID="register-password"
              label="პაროლი"
              required
              value={pass}
              onChangeText={setPass}
              onBlur={() => touch('pass')}
              placeholder="••••••••"
              error={errors.pass}
              helperText={errors.pass ? undefined : 'მინიმუმ 8 სიმბოლო'}
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
            />
            <PasswordStrengthMeter password={pass} />
            <TextField
              ref={confirmRef}
              testID="register-confirm-password"
              label="გაიმეორე პაროლი"
              required
              value={confirm}
              onChangeText={setConfirm}
              onBlur={() => touch('confirm')}
              placeholder="••••••••"
              error={errors.confirm}
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            <Button
              label="გაგრძელება"
              loadingLabel="გაგრძელება..."
              onPress={handleSubmit}
              disabled={!allValid}
              loading={loading}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ან</Text>
              <View style={styles.dividerLine} />
            </View>

            <SocialAuthRow
              onGoogle={handleGoogle}
              gLoading={gLoading}
              onApple={handleApple}
              aLoading={aLoading}
              appleAvailable={appleAvailable}
              appleButtonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              appleLoadingLabel="Apple-ით გაგრძელება..."
              onPhone={() => navigation.navigate('PhoneRegister', { role })}
            />

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>უკვე გაქვს ანგარიში? </Text>
              <Pressable onPress={() => navigation.navigate('Login')}>
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.small,
    color: colors.mutedForeground,
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
