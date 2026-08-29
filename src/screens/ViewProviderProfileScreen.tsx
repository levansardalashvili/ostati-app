import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Award, Heart, Image as ImageIcon, MapPin, MessageCircle, Share2, Star } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { MediaPreviewModal } from '../components/MediaPreviewModal';
import type { MediaItem } from '../components/MediaUploadGrid';
import { Skeleton } from '../components/Skeleton';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { colors, radius, spacing, typography } from '../theme';
import { SPECIALTY_LABEL } from '../data/categories';
import { authService } from '../services/authService';
import { reviewService } from '../services/reviewService';
import { userService } from '../services/userService';
import { useFavoriteProviders } from '../state/FavoriteProvidersContext';
import type { Provider } from '../types/provider';
import type { Review } from '../types/review';
import { isNewProvider } from '../utils/providerRank';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ViewProviderProfile'>;

const EMPTY_PROVIDER: Provider = {
  id: '',
  name: '',
  category: '',
  years: 0,
  rating: 0,
  reviews: 0,
  location: '',
  areas: [],
  price: '',
  jobs: 0,
  verified: false,
  online: false,
  initials: '',
  color: colors.primary,
  bio: '',
  skills: [],
  certificates: [],
  portfolio: [],
  specialties: [],
};

// ViewProviderProfile — ოსტატის საჯარო პროფილი Customer-ის თვალით. Provider-ისთვისაც
// გამოიყენება საკუთარი პროფილის "თვალით" წინასწარი ნახვისთვის — ამ
// შემთხვევაში ❤️ ღილაკი არ ჩანს (საკუთარი თავის "შენახვა" აზრი არ აქვს),
// `p.id === auth uid`-ით ვარკვევთ (#71 — ProviderProfileScreen-ის preview
// ახლა რეალურ, ავტორიზებულ uid-ს ხსნის, არა mock 'p1'-ს).
export function ViewProviderProfileScreen({ navigation, route }: Props) {
  const [p, setP] = useState<Provider>(EMPTY_PROVIDER);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    userService.getRealProviderById(route.params.id).then((real) => {
      if (cancelled) return;
      if (real) {
        setP(real);
        reviewService.listRealReviewsForProvider(real.id).then((r) => {
          if (!cancelled) setReviews(r);
        });
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [route.params.id]);

  const specialty = SPECIALTY_LABEL[p.category] ?? p.category;
  const [previewCert, setPreviewCert] = useState<MediaItem | null>(null);
  const [previewPortfolio, setPreviewPortfolio] = useState<MediaItem | null>(null);
  const { isFavorite, toggleFavorite } = useFavoriteProviders();
  const isSelfPreview = !!p.id && p.id === authService.getCurrentUser()?.uid;
  const favorite = isFavorite(p.id);

  const handleChat = () => {
    navigation.navigate('ChatConversation', {
      chatId: p.id,
      name: p.name,
      initials: p.initials,
      color: p.color,
      role: 'customer',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={18} color={colors.foreground} />
          </Pressable>
          <Text style={styles.headerTitle}>ოსტატის პროფილი</Text>
          <View style={styles.headerActions} />
        </View>
        <View style={{ padding: spacing.lg }}>
          <Skeleton width="100%" height={160} borderRadius={radius.lg} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.foreground} />
        </Pressable>
        <Text style={styles.headerTitle}>ოსტატის პროფილი</Text>
        <View style={styles.headerActions}>
          {!isSelfPreview && (
            <Pressable style={styles.iconButton} onPress={() => toggleFavorite(p.id)}>
              <Heart size={17} color={favorite ? colors.destructive : colors.mutedForeground} fill={favorite ? colors.destructive : 'transparent'} />
            </Pressable>
          )}
          <Pressable style={styles.iconButton}>
            <Share2 size={17} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.hero}>
          <View style={styles.heroContent}>
            <View style={styles.avatarWrap}>
              <Avatar initials={p.initials} color={p.color} size={88} uri={p.photoUrl} />
              {p.online && <View style={styles.onlineDot} />}
            </View>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{p.name}</Text>
              {p.verified && <VerifiedBadge size={20} />}
            </View>
            <Text style={styles.specialty}>{specialty}</Text>
            {p.online ? (
              <View style={styles.availableBadge}>
                <View style={styles.availableDot} />
                <Text style={styles.availableText}>ხელმისაწვდომი</Text>
              </View>
            ) : (
              <View style={styles.busyBadge}>
                <View style={styles.busyDot} />
                <Text style={styles.busyText}>დაკავებული</Text>
              </View>
            )}
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statBox}>
              {isNewProvider(p) ? (
                <>
                  <Text style={styles.statValue}>—</Text>
                  <Text style={styles.statLabel}>ახალი ოსტატი</Text>
                </>
              ) : (
                <>
                  <View style={styles.statRatingRow}>
                    <Star size={13} color="#FBBF24" fill="#FBBF24" />
                    <Text style={styles.statValue}>{p.rating}</Text>
                  </View>
                  <Text style={styles.statLabel}>{p.reviews} შეფასება</Text>
                </>
              )}
            </View>
            <View style={[styles.statBox, styles.statBoxBordered]}>
              <Text style={styles.statValue}>{p.years}</Text>
              <Text style={styles.statLabel}>წ. გამოცდ.</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{p.jobs}</Text>
              <Text style={styles.statLabel}>შესრულ.</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>ჩემ შესახებ</Text>
          <Text style={styles.bioText}>{p.bio}</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>სპეციალობები</Text>
          <View style={styles.tagsRow}>
            {p.specialties.map((s) => (
              <View key={s} style={styles.skillTag}>
                <Text style={styles.skillTagText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>ფასი</Text>
          {p.price || p.sqmPrice ? (
            <View style={{ gap: spacing.xs + 2 }}>
              {p.price && <Text style={styles.priceText}>{p.price}</Text>}
              {p.sqmPrice && <Text style={styles.priceText}>ფასი კვ.მ-ზე: {p.sqmPrice} ₾ / მ²</Text>}
            </View>
          ) : (
            <Text style={styles.priceTextMuted}>ფასი სამუშაოს ნახვის შემდეგ განისაზღვრება</Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>სერვისები</Text>
          <View style={styles.tagsRow}>
            {p.skills.map((s) => (
              <View key={s} style={styles.skillTag}>
                <Text style={styles.skillTagText}>{s}</Text>
              </View>
            ))}
          </View>
        </View>

        {p.certificates.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>სერთიფიკატები</Text>
            <View style={styles.mediaRow}>
              {p.certificates.map((c) => (
                <Pressable key={c.id} style={[styles.mediaThumb, { backgroundColor: c.bg }]} onPress={() => setPreviewCert(c)}>
                  <Award size={20} color="rgba(100,116,139,0.5)" />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {p.portfolio.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>ნამუშევრები</Text>
            <View style={styles.mediaRow}>
              {p.portfolio.map((ph) => (
                <Pressable key={ph.id} style={[styles.mediaThumb, { backgroundColor: ph.bg }]} onPress={() => setPreviewPortfolio(ph)}>
                  <ImageIcon size={20} color="rgba(100,116,139,0.5)" />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>სამუშაო არეალი</Text>
          <View style={styles.tagsRow}>
            {p.areas.map((a) => (
              <View key={a} style={styles.areaTag}>
                <MapPin size={11} color={colors.mutedForeground} />
                <Text style={styles.areaTagText}>{a}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.sectionCard, { marginBottom: spacing.lg }]}>
          <Text style={styles.sectionTitle}>შეფასებები</Text>
          {reviews.length === 0 ? (
            <View style={styles.reviewsEmpty}>
              <View style={styles.reviewsEmptyIcon}>
                <Star size={20} color={colors.mutedForeground} />
              </View>
              <Text style={styles.reviewsEmptyTitle}>შეფასებები ჯერ არ აქვს</Text>
              <Text style={styles.reviewsEmptySubtitle}>პირველი შეფასება შესრულებული სამუშაოს შემდეგ გამოჩნდება.</Text>
            </View>
          ) : (
            <>
              <View style={styles.ratingSummaryBar}>
                <Text style={styles.ratingSummaryValue}>{p.rating}</Text>
                <View>
                  <View style={styles.ratingSummaryStars}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={14} color="#FBBF24" fill={i < Math.floor(p.rating) ? '#FBBF24' : 'transparent'} />
                    ))}
                  </View>
                  <Text style={styles.ratingSummaryNote}>{p.reviews} შეფასებიდან</Text>
                </View>
              </View>
              {reviews.slice(0, 3).map((r, i) => (
                <View key={i} style={[styles.reviewRow, i > 0 && styles.reviewRowBorder]}>
                  <View style={styles.reviewTop}>
                    <View style={styles.reviewNameRow}>
                      <View style={styles.reviewAvatar}>
                        <Text style={styles.reviewAvatarText}>{r.name[0]}</Text>
                      </View>
                      <View>
                        <Text style={styles.reviewName}>{r.name}</Text>
                        <View style={styles.reviewStars}>
                          {Array.from({ length: r.stars }).map((_, j) => (
                            <Star key={j} size={10} color="#FBBF24" fill="#FBBF24" />
                          ))}
                        </View>
                      </View>
                    </View>
                    <Text style={styles.reviewDate}>{r.date}</Text>
                  </View>
                  <Text style={styles.reviewText}>{r.text}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.chatButton} onPress={handleChat}>
          <MessageCircle size={18} color={colors.primaryForeground} />
          <Text style={styles.chatButtonText}>მიწერა</Text>
        </Pressable>
        <Text style={styles.footerNote}>საკონტაქტო ინფორმაცია დაცულია და ავტომატურად არ არის გაზიარებული.</Text>
      </View>

      <MediaPreviewModal item={previewCert} icon={Award} onClose={() => setPreviewCert(null)} />
      <MediaPreviewModal item={previewPortfolio} icon={ImageIcon} onClose={() => setPreviewPortfolio(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    ...typography.bodyMedium,
    color: colors.foreground,
    fontWeight: '600',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: spacing.xxl * 2,
  },
  hero: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heroContent: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.success,
    borderWidth: 3,
    borderColor: colors.card,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
  },
  specialty: {
    ...typography.body,
    color: colors.mutedForeground,
    marginBottom: spacing.sm + 2,
  },
  availableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.successBackground,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 6,
    paddingVertical: spacing.xs + 2,
  },
  availableDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  availableText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },
  busyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 6,
    paddingVertical: spacing.xs + 2,
  },
  busyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.mutedForeground,
  },
  busyText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedForeground,
  },
  statsCard: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    overflow: 'hidden',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  statBoxBordered: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  statRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  statLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm + 6,
  },
  sectionTitle: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
    marginBottom: spacing.sm + 2,
  },
  bioText: {
    ...typography.small,
    color: colors.mutedForeground,
    lineHeight: 19,
  },
  priceText: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
  },
  priceTextMuted: {
    ...typography.small,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  skillTag: {
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 4,
  },
  skillTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.secondaryForeground,
  },
  areaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 4,
  },
  areaTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  mediaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  mediaThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewsEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  reviewsEmptyIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm + 2,
  },
  reviewsEmptyTitle: {
    ...typography.small,
    color: colors.foreground,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  reviewsEmptySubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 220,
  },
  ratingSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  ratingSummaryValue: {
    fontSize: 30,
    fontWeight: '700',
    color: '#D97706',
  },
  ratingSummaryStars: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 4,
  },
  ratingSummaryNote: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B45309',
  },
  reviewRow: {
    paddingBottom: 2,
  },
  reviewRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.muted,
    paddingTop: spacing.sm + 6,
    marginTop: spacing.xs,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs + 2,
  },
  reviewNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedForeground,
  },
  reviewName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 1,
    marginTop: 2,
  },
  reviewDate: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  reviewText: {
    ...typography.small,
    color: colors.mutedForeground,
    lineHeight: 18,
    marginLeft: 42,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm + 6,
    paddingBottom: spacing.xl,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm + 2,
  },
  chatButtonText: {
    ...typography.bodyMedium,
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  footerNote: {
    fontSize: 11,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 15,
    paddingHorizontal: spacing.lg,
  },
});
