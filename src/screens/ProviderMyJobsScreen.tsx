import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Briefcase, Clock, MapPin, User } from 'lucide-react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { type CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CategoryIcon } from '../components/CategoryIcon';
import { Skeleton } from '../components/Skeleton';
import { StatusPill } from '../components/StatusPill';
import { colors, radius, spacing, typography } from '../theme';
import { authService } from '../services/authService';
import { jobService } from '../services/jobService';
import { useJobStatus } from '../state/JobStatusContext';
import type { FeedJob } from '../types/job';
import type { ProviderTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<ProviderTabParamList, 'MyJobsTab'>,
  NativeStackScreenProps<RootStackParamList>
>;
type Tab = 'active' | 'done';

const EMPTY_TEXT: Record<Tab, string> = {
  active: 'დადასტურებული სამუშაოები არ გაქვს',
  done: 'დასრულებული სამუშაოები არ გაქვს',
};

// ProviderMyJobs — "ჩემი სამუშაოები" ტაბი, რეალურ `job_posts`-ზე აგებული
// (#69, `job_posts.provider_id = me`) — მანამდე ცალკე, id-ის გარეშე
// `MyJobRow` mock-კუნძული იყო (#30-ის შენიშვნა), ჩატის/StatusPill-ის/
// JobStatusContext-ის კავშირის გარეშე. ახლა CustomerJobsScreen-ის იგივე
// pattern-ს იზიარებს (`useFocusEffect`, სტატუსით navigate ProviderJobDetail-ზე).
export function ProviderMyJobsScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>('active');
  const [isLoading, setIsLoading] = useState(true);
  const [jobs, setJobs] = useState<FeedJob[]>([]);
  const { getStatus } = useJobStatus();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      const uid = authService.getCurrentUser()?.uid;
      if (!uid) {
        setJobs([]);
        setIsLoading(false);
        return;
      }
      jobService
        .listMyAssignedJobs(uid)
        .then((real) => {
          if (!cancelled) setJobs(real);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // "awaiting_customer_confirmation"/"disputed" — job ჯერ კიდევ აქტიურ
  // მუშაობშია (არ არის დასრულებული), ამიტომ "დადასტურებული" ტაბში რჩება
  // (ორმხრივი დასრულების flow, JobStatusContext.tsx — CustomerJobsScreen-ის
  // იგივე პრინციპი).
  const items = jobs.filter((j) => {
    const status = j.customerJobId ? (getStatus(j.customerJobId) ?? j.status) : j.status;
    if (tab === 'active') return status === 'active' || status === 'awaiting_customer_confirmation' || status === 'disputed';
    return status === 'completed';
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ჩემი სამუშაოები</Text>
      </View>
      <View style={styles.tabsRow}>
        {(
          [
            { id: 'active' as Tab, label: 'დადასტურებული' },
            { id: 'done' as Tab, label: 'დასრულებული' },
          ]
        ).map((t) => (
          <Pressable key={t.id} style={[styles.tab, tab === t.id && styles.tabActive]} onPress={() => setTab(t.id)}>
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.bodyContent}>
          {[0, 1].map((i) => (
            <JobRowSkeleton key={i} />
          ))}
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Briefcase size={22} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>{EMPTY_TEXT[tab]}</Text>
        </View>
      ) : (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {items.map((j) => {
            const liveStatus = j.customerJobId ? (getStatus(j.customerJobId) ?? j.status) : j.status;
            return (
              <Pressable
                key={j.id}
                style={styles.card}
                onPress={() => navigation.navigate('ProviderJobDetail', { id: j.id, job: j, mode: 'selected' })}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardTopLeft}>
                    <CategoryIcon categoryId={j.category} />
                    <Text style={styles.jobTitle} numberOfLines={1}>
                      {j.title}
                    </Text>
                  </View>
                  {liveStatus && <StatusPill status={liveStatus} />}
                </View>
                <View style={{ gap: spacing.xs + 2 }}>
                  <View style={styles.metaRow}>
                    <User size={13} color={colors.mutedForeground} />
                    <Text style={styles.metaText}>{j.customer}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <MapPin size={13} color={colors.mutedForeground} />
                    <Text style={styles.metaText}>{j.location}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Clock size={13} color={colors.mutedForeground} />
                    <Text style={styles.metaText}>{j.date}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
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
        <Skeleton width={140} height={14} />
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
  cardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    flex: 1,
    minWidth: 0,
  },
  jobTitle: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
    flexShrink: 1,
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
});
