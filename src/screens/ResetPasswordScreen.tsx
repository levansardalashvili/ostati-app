import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareForm } from '../components/KeyboardAwareForm';
import { KeyRound } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { PasswordChecklist } from '../components/PasswordChecklist';
import { RecoveryStepHeader } from '../components/RecoveryStepHeader';
import { SuccessCheck } from '../components/SuccessCheck';
import { TextField } from '../components/TextField';
import { colors, spacing, typography } from '../theme';
import { authService, getAuthErrorMessage } from '../services/authService';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

// Last reset step for both: new password, then sign out and log in again.
export function ResetPasswordScreen({ navigation }: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

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

  const canSubmit = password.length >= 8 && password === confirmPassword && !submitting;

  const handleSubmit = async () => {
    setTouched({ password: true, confirmPassword: true });
    setError('');
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await authService.setNewPassword(password);
      await authService.signOut();
      setDone(true);
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.successWrap}>
          <SuccessCheck />
          <Text style={styles.successTitle}>პაროლი განახლდა</Text>
          <Text style={styles.successSubtitle}>ახლა შეგიძლია ახალი პაროლით შესვლა.</Text>
          <Button
            label="შესვლაზე დაბრუნება"
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAwareForm
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <RecoveryStepHeader icon={KeyRound} step={2} total={3} onBack={() => navigation.goBack()} />

        <Text style={styles.title}>ახალი პაროლი</Text>
        <Text style={styles.subtitle}>შექმენი ახალი, უსაფრთხო პაროლი შენი ანგარიშისთვის.</Text>

        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <View style={styles.fields}>
          <TextField
            label="ახალი პაროლი"
            required
            value={password}
            onChangeText={setPassword}
            onBlur={() => touch('password')}
            placeholder="••••••••"
            error={passwordError}
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
          <PasswordChecklist password={password} confirmPassword={confirmPassword} />
        </View>

        <Button
          label="პაროლის განახლება"
          loadingLabel="ინახება..."
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
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
  fields: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  errorBanner: {
    backgroundColor: colors.dangerBackground,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    ...typography.caption,
    color: colors.destructive,
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  successTitle: {
    ...typography.h1,
    color: colors.foreground,
    marginTop: spacing.md,
  },
  successSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
