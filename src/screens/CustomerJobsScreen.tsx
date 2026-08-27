import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText, MessageCircle } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { CategoryIcon } from '../components/CategoryIcon';
import { Skeleton } from '../components/Skeleton';
import { StatusPill } from '../components/StatusPill';
import { colors, radius, spacing, typography } from '../theme';
import { CUSTOMER_JOBS } from '../data/mockHomeData';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerJobs'>;
type Tab = 'active' | 'pending' | 'done';

const TABS: { id: Tab; label: string }[] = [
  { id: 'active', label: 'აქტიური' },
  { id: 'pending', label: 'მოლოდინი' },
  { id: 'done', label: 'დასრულდა' },
];

const EMPTY_TEXT: Record<Tab, string> = {
  active: 'აქტიური სამუშაოები არ გაქვს',
  pending: 'მოლოდინის სამუშაოები არ გაქვს',
  done: 'დასრულებული სამუშაოები არ გაქვს',
};

// CustomerJobs — "ჩემი მოთხოვნები" (ზუსტად ზიპის App.tsx-ის
// CustomerJobs-ის მიხედვით).
export function CustomerJobsScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>('active');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  const statusFor: Record<Tab, string> = { active: 'active', pending: 'pending', done: 'completed' };
  const items = CUSTOMER_JOBS.filter((j) => j.status === statusFor[tab]);

  const openChat = (providerName: string) => {
    navigation.navigate('ChatConversation', {
      chatId: 'p1',
      name: providerName,
      initials: providerName[0],
      color: colors.primary,
      role: 'customer',
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="ჩემი სამუშაოები" onBack={() => navigation.goBack()} />
      <View style={styles.tabsRow}>
        {TABS.map((t) => (
          <Pressable key={t.id} style={[styles.tab, tab === t.id && styles.tabActive]} onPress={() => setTab(t.id)}>
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.body}>
          {[0, 1].map((i) => (
            <JobRowSkeleton key={i} />
          ))}
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <FileText size={22} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>{EMPTY_TEXT[tab]}</Text>
          <Text style={styles.emptySubtitle}>მოთხოვნები ამ სტატუსში არ მოიძებნა.</Text>
        </View>
      ) : (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {items.map((j) => (
            <Pressable key={j.id} style={styles.card} onPress={() => navigation.navigate('CustomerJobDetail', { jobId: j.id })}>
              <View style={styles.cardTop}>
                <View style={styles.cardTopLeft}>
                  <CategoryIcon categoryId={j.category} />
                  <View>
                    <Text style={styles.jobTitle}>{j.title}</Text>
                    <Text style={styles.jobDate}>{j.date}</Text>
                  </View>
                </View>
                <StatusPill status={j.status} />
              </View>
              <Text style={styles.jobDesc} numberOfLines={2}>
                {j.desc}
              </Text>
              <View style={styles.cardFooter}>
                <View style={styles.footerLeft}>
                  <Text style={styles.budget}>{j.budget}</Text>
                  {j.provider && (
                    <>
                      <Text style={styles.dot}>·</Text>
                      <Text style={styles.providerName}>{j.provider}</Text>
                    </>
                  )}
                </View>
                {j.provider && (
                  <Pressable
                    style={styles.chatButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      openChat(j.provider!);
                    }}
                  >
                    <MessageCircle size={13} color={colors.primary} />
                    <Text style={styles.chatButtonText}>ჩატი</Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function JobRowSkeleton() {
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
        <Skeleton width={36} height={36} borderRadius={radius.md} />
        <View style={{ gap: spacing.xs }}>
          <Skeleton width={140} height={14} />
          <Skeleton width={80} height={11} />
        </View>
      </View>
      <Skeleton width="90%" height={12} />
    </View>
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
    paddingVertical: spacing.sm,
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
  cardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    flex: 1,
  },
  jobTitle: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
  },
  jobDate: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  jobDesc: {
    ...typography.small,
    color: colors.mutedForeground,
    marginBottom: spacing.sm + 2,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.muted,
    paddingTop: spacing.sm + 2,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  budget: {
    ...typography.captionMedium,
    color: colors.primary,
    fontWeight: '700',
  },
  dot: {
    color: colors.border,
  },
  providerName: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 4,
  },
  chatButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl * 2,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '600',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.small,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
