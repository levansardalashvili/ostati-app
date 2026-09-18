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
import { ArrowLeft } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../theme';
import { authService, getAuthErrorMessage } from '../services/authService';
import { userService } from '../services/userService';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import { useProviderProfile } from '../state/ProviderProfileContext';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PhoneLogin'>;

const PHONE_RE = /^5\d{8}$/;

// #107 — ტელეფონის ნომრით შესვლა (როლი აქ არ სჭირდება — LoginScreen.tsx-ის
// იგივე პრინციპით, რეალურ ანგარიშში როლი უკვე `users`-შია).
//
// Task — დარეგისტრირებული ანგარიშისთვის login აღარ ითხოვს ახალ SMS-კოდს:
// ტელეფონი+პაროლი პირდაპირ შედის (authService.signInWithPhonePassword),
// LoginScreen.tsx-ის (email) იგივე ერთსაფეხურიან ნაკადით — ცალკე
// OTP-ვერიფიკაციის ეკრანი (PhoneLoginVerify) ამის შემდეგ საჭირო აღარ იყო,
// მთლიანად მოცილებულია. `completeSignIn`-ის სხეული აქ LoginScreen.tsx-ის
// იგივე ლოგიკის ცალკე ასლია (კოდბაზის დამკვიდრებული "დუბლირება
// აბსტრაქციაზე" პრინციპით — GoogleCompleteScreen-ის RegisterScreen-თან
// დუბლირების იგივე მაგალითი).
export function PhoneLoginScreen({ navigation }: Props) {
  const { setProfile } = useCustomerProfile();
  const { setProfile: setProviderProfile } = useProviderProfile();

  const [phoneDigits, setPhoneDigits] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const touch = (field: string) => setTouched((t) => ({ ...t, [field]: true }));

  const phoneError = touched.phone && !PHONE_RE.test(phoneDigits) ? 'შეიყვანე სწორი მობილურის ნომერი' : '';
  const passwordError = touched.password && !password ? 'ეს ველი სავალდებულოა' : '';
  const canSubmit = PHONE_RE.test(phoneDigits) && !!password && !loading;

  const completeSignIn = async () => {
    const user = authService.getCurrentUser();
    if (!user) {
      setError('ავტორიზაცია ვერ დასრულდა — სცადე თავიდან.');
      return;
    }
    const record = await userService.getUserRecord(user.uid);
    if (!record) {
      await authService.signOut();
      setError('ეს ანგარიში ჯერ არ არის დარეგისტრირებული — ჯერ დარეგისტრირდი.');
      return;
    }
    if (record.role === 'provider') {
      setProviderProfile({ firstName: record.firstName, lastName: record.lastName });
      const providerProfile = await userService.getProviderProfileRecord(user.uid);
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

  const handleLogin = async () => {
    setTouched({ phone: true, password: true });
    setError('');
    if (!canSubmit) return;
    setLoading(true);
    try {
      const e164 = `+995${phoneDigits}`;
      await authService.signInWithPhonePassword(e164, password);
      await completeSignIn();
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={18} color={colors.foreground} />
          </Pressable>

          <Text style={styles.title}>ტელეფონის ნომრით შესვლა</Text>
          <Text style={styles.subtitle}>შეიყვანე ტელეფონის ნომერი და პაროლი.</Text>

          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          <View>
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
                onBlur={() => touch('phone')}
                placeholder="5XX XX XX XX"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                maxLength={9}
                style={styles.phoneInput}
              />
            </View>
            {!!phoneError && <Text style={styles.phoneErrorText}>{phoneError}</Text>}
          </View>

          <View>
            <TextField
              label="პაროლი"
              required
              value={password}
              onChangeText={setPassword}
              onBlur={() => touch('password')}
              placeholder="••••••••"
              error={passwordError}
              secureTextEntry
              autoCapitalize="none"
            />
            <Pressable style={styles.forgotLink} onPress={() => navigation.navigate('PhoneForgotPassword')}>
              <Text style={styles.forgotLinkText}>დაგავიწყდა პაროლი?</Text>
            </Pressable>
          </View>

          <Button
            label="შესვლა"
            loadingLabel="შესვლა..."
            onPress={handleLogin}
            disabled={!canSubmit}
            loading={loading}
          />

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>არ გაქვს ანგარიში? </Text>
            <Pressable onPress={() => navigation.navigate('RoleSelect')}>
              <Text style={styles.registerLink}>რეგისტრაცია</Text>
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
    gap: spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
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
  errorBanner: {
    backgroundColor: colors.dangerBackground,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorBannerText: {
    ...typography.caption,
    color: colors.destructive,
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
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: spacing.sm,
  },
  forgotLinkText: {
    ...typography.captionMedium,
    color: colors.primary,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: spacing.xs,
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
