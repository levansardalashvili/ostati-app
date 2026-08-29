import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle, Award, CheckCircle, Clock, MapPin, MessageCircle, MoreVertical, Star, ThumbsUp } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { CategoryIcon } from '../components/CategoryIcon';
import { colors, radius, spacing, typography } from '../theme';
import { Skeleton } from '../components/Skeleton';
import { authService } from '../services/authService';
import { jobService } from '../services/jobService';
import { notificationService } from '../services/notificationService';
import { quoteService } from '../services/quoteService';
import { reviewService } from '../services/reviewService';
import { isUuid } from '../utils/isUuid';
import { useJobStatus } from '../state/JobStatusContext';
import { useProviderProfile } from '../state/ProviderProfileContext';
import type { FeedJob } from '../types/job';
import type { RatingData } from '../types/review';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProviderJobDetail'>;

const EMPTY_JOB: FeedJob = {
  id: '',
  category: '',
  title: '',
  customer: '',
  location: '',
  date: '',
  ago: '',
  interested: 0,
  urgent: false,
  hasPhoto: false,
  desc: '',
};

// B2 — Job-ის დეტალი + ინტერესის დადასტურება (Provider მხრიდან)
// (product-spec.md; დიზაინის რეფერენსის ProviderJobDetail-ის browse/selected
// mode-ების მიხედვით). "selected" mode-ის შიგნით ორმხრივი დასრულების state
// machine მუშაობს (JobStatusContext.tsx) — Provider-ს პირდაპირ დასრულება არ
// შეუძლია, მხოლოდ "სამუშაო დავასრულე", რაც Customer-ის დადასტურებას ელოდება.
export function ProviderJobDetailScreen({ navigation, route }: Props) {
  const { id, mode = 'browse', job: passedJob } = route.params;
  const [job, setJob] = useState<FeedJob>(() => passedJob ?? EMPTY_JOB);
  const [jobLoading, setJobLoading] = useState(!passedJob);
  useEffect(() => {
    if (passedJob) {
      setJob(passedJob);
      setJobLoading(false);
      return;
    }
    let cancelled = false;
    setJobLoading(true);
    jobService.getFeedJobPostById(id).then((real) => {
      if (cancelled) return;
      if (real) setJob(real);
      setJobLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [passedJob, id]);

  const [expressed, setExpressed] = useState(false);
  const [offerSheetOpen, setOfferSheetOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const { getStatus, setStatus } = useJobStatus();
  const { profile: providerProfile } = useProviderProfile();

  // უკვე გაგზავნილი ინტერესის state-ის აღდგენა, თუ Provider ამ job-ის
  // დეტალზე ხელახლა შემოვიდა (Supabase-ის job_responses, #56).
  useEffect(() => {
    const uid = authService.getCurrentUser()?.uid;
    if (!uid || !job.id) return;
    let cancelled = false;
    quoteService.listMyResponseJobIds(uid).then((ids) => {
      if (!cancelled && ids.has(job.id)) setExpressed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  // "selected"/"completed" mode-ის რეალური ვარიანტი გაზიარებული სტატუსიდან
  // გამოითვლება, თუ job-ს Customer-ის მხარესთან ბმული აქვს (customerJobId) —
  // route-ის სტატიკური `mode` param მხოლოდ fallback-ია (ან საწყისი
  // navigation-ის მინიშნებაა). Provider-ს "დასრულებული" mode-ის პირდაპირ
  // დაყენება არასდროს არ შეუძლია — მხოლოდ სტატუსის ცვლილებით.
  const linkedStatus = job.customerJobId ? getStatus(job.customerJobId) : undefined;
  const variant: 'browse' | 'active' | 'awaiting_confirmation' | 'disputed' | 'completed' =
    linkedStatus === 'awaiting_customer_confirmation'
      ? 'awaiting_confirmation'
      : linkedStatus === 'disputed'
        ? 'disputed'
        : linkedStatus === 'completed'
          ? 'completed'
          : linkedStatus === 'active'
            ? 'active'
            : mode === 'completed'
              ? 'completed'
              : mode === 'selected'
                ? 'active'
                : 'browse';

  const markWorkDone = () => {
    if (!job.customerJobId) return;
    setStatus(job.customerJobId, 'awaiting_customer_confirmation');
    if (job.customerId && isUuid(job.customerId)) {
      notificationService
        .create(job.customerId, {
          title: 'სამუშაო დასრულდა?',
          body: job.title,
          iconEmoji: '⏰',
          iconBg: '#D97706',
          target: { screen: 'CustomerJobDetail', jobId: job.customerJobId },
        })
        .catch(() => {});
    }
  };

  const [receivedRating, setReceivedRating] = useState<RatingData | null>(null);
  useEffect(() => {
    if (variant !== 'completed' || !job.id) {
      setReceivedRating(null);
      return;
    }
    let cancelled = false;
    reviewService.getReviewByJobId(job.id).then((real) => {
      if (!cancelled) setReceivedRating(real);
    });
    return () => {
      cancelled = true;
    };
  }, [variant, job.id]);

  const handleChat = () => {
    if (!job.customerId) return;
    navigation.navigate('ChatConversation', {
      chatId: job.customerId,
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
    const uid = authService.getCurrentUser()?.uid;
    if (!uid) return;
    quoteService
      .expressInterest(
        job.id,
        {
          id: uid,
          name: `${providerProfile.firstName} ${providerProfile.lastName}`.trim(),
          initials: `${providerProfile.firstName.charAt(0)}${providerProfile.lastName.charAt(0)}`,
          color: colors.primary,
        },
        offerPrice || undefined,
        job.customerId,
      )
      .catch(() => {
        // ლოკალურ state-ში "დაინტერესებული ხარ" უკვე ასახულია — Supabase-ის
        // ჩავარდნისას UI-ს არ ვბლოკავთ (CustomerEditProfileScreen-ის (#51)
        // იგივე optimistic-update პრინციპით).
      });
  };

  if (jobLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <BackHeader title="განცხადება" onBack={() => navigation.goBack()} />
        <View style={styles.bodyContent}>
          <Skeleton width="100%" height={140} borderRadius={radius.lg} />
        </View>
      </SafeAreaView>
    );
  }

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
        {variant === 'active' && (
          <View style={styles.selectedBanner}>
            <View style={styles.bannerHeaderRow}>
              <CheckCircle size={16} color={colors.success} />
              <Text style={styles.selectedBannerTitle}>შენ აგირჩიეს ამ სამუშაოსთვის</Text>
            </View>
            <Text style={styles.selectedBannerText}>
              დაასრულე სამუშაო და დააჭირე „სამუშაო დავასრულე" — მომხმარებელი დაადასტურებს დასრულებას.
            </Text>
          </View>
        )}

        {variant === 'awaiting_confirmation' && (
          <View style={styles.selectedBanner}>
            <View style={styles.bannerHeaderRow}>
              <Clock size={16} color={colors.success} />
              <Text style={styles.selectedBannerTitle}>სამუშაო დასრულებულად მონიშნე</Text>
            </View>
            <Text style={styles.selectedBannerText}>
              ელოდება მომხმარებლის დადასტურებას სამუშაოს დასრულების შესახებ.
            </Text>
          </View>
        )}

        {variant === 'disputed' && (
          <View style={styles.disputedBanner}>
            <View style={styles.bannerHeaderRow}>
              <AlertTriangle size={16} color={colors.destructive} />
              <Text style={styles.disputedBannerTitle}>მომხმარებელმა პრობლემა აღნიშნა</Text>
            </View>
            <Text style={styles.disputedBannerText}>დაუკავშირდი მომხმარებელს ჩატში პრობლემის გასარკვევად.</Text>
          </View>
        )}

        {variant === 'completed' && (
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
            </View>
          </View>
        </View>
      </ScrollView>

      {variant === 'browse' && (
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
      {variant === 'active' && (
        <View style={styles.footer}>
          <Pressable style={styles.chatButton} onPress={handleChat}>
            <MessageCircle size={17} color={colors.foreground} />
            <Text style={styles.chatButtonText}>ჩატი</Text>
          </Pressable>
          {/* Provider-ს პირდაპირ დასრულების უფლება არა აქვს — ეს ღილაკი
              მხოლოდ "awaiting_customer_confirmation"-ზე გადადის, Customer-ის
              დადასტურებამდე job "completed" ვერასდროს გახდება. ღილაკი მხოლოდ
              მაშინ ჩანს, როცა ამ job-ს Customer-ის მხარესთან რეალური ბმული
              აქვს (customerJobId) — წინააღმდეგ შემთხვევაში დასაჭერი არაფერია. */}
          {job.customerJobId && (
            <Pressable style={styles.completeWorkButton} onPress={markWorkDone}>
              <CheckCircle size={17} color={colors.primaryForeground} />
              <Text style={styles.completeWorkButtonText}>სამუშაო დავასრულე</Text>
            </Pressable>
          )}
        </View>
      )}
      {variant === 'awaiting_confirmation' && (
        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            <Text style={styles.waitingText}>ელოდება მომხმარებლის დადასტურებას</Text>
            <Pressable style={[styles.chatButton, { alignSelf: 'stretch' }]} onPress={handleChat}>
              <MessageCircle size={17} color={colors.foreground} />
              <Text style={styles.chatButtonText}>ჩატი</Text>
            </Pressable>
          </View>
        </View>
      )}
      {variant === 'disputed' && (
        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            <Text style={styles.disputedFooterText}>მომხმარებელმა პრობლემა აღნიშნა — გაარკვიე დეტალები ჩატში.</Text>
            <Pressable style={[styles.chatButton, { alignSelf: 'stretch' }]} onPress={handleChat}>
              <MessageCircle size={17} color={colors.foreground} />
              <Text style={styles.chatButtonText}>ჩატი</Text>
            </Pressable>
          </View>
        </View>
      )}
      {variant === 'completed' && (
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
  disputedBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: colors.dangerBackground,
    padding: spacing.md,
  },
  disputedBannerTitle: {
    ...typography.captionMedium,
    color: colors.destructive,
    fontWeight: '700',
  },
  disputedBannerText: {
    ...typography.small,
    color: colors.destructive,
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
  completeWorkButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.success,
    borderRadius: radius.md,
    minHeight: 52,
  },
  completeWorkButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  waitingText: {
    ...typography.small,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.sm + 2,
  },
  disputedFooterText: {
    ...typography.small,
    color: colors.destructive,
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
