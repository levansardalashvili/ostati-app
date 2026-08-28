import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Award, CheckCircle, Clock, MapPin, MessageCircle, MoreVertical, Star, ThumbsUp } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { CategoryIcon } from '../components/CategoryIcon';
import { colors, radius, spacing, typography } from '../theme';
import { PROVIDER_FEED } from '../data/mockHomeData';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProviderJobDetail'>;

// B2 — Job-ის დეტალი + ინტერესის დადასტურება (Provider მხრიდან)
// (product-spec.md; დიზაინის რეფერენსის ProviderJobDetail-ის browse/selected
// mode-ების მიხედვით)
export function ProviderJobDetailScreen({ navigation, route }: Props) {
  const { id, mode = 'browse' } = route.params;
  const job = PROVIDER_FEED.find((j) => j.id === id) ?? PROVIDER_FEED[0];
  const [expressed, setExpressed] = useState(false);
  const [offerSheetOpen, setOfferSheetOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');

  const receivedRating =
    mode === 'completed'
      ? { stars: 5, review: 'ძალიან კარგი სამუშაო, მადლობა!', chips: ['დროულად მოვიდა', 'ხარისხიანი სამუშაო'] }
      : null;

  const handleChat = () => {
    navigation.navigate('ChatConversation', {
      chatId: 'c1',
      name: job.customer,
      initials: job.customer[0],
      color: '#64748B',
      role: 'provider',
    });
  };
  const handleMore = () => {
    // TODO: მენიუს მოქმედებები (მაგ. "გაუზიარე", "შეატყობინე") მოგვიანებით
  };
  const confirmInterest = () => {
    setExpressed(true);
    setOfferSheetOpen(false);
    // TODO: jobResponses-ში ჩაწერა Firestore-ში (providerId, jobId, offerPrice)
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader
        title="განცხადება"
        onBack={() => navigation.goBack()}
        right={
          <Pressable style={styles.iconButton} onPress={handleMore}>
            <MoreVertical size={16} color={colors.foreground} />
          </Pressable>
        }
      />

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {mode === 'selected' && (
          <View style={styles.selectedBanner}>
            <View style={styles.bannerHeaderRow}>
              <CheckCircle size={16} color={colors.success} />
              <Text style={styles.selectedBannerTitle}>შენ აგირჩიეს ამ სამუშაოსთვის</Text>
            </View>
            <Text style={styles.selectedBannerText}>
              ველოდებით მომხმარებლის დადასტურებას სამუშაოს დასრულების შესახებ.
            </Text>
          </View>
        )}

        {mode === 'completed' && (
          <View style={styles.completedBanner}>
            <View style={styles.bannerHeaderRow}>
              <Award size={16} color={colors.primary} />
              <Text style={styles.completedBannerTitle}>სამუშაო დასრულებულად დადასტურდა</Text>
            </View>
            {receivedRating && (
              <>
                <View style={styles.completedStarsRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} size={15} color="#FBBF24" fill={receivedRating.stars >= s ? '#FBBF24' : 'transparent'} />
                  ))}
                  <Text style={styles.completedStarsLabel}>{receivedRating.stars}.0</Text>
                </View>
                {receivedRating.chips.length > 0 && (
                  <View style={styles.completedChipsRow}>
                    {receivedRating.chips.map((c) => (
                      <View key={c} style={styles.completedChip}>
                        <Text style={styles.completedChipText}>{c}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <Text style={styles.completedReviewText}>"{receivedRating.review}"</Text>
              </>
            )}
          </View>
        )}

        <View style={styles.headerCard}>
          <View style={styles.jobHeaderRow}>
            <CategoryIcon categoryId={job.category} size={40} />
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.jobTitle}>{job.title}</Text>
                {job.urgent && (
                  <View style={styles.urgentBadge}>
                    <Text style={styles.urgentBadgeText}>🔥 სასწრაფო</Text>
                  </View>
                )}
              </View>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <MapPin size={13} color={colors.mutedForeground} />
                  <Text style={styles.metaText}>{job.location}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Clock size={13} color={colors.mutedForeground} />
                  <Text style={styles.metaText}>{job.ago}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.statLabel}>დაინტერესებული</Text>
              <Text style={styles.statValue}>{job.interested + (expressed ? 1 : 0)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>სამუშაოს აღწერა</Text>
          <Text style={styles.sectionText}>{job.desc}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>მომხმარებელი</Text>
          <View style={styles.customerRow}>
            <View style={styles.customerAvatar}>
              <Text style={styles.customerAvatarText}>{job.customer[0]}</Text>
            </View>
            <View>
              <Text style={styles.customerName}>{job.customer}</Text>
              <View style={styles.customerRatingRow}>
                <Star size={11} color="#FBBF24" fill="#FBBF24" />
                <Text style={styles.customerRatingText}>4.7 · 8 განცხ.</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {mode === 'browse' && (
        <View style={styles.footer}>
          <Pressable style={styles.chatButton} onPress={handleChat}>
            <MessageCircle size={17} color={colors.foreground} />
            <Text style={styles.chatButtonText}>ჩატი</Text>
          </Pressable>
          <Pressable
            style={[styles.interestButton, expressed && styles.interestButtonExpressed]}
            onPress={() => !expressed && setOfferSheetOpen(true)}
          >
            {expressed ? (
              <CheckCircle size={17} color={colors.primaryForeground} />
            ) : (
              <ThumbsUp size={17} color={colors.primaryForeground} />
            )}
            <Text style={styles.interestButtonText}>
              {expressed ? (offerPrice ? `შეთავაზდა: ${offerPrice} ₾` : 'დაინტ. ხარ') : 'დაინტერესება'}
            </Text>
          </Pressable>
        </View>
      )}
      {mode === 'selected' && (
        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            <Text style={styles.waitingText}>ველოდებით მომხმარებლის დადასტურებას</Text>
            <Pressable style={[styles.chatButton, { alignSelf: 'stretch' }]} onPress={handleChat}>
              <MessageCircle size={17} color={colors.foreground} />
              <Text style={styles.chatButtonText}>ჩატი</Text>
            </Pressable>
          </View>
        </View>
      )}
      {mode === 'completed' && (
        <View style={styles.footer}>
          <Pressable style={styles.reviewsButton} onPress={() => navigation.navigate('ProviderReviews')}>
            <Award size={17} color={colors.primary} />
            <Text style={styles.reviewsButtonText}>ჩემი შეფასებები</Text>
          </Pressable>
        </View>
      )}

      <BottomSheet visible={offerSheetOpen} onClose={() => setOfferSheetOpen(false)}>
        <Text style={styles.sheetTitle}>დაინტერესების გაგზავნა</Text>
        <Text style={styles.sheetSubtitle}>შეგიძლია მიუთითო შეთავაზებული ფასი (არასავალდებულო).</Text>
        <Text style={styles.offerLabel}>შეთავაზებული ფასი</Text>
        <View style={styles.offerInputWrap}>
          <TextInput
            value={offerPrice}
            onChangeText={(v) => setOfferPrice(v.replace(/[^0-9]/g, ''))}
            placeholder="ჩაწერეთ თანხა"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            style={styles.offerInput}
            autoFocus
          />
          <Text style={styles.offerSuffix}>₾</Text>
        </View>
        <Button label="დაინტერესების გაგზავნა" onPress={confirmInterest} />
        <Pressable style={styles.sheetCancelLink} onPress={() => setOfferSheetOpen(false)}>
          <Text style={styles.sheetCancelLinkText}>გაუქმება</Text>
        </Pressable>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingBottom: spacing.xxl,
  },
  selectedBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: colors.successBackground,
    padding: spacing.md,
  },
  bannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  selectedBannerTitle: {
    ...typography.captionMedium,
    color: '#065F46',
    fontWeight: '700',
  },
  selectedBannerText: {
    ...typography.small,
    color: colors.success,
  },
  headerCard: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    marginTop: spacing.sm + 2,
  },
  jobHeaderRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  jobTitle: {
    ...typography.h3,
    color: colors.foreground,
  },
  urgentBadge: {
    backgroundColor: colors.dangerBackground,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  urgentBadgeText: {
    ...typography.small,
    color: colors.destructive,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  statLabel: {
    ...typography.small,
    color: colors.primary,
    opacity: 0.7,
  },
  statValue: {
    ...typography.h3,
    color: colors.foreground,
  },
  section: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  sectionText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    ...typography.bodyMedium,
    color: colors.mutedForeground,
    fontWeight: '700',
  },
  customerName: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '600',
  },
  customerRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  customerRatingText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  chatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    minHeight: 52,
  },
  chatButtonText: {
    ...typography.bodyMedium,
    color: colors.foreground,
    fontWeight: '700',
  },
  interestButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    minHeight: 52,
  },
  interestButtonExpressed: {
    backgroundColor: colors.success,
  },
  interestButtonText: {
    ...typography.bodyMedium,
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  waitingText: {
    ...typography.small,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.sm + 2,
  },
  completedBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: colors.secondary,
    padding: spacing.md,
  },
  completedBannerTitle: {
    ...typography.captionMedium,
    color: colors.secondaryForeground,
    fontWeight: '700',
  },
  completedStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: spacing.xs + 2,
  },
  completedStarsLabel: {
    ...typography.small,
    color: colors.secondaryForeground,
    fontWeight: '700',
    marginLeft: spacing.xs + 2,
  },
  completedChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginBottom: spacing.xs + 2,
  },
  completedChip: {
    backgroundColor: '#BFDBFE',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  completedChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.secondaryForeground,
  },
  completedReviewText: {
    ...typography.small,
    color: colors.primary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  reviewsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    minHeight: 52,
  },
  reviewsButtonText: {
    ...typography.bodyMedium,
    color: colors.secondaryForeground,
    fontWeight: '700',
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  sheetSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  offerLabel: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  offerInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  offerInput: {
    ...typography.body,
    color: colors.foreground,
    flex: 1,
    paddingVertical: spacing.md,
  },
  offerSuffix: {
    ...typography.bodyMedium,
    color: colors.mutedForeground,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  sheetCancelLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  sheetCancelLinkText: {
    ...typography.captionMedium,
    color: colors.mutedForeground,
  },
});
