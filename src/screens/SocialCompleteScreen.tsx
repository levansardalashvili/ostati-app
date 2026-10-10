import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AddressAutocompleteField } from '../components/AddressAutocompleteField';
import { AddressDetailsField, type AddressDetails } from '../components/AddressDetailsField';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { colors, radius, spacing, typography } from '../theme';
import { authService, getAuthErrorMessage } from '../services/authService';
import { userService } from '../services/userService';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import { useProviderProfile } from '../state/ProviderProfileContext';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SocialComplete'>;

// Finish the profile after Google/Apple sign-in (the auth itself already
// happened on RegisterScreen). Name/email: Google from the session; Apple only
// returns the name on the very first authorization, so it comes as a route param.
// Providers don't give an address here — the work area is picked in ProviderSetup.
export function SocialCompleteScreen({ navigation, route }: Props) {
  const { role, provider, appleFullName } = route.params;
  const isProvider = role === 'provider';
  const isApple = provider === 'apple';
  const providerLabel = isApple ? 'Apple' : 'Google';
  const { setProfile } = useCustomerProfile();
  const { setProfile: setProviderProfile } = useProviderProfile();

  const sessionUser = authService.getCurrentUser();
  const [googleFirst, ...googleRest] = (sessionUser?.displayName?.trim() || 'ახალი მომხმარებელი').split(' ');
  const firstName = (isApple ? appleFullName?.givenName : googleFirst)?.trim() || '';
  const lastName = (isApple ? appleFullName?.familyName : googleRest.join(' '))?.trim() || '';
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || 'ახალი მომხმარებელი';
  const email = sessionUser?.email ?? '';
  const phone = sessionUser?.phone ?? '';
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || providerLabel.charAt(0);

  const [address, setAddress] = useState('');
  const [addressDetails, setAddressDetails] = useState<AddressDetails>({
    entrance: '',
    apartment: '',
    doorCode: '',
    isPrivateHouse: false,
  });
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const addressError = !isProvider && touched && !address.trim() ? 'ეს ველი სავალდებულოა' : '';
  const entranceError =
    !isProvider &&
    touched &&
    !addressDetails.isPrivateHouse &&
    (!addressDetails.entrance.trim() || !addressDetails.apartment.trim());
  const canContinue =
    (isProvider || address.trim()) &&
    (isProvider ||
      addressDetails.isPrivateHouse ||
      (addressDetails.entrance.trim() && addressDetails.apartment.trim())) &&
    !loading;

  const handleContinue = async () => {
    setTouched(true);
    setSubmitError('');
    if (
      !isProvider &&
      (!address.trim() ||
        (!addressDetails.isPrivateHouse && (!addressDetails.entrance.trim() || !addressDetails.apartment.trim())))
    )
      return;
    if (!sessionUser) {
      setSubmitError(`${providerLabel} სესია ვერ მოიძებნა — დაბრუნდი და სცადე თავიდან.`);
      return;
    }
    setLoading(true);
    try {
      const defaultAddress = isProvider ? '' : address.trim();
      await userService.createUserRecord(sessionUser.uid, {
        role,
        firstName,
        lastName,
        email,
        defaultAddress,
        phone,
        entrance: isProvider ? '' : addressDetails.entrance,
        apartment: isProvider ? '' : addressDetails.apartment,
        doorCode: isProvider ? '' : addressDetails.doorCode,
        isPrivateHouse: isProvider ? false : addressDetails.isPrivateHouse,
      });
      if (role === 'provider') {
        setProviderProfile({ firstName, lastName });
        navigation.replace('ProviderSetup');
      } else {
        setProfile({
          firstName,
          lastName,
          email,
          defaultAddress,
          phone,
          entrance: addressDetails.entrance,
          apartment: addressDetails.apartment,
          doorCode: addressDetails.doorCode,
          isPrivateHouse: addressDetails.isPrivateHouse,
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

        <View style={styles.accountCard}>
          <Text style={styles.accountCardLabel}>{providerLabel}-ის ანგარიშიდან</Text>
          <View style={styles.accountCardRow}>
            <Avatar initials={initials} size={52} />
            <View style={styles.accountCardText}>
              <Text style={styles.accountCardName}>{displayName}</Text>
              {!!email && <Text style={styles.accountCardEmail}>{email}</Text>}
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
            <View style={styles.entranceRow}>
              <AddressDetailsField
                address={address}
                value={addressDetails}
                onChange={setAddressDetails}
                error={entranceError}
              />
            </View>
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
  accountCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  accountCardLabel: {
    ...typography.small,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
  accountCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  accountCardText: {
    flex: 1,
  },
  accountCardName: {
    ...typography.bodyMedium,
    color: colors.foreground,
  },
  accountCardEmail: {
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
  entranceRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    marginTop: spacing.md,
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
