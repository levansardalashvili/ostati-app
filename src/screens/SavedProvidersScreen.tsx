import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, MapPin, MessageCircle, Star } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { BackHeader } from '../components/BackHeader';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { colors, radius, spacing, typography } from '../theme';
import { SPECIALTY_LABEL } from '../data/categories';
import { userService } from '../services/userService';
import { useFavoriteProviders } from '../state/FavoriteProvidersContext';
import type { Provider } from '../types/provider';
import { isNewProvider } from '../utils/providerRank';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SavedProviders'>;

// SavedProviders — Customer-ის შენახული (favorite) ოსტატები. ახალი ეკრანი
// (ზიპში არ არსებობდა), მომხმარებლის მოთხოვნით: "თუ ერთხელ კარგი
// ელექტრიკოსი იპოვა, მომავალში თავიდან აღარ მოძებნის". ❤️ ღილაკი
// ViewProviderProfileScreen-ის header-შია, ეს ეკრანი მხოლოდ კითხულობს
// FavoriteProvidersContext-ს — CustomerProfileScreen-ის "შენახული ოსტატები"
// მენიუდან იხსნება.
export function SavedProvidersScreen({ navigation }: Props) {
  const { favoriteIds, toggleFavorite } = useFavoriteProviders();
  const [allProviders, setAllProviders] = useState<Provider[]>([]);
  useEffect(() => {
    let cancelled = false;
    userService.listRealProviders().then((real) => {
      if (!cancelled) setAllProviders(real);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const saved = allProviders.filter((p) => favoriteIds.has(p.id));

  const openProfile = (id: string) => navigation.navigate('ViewProviderProfile', { id });
  const openChat = (p: Provider) => {
    navigation.navigate('ChatConversation', {
      chatId: p.id,
      name: p.name,
      initials: p.initials,
      color: p.color,
      role: 'customer',
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader title="შენახული ოსტატები" onBack={() => navigation.goBack()} />

      {saved.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Heart size={22} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>შენახული ოსტატები არ გაქვს</Text>
          <Text style={styles.emptySubtitle}>
            ოსტატის პროფილზე ❤️ დააჭირე, რომ აქ შეინახო და მომავალში მარტივად იპოვო.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {saved.map((p) => {
            const specialty = SPECIALTY_LABEL[p.category] ?? p.category;
            return (
              <View key={p.id} style={styles.card}>
                <Pressable style={styles.cardBody} onPress={() => openProfile(p.id)}>
                  <Avatar initials={p.initials} color={p.color} size={54} online={p.online} uri={p.photoUrl} />
                  <View style={styles.info}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={1}>
                        {p.name}
                      </Text>
                      {p.verified && <VerifiedBadge size={15} />}
                    </View>
                    <Text style={styles.meta}>
                      {specialty} • {p.years} წ. გამოცდ.
                    </Text>
                    <View style={styles.statsRow}>
                      {isNewProvider(p) ? (
                        <View style={styles.newProviderBadge}>
                          <Text style={styles.newProviderBadgeText}>ახალი ოსტატი</Text>
                        </View>
                      ) : (
                        <View style={styles.ratingRow}>
                          <Star size={12} color="#FBBF24" fill="#FBBF24" />
                          <Text style={styles.ratingText}>{p.rating}</Text>
                          <Text style={styles.reviewsText}>({p.reviews} შეფ.)</Text>
                        </View>
                      )}
                      <Text style={styles.dotSeparator}>•</Text>
                      <View style={styles.locationRow}>
                        <MapPin size={11} color={colors.mutedForeground} />
                        <Text style={styles.locationText} numberOfLines={1}>
                          {p.location}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Pressable style={styles.heartButton} onPress={() => toggleFavorite(p.id)}>
                    <Heart size={17} color={colors.destructive} fill={colors.destructive} />
                  </Pressable>
                </Pressable>

                <View style={styles.actionRow}>
                  <Text style={styles.priceText} numberOfLines={1}>
                    {p.price}
                  </Text>
                  <Pressable style={styles.messageButton} onPress={() => openChat(p)}>
                    <MessageCircle size={14} color={colors.primaryForeground} />
                    <Text style={styles.messageButtonText}>მიწერა</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
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
    gap: spacing.sm + 6,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  name: {
    ...typography.bodyMedium,
    color: colors.foreground,
    fontWeight: '700',
    flexShrink: 1,
  },
  meta: {
    ...typography.small,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginTop: spacing.xs + 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    ...typography.small,
    color: colors.foreground,
    fontWeight: '700',
  },
  reviewsText: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  dotSeparator: {
    fontSize: 11,
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
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
  },
  locationText: {
    fontSize: 11,
    color: colors.mutedForeground,
    flexShrink: 1,
  },
  heartButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.muted,
    marginTop: spacing.sm + 2,
    paddingTop: spacing.sm + 2,
  },
  priceText: {
    ...typography.captionMedium,
    color: colors.primary,
    fontWeight: '700',
    flexShrink: 1,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 4,
  },
  messageButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryForeground,
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
