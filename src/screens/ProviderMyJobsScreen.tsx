import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Briefcase, Clock, MapPin, User } from 'lucide-react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { type CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { CategoryIcon } from '../components/CategoryIcon';
import { Skeleton } from '../components/Skeleton';
import { StatusPill } from '../components/StatusPill';
import { colors, radius, spacing, typography } from '../theme';
import { authService } from '../services/authService';
import { jobService } from '../services/jobService';
import { quoteService } from '../services/quoteService';
import { useJobStatus } from '../state/JobStatusContext';
import type { FeedJob } from '../types/job';
import type { ProviderTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<ProviderTabParamList, 'MyJobsTab'>,
  NativeStackScreenProps<RootStackParamList>
>;
type Tab = 'pending' | 'active' | 'done';

const TABS: { id: Tab; label: string }[] = [
  { id: 'pending', label: 'მომლოდინე' },
  { id: 'active', label: 'დადასტურებული' },
  { id: 'done', label: 'დასრულებული' },
];

const EMPTY_TEXT: Record<Tab, string> = {
  pending: 'მომლოდინე სამუშაოები არ გაქვს',
  active: 'დადასტურებული სამუშაოები არ გაქვს',
  done: 'დასრულებული სამუშაოები არ გაქვს',
};

// ProviderMyJobs — "ჩემი სამუშაოები" ტაბი, რეალურ `job_posts`-ზე აგებული
// (#69, `job_posts.provider_id = me`) — მანამდე ცალკე, id-ის გარეშე
// `MyJobRow` mock-კუნძული იყო (#30-ის შენიშვნა), ჩატის/StatusPill-ის/
// JobStatusContext-ის კავშირის გარეშე. ახლა CustomerJobsScreen-ის იგივე
// pattern-ს იზიარებს (`useFocusEffect`, სტატუსით navigate ProviderJobDetail-ზე).
export function ProviderMyJobsScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [jobs, setJobs] = useState<FeedJob[]>([]);
  // "მომლოდინე" — job-ები, სადაც ამ Provider-ს უკვე აქვს job_response
  // (დაინტერესება/ფასი), მაგრამ Customer-ს ჯერ არავინ არჩეული (job კვლავ
  // status='pending'-ია). არა ღია Job Feed-ის სრული სია — მხოლოდ ის
  // job-ები, სადაც ამ Provider-ს რეალურად აქვს პასუხი. არსებული
  // getOpenProviderFeedPosts()/listMyResponseJobIds() სერვისების
  // კომბინაციაა (ორივე უკვე გამოიყენება Job Feed/Home ეკრანებზე, "უკვე
  // დაინტერესებული ხარ" state-ისთვის) — ახალი RPC/სტატუსი არ დამატებულა.
  const [pendingJobs, setPendingJobs] = useState<FeedJob[]>([]);
  const { getStatus } = useJobStatus();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      const uid = authService.getCurrentUser()?.uid;
      if (!uid) {
        setJobs([]);
        setPendingJobs([]);
        setIsLoading(false);
        return;
      }
      Promise.all([
        jobService.listMyAssignedJobs(uid),
        jobService.getOpenProviderFeedPosts(),
        quoteService.listMyResponseJobIds(uid),
      ])
        .then(([assigned, openFeed, myResponseIds]) => {
          if (cancelled) return;
          setJobs(assigned);
          setPendingJobs(openFeed.filter((j) => myResponseIds.has(j.id)));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // "awaiting_customer_confirmation"/"confirmed_awaiting_rating"/"disputed" —
  // job ჯერ კიდევ აქტიურ მუშაობშია ან დასრულების დადასტურების პროცესშია
  // (არ არის საბოლოოდ "completed"), ამიტომ "დადასტურებული" ტაბში რჩება
  // (ორმხრივი დასრულების flow, JobStatusContext.tsx — CustomerJobsScreen-ის
  // იგივე პრინციპი).
  const items =
    tab === 'pending'
      ? pendingJobs
      : jobs.filter((j) => {
          const status = j.customerJobId ? (getStatus(j.customerJobId) ?? j.status) : j.status;
          if (tab === 'active') {
            return (
              status === 'active' ||
              status === 'awaiting_customer_confirmation' ||
              status === 'confirmed_awaiting_rating' ||
              status === 'disputed'
            );
          }
          return status === 'completed';
        });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Nav-fix pass, task 1 — MyJobsTab is a bottom tab, not a pushed
          stack screen, so it never had a Back button at all. Bottom Tab
          Navigator's default `backBehavior: 'history'` (ProviderTabs.tsx,
          unchanged) already means `navigation.goBack()` correctly returns
          to whichever tab was focused right before this one — Profile, in
          the "Profile → ჩემი სამუშაოები" flow this task describes, without
          hardcoding that destination (if this tab was reached some other
          way, goBack() correctly returns there instead). Android hardware
          back resolves through the exact same mechanism. */}
      <BackHeader title="ჩემი სამუშაოები" onBack={() => navigation.goBack()} />
      <View style={styles.tabsRow}>
        {TABS.map((t) => (
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
                onPress={() =>
                  navigation.navigate('ProviderJobDetail', { id: j.id, job: j, mode: tab === 'pending' ? 'browse' : 'selected' })
                }
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
