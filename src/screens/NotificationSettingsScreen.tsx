import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { Switch } from '../components/Switch';
import { colors, radius, spacing, typography } from '../theme';
import { authService } from '../services/authService';
import { notificationService } from '../services/notificationService';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationSettings'>;

// key — სტაბილური იდენტიფიკატორი, Supabase-ის `notification_preferences.prefs`
// jsonb-ის key (Task 3) — label ტექსტი (ან სიაში ადგილი) ვერასდროს
// გამოსადეგია storage key-დ, რადგან თარგმანი/დალაგება შეიძლება შეიცვალოს.
const CUSTOMER_TOGGLES: { key: string; label: string }[] = [
  { key: 'new_interest', label: 'ახალი ინტერესი ჩემს მოთხოვნაზე' },
  { key: 'new_chat_message', label: 'ახალი შეტყობინება ჩატში' },
  { key: 'job_status_change', label: 'მოთხოვნის სტატუსის ცვლილება' },
  { key: 'completion_reminder', label: 'სამუშაოს დასრულების შეხსენება' },
];

const PROVIDER_TOGGLES: { key: string; label: string }[] = [
  { key: 'new_jobs_in_area', label: 'ახალი მოთხოვნები ჩემს არეალში' },
  { key: 'new_chat_message', label: 'ახალი შეტყობინება ჩატში' },
  { key: 'job_selected', label: 'სამუშაოზე არჩევა' },
  { key: 'job_status_change', label: 'მოთხოვნის სტატუსის ცვლილება' },
  { key: 'new_review', label: 'ახალი შეფასება' },
];

// NotificationSettings — ზუსტად ზიპის App.tsx-ის NotificationSettings-ის
// მიხედვით (ვიზუალურად უცვლელი). toggle-ების მდგომარეობა Task 3-ის
// მიხედვით რეალურად Supabase-ზეა (`notification_preferences`) — ეკრანის
// გახსნისას აღდგება, გადარჩება logout/login/app restart-საც. ნაგულისხმევად
// ყველა ჩართულია (მომხმარებელს არასდროს გამორთვია) — missing key ბაზაში
// ნიშნავს "ჯერ არასდროს შეხებია", არა "გამორთული".
export function NotificationSettingsScreen({ navigation, route }: Props) {
  const { role } = route.params;
  const toggles = role === 'customer' ? CUSTOMER_TOGGLES : PROVIDER_TOGGLES;
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(toggles.map((t) => t.key)));

  useEffect(() => {
    const uid = authService.getCurrentUser()?.uid;
    if (!uid) return;
    let cancelled = false;
    notificationService
      .getPreferences(uid)
      .then((prefs) => {
        if (cancelled) return;
        setEnabled(new Set(toggles.filter((t) => prefs[t.key] !== false).map((t) => t.key)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const toggle = async (key: string) => {
    const uid = authService.getCurrentUser()?.uid;
    if (!uid) return;
    const next = !enabled.has(key);
    setEnabled((prev) => {
      const nextSet = new Set(prev);
      next ? nextSet.add(key) : nextSet.delete(key);
      return nextSet;
    });
    try {
      await notificationService.setPreference(uid, key, next);
    } catch {
      setEnabled((prev) => {
        const revert = new Set(prev);
        next ? revert.delete(key) : revert.add(key);
        return revert;
      });
      Alert.alert('ვერ მოხერხდა', 'პარამეტრის შენახვა ვერ მოხერხდა — სცადე თავიდან.');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="შეტყობინებები" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.card}>
          {toggles.map((t, i) => (
            <View key={t.key} style={[styles.row, i < toggles.length - 1 && styles.rowBorder]}>
              <Text style={styles.rowLabel}>{t.label}</Text>
              <Switch value={enabled.has(t.key)} onValueChange={() => toggle(t.key)} activeColor={colors.primary} />
            </View>
          ))}
        </View>

        {role === 'provider' && (
          <View style={styles.infoBanner}>
            <Text style={styles.infoEmoji}>ℹ️</Text>
            <Text style={styles.infoText}>
              „ახალი მოთხოვნები ჩემს არეალში" — ეს შეტყობინება მუშაობს მხოლოდ მაშინ, როდესაც ხელმისაწვდომობა ჩართულია
              მთავარ გვერდზე.
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
