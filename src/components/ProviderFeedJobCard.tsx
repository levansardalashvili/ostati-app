import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, Check, ChevronRight, Clock, MapPin, MessageCircle } from 'lucide-react-native';
import { CategoryIcon } from './CategoryIcon';
import { usePressScale } from '../utils/usePressScale';
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
// "მიწერა" (Customer-ის ProviderCard-ის იგივე ზოლი — ცალკე, დასრულებული ინტერესის
// შემდგომი მოქმედებაა).
export function ProviderFeedJobCard({ job, sent, onDetail, onChat }: Props) {
  const category = CATEGORIES.find((c) => c.id === job.category) ?? CATEGORIES[0];
  const message = usePressScale();

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

      </View>

      {/* Same action row as the Customer's ProviderCard: "დეტალების ნახვა ›"
          link + blue "მიწერა" pill (the pill only after interest was sent). */}
      <View style={styles.jobActionRow}>
        <Pressable style={styles.detailLink} onPress={onDetail} hitSlop={6}>
          <Text style={styles.detailLinkText}>დეტალების ნახვა</Text>
          <ChevronRight size={12} color={colors.primary} />
        </Pressable>
        {sent && (
          <Animated.View style={[styles.messageButtonWrap, { transform: [{ scale: message.scale }] }]}>
            <Pressable
              style={styles.messageButton}
              onPress={onChat}
              onPressIn={message.onPressIn}
              onPressOut={message.onPressOut}
            >
              <MessageCircle size={14} color={colors.primaryForeground} />
              <Text style={styles.messageButtonText}>მიწერა</Text>
            </Pressable>
          </Animated.View>
        )}
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
  // Mirrors ProviderCard's action row (Customer side).
  jobActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  detailLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  detailLinkText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '700',
  },
  messageButtonWrap: {
    flex: 1,
    alignItems: 'center',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
  },
  messageButtonText: {
    ...typography.small,
    color: colors.primaryForeground,
    fontWeight: '700',
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
