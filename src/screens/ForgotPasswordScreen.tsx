import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareForm } from '../components/KeyboardAwareForm';
import { Mail } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { RecoveryStepHeader } from '../components/RecoveryStepHeader';
import { TextField } from '../components/TextField';
import { colors, spacing, typography } from '../theme';
import { authService, getAuthErrorMessage } from '../services/authService';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// A3 — პაროლის აღდგენის ეზარდის 1/3 (email OTP, #170-ის ვიდეო-რეფერენსის
// 3-ნაბიჯიანი სტილი — ძველი magic-link-ის ნაცვლად, რომელსაც აპში
// დასრულების ეკრანი არასდროს ჰქონია).
export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendError, setSendError] = useState('');

  const emailError = touched
    ? !email
      ? 'ეს ველი სავალდებულოა'
      : !isEmail(email)
        ? 'შეიყვანე სწორი ელ. ფოსტა'
        : ''
    : '';

  const handleSend = async () => {
    setTouched(true);
    setSendError('');
    if (!email || !isEmail(email) || loading) return;
    setLoading(true);
    try {
      await authService.sendEmailOtp(email.trim());
      navigation.navigate('ForgotPasswordVerify', { email: email.trim() });
    } catch (error) {
      setSendError(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAwareForm
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <RecoveryStepHeader icon={Mail} step={0} total={3} onBack={() => navigation.goBack()} />

        <Text style={styles.title}>პაროლი დაგავიწყდა?</Text>
        <Text style={styles.subtitle}>
          შეიყვანე შენი ელ. ფოსტა — გამოგიგზავნით 6-ციფრიან დასადასტურებელ კოდს.
        </Text>

        {sendError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{sendError}</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <TextField
            label="ელ. ფოსტა"
            value={email}
            onChangeText={setEmail}
            onBlur={() => setTouched(true)}
            placeholder="example@email.com"
            error={emailError}
            icon={Mail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <Button
          label="კოდის გაგზავნა"
          loadingLabel="იგზავნება..."
          onPress={handleSend}
          disabled={!email || !isEmail(email)}
          loading={loading}
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
  field: {
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
});
