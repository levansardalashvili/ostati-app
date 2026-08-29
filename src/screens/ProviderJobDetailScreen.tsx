import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  Award,
  CheckCircle,
  Clock,
  Flag,
  MapPin,
  MessageCircle,
  MoreVertical,
  Star,
  ThumbsUp,
  X,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BackHeader } from '../components/BackHeader';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { CategoryIcon } from '../components/CategoryIcon';
import { OfferPriceSheet } from '../components/OfferPriceSheet';
import { ReportJobSheet } from '../components/ReportJobSheet';
import { colors, radius, spacing, typography } from '../theme';
import { Skeleton } from '../components/Skeleton';
import { authService } from '../services/authService';
import { jobService } from '../services/jobService';
import { quoteService } from '../services/quoteService';
import { reviewService } from '../services/reviewService';
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

// Provider-ის job-გაუქმების ფიქსირებული მიზეზები (task-ის მოთხოვნა,
// supabase/migrations/0036-ის `job_posts_cancellation_reason_code_check`-ის
// ზუსტი ანარეკლი) — structured code + ცალკე ქართული ლეიბლი, არა
// მხოლოდ ტექსტი (მომავალი moderation-ისთვის).
const PROVIDER_CANCEL_REASONS: { code: string; label: string }[] = [
  { code: 'provider_unavailable', label: 'აღარ ვარ ხელმისაწვდომი' },
  { code: 'schedule_conflict', label: 'დროის კონფლიქტი' },
  { code: 'cannot_complete_job', label: 'სამუშაოს შესრულებას ვერ შევძლებ' },
  { code: 'customer_unreachable', label: 'მომხმარებელს ვერ ვუკავშირდები' },
  { code: 'incorrect_job_information', label: 'სამუშაოს ინფორმაცია არასწორია' },
  { code: 'other', label: 'სხვა' },
];

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
    jobService
      .getFeedJobPostById(id)
      .then((real) => {
        if (!cancelled && real) setJob(real);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setJobLoading(false);
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
    quoteService
      .listMyResponseJobIds(uid)
      .then((ids) => {
        if (!cancelled && ids.has(job.id)) setExpressed(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  // "selected"/"completed" mode-ის რეალური ვარიანტი გაზიარებული სტატუსიდან
  // გამოითვლება, თუ job-ს Customer-ის მხარესთან ბმული აქვს (customerJobId) —
  // route-ის სტატიკური `mode` param მხოლოდ fallback-ია (ან საწყისი
  // navigation-ის მინიშნებაა). Provider-ს "დასრულებული" mode-ის პირდაპირ
  // დაყენება არასდროს არ შეუძლია — მხოლოდ სტატუსის ცვლილებით.
  // #82: `getStatus(...)` მხოლოდ ლოკალური, ამ მოწყობილობის JobStatusContext
  // ქეშია — Provider-ის საკუთარ device-ს არასდროს არ "შეუტყვია" job-ის
  // გაუქმებაზე ლოკალურად (მხოლოდ Customer-ის device-ზე გამოიძახა
  // setStatus(...,'cancelled')), ამიტომ `?? job.status` fallback აუცილებელია —
  // `job.status` კი ყოველთვის ახლახან წამოღებული, რეალური მნიშვნელობაა
  // (`getFeedJobPostById`/`listMyAssignedJobs`-იდან), რომ Provider-მა
  // "cancelled" job-ს ჯერ კიდევ "active"-ად ვერასდროს დაინახოს.
  const linkedStatus = (job.customerJobId ? getStatus(job.customerJobId) : undefined) ?? job.status;
  const variant: 'browse' | 'active' | 'awaiting_confirmation' | 'disputed' | 'completed' | 'cancelled' =
    linkedStatus === 'cancelled'
      ? 'cancelled'
      : linkedStatus === 'awaiting_customer_confirmation'
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

  const [markingWorkDone, setMarkingWorkDone] = useState(false);
  const markWorkDone = async () => {
    if (!job.customerJobId || markingWorkDone) return;
    setMarkingWorkDone(true);
    try {
      // #73: Customer-ის "სამუშაო დასრულდა?" შეტყობინება ახლა თავად RPC-ის
      // (provider_request_completion) მხრიდან იგზავნება, სერვერის მხარეს —
      // იხ. supabase/migrations/0022.
      await jobService.providerRequestCompletion(job.customerJobId);
      setStatus(job.customerJobId, 'awaiting_customer_confirmation');
    } catch {
      Alert.alert('ვერ მოხერხდა', 'სამუშაოს დასრულების მონიშვნა ვერ მოხერხდა — სცადე თავიდან.');
    } finally {
      setMarkingWorkDone(false);
    }
  };

  const [receivedRating, setReceivedRating] = useState<RatingData | null>(null);
  useEffect(() => {
    if (variant !== 'completed' || !job.id) {
      setReceivedRating(null);
      return;
    }
    let cancelled = false;
    reviewService
      .getReviewByJobId(job.id)
      .then((real) => {
        if (!cancelled) setReceivedRating(real);
      })
      .catch(() => {});
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
  // #84-ის დროს "..." ღილაკს მხოლოდ ერთი მოქმედება (ზოგადი
  // moderation-რეპორტი) ჰქონდა, ამიტომ პირდაპირ ხსნიდა ReportJobSheet-ს.
  // ახლა job-ის გაუქმებაც ემატება (Task — Provider-initiated cancellation)
  // — ორი მოქმედება ერთ ღილაკზე უკვე მართლაც menu-ს საჭიროებს, ზუსტად
  // CustomerJobDetailScreen-ის იგივე "..." menu-ს პატერნით.
  // completion-dispute flow ("პრობლემა მაქვს", markWorkDone-ის მეზობელი)
  // ამ menu-ს არაფერში ეხება, სრულიად ცალკეა.
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const handleMore = () => {
    setActionMenuOpen(true);
  };

  // Provider-initiated job cancellation — supabase/migrations/0036-ის
  // `provider_cancel_job` RPC. მხოლოდ `variant === 'active'`-ზეა
  // ხელმისაწვდომი (task: "Do not show the action for jobs where
  // Provider is only interested but not selected") — menu-ს JSX-შივეა
  // დაცული, ცალკე დამატებითი შემოწმება აქ არ სჭირდება.
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
  const [cancelReasonCode, setCancelReasonCode] = useState<string | null>(null);
  const [cancelDetails, setCancelDetails] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const canSubmitCancel = !!cancelReasonCode && (cancelReasonCode !== 'other' || cancelDetails.trim().length > 0);
  const closeCancelSheet = () => {
    if (cancelling) return;
    setCancelSheetOpen(false);
    setCancelReasonCode(null);
    setCancelDetails('');
  };
  const confirmCancel = async () => {
    if (!job.customerJobId || !canSubmitCancel || cancelling) return;
    setCancelling(true);
    try {
      await jobService.providerCancelJob(job.customerJobId, cancelReasonCode!, cancelDetails.trim() || undefined);
      setStatus(job.customerJobId, 'cancelled');
      setCancelSheetOpen(false);
      setCancelReasonCode(null);
      setCancelDetails('');
    } catch {
      Alert.alert('ვერ მოხერხდა', 'სამუშაოს გაუქმება ვერ მოხერხდა — სცადე თავიდან.');
    } finally {
      setCancelling(false);
    }
  };
  // #72: ფასი სავალდებულო, კონკრეტული რიცხვია — "დაინტ. ვარ" აღარ
  // იგზავნება ფასის გარეშე.
  const [sendingInterest, setSendingInterest] = useState(false);
  const confirmInterest = async () => {
    const priceNum = Number(offerPrice);
    if (!offerPrice || priceNum <= 0 || sendingInterest) return;
    const uid = authService.getCurrentUser()?.uid;
    if (!uid) return;
    setSendingInterest(true);
    try {
      await quoteService.expressInterest(
        job.id,
        {
          id: uid,
          name: `${providerProfile.firstName} ${providerProfile.lastName}`.trim(),
          initials: `${providerProfile.firstName.charAt(0)}${providerProfile.lastName.charAt(0)}`,
          color: colors.primary,
        },
        priceNum,
      );
      setExpressed(true);
      setOfferSheetOpen(false);
    } catch {
      Alert.alert('ვერ მოხერხდა', 'ინტერესის გაგზავნა ვერ მოხერხდა — სცადე თავიდან.');
    } finally {
      setSendingInterest(false);
    }
  };

  // ერთი მუდმივი JSX ხე jobLoading→loaded გადასვლისას (Fabric-ის "child
  // already has a parent" crash-ის თავიდან ასაცილებლად — CustomerJobDetailScreen-ის
  // იგივე პრინციპი).
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader
        title="განცხადება"
        onBack={() => navigation.goBack()}
        right={
          jobLoading ? undefined : (
            <Pressable style={styles.iconButton} onPress={handleMore}>
              <MoreVertical size={16} color={colors.foreground} />
            </Pressable>
          )
        }
      />

      {jobLoading ? (
        <View style={styles.bodyContent}>
          <Skeleton width="100%" height={140} borderRadius={radius.lg} />
        </View>
      ) : (
      <>
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

        {variant === 'cancelled' && (
          <View style={styles.disputedBanner}>
            <View style={styles.bannerHeaderRow}>
              <AlertTriangle size={16} color={colors.destructive} />
              <Text style={styles.disputedBannerTitle}>მოთხოვნა გაუქმებულია</Text>
            </View>
            {/* supabase/migrations/0036: `cancellationActor` სერვერზეა
                derived (RPC-ის შიგნით), არასდროს client-ის claim — ტექსტი
                სწორად განასხვავებს, თავად Provider-მა გააუქმა თუ Customer-მა. */}
            <Text style={styles.disputedBannerText}>
              {job.cancellationActor === 'provider' ? 'შენ გააუქმე ეს სამუშაო.' : 'მომხმარებელმა ეს მოთხოვნა გააუქმა.'}
            </Text>
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
            <Pressable
              style={[styles.completeWorkButton, markingWorkDone && styles.completeWorkButtonDisabled]}
              onPress={markWorkDone}
              disabled={markingWorkDone}
            >
              <CheckCircle size={17} color={colors.primaryForeground} />
              <Text style={styles.completeWorkButtonText}>
                {markingWorkDone ? 'იგზავნება...' : 'სამუშაო დავასრულე'}
              </Text>
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
      {variant === 'cancelled' && (
        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            <Text style={styles.disputedFooterText}>
              {job.cancellationActor === 'provider' ? 'შენ გააუქმე ეს სამუშაო.' : 'მომხმარებელმა მოთხოვნა გააუქმა.'}
            </Text>
          </View>
        </View>
      )}
      </>
      )}

      <OfferPriceSheet
        visible={offerSheetOpen}
        price={offerPrice}
        onChangePrice={setOfferPrice}
        onSubmit={confirmInterest}
        onClose={() => setOfferSheetOpen(false)}
        submitting={sendingInterest}
      />

      <ReportJobSheet
        visible={reportSheetOpen}
        jobId={job.id}
        role="provider"
        onClose={() => setReportSheetOpen(false)}
      />

      <BottomSheet visible={actionMenuOpen} onClose={() => setActionMenuOpen(false)}>
        <Pressable
          style={styles.menuRow}
          onPress={() => {
            setActionMenuOpen(false);
            setReportSheetOpen(true);
          }}
        >
          <Flag size={15} color={colors.mutedForeground} />
          <Text style={styles.menuRowText}>პრობლემის შეტყობინება</Text>
        </Pressable>
        {variant === 'active' && (
          <Pressable
            style={styles.menuRow}
            onPress={() => {
              setActionMenuOpen(false);
              setCancelSheetOpen(true);
            }}
          >
            <X size={15} color={colors.destructive} />
            <Text style={[styles.menuRowText, { color: colors.destructive }]}>სამუშაოს გაუქმება</Text>
          </Pressable>
        )}
      </BottomSheet>

      <BottomSheet visible={cancelSheetOpen} onClose={closeCancelSheet}>
        <View style={styles.cancelIcon}>
          <X size={22} color={colors.destructive} />
        </View>
        <Text style={styles.sheetTitle}>სამუშაოს გაუქმება</Text>
        <Text style={styles.sheetSubtitle}>მომხმარებელს ეცნობება გაუქმების შესახებ. აირჩიე მიზეზი.</Text>
        {PROVIDER_CANCEL_REASONS.map((opt) => {
          const on = cancelReasonCode === opt.code;
          return (
            <Pressable
              key={opt.code}
              style={[styles.problemOption, on && styles.problemOptionOn]}
              onPress={() => setCancelReasonCode(opt.code)}
            >
              <View style={[styles.radioOuter, on && styles.radioOuterOn]}>{on && <View style={styles.radioInner} />}</View>
              <Text style={[styles.problemOptionText, on && styles.problemOptionTextOn]}>{opt.label}</Text>
            </Pressable>
          );
        })}
        {cancelReasonCode === 'other' && (
          <TextInput
            value={cancelDetails}
            onChangeText={setCancelDetails}
            placeholder="აღწერე მიზეზი..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            style={styles.problemTextarea}
          />
        )}
        <Button label="სამუშაოს გაუქმება" loadingLabel="უქმდება..." variant="destructive" onPress={confirmCancel} disabled={!canSubmitCancel} loading={cancelling} />
        <Pressable style={styles.sheetCancelLink} onPress={closeCancelSheet}>
          <Text style={styles.sheetCancelLinkText}>დახურვა</Text>
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
  completeWorkButtonDisabled: {
    opacity: 0.6,
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
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  menuRowText: {
    ...typography.captionMedium,
    color: colors.foreground,
  },
  cancelIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.dangerBackground,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.sm + 2,
  },
  problemOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 6,
    marginBottom: spacing.sm,
  },
  problemOptionOn: {
    borderColor: colors.primary,
    backgroundColor: colors.secondary,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterOn: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  problemOptionText: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '500',
  },
  problemOptionTextOn: {
    color: colors.secondaryForeground,
  },
  problemTextarea: {
    ...typography.caption,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 6,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: spacing.sm,
  },
});
