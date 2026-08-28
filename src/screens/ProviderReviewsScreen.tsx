import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Star } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { Skeleton } from '../components/Skeleton';
import { colors, radius, spacing, typography } from '../theme';
import { reviewService } from '../services/reviewService';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProviderReviews'>;

// ProviderReviewsScreen — ზუსტად ზიპის App.tsx-ის ProviderReviewsScreen-ის
// მიხედვით (ყოველთვის საკუთარი პროფილის — p1 — შეფასებები, ისევე როგორც
// ზიპშია, mode/id param-ის გარეშე).
export function ProviderReviewsScreen({ navigation }: Props) {
  const reviews = reviewService.getReviewsForProvider('p1');
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.stars, 0) / reviews.length : 0;
  const avgLabel = avg.toFixed(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 850);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="შეფასებები" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeft}>
            <Text style={styles.summaryAvg}>{avgLabel}</Text>
            <View style={styles.summaryStars}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={14} color="#FBBF24" fill={avg >= i ? '#FBBF24' : 'transparent'} />
              ))}
            </View>
            <Text style={styles.summaryCount}>{reviews.length} შეფ.</Text>
          </View>
          <View style={styles.summaryBars}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = reviews.filter((r) => r.stars === star).length;
              const pct = reviews.length ? (count / reviews.length) * 100 : 0;
              return (
                <View key={star} style={styles.barRow}>
                  <Text style={styles.barStarNum}>{star}</Text>
                  <Star size={10} color="#FBBF24" fill="#FBBF24" />
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.barCount}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {isLoading ? (
          <View style={{ gap: spacing.sm + 2, marginTop: spacing.md }}>
            {[0, 1, 2].map((i) => (
              <ReviewCardSkeleton key={i} />
            ))}
          </View>
        ) : reviews.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Star size={22} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>შეფასებები ჯერ არ არის</Text>
            <Text style={styles.emptySubtitle}>შეფასებები შესრულებული სამუშაოების შემდეგ გამოჩნდება.</Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm + 2, marginTop: spacing.md }}>
            {reviews.map((r, i) => (
              <View key={i} style={styles.reviewCard}>
                <View style={styles.reviewTop}>
                  <View style={styles.reviewNameRow}>
                    <View style={styles.reviewAvatar}>
                      <Text style={styles.reviewAvatarText}>{r.name[0]}</Text>
                    </View>
                    <Text style={styles.reviewName}>{r.name}</Text>
                  </View>
                  <Text style={styles.reviewDate}>{r.date}</Text>
                </View>
                <View style={styles.reviewStars}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} size={12} color="#FBBF24" fill={r.stars >= s ? '#FBBF24' : 'transparent'} />
                  ))}
                </View>
                <Text style={styles.reviewText}>{r.text}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ReviewCardSkeleton() {
  return (
    <View style={styles.reviewCard}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
        <Skeleton width={32} height={32} borderRadius={radius.full} />
        <Skeleton width={100} height={14} />
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
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.lg,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  summaryLeft: {
    alignItems: 'center',
  },
  summaryAvg: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.foreground,
    lineHeight: 44,
  },
  summaryStars: {
    flexDirection: 'row',
    gap: 2,
    marginTop: spacing.xs,
  },
  summaryCount: {
    ...typography.small,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  summaryBars: {
    flex: 1,
    gap: spacing.xs + 2,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  barStarNum: {
    fontSize: 11,
    color: colors.mutedForeground,
    width: 8,
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: '#FBBF24',
  },
  barCount: {
    fontSize: 11,
    color: colors.mutedForeground,
    width: 14,
  },
  reviewCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs + 2,
  },
  reviewNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: {
    color: colors.secondaryForeground,
    fontWeight: '700',
    fontSize: 13,
  },
  reviewName: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '600',
  },
  reviewDate: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: spacing.xs + 2,
  },
  reviewText: {
    ...typography.small,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
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
