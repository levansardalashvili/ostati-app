import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import { ArrowLeft, Mail, Phone } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AddressAutocompleteField } from '../components/AddressAutocompleteField';
import { Button } from '../components/Button';
import { GoogleButton } from '../components/GoogleButton';
import { ProgressBar } from '../components/ProgressBar';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../theme';
import { authService, getAuthErrorMessage } from '../services/authService';
import { userService } from '../services/userService';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import { useProviderProfile } from '../state/ProviderProfileContext';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// A3 — რეგისტრაცია (product-spec.md, create-account-form.md).
// მისამართის ველი customer-ისთვისაც ემატება — დიზაინის რეფერენსის
// მიხედვით, პრიორიტეტის წესის თანახმად (ზიპი კონფლიქტში იმარჯვებს).
// Provider-ისთვის მისამართი საერთოდ არ ჩანს/არ სავალდებულოა (მომხმარებლის
// მოთხოვნით) — Provider-ის სამუშაო არეალს მოგვიანებით, ProviderSetup-ზე
// ირჩევს (RegionAreaPicker), საცხოვრებელი მისამართი მას საერთოდ არ სჭირდება.
// "სახელი და გვარი" ორივე როლისთვის გაყოფილია ცალკე ველებად
// (მომხმარებლის მოთხოვნით override-ავს ზიპის ერთიან ველს).
export function RegisterScreen({ navigation, route }: Props) {
  const { role } = route.params;
  const isProvider = role === 'provider';
  const { setProfile } = useCustomerProfile();
  const { setProfile: setProviderProfile } = useProviderProfile();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
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
    nameValid && isEmail(email) && (isProvider || address.trim()) && pass.length >= 8 && pass === confirm;

  const handleSubmit = async () => {
    setTouched({ firstName: true, lastName: true, email: true, address: !isProvider, pass: true, confirm: true });
    setSubmitError('');
    if (!allValid || loading) return;
    setLoading(true);
    try {
      const { uid } = await authService.registerWithEmail({ email: email.trim(), password: pass, role });
      // Supabase-ის `users` ცხრილის row — Login-ს დასჭირდება role-ის
      // წასაკითხად (რომელ Home-ზე გადაიყვანოს ავტორიზაციის შემდეგ).
      await userService.createUserRecord(uid, {
        role,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        defaultAddress: isProvider ? '' : address.trim(),
        phone: '',
      });
      // Task — უკან-ისრით ამ ეკრანზე დაბრუნებისას ღილაკი "რეგისტრაცია..."-ზე
      // ჩარჩენილი აღარ დარჩეს (`navigate`-ის, არა `replace`-ის შემდეგ ეს
      // ეკრანი აღარ იშლება, `loading`-ის reset კი მანამდე მხოლოდ catch-ში
      // ხდებოდა — წარმატებაზე screen უბრალოდ ქრებოდა, state-ს არავინ
      // კითხულობდა).
      setLoading(false);
      if (role === 'provider') {
        setProviderProfile({ firstName: firstName.trim(), lastName: lastName.trim() });
        // `navigate` (არა `replace`), რომ ეს ეკრანი სტეკში დარჩეს:
        // ProviderSetup-ის ახალი უკან-ისარი (`navigation.goBack()`) ამ
        // ზუსტად ამ ეკრანზე დაბრუნდეს, ზუსტად ისე, როგორც
        // Google/Apple/Phone-ის რეგისტრაციის გზებზეც უკვე მუშაობდა
        // (იქ `navigation.navigate('GoogleComplete'|...)`-ით მისული
        // შუალედური ეკრანი `replace`-ავს საკუთარ თავს ProviderSetup-ით,
        // Register კი სტეკში ხელუხლებელი რჩება).
        navigation.navigate('ProviderSetup');
      } else {
        setProfile({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          defaultAddress: address.trim(),
        });
        navigation.navigate('CustomerSetup', { userName: `${firstName.trim()} ${lastName.trim()}` });
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
      navigation.navigate('GoogleComplete', { role });
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
      navigation.navigate('AppleComplete', { role, appleFullName });
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error));
    } finally {
      setALoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
              <ArrowLeft size={18} color={colors.foreground} />
            </Pressable>
            <ProgressBar step={0} total={role === 'provider' ? 3 : 2} />
            {/* Nav-fix pass, task 6 — this used to reuse `styles.backButton`
                (same visible circular muted-gray shape as the real button
                on the left) purely to balance the ProgressBar's centering,
                even though it had no icon and no onPress — a dead
                icon-looking shape with no action. Still needed for layout
                balance (`header` is `justifyContent: 'space-between'`), so
                kept as a same-sized spacer, just invisible instead of
                styled to look like a button. */}
            <View style={styles.headerSpacer} />
          </View>

          <Text style={styles.title}>ანგარიშის შექმნა</Text>
          <Text style={styles.subtitle}>შეიყვანეთ თქვენი მონაცემები რეგისტრაციის გასაგრძელებლად.</Text>

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
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  testID="register-last-name"
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
            <TextField
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
            />
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
            <TextField
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
            />
            <TextField
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
            />

            {/* Task — მომსახურების პირობების დათანხმება ორივე როლისთვის
                გადატანილია მეორე გვერდის (ProviderSetup/CustomerSetup)
                ბოლოში — Provider-ისთვის ჩნდება მხოლოდ იმ ეკრანის
                სავალდებულო ველების შევსების შემდეგ, Customer-ისთვის კი
                (მეორე გვერდს სავალდებულო ველი არ აქვს) დაუყოვნებლივ
                ხელმისაწვდომია. */}
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

            <GoogleButton loading={gLoading} onPress={handleGoogle} />

            {appleAvailable && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={radius.md}
                style={styles.appleButton}
                onPress={handleApple}
              />
            )}
            {aLoading && <Text style={styles.appleLoadingText}>Apple-ით გაგრძელება...</Text>}

            <Pressable
              style={({ pressed }) => [styles.phoneButton, pressed && styles.phoneButtonPressed]}
              onPress={() => navigation.navigate('PhoneRegister', { role })}
            >
              <Phone size={18} color={colors.foreground} />
              <Text style={styles.phoneButtonText}>ტელეფონით გაგრძელება</Text>
            </Pressable>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>უკვე გაქვს ანგარიში? </Text>
              <Pressable onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>შესვლა</Text>
              </Pressable>
            </View>
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
  // Task 6 — invisible layout-balance spacer (same width as backButton,
  // no visible shape) — matches GoogleCompleteScreen.tsx/CustomerSetupScreen.tsx/
  // ProviderSetupScreen.tsx's existing headerSpacer pattern.
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
  appleButton: {
    minHeight: 52,
    width: '100%',
  },
  appleLoadingText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  // Task — GoogleButton-ის ზუსტად იგივე ზომა/ვიზუალი (minHeight/radius/
  // border/background), რომ ორივე ღილაკი ერთნაირად გამოიყურებოდეს —
  // ცალკე კომპონენტად არ გატანილა, რადგან მისი აიქონი (Phone, არა Google
  // ლოგო) ერთადერთი განსხვავებაა და მხოლოდ აქ გამოიყენება.
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
