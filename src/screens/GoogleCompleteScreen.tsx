import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AddressAutocompleteField } from '../components/AddressAutocompleteField';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { colors, radius, spacing, typography } from '../theme';
import { authService, getAuthErrorMessage } from '../services/authService';
import { userService } from '../services/userService';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import { useProviderProfile } from '../state/ProviderProfileContext';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'GoogleComplete'>;

// A3 — Google-ის ანგარიშით პროფილის დასრულება (product-spec.md, create-account-form.md).
// Provider-ისთვის მისამართის ველი არ ჩანს/არ სავალდებულოა — RegisterScreen-ის
// იგივე წესით (Provider-ს საცხოვრებელი მისამართი საერთოდ არ სჭირდება,
// სამუშაო არეალს მოგვიანებით ProviderSetup-ზე ირჩევს). Google-ის რეალური
// ავტორიზაცია უკვე მოხდა წინა ეკრანზე (RegisterScreen-ის Google ღილაკი) —
// აქ უბრალოდ ვკითხულობთ უკვე შესულ Supabase Auth მომხმარებელს
// (authService.getCurrentUser()) და ვასრულებთ პროფილს.
export function GoogleCompleteScreen({ navigation, route }: Props) {
  const { role } = route.params;
  const isProvider = role === 'provider';
  const { setProfile } = useCustomerProfile();
  const { setProfile: setProviderProfile } = useProviderProfile();

  const googleUser = authService.getCurrentUser();
  const displayName = googleUser?.displayName?.trim() || 'ახალი მომხმარებელი';
  const [googleFirstName, ...googleLastNameParts] = displayName.split(' ');
  const googleLastName = googleLastNameParts.join(' ');
  const googleEmail = googleUser?.email ?? '';
  const initials = `${googleFirstName.charAt(0)}${googleLastName.charAt(0) || ''}`.toUpperCase();

  const [address, setAddress] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const addressError = !isProvider && touched && !address.trim() ? 'ეს ველი სავალდებულოა' : '';
  const canContinue = (isProvider || address.trim()) && !loading;

  const handleContinue = async () => {
    setTouched(true);
    setSubmitError('');
    if (!isProvider && !address.trim()) return;
    if (!googleUser) {
      setSubmitError('Google სესია ვერ მოიძებნა — დაბრუნდი და სცადე თავიდან.');
      return;
    }
    setLoading(true);
    try {
      const defaultAddress = isProvider ? '' : address.trim();
      await userService.createUserRecord(googleUser.uid, {
        role,
        firstName: googleFirstName,
        lastName: googleLastName,
        email: googleEmail,
        defaultAddress,
      });
      if (role === 'provider') {
        setProviderProfile({ firstName: googleFirstName, lastName: googleLastName });
        navigation.replace('ProviderSetup');
      } else {
        setProfile({
          firstName: googleFirstName,
          lastName: googleLastName,
          email: googleEmail,
          defaultAddress,
        });
        navigation.replace('CustomerSetup', { userName: displayName });
      }
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error));
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <ProgressBar step={1} total={role === 'provider' ? 3 : 2} />
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.title}>დაასრულე პროფილის შექმნა</Text>
        <Text style={styles.subtitle}>დაგვჭირდება კიდევ რამდენიმე ინფორმაცია.</Text>

        <View style={styles.googleCard}>
          <Text style={styles.googleCardLabel}>Google-ის ანგარიშიდან</Text>
          <View style={styles.googleCardRow}>
            <Avatar initials={initials} size={52} />
            <View style={styles.googleCardText}>
              <Text style={styles.googleCardName}>{displayName}</Text>
              <Text style={styles.googleCardEmail}>{googleEmail}</Text>
            </View>
            <View style={styles.checkBadge}>
              <Check size={13} color={colors.success} strokeWidth={3} />
            </View>
          </View>
        </View>

        {submitError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{submitError}</Text>
          </View>
        ) : null}

        {!isProvider && (
          <View style={styles.field}>
            <AddressAutocompleteField
              label="მისამართი"
              value={address}
              onChangeText={setAddress}
              onBlur={() => setTouched(true)}
              placeholder="მაგ. ჭავჭავაძის 48"
              error={addressError}
            />
          </View>
        )}

        <Button
          label="გაგრძელება"
          loadingLabel="გაგრძელება..."
          onPress={handleContinue}
          disabled={!canContinue}
          loading={loading}
        />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerSpacer: {
    width: 36,
  },
  title: {
    ...typography.h2,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.lg,
  },
  googleCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  googleCardLabel: {
    ...typography.small,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
  googleCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  googleCardText: {
    flex: 1,
  },
  googleCardName: {
    ...typography.bodyMedium,
    color: colors.foreground,
  },
  googleCardEmail: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.successBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    marginBottom: spacing.lg,
    zIndex: 10,
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
});
