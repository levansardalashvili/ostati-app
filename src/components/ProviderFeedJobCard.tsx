import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, Check, Clock, MapPin, MessageCircle, ThumbsUp } from 'lucide-react-native';
import { CategoryIcon } from './CategoryIcon';
import { Skeleton } from './Skeleton';
import { colors, radius, spacing, typography } from '../theme';
import { CATEGORIES } from '../data/categories';
import type { FeedJob } from '../types/job';
import { usePressScale } from '../utils/usePressScale';

type Props = {
  job: FeedJob;
  sent: boolean;
  onDetail: () => void;
  onInterested: () => void;
  onChat: () => void;
};

// ProviderFeedJobCard — Job Feed-ის ერთი ბარათი (ProviderHomeScreen-ის
// JobCard-იდან გამოტანილი, გაზიარებულია ProviderHomeScreen-სა და
// ProviderJobFeedScreen-ს ("ყველას ნახვა") შორის).
export function ProviderFeedJobCard({ job, sent, onDetail, onInterested, onChat }: Props) {
  const category = CATEGORIES.find((c) => c.id === job.category) ?? CATEGORIES[0];
  const detail = usePressScale();
  const action = usePressScale();

  return (
    <View style={styles.jobCard}>
      <View style={styles.jobCardBody}>
        <View style={styles.jobHeaderRow}>
          <CategoryIcon categoryId={category.id} size={38} />
          <View style={{ flex: 1 }}>
            <View style={styles.jobTitleRow}>
              <Text style={styles.jobTitle}>{job.title}</Text>
              {job.urgent && (
                <View style={styles.urgentBadge}>
                  <Text style={styles.urgentBadgeText}>🔥 სასწ.</Text>
                </View>
              )}
            </View>
            <View style={styles.jobMetaRow}>
              <Text style={styles.jobMetaText}>{category.label}</Text>
              <Text style={styles.dotSeparator}>•</Text>
              <View style={styles.jobMetaLocation}>
                <MapPin size={10} color={colors.mutedForeground} />
                <Text style={styles.jobMetaText}>{job.location}</Text>
              </View>
              <Text style={styles.dotSeparator}>•</Text>
              <Text style={styles.jobMetaText}>{job.ago} წინ</Text>
            </View>
          </View>
        </View>

        <Text style={styles.jobDesc}>{job.desc}</Text>

        <View style={styles.jobTimeRow}>
          <Clock size={12} color={colors.primary} />
          <Text style={styles.jobTimeText}>{job.date}</Text>
        </View>

        <View style={styles.jobTagsRow}>
          {job.hasPhoto && (
            <View style={styles.jobTag}>
              <Camera size={10} color={colors.mutedForeground} />
              <Text style={styles.jobTagText}>ფოტოა</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.jobActionRow}>
        <Text style={styles.interestedCount}>{job.interested + (sent ? 1 : 0)} დაინტ.</Text>
        <View style={styles.jobActionButtons}>
          <Animated.View style={{ transform: [{ scale: detail.scale }] }}>
            <Pressable
              style={styles.detailButton}
              onPress={onDetail}
              onPressIn={detail.onPressIn}
              onPressOut={detail.onPressOut}
            >
              <Text style={styles.detailButtonText}>დეტ. ნახვა</Text>
            </Pressable>
          </Animated.View>
          <Animated.View style={{ transform: [{ scale: action.scale }] }}>
            {sent ? (
              <Pressable
                style={styles.chatButton}
                onPress={onChat}
                onPressIn={action.onPressIn}
                onPressOut={action.onPressOut}
              >
                <MessageCircle size={13} color={colors.primaryForeground} />
                <Text style={styles.chatButtonText}>ჩატის გახსნა</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.chatButton}
                onPress={onInterested}
                onPressIn={action.onPressIn}
                onPressOut={action.onPressOut}
              >
                <ThumbsUp size={13} color={colors.primaryForeground} />
                <Text style={styles.chatButtonText}>დაინტ. ვარ</Text>
              </Pressable>
            )}
          </Animated.View>
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
    paddingBottom: spacing.sm + 2,
  },
  jobHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm + 2,
  },
  jobTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  jobTitle: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
    flex: 1,
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
  jobMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  jobMetaLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  jobMetaText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  dotSeparator: {
    color: colors.border,
    fontSize: 9,
  },
  jobDesc: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.sm + 2,
  },
  jobTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm + 2,
  },
  jobTimeText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '600',
  },
  jobTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  jobTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  jobTagText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  jobActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  interestedCount: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  jobActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailButton: {
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  detailButtonText: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '600',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  chatButtonText: {
    ...typography.small,
    color: colors.primaryForeground,
    fontWeight: '600',
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
