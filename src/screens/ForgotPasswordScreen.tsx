import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CheckCircle, Mail, Shield } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../theme';
import { authService } from '../services/authService';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// A3 — პაროლის აღდგენის ეკრანი (product-spec.md, create-account-form.md)
export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const emailError = touched
    ? !email
      ? 'ეს ველი სავალდებულოა'
      : !isEmail(email)
        ? 'შეიყვანე სწორი ელ. ფოსტა'
        : ''
    : '';

  const handleSend = () => {
    setTouched(true);
    if (!email || !isEmail(email)) return;
    setLoading(true);
    authService.sendPasswordReset(email.trim());
    setTimeout(() => {
      setLoading(false);
      setSent(true);
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.foreground} />
        </Pressable>

        {sent ? (
          <View style={styles.successState}>
            <View style={styles.successIcon}>
              <CheckCircle size={36} color={colors.success} />
            </View>
            <Text style={styles.successTitle}>ბმული გამოგზავნილია</Text>
            <Text style={styles.successSubtitle}>შეამოწმე შენი ელ. ფოსტა პაროლის აღსადგენად.</Text>

            <View style={styles.emailBanner}>
              <Mail size={18} color={colors.success} />
              <Text style={styles.emailBannerText} numberOfLines={1}>
                {email}
              </Text>
            </View>

            <Button label="შესვლაზე დაბრუნება" onPress={() => navigation.goBack()} />
          </View>
        ) : (
          <>
            <View style={styles.headerIcon}>
              <Shield size={24} color={colors.primary} />
            </View>
            <Text style={styles.title}>პაროლის აღდგენა</Text>
            <Text style={styles.subtitle}>
              შეიყვანე შენი ელ. ფოსტა და გამოგიგზავნით პაროლის აღდგენის ინსტრუქციას.
            </Text>

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
              label="აღდგენის ბმულის გაგზავნა"
              loadingLabel="გაგზავნა..."
              onPress={handleSend}
              disabled={!email || !isEmail(email)}
              loading={loading}
            />
          </>
        )}
      </View>
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
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
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
  successState: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.successBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  successTitle: {
    ...typography.h2,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  successSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xl,
    maxWidth: 280,
  },
  emailBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
    backgroundColor: colors.successBackground,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
  },
  emailBannerText: {
    ...typography.captionMedium,
    color: colors.success,
    flexShrink: 1,
  },
});
