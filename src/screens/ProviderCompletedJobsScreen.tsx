import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Award, Clock, MapPin, Star } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { CategoryIcon } from '../components/CategoryIcon';
import { Skeleton } from '../components/Skeleton';
import { StatusPill } from '../components/StatusPill';
import { colors, radius, spacing, typography } from '../theme';
import { authService } from '../services/authService';
import { jobService } from '../services/jobService';
import { reviewService } from '../services/reviewService';
import type { FeedJob } from '../types/job';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProviderCompletedJobs'>;

// ProviderCompletedJobs — რეალურ `job_posts`-ზეა აგებული (#69,
// `provider_id = me AND status = 'completed'`), `reviews`-ის (#58/#64)
// job_id→stars mapping-ით ერთდროულად წამოღებული. მანამდე ცალკე, id-იანი
// mock `PROVIDER_COMPLETED_JOBS` იყო (`getCompletedJobs`, უცვლელი დარჩა
// mock consumer-ების არარსებობის შემთხვევაშიც — საბოლოო წაშლის ეტაპისთვის).
export function ProviderCompletedJobsScreen({ navigation }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [completedJobs, setCompletedJobs] = useState<FeedJob[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      const uid = authService.getCurrentUser()?.uid;
      if (!uid) {
        setCompletedJobs([]);
        setIsLoading(false);
        return;
      }
      Promise.all([jobService.listMyAssignedJobs(uid), reviewService.listReviewStarsByJob(uid)])
        .then(([jobs, stars]) => {
          if (cancelled) return;
          setCompletedJobs(jobs.filter((j) => j.status === 'completed'));
          setRatings(stars);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="შესრულებული სამუშაოები" onBack={() => navigation.goBack()} />
      {isLoading ? (
        <View style={[styles.body, styles.bodyContent]}>
          {[0, 1, 2, 3].map((i) => (
            <JobRowSkeleton key={i} />
          ))}
        </View>
      ) : completedJobs.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Award size={22} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>შესრულებული სამუშაოები ჯერ არ გაქვს</Text>
          <Text style={styles.emptySubtitle}>შენი სამუშაოები აქ გამოჩნდება.</Text>
        </View>
      ) : (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {completedJobs.map((j) => {
            const stars = ratings[j.id] ?? null;
            return (
              <View key={j.id} style={styles.card}>
                <CategoryIcon categoryId={j.category} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.jobTitle}>{j.title}</Text>
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <MapPin size={11} color={colors.mutedForeground} />
                      <Text style={styles.metaText}>{j.location}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Clock size={11} color={colors.mutedForeground} />
                      <Text style={styles.metaText}>{j.date}</Text>
                    </View>
                  </View>
                  <View style={styles.statusRow}>
                    <StatusPill status="completed" />
                    {stars !== null && (
                      <View style={styles.starsRow}>
                        {Array.from({ length: stars }).map((_, i) => (
                          <Star key={i} size={12} color="#FBBF24" fill="#FBBF24" />
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              </View>
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
      <Skeleton width={40} height={40} borderRadius={radius.md} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="50%" height={12} />
      </View>
    </View>
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
    gap: spacing.sm + 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  jobTitle: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 1,
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
  },
  emptySubtitle: {
    ...typography.small,
    color: colors.mutedForeground,
  },
});
