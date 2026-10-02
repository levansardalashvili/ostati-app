import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAwareForm } from '../components/KeyboardAwareForm';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Mail } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { CurvedAuthHeader } from '../components/CurvedAuthHeader';
import { Reveal } from '../components/Reveal';
import { SocialAuthRow } from '../components/SocialAuthRow';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../theme';
import { authService, getAuthErrorMessage } from '../services/authService';
import { userService } from '../services/userService';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import { useProviderProfile } from '../state/ProviderProfileContext';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// A3 — შესვლის ეკრანი (product-spec.md, create-account-form.md)
export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);
  const [aLoading, setALoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [credError, setCredError] = useState('');
  const { setProfile } = useCustomerProfile();
  const { setProfile: setProviderProfile } = useProviderProfile();

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const emailError = touched.email
    ? !email
      ? 'ეს ველი სავალდებულოა'
      : !isEmail(email)
        ? 'შეიყვანე სწორი ელ. ფოსტა'
        : ''
    : '';
  const passError = touched.pass && !pass ? 'ეს ველი სავალდებულოა' : '';
  const canSubmit = email && isEmail(email) && pass && !loading;

  // საავტორიზაციო call-ის წარმატების შემდეგ საერთო ნაბიჯი (email-ითაც,
  // Google-ითაც) — users/{uid}-დან როლის წაკითხვა, შესაბამისი Context-ის
  // ჰიდრატაცია და სწორ Home-ზე გადასვლა. თუ ჩანაწერი არ მოიძებნა (ეს
  // ანგარიში ჯერ არასდროს დარეგისტრირებულა ამ აპში), უკან ვასვლით.
  const completeSignIn = async () => {
    const user = authService.getCurrentUser();
    if (!user) {
      setCredError('ავტორიზაცია ვერ დასრულდა — სცადე თავიდან.');
      return;
    }
    const record = await userService.getUserRecord(user.uid);
    if (!record) {
      await authService.signOut();
      setCredError('ეს ანგარიში ჯერ არ არის დარეგისტრირებული — ჯერ დარეგისტრირდი.');
      return;
    }
    if (record.suspended) {
      await authService.signOut();
      setCredError(`თქვენი ანგარიში შეჩერებულია: ${record.suspensionReason ?? 'წესების დარღვევის გამო'}`);
      return;
    }
    if (record.role === 'provider') {
      setProviderProfile({ firstName: record.firstName, lastName: record.lastName });
      const providerProfile = await userService.getProviderProfileRecord(user.uid);
      if (providerProfile) setProviderProfile(providerProfile);
      // პროფილის row არ არსებობს = setup არ დასრულებულა, ვაბრუნებთ setup-ზე
      navigation.reset({ index: 0, routes: [{ name: providerProfile ? 'ProviderHome' : 'ProviderSetup' }] });
    } else {
      setProfile({
        firstName: record.firstName,
        lastName: record.lastName,
        email: record.email,
        defaultAddress: record.defaultAddress,
        phone: record.phone,
        entrance: record.entrance,
        apartment: record.apartment,
        doorCode: record.doorCode,
        isPrivateHouse: record.isPrivateHouse,
      });
      navigation.reset({ index: 0, routes: [{ name: 'CustomerHome' }] });
    }
  };

  const handleLogin = async () => {
    setTouched({ email: true, pass: true });
    setCredError('');
    if (!canSubmit) return;
    setLoading(true);
    try {
      await authService.signInWithEmail({ email: email.trim(), password: pass });
      await completeSignIn();
    } catch (error) {
      setCredError(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setCredError('');
    setGLoading(true);
    try {
      await authService.signInWithGoogle();
      await completeSignIn();
    } catch (error) {
      setCredError(getAuthErrorMessage(error));
    } finally {
      setGLoading(false);
    }
  };

  const handleApple = async () => {
    setCredError('');
    setALoading(true);
    try {
      await authService.signInWithApple();
      await completeSignIn();
    } catch (error) {
      setCredError(getAuthErrorMessage(error));
    } finally {
      setALoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar style="light" />
      <CurvedAuthHeader subtitle="კეთილი იყოს თქვენი დაბრუნება!" />
      <KeyboardAwareForm
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Reveal delay={300}>
          <Text style={styles.title}>შესვლა</Text>
        </Reveal>

        {credError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{credError}</Text>
          </View>
        ) : null}

        <Reveal delay={340} style={styles.fields}>
          <TextField
            testID="login-email"
            label="ელ. ფოსტა"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setCredError('');
            }}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            placeholder="example@email.com"
            error={emailError}
            icon={Mail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <View>
            <TextField
              testID="login-password"
              label="პაროლი"
              value={pass}
              onChangeText={setPass}
              onBlur={() => setTouched((t) => ({ ...t, pass: true }))}
              placeholder="••••••••"
              error={passError}
              secureTextEntry
              autoCapitalize="none"
            />
            <Pressable
              style={styles.forgotLink}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotLinkText}>დაგავიწყდა პაროლი?</Text>
            </Pressable>
          </View>
        </Reveal>

        <Reveal delay={420} style={styles.actions}>
          <Button
            testID="login-submit-button"
            label="შესვლა"
            loadingLabel="შესვლა..."
            onPress={handleLogin}
            disabled={!canSubmit}
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
            appleButtonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            appleLoadingLabel="Apple-ით შესვლა..."
            onPhone={() => navigation.navigate('PhoneLogin')}
          />

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>არ გაქვს ანგარიში? </Text>
            <Pressable onPress={() => navigation.navigate('RoleSelect')}>
              <Text style={styles.registerLink}>რეგისტრაცია</Text>
            </Pressable>
          </View>
        </Reveal>
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.h2,
    color: colors.foreground,
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
  fields: {
    gap: spacing.md,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
  },
  forgotLinkText: {
    ...typography.captionMedium,
    color: colors.primary,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.lg,
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
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  registerText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  registerLink: {
    ...typography.captionMedium,
    color: colors.primary,
  },
});
