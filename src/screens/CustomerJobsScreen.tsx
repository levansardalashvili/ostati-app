import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText, MessageCircle, Plus } from 'lucide-react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CategoryIcon } from '../components/CategoryIcon';
import { Skeleton } from '../components/Skeleton';
import { StatusPill } from '../components/StatusPill';
import { colors, radius, spacing, typography } from '../theme';
import { jobService } from '../services/jobService';
import { useJobStatus } from '../state/JobStatusContext';
import type { CustomerTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'MyJobsTab'>,
  NativeStackScreenProps<RootStackParamList>
>;
type Tab = 'active' | 'pending' | 'done';

// ტაბის ლეიბლები StatusPill-ის ლეიბლებთან შესატყვისობაშია (#32).
const TABS: { id: Tab; label: string }[] = [
  { id: 'active', label: 'დადასტურებული' },
  { id: 'pending', label: 'მომლოდინე' },
  { id: 'done', label: 'დასრულებული' },
];

const EMPTY_TEXT: Record<Tab, string> = {
  active: 'დადასტურებული სამუშაოები არ გაქვს',
  pending: 'მომლოდინე სამუშაოები არ გაქვს',
  done: 'დასრულებული სამუშაოები არ გაქვს',
};

// CustomerJobs — "ჩემი განცხადებები" (ყოფილი ზიპის CustomerJobs-ის
// მიხედვით აშენებული ეკრანი). Bottom Tab-ის ("MyJobsTab") საკუთარი
// ეკრანია — აღარ არის root-stack-ზე push-ილი (მომხმარებლის მოთხოვნით:
// "მოთხოვნა"-ს მაგივრად ეს ტაბი პირდაპირ "ჩემი განცხადებები"-ს აჩვენებს,
// პლუს ახალი განცხადების დამატების ღილაკი header-ში). Profile-ის "ჩემი
// მოთხოვნები" მენიუც ამავე ტაბზე გადადის (CustomerProfileScreen.tsx),
// push-ის ნაცვლად.
export function CustomerJobsScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>('active');
  const [isLoading, setIsLoading] = useState(true);
  const { getStatus } = useJobStatus();

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  // "awaiting_customer_confirmation"/"disputed" — job ჯერ კიდევ აქტიურ
  // მუშაობშია (არ არის დასრულებული), ამიტომ "დადასტურებული" ტაბში რჩება
  // (ორმხრივი დასრულების flow, JobStatusContext.tsx).
  const items = jobService.listCustomerJobs().filter((j) => {
    const status = getStatus(j.id) ?? j.status;
    if (tab === 'active') return status === 'active' || status === 'awaiting_customer_confirmation' || status === 'disputed';
    if (tab === 'pending') return status === 'pending';
    return status === 'completed';
  });

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ჩემი განცხადებები</Text>
        <Pressable style={styles.addButton} onPress={() => navigation.navigate('PostJob')}>
          <Plus size={20} color={colors.primaryForeground} strokeWidth={2.5} />
        </Pressable>
      </View>
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
                <StatusPill status={getStatus(j.id) ?? j.status} />
              </View>
              <Text style={styles.jobDesc} numberOfLines={2}>
                {j.desc}
              </Text>
              <View style={styles.cardFooter}>
                <View style={styles.footerLeft}>
                  {j.provider && <Text style={styles.providerName}>{j.provider}</Text>}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.foreground,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
