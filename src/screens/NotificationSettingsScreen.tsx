import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { Switch } from '../components/Switch';
import { colors, radius, spacing, typography } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationSettings'>;

const CUSTOMER_TOGGLES = [
  'ახალი ინტერესი ჩემს მოთხოვნაზე',
  'ახალი შეტყობინება ჩატში',
  'მოთხოვნის სტატუსის ცვლილება',
  'სამუშაოს დასრულების შეხსენება',
];

const PROVIDER_TOGGLES = [
  'ახალი მოთხოვნები ჩემს არეალში',
  'ახალი შეტყობინება ჩატში',
  'სამუშაოზე არჩევა',
  'მოთხოვნის სტატუსის ცვლილება',
  'ახალი შეფასება',
];

// NotificationSettings — ზუსტად ზიპის App.tsx-ის NotificationSettings-ის
// მიხედვით. toggle-ების მდგომარეობა ლოკალურია — TODO: ჩანაცვლდება
// Firestore-ის users/{uid}.notificationPrefs ველით.
export function NotificationSettingsScreen({ navigation, route }: Props) {
  const { role } = route.params;
  const toggles = role === 'customer' ? CUSTOMER_TOGGLES : PROVIDER_TOGGLES;
  const [enabled, setEnabled] = useState<Set<number>>(() => new Set(toggles.map((_, i) => i)));

  const toggle = (i: number) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="შეტყობინებები" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.card}>
          {toggles.map((label, i) => (
            <View key={label} style={[styles.row, i < toggles.length - 1 && styles.rowBorder]}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Switch value={enabled.has(i)} onValueChange={() => toggle(i)} activeColor={colors.primary} />
            </View>
          ))}
        </View>

        {role === 'provider' && (
          <View style={styles.infoBanner}>
            <Text style={styles.infoEmoji}>ℹ️</Text>
            <Text style={styles.infoText}>
              „ახალი მოთხოვნები ჩემს არეალში" — ეს შეტყობინება მუშაობს მხოლოდ მაშინ, როდესაც ხელმისაწვდომობა ჩართულია
              Provider Home-ზე.
            </Text>
          </View>
        )}

        <Text style={styles.footNote}>ჩატის შეტყობინებები ყოველთვის ჩართულია, მიუხედავად ხელმისაწვდომობის სტატუსისა.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.muted,
  },
  rowLabel: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '600',
    flex: 1,
    paddingRight: spacing.md,
  },
  infoBanner: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    backgroundColor: colors.warningBackground,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 6,
  },
  infoEmoji: {
    fontSize: 18,
  },
  infoText: {
    ...typography.small,
    color: colors.warning,
    flex: 1,
    lineHeight: 18,
  },
  footNote: {
    ...typography.small,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
});
