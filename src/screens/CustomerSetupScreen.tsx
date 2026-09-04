import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { colors, radius, spacing, typography } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerSetup'>;

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
}

// A4 — პროფილის დასრულების ეკრანი (product-spec.md; დიზაინის რეფერენსის
// CustomerSetupScreen-ის მიხედვით). ფოტოს დამატების ღილაკები აქედან
// მოცილებულია — Customer-ის პროფილს (users ცხრილს/CustomerProfile ტიპს)
// საერთოდ არ აქვს photo_url ველი, ისინი მხოლოდ ვიზუალურად ცვლიდნენ
// ავატარს (initials-ს), არაფერს არ ინახავდნენ. Provider-ის საკუთარი
// პროფილის ფოტო (#65) რეალურია, Customer-ისთვის ეს ჯერ არ აშენებულა.
export function CustomerSetupScreen({ navigation, route }: Props) {
  const { userName } = route.params;
  const [loading, setLoading] = useState(false);

  const initials = getInitials(userName);

  const handleDone = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigation.reset({ index: 0, routes: [{ name: 'CustomerHome' }] });
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <ProgressBar step={2} total={2} />
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.title}>პროფილის დასრულება</Text>
        <Text style={styles.subtitle}>თითქმის მზად ხარ.</Text>

        <View style={styles.nameCard}>
          <Check size={16} color={colors.success} strokeWidth={2.5} />
          <Text style={styles.nameLabel}>სახელი:</Text>
          <Text style={styles.nameValue}>{userName}</Text>
        </View>

        <View style={styles.photoSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitials}>{initials || '+'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          label="დასრულება"
          loadingLabel="შენახვა..."
          onPress={handleDone}
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
    marginBottom: spacing.xl,
  },
  headerSpacer: {
    width: 36,
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
  nameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
  },
  nameLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  nameValue: {
    ...typography.captionMedium,
    color: colors.foreground,
  },
  photoSection: {
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
  },
  footer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
