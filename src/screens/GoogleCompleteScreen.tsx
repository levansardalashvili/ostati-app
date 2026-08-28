import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, MapPin } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { TextField } from '../components/TextField';
import { colors, radius, spacing, typography } from '../theme';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'GoogleComplete'>;

// TODO: რეალური მონაცემები Google Sign-In-იდან ჩანაცვლდება, როცა
// @react-native-google-signin/google-signin დაუკავშირდება (ტექნიკური შენიშვნა, product-spec.md)
const MOCK_GOOGLE_USER = {
  name: 'ნინო სულაბერიძე',
  email: 'nino.sulaberidze@gmail.com',
  initials: 'ნს',
};
const [MOCK_GOOGLE_FIRST_NAME, ...MOCK_GOOGLE_LAST_NAME_PARTS] = MOCK_GOOGLE_USER.name.split(' ');
const MOCK_GOOGLE_LAST_NAME = MOCK_GOOGLE_LAST_NAME_PARTS.join(' ');

// A3 — Google-ის ანგარიშით პროფილის დასრულება (product-spec.md, create-account-form.md)
export function GoogleCompleteScreen({ navigation, route }: Props) {
  const { role } = route.params;
  const { setProfile } = useCustomerProfile();

  const [address, setAddress] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);

  const addressError = touched && !address.trim() ? 'ეს ველი სავალდებულოა' : '';
  const canContinue = address.trim() && !loading;

  const handleContinue = () => {
    setTouched(true);
    if (!address.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (role === 'provider') {
        navigation.replace('ProviderSetup');
      } else {
        setProfile({
          firstName: MOCK_GOOGLE_FIRST_NAME,
          lastName: MOCK_GOOGLE_LAST_NAME,
          email: MOCK_GOOGLE_USER.email,
          defaultAddress: address.trim(),
        });
        navigation.replace('CustomerSetup', { userName: MOCK_GOOGLE_USER.name });
      }
    }, 1000);
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
            <Avatar initials={MOCK_GOOGLE_USER.initials} size={52} />
            <View style={styles.googleCardText}>
              <Text style={styles.googleCardName}>{MOCK_GOOGLE_USER.name}</Text>
              <Text style={styles.googleCardEmail}>{MOCK_GOOGLE_USER.email}</Text>
            </View>
            <View style={styles.checkBadge}>
              <Check size={13} color={colors.success} strokeWidth={3} />
            </View>
          </View>
        </View>

        <View style={styles.field}>
          <TextField
            label="მისამართი"
            value={address}
            onChangeText={setAddress}
            onBlur={() => setTouched(true)}
            placeholder="მაგ. თბილისი, ვაკე"
            error={addressError}
            icon={MapPin}
          />
        </View>

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
  },
});
