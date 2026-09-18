import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Camera, Check, Clock, MapPin } from 'lucide-react-native';
import { Button } from './Button';
import { CategoryIcon } from './CategoryIcon';
import { Skeleton } from './Skeleton';
import { colors, radius, spacing, typography } from '../theme';
import { CATEGORIES } from '../data/categories';
import type { FeedJob } from '../types/job';

type Props = {
  job: FeedJob;
  sent: boolean;
  onDetail: () => void;
  onChat: () => void;
};

// ProviderFeedJobCard — Job Feed-ის ერთი ბარათი (ProviderHomeScreen-ის
// JobCard-იდან გამოტანილი, გაზიარებულია ProviderHomeScreen-სა და
// ProviderJobFeedScreen-ს ("ყველას ნახვა") შორის).
//
// Task — ბარათზე პირდაპირ "დაინტ. ვარ" ღილაკი ამოღებულია — Provider-მა
// ჯერ სამუშაოს სრული დეტალები/აღწერა/ფოტოები უნდა ნახოს ("დეტ. ნახვა"),
// ინტერესის/ფასის გაგზავნა კი მხოლოდ Job Detail-ის ეკრანზეა შესაძლებელი
// (ქვედა footer, "დაინტერესება" ღილაკი). `sent`-ის შემდეგ კვლავ ჩანს
// "ჩატის გახსნა" (ეს არ იცვლება — ცალკე, დასრულებული ინტერესის
// შემდგომი მოქმედებაა).
export function ProviderFeedJobCard({ job, sent, onDetail, onChat }: Props) {
  const category = CATEGORIES.find((c) => c.id === job.category) ?? CATEGORIES[0];

  return (
    <View style={styles.jobCard}>
      <View style={styles.jobCardBody}>
        <View style={styles.jobHeaderRow}>
          <CategoryIcon categoryId={category.id} size={44} />
          <View style={styles.jobTitleBlock}>
            <Text style={styles.jobTitle} numberOfLines={1}>
              {job.title}
            </Text>
            <Text style={styles.jobCategoryText} numberOfLines={1}>
              {job.ago} წინ
            </Text>
          </View>
          {job.urgent && (
            <View style={styles.urgentBadge}>
              <Text style={styles.urgentBadgeText}>🔥 სასწ.</Text>
            </View>
          )}
        </View>

        <Text style={styles.jobDesc} numberOfLines={3}>
          {job.desc}
        </Text>

        <View style={styles.jobMetaRow}>
          {!!job.date && (
            <View style={styles.jobMetaItem}>
              <Clock size={13} color={colors.primary} />
              <Text style={[styles.jobMetaText, styles.jobTimeText]} numberOfLines={1}>
                {job.date}
              </Text>
            </View>
          )}
          <View style={styles.jobMetaItem}>
            <MapPin size={13} color={colors.mutedForeground} />
            <Text style={styles.jobMetaText} numberOfLines={1}>
              {job.location}
            </Text>
          </View>
          {job.hasPhoto && (
            <View style={styles.jobMetaItem}>
              <Camera size={13} color={colors.mutedForeground} />
              <Text style={styles.jobMetaText}>ფოტოა</Text>
            </View>
          )}
        </View>

        {/* Provider-ს არ უნდა დაინახოს, რამდენი კონკურენტი-ოსტატია
            დაინტერესებული ამ job-ზე — "interestedCount" აქაც არ ჩანს. */}
        <View style={styles.jobActionRow}>
          <View style={styles.actionButton}>
            <Button label="დეტალების ნახვა" variant="outline" onPress={onDetail} />
          </View>
          {sent && (
            <View style={styles.actionButton}>
              <Button label="ჩატის გახსნა" onPress={onChat} />
            </View>
          )}
        </View>
      </View>

      {sent && (
        <View style={styles.sentStrip}>
          <Check size={13} color={colors.success} strokeWidth={2.5} />
          <Text style={styles.sentStripText}>ინტერესი გაგზავნილია</Text>
        </View>
      )}
    </View>
  );
}

export function ProviderFeedJobCardSkeleton() {
  return (
    <View style={[styles.jobCard, { padding: spacing.md, gap: spacing.sm }]}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Skeleton width={38} height={38} borderRadius={radius.md} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Skeleton width="80%" height={16} />
          <Skeleton width="50%" height={12} />
        </View>
      </View>
      <Skeleton width="100%" height={12} />
      <Skeleton width="60%" height={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  jobCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  jobCardBody: {
    padding: spacing.md,
    gap: spacing.md,
  },
  jobHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  jobTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  jobTitle: {
    ...typography.bodyMedium,
    color: colors.foreground,
    fontWeight: '700',
  },
  jobCategoryText: {
    ...typography.small,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  urgentBadge: {
    backgroundColor: colors.dangerBackground,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  urgentBadgeText: {
    ...typography.small,
    color: colors.destructive,
    fontWeight: '700',
  },
  jobDesc: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  jobMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  jobMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  jobMetaText: {
    ...typography.small,
    color: colors.mutedForeground,
    flexShrink: 1,
  },
  jobTimeText: {
    color: colors.primary,
    fontWeight: '600',
  },
  jobActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  sentStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successBackground,
    borderTopWidth: 1,
    borderTopColor: '#A7F3D0',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  sentStripText: {
    ...typography.small,
    color: colors.success,
    fontWeight: '600',
  },
});
