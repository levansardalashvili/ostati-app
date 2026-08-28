import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Briefcase } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { ProviderFeedJobCard } from '../components/ProviderFeedJobCard';
import { colors, radius, spacing, typography } from '../theme';
import { jobService } from '../services/jobService';
import type { FeedJob } from '../types/job';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProviderJobFeed'>;

// ProviderJobFeed — Home-ის "ყველას ნახვა"-ს სრული ვერსია (ProviderHomeScreen-ის
// 5-ცალიანი ჩამონათვალის გარეშე). იგივე ბარათი, საერთო
// providerFeedFilters/ProviderFeedJobCard-იდან.
export function ProviderJobFeedScreen({ navigation }: Props) {
  const [interests, setInterests] = useState<Set<string>>(new Set());
  const filtered = useMemo(() => jobService.getOpenProviderFeed(), []);

  const handleJobDetail = (id: string) => {
    navigation.navigate('ProviderJobDetail', { id });
  };
  const handleOpenChat = (job: FeedJob) => {
    navigation.navigate('ChatConversation', {
      chatId: 'c1',
      name: job.customer,
      initials: job.customer[0],
      color: '#64748B',
      role: 'provider',
    });
  };
  const markInterested = (id: string) => {
    setInterests((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="ახალი მოთხოვნები" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {filtered.length === 0 ? (
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
                onDetail={() => handleJobDetail(job.id)}
                onInterested={() => markInterested(job.id)}
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
