import { useCallback, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText, MessageCircle, Plus } from 'lucide-react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { type CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { CategoryIcon } from '../components/CategoryIcon';
import { Skeleton } from '../components/Skeleton';
import { StatusPill } from '../components/StatusPill';
import { Reveal } from '../components/Reveal';
import { staggerDelay } from '../utils/motion';
import { colors, radius, spacing, typography } from '../theme';
import { authService } from '../services/authService';
import { jobService } from '../services/jobService';
import { useJobStatus } from '../state/JobStatusContext';
import { useTabBarScroll } from '../state/TabBarScrollContext';
import type { CustomerJob, JobStatus } from '../types/job';
import type { CustomerTabParamList, RootStackParamList } from '../navigation/types';
import { usePressScale } from '../utils/usePressScale';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'MyJobsTab'>,
  NativeStackScreenProps<RootStackParamList>
>;
type Tab = 'active' | 'pending' | 'done';

// Labels match StatusPill.
const TABS: { id: Tab; label: string }[] = [
  { id: 'pending', label: 'მომლოდინე' },
  { id: 'active', label: 'დადასტურებული' },
  { id: 'done', label: 'დასრულებული' },
];

const EMPTY_TEXT: Record<Tab, string> = {
  active: 'დადასტურებული სამუშაოები არ გაქვს',
  pending: 'მომლოდინე სამუშაოები არ გაქვს',
  done: 'დასრულებული სამუშაოები არ გაქვს',
};

// "My jobs" tab, with a "+" to post a new one.
export function CustomerJobsScreen({ navigation }: Props) {
  const { handleScroll } = useTabBarScroll();
  const [tab, setTab] = useState<Tab>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [jobs, setJobs] = useState<CustomerJob[]>([]);
  const { getStatus } = useJobStatus();

  // Refetch on focus — tabs stay mounted.
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
        .listMyJobPosts(uid)
        .then((posts) => {
          if (!cancelled) setJobs(posts);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Everything between selection and the rating stays in the "confirmed" tab.
  const items = jobs.filter((j) => {
    const status = getStatus(j.id) ?? j.status;
    if (tab === 'active') {
      return (
        status === 'active' ||
        status === 'awaiting_customer_confirmation' ||
        status === 'confirmed_awaiting_rating' ||
        status === 'disputed'
      );
    }
    if (tab === 'pending') return status === 'pending';
    // Cancelled jobs show here too — they can be reopened.
    return status === 'completed' || status === 'cancelled';
  });

  const openChat = (job: CustomerJob) => {
    if (!job.provider || !job.providerId) return;
    navigation.navigate('ChatConversation', {
      chatId: job.providerId,
      name: job.provider,
      initials: job.provider[0],
      color: colors.primary,
      role: 'customer',
      jobId: job.id,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* goBack returns to the previous tab (backBehavior 'history'). */}
      <BackHeader
        title="ჩემი განცხადებები"
        onBack={() => navigation.goBack()}
        right={
          <Pressable testID="post-job-fab" style={styles.addButton} onPress={() => navigation.navigate('PostJob')}>
            <Plus size={20} color={colors.primaryForeground} strokeWidth={2.5} />
          </Pressable>
        }
      />
      <View style={styles.tabsRow}>
        {TABS.map((t) => (
          <Pressable key={t.id} style={[styles.tab, tab === t.id && styles.tabActive]} onPress={() => setTab(t.id)}>
            <Text
              style={[styles.tabText, tab === t.id && styles.tabTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {t.label}
            </Text>
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
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {items.map((j, i) => (
            <Reveal key={j.id} delay={staggerDelay(i)}>
            <JobCard
              job={j}
              status={getStatus(j.id) ?? j.status}
              onPress={() => navigation.navigate('CustomerJobDetail', { jobId: j.id, job: j })}
              onChat={() => openChat(j)}
            />
            </Reveal>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function JobCard({
  job: j,
  status,
  onPress,
  onChat,
}: {
  job: CustomerJob;
  status: JobStatus;
  onPress: () => void;
  onChat: () => void;
}) {
  const card = usePressScale();
  const chat = usePressScale();

  return (
    <Animated.View style={{ transform: [{ scale: card.scale }] }}>
      <Pressable style={styles.card} onPress={onPress} onPressIn={card.onPressIn} onPressOut={card.onPressOut}>
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <CategoryIcon categoryId={j.category} />
            <View>
              <Text style={styles.jobTitle}>{j.title}</Text>
              <Text style={styles.jobDate}>{j.date}</Text>
            </View>
          </View>
          <StatusPill status={status} />
        </View>
        <Text style={styles.jobDesc} numberOfLines={2}>
          {j.desc}
        </Text>
        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            {j.provider && <Text style={styles.providerName}>{j.provider}</Text>}
          </View>
          {j.provider && j.providerId && (
            <Animated.View style={{ transform: [{ scale: chat.scale }] }}>
              <Pressable
                style={styles.chatButton}
                onPress={(e) => {
                  e.stopPropagation();
                  onChat();
                }}
                onPressIn={chat.onPressIn}
                onPressOut={chat.onPressOut}
              >
                <MessageCircle size={13} color={colors.primary} />
                <Text style={styles.chatButtonText}>ჩატი</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
      </Pressable>
    </Animated.View>
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
