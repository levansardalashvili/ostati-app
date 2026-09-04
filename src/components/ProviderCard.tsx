import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MapPin, MessageCircle, Star } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { Skeleton } from './Skeleton';
import { VerifiedBadge } from './VerifiedBadge';
import { colors, radius, spacing, typography } from '../theme';
import { SPECIALTY_LABEL, CATEGORIES } from '../data/categories';
import type { Provider } from '../types/provider';
import { isNewProvider } from '../utils/providerRank';

// გატანილია CustomerHomeScreen-იდან (Task: "ტოპ ოსტატები" + სრული სია
// screen-ი ერთსა და იმავე ბარათს იზიარებენ, Provider-ის fetching/
// ranking-ის დუბლირების გარეშე — ProviderFeedJobCard-ის იგივე პრინციპი,
// #29). ვიზუალურად უცვლელი.
export function ProviderCard({
  provider,
  onOpenProfile,
  onMessage,
}: {
  provider: Provider;
  onOpenProfile: () => void;
  onMessage: () => void;
}) {
  const specialty = SPECIALTY_LABEL[provider.category] ?? CATEGORIES.find((c) => c.id === provider.category)?.label ?? '';
  const district = provider.location.replace(', თბილისი', '');

  return (
    <View style={styles.providerCard}>
      <Pressable style={styles.providerCardBody} onPress={onOpenProfile}>
        <Avatar initials={provider.initials} color={provider.color} size={54} online={provider.online} uri={provider.photoUrl} />
        <View style={styles.providerInfo}>
          <View style={styles.providerNameRow}>
            <Text style={styles.providerName} numberOfLines={1}>
              {provider.name}
            </Text>
            {provider.verified && <VerifiedBadge size={15} />}
          </View>
          <Text style={styles.providerMeta}>
            {specialty} • {provider.years} წ. გამოცდ.
          </Text>
          <View style={styles.providerStatsRow}>
            {isNewProvider(provider) ? (
              <View style={styles.newProviderBadge}>
                <Text style={styles.newProviderBadgeText}>ახალი ოსტატი</Text>
              </View>
            ) : (
              <View style={styles.ratingRow}>
                <Star size={12} color="#FBBF24" fill="#FBBF24" />
                <Text style={styles.ratingText}>{provider.rating}</Text>
                <Text style={styles.reviewsText}>({provider.reviews} შეფ.)</Text>
              </View>
            )}
            <Text style={styles.dotSeparator}>•</Text>
            <View style={styles.locationRow}>
              <MapPin size={11} color={colors.mutedForeground} />
              <Text style={styles.locationText}>{district}</Text>
            </View>
          </View>
          <View style={styles.availabilityRow}>
            {provider.online ? (
              <View style={styles.availableRow}>
                <View style={styles.availableDot} />
                <Text style={styles.availableText}>ხელმისაწვდომი</Text>
              </View>
            ) : (
              <Text style={styles.busyText}>დაკავებული</Text>
            )}
          </View>
        </View>
      </Pressable>

      <View style={styles.providerActionRow}>
        <Text style={styles.priceText} numberOfLines={1}>
          {provider.price}
        </Text>
        <Pressable style={styles.messageButton} onPress={onMessage}>
          <MessageCircle size={14} color={colors.primaryForeground} />
          <Text style={styles.messageButtonText}>მიწერა</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ProviderCardSkeleton() {
  return (
    <View style={styles.providerCard}>
      <View style={[styles.providerCardBody, { paddingBottom: spacing.md }]}>
        <Skeleton width={54} height={54} borderRadius={radius.full} />
        <View style={[styles.providerInfo, { gap: spacing.xs }]}>
          <Skeleton width="70%" height={16} />
          <Skeleton width="50%" height={12} />
          <Skeleton width="60%" height={12} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  providerCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  providerCardBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
  },
  providerInfo: {
    flex: 1,
    minWidth: 0,
  },
  providerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  providerName: {
    ...typography.bodyMedium,
    color: colors.foreground,
    flexShrink: 1,
  },
  providerMeta: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  providerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    ...typography.captionMedium,
    color: colors.foreground,
  },
  reviewsText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  newProviderBadge: {
    backgroundColor: colors.secondary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
  },
  newProviderBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.secondaryForeground,
  },
  dotSeparator: {
    color: colors.border,
    fontSize: 9,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  locationText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  availabilityRow: {
    marginTop: spacing.xs,
  },
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  availableDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  availableText: {
    ...typography.small,
    color: colors.success,
    fontWeight: '700',
  },
  busyText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  providerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  priceText: {
    ...typography.small,
    color: colors.mutedForeground,
    flexShrink: 1,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
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
});
