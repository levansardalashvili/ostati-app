import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAwareForm, ScrollAwareTextInput } from '../components/KeyboardAwareForm';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { CurvedAuthHeader } from '../components/CurvedAuthHeader';
import { Reveal } from '../components/Reveal';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../theme';
import { authService, getAuthErrorMessage } from '../services/authService';
import { loadSignedInUser } from '../utils/signInSession';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import { useProviderProfile } from '../state/ProviderProfileContext';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PhoneLogin'>;

const PHONE_RE = /^5\d{8}$/;

// Phone + password login (no SMS). Hidden while PHONE_AUTH_ENABLED is false.
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
    const result = await loadSignedInUser(user.uid, setProfile, setProviderProfile);
    if ('error' in result) setError(result.error);
    else navigation.reset({ index: 0, routes: [{ name: result.route }] });
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
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar style="light" />
      <CurvedAuthHeader subtitle="კეთილი იყოს თქვენი დაბრუნება!" onBack={() => navigation.goBack()} />
      <KeyboardAwareForm
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
          <Reveal delay={300}>
            <Text style={styles.title}>შესვლა</Text>
          </Reveal>

          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          <Reveal delay={340} style={styles.fields}>
            <View>
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
          </Reveal>

          <Reveal delay={420} style={styles.actions}>
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
  fields: {
    gap: spacing.md,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.lg,
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
