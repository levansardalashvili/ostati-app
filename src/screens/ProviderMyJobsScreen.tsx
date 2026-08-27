import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Clock, MapPin, User } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { StatusPill } from '../components/StatusPill';
import { colors, radius, spacing, typography } from '../theme';
import { PROVIDER_MY_JOBS_ACTIVE, PROVIDER_MY_JOBS_DONE } from '../data/mockReviews';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProviderMyJobs'>;
type Tab = 'active' | 'done';

// ProviderMyJobs — ზუსტად ზიპის App.tsx-ის ProviderMyJobs-ის მიხედვით.
// ზიპშივე ეს ეკრანი არსად არ იყო რეალურად ჩართული (orphan) — ჩვენთან
// ProviderHome-ის სტატისტიკის "სამ." უჯრიდან ვხსნით.
export function ProviderMyJobsScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>('active');
  const items = tab === 'active' ? PROVIDER_MY_JOBS_ACTIVE : PROVIDER_MY_JOBS_DONE;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="ჩემი სამუშაოები" onBack={() => navigation.goBack()} />
      <View style={styles.tabsRow}>
        {(
          [
            { id: 'active' as Tab, label: 'აქტიური' },
            { id: 'done' as Tab, label: 'დასრულდა' },
          ]
        ).map((t) => (
          <Pressable key={t.id} style={[styles.tab, tab === t.id && styles.tabActive]} onPress={() => setTab(t.id)}>
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {items.map((j, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.jobTitle}>{j.title}</Text>
              <StatusPill status={tab === 'active' ? 'active' : 'completed'} />
            </View>
            <View style={{ gap: spacing.xs + 2 }}>
              <View style={styles.metaRow}>
                <User size={13} color={colors.mutedForeground} />
                <Text style={styles.metaText}>{j.customer}</Text>
              </View>
              <View style={styles.metaRow}>
                <MapPin size={13} color={colors.mutedForeground} />
                <Text style={styles.metaText}>{j.addr}</Text>
              </View>
              <View style={styles.metaRow}>
                <Clock size={13} color={colors.mutedForeground} />
                <Text style={styles.metaText}>{j.when}</Text>
              </View>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.pay}>{j.pay}</Text>
              {tab === 'active' && (
                <View style={styles.doneButton}>
                  <Check size={12} color={colors.success} />
                  <Text style={styles.doneButtonText}>დასრულება</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm + 6,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '700',
  },
  tabTextActive: {
    color: colors.primaryForeground,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.lg,
    gap: spacing.sm + 6,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm + 2,
  },
  jobTitle: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  metaText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.muted,
    marginTop: spacing.sm + 2,
    paddingTop: spacing.sm + 2,
  },
  pay: {
    ...typography.captionMedium,
    color: colors.primary,
    fontWeight: '700',
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successBackground,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
  },
  doneButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
});
