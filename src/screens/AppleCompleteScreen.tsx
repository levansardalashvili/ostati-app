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

type Props = NativeStackScreenProps<RootStackParamList, 'AppleComplete'>;

// #107 — Apple-ის ანგარიშით პროფილის დასრულება, GoogleCompleteScreen.tsx-ის
// ზუსტი სარკე (ცალკე კონკრეტული ეკრანი, არა გაზიარებული "SocialComplete" —
// კოდბაზის დამკვიდრებული პატერნით). ერთადერთი რეალური განსხვავება: Apple
// `fullName`/`email`-ს მხოლოდ **პირველივე** ავტორიზაციაზე აბრუნებს —
// `authService.getCurrentUser()`-იდან ხელახლა ამოღება შეუძლებელია (მეორედ
// `null` იქნება), ამიტომ ეს მონაცემი route param-ითაა გადმოცემული
// (RegisterScreen-ის Apple-ღილაკის handler-იდან, პირდაპირ signInWithApple()-ის
// დაბრუნებული მნიშვნელობიდან).
export function AppleCompleteScreen({ navigation, route }: Props) {
  const { role, appleFullName } = route.params;
  const isProvider = role === 'provider';
  const { setProfile } = useCustomerProfile();
  const { setProfile: setProviderProfile } = useProviderProfile();

  const appleUser = authService.getCurrentUser();
  const firstName = appleFullName?.givenName?.trim() || '';
  const lastName = appleFullName?.familyName?.trim() || '';
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'ახალი მომხმარებელი';
  const appleEmail = appleUser?.email ?? '';
  const initials = `${firstName.charAt(0)}${lastName.charAt(0) || ''}`.toUpperCase() || 'A';

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
    if (!appleUser) {
      setSubmitError('Apple სესია ვერ მოიძებნა — დაბრუნდი და სცადე თავიდან.');
      return;
    }
    setLoading(true);
    try {
      const defaultAddress = isProvider ? '' : address.trim();
      await userService.createUserRecord(appleUser.uid, {
        role,
        firstName,
        lastName,
        email: appleEmail,
        defaultAddress,
        phone: appleUser.phone ?? '',
      });
      if (role === 'provider') {
        setProviderProfile({ firstName, lastName });
        navigation.replace('ProviderSetup');
      } else {
        setProfile({ firstName, lastName, email: appleEmail, defaultAddress, phone: '' });
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

        <View style={styles.appleCard}>
          <Text style={styles.appleCardLabel}>Apple-ის ანგარიშიდან</Text>
          <View style={styles.appleCardRow}>
            <Avatar initials={initials} size={52} />
            <View style={styles.appleCardText}>
              <Text style={styles.appleCardName}>{displayName}</Text>
              {!!appleEmail && <Text style={styles.appleCardEmail}>{appleEmail}</Text>}
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
              placeholder="მაგ. ჭავჭავაძე 48"
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
  appleCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  appleCardLabel: {
    ...typography.small,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
  appleCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  appleCardText: {
    flex: 1,
  },
  appleCardName: {
    ...typography.bodyMedium,
    color: colors.foreground,
  },
  appleCardEmail: {
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
