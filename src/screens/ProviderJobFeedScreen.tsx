import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Briefcase } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { ProviderFeedJobCard, ProviderFeedJobCardSkeleton } from '../components/ProviderFeedJobCard';
import { colors, radius, spacing, typography } from '../theme';
import { authService } from '../services/authService';
import { jobService } from '../services/jobService';
import { quoteService } from '../services/quoteService';
import type { FeedJob } from '../types/job';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProviderJobFeed'>;

// ProviderJobFeed — Home-ის "ყველას ნახვა"-ს სრული ვერსია (ProviderHomeScreen-ის
// 5-ცალიანი ჩამონათვალის გარეშე). იგივე ბარათი, საერთო
// providerFeedFilters/ProviderFeedJobCard-იდან.
export function ProviderJobFeedScreen({ navigation }: Props) {
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const [filtered, setFiltered] = useState<FeedJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      const uid = authService.getCurrentUser()?.uid;
      // Task — `get_open_provider_feed()` RPC-ს `authenticated` role სჭირდება
      // (grant-ის დონეზეც, `SET search_path`-ის auth.uid()-checkis
      // გვერდით) — ადრე ეს fetch უპირობოდ ეშვებოდა, სესიის მზადყოფნის
      // გარეშეც (მაგ. logout-ის navigation.reset-ის შუალედში ეს ეკრანი
      // ჯერ კიდევ focused-ია), რაც "permission denied for function
      // get_open_provider_feed" (42501) uncaught rejection-ს იწვევდა —
      // `uid`-ის სხვა ორ query-ის იგივე დაცვის ქვეშ ჩავაგდე, პლუს `.catch()`.
      Promise.all([
        uid ? jobService.getOpenProviderFeedPosts() : Promise.resolve([]),
        uid ? quoteService.listMyResponseJobIds(uid) : Promise.resolve(new Set<string>()),
      ])
        .then(([jobs, myResponses]) => {
          if (cancelled) return;
          setFiltered(jobs);
          setInterests(myResponses);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handleJobDetail = (job: FeedJob) => {
    navigation.navigate('ProviderJobDetail', { id: job.id, job });
  };
  const handleOpenChat = (job: FeedJob) => {
    if (!job.customerId) return;
    navigation.navigate('ChatConversation', {
      chatId: job.customerId,
      name: job.customer,
      initials: job.customer[0],
      color: '#64748B',
      role: 'provider',
      jobId: job.customerJobId,
      jobStatus: job.status,
    });
  };
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="ახალი მოთხოვნები" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {isLoading ? (
          <View style={{ gap: spacing.md }}>
            {[0, 1, 2].map((i) => (
              <ProviderFeedJobCardSkeleton key={i} />
            ))}
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Briefcase size={20} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>ახალი მოთხოვნები ჯერ არ არის</Text>
            <Text style={styles.emptySubtitle}>შენს კატეგორიასა და არეალში ახალი მოთხოვნა გამოჩნდება.</Text>
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {filtered.map((job) => (
              <ProviderFeedJobCard
                key={job.id}
                job={job}
                sent={interests.has(job.id)}
                onDetail={() => handleJobDetail(job)}
                onChat={() => handleOpenChat(job)}
              />
            ))}
          </View>
        )}
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
  },
  emptyState: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm + 2,
  },
  emptyTitle: {
    ...typography.captionMedium,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.small,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.sm + 2,
  },
});
