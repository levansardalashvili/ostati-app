import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  Award,
  Calendar,
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
import { SecureStorageImage } from '../components/SecureStorageImage';
import { colors, radius, spacing, typography } from '../theme';
import { Skeleton } from '../components/Skeleton';
import { authService } from '../services/authService';
import { chatService } from '../services/chatService';
import { jobService } from '../services/jobService';
import { quoteService } from '../services/quoteService';
import { reviewService } from '../services/reviewService';
import { useJobStatus } from '../state/JobStatusContext';
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
  // Feed-ის ბარათის "დაინტ. ვარ" ღილაკი (ProviderHomeScreen/
  // ProviderJobFeedScreen) აღარ ხსნის ფასის sheet-ს ბარათიდანვე პირდაპირ —
  // ნავიგირებს აქ, სრული აღწერის/ფოტოების ნახვის შემდეგ ფასის მოთხოვნისთვის
  // (task-ის მოთხოვნა: Provider-მა ფასი უნდა შესთავაზოს მხოლოდ job-ის
  // დეტალების ნახვის შემდეგ, არა ერთი შეხედვით feed-ის ბარათზე).
  const [offerSheetOpen, setOfferSheetOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const { getStatus, setStatus } = useJobStatus();

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
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  // Task — footer (ჩატი/"სამუშაო დავასრულე") ადრე ნულოვანი paddingBottom-ით
  // იჯდა ეკრანის ნამდვილ ქვედა კიდეზე (SafeAreaView-ს აქ `edges={['top']}`
  // აქვს, ბოლო არ ჯავშნავს) — Android-ის gesture-ნავიგაციის ზოლს
  // ხვდებოდა/თითქმის ხვდებოდა. ChatConversationScreen-ის კომპოზერის იგივე
  // პრინციპი — ოდნავ (ზუსტად safe-area inset-ის ოდენობით) მაღლა სწევს.
  const insets = useSafeAreaInsets();
  const footerBottomPadding = insets.bottom > 0 ? insets.bottom + spacing.xs : spacing.md;
  const markWorkDone = async () => {
    if (!job.customerJobId || markingWorkDone) return;
    setMarkingWorkDone(true);
    try {
      // #73: Customer-ის "სამუშაო დასრულდა?" შეტყობინება ახლა თავად RPC-ის
      // (provider_request_completion) მხრიდან იგზავნება, სერვერის მხარეს —
      // იხ. supabase/migrations/0022.
      await jobService.providerRequestCompletion(job.customerJobId);
      setStatus(job.customerJobId, 'awaiting_customer_confirmation');
    } catch (err) {
      // supabase/migrations/0041 — RPC-ის სპეციფიკური, greppable
      // შეცდომა ("SCHEDULED_TIME_NOT_REACHED"), authService.ts-ის
      // getAuthErrorMessage-ის იგივე პატერნით — ზუსტი ტექსტის ნაცვლად
      // მკაფიო, ცნობადი მარკერ-სტრიქონი.
      const message = (err as { message?: string } | null)?.message ?? '';
      if (message.includes('SCHEDULED_TIME_NOT_REACHED')) {
        Alert.alert('ჯერ ადრეა', 'სამუშაოს დასრულება ვერ მოინიშნება დაგეგმილ თარიღ/დრომდე ადრე.');
      } else {
        Alert.alert('ვერ მოხერხდა', 'სამუშაოს დასრულების მონიშვნა ვერ მოხერხდა — სცადე თავიდან.');
      }
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
      jobId: job.customerJobId,
      // Audit fix — `linkedStatus` (not the possibly-stale `job.status`)
      // so the chat's offer composer stays hidden once this job is no
      // longer 'pending' (Provider already selected, price locked).
      jobStatus: linkedStatus,
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
      // Audit fix (found via Maestro E2E testing) — `job` is local state,
      // fetched once at mount, before this cancellation happened. Without
      // this, `job.cancellationActor` below stays at whatever it was on
      // load (never 'provider'), so the banner always fell back to
      // "მომხმარებელმა... გააუქმა" even when the Provider is the one who
      // just cancelled it through this exact action.
      setJob((j) => ({ ...j, cancellationActor: 'provider' }));
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
      await quoteService.expressInterest(job.id, priceNum);
      setExpressed(true);
      setOfferSheetOpen(false);
      // Task — ინტერესის გამოხატვისას გაგზავნილი ფასი ახლა ავტომატურად
      // ჩატშიც ჩნდება, სტრუქტურირებული offer-ბარათის სახით (არა მხოლოდ
      // job_responses.offered_price-ში, ჩუმად) — Provider-ს აღარ სჭირდება
      // იგივე ფასის ხელახლა, ცალკე გაგზავნა ჩატის Wallet-ღილაკიდან.
      // Best-effort, fire-and-forget — ინტერესი უკვე წარმატებით
      // გამოხატულია (job_responses-ის row უკვე არსებობს, რაც messages-ის
      // INSERT policy-საც (0046) სჭირდება), ეს მხოლოდ ჩატს ამდიდრებს და
      // ამ ჩავარდნაზე მთავარი ნაკადი არ უნდა დაბლოკოს.
      if (job.customerId) {
        chatService.sendRealOffer(job.customerId, uid, uid, priceNum, undefined, job.id).catch(() => {});
      }
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
            <Pressable testID="job-detail-menu-button" style={styles.iconButton} onPress={handleMore}>
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
                {/* Task — "როდის სურს მომხმარებელს რომ მივიდე" (job.date,
                    Customer-ის PostJobScreen-ზე არჩეული სასურველი თარიღი/
                    დრო) ამ ეკრანზე საერთოდ არ ჩანდა — მხოლოდ `job.ago`
                    (განცხადების გამოქვეყნების, არა სამუშაოს, დროა) იყო.
                    CustomerJobDetailScreen-ს ეს უკვე ჰქონდა (იგივე
                    `job.date`, Clock-აიქონით) — Provider-ის მხარეს
                    დაემატა, `Calendar`-აიქონით (Clock-ს `job.ago`-სთვის
                    დარჩენილი, რომ ორივე ცალსახად გამოირჩეოდეს). */}
                <View style={styles.metaItem}>
                  <Calendar size={13} color={colors.mutedForeground} />
                  <Text style={styles.metaText}>{job.date}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Clock size={13} color={colors.mutedForeground} />
                  <Text style={styles.metaText}>{job.ago}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>სამუშაოს აღწერა</Text>
          <Text style={styles.sectionText}>{job.desc}</Text>
          {/* Task — Customer-ის ატვირთული ფოტოები (CustomerJobDetailScreen-ს
              ეს უკვე ჰქონდა, #63) Provider-ის მხარეს არასდროს არ ჩანდა —
              `FeedJob.photos` საერთოდ არ არსებობდა (მხოლოდ `hasPhoto`
              badge-ისთვის), მიუხედავად იმისა, რომ ბექენდის RPC-ები
              (`get_open_provider_feed`/`get_feed_job_by_id`) ისედაც
              აბრუნებდნენ `photos`-ს. */}
          {job.photos && job.photos.length > 0 && (
            <View style={styles.photoRow}>
              {job.photos.map((uri) => (
                // Task — თამბნეილი ადრე გადიდებას/გახსნას არ უჭერდა
                // მხარს — Provider-ს ფოტოს დეტალების უკეთ დანახვა არ
                // შეეძლო. ChatConversationScreen-ის იმავე
                // full-screen-preview პატერნით (Pressable + overlay).
                <Pressable key={uri} style={styles.photoThumb} onPress={() => setPhotoPreview(uri)}>
                  <SecureStorageImage reference={uri} style={styles.photoThumbImage} />
                </Pressable>
              ))}
            </View>
          )}
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

      {/* Task — footer ისევ pinned bottom bar-ია (ScrollView-ის მიღმა,
          content-ს არ მისდევს) — მომხმარებელმა დააზუსტა, რომ საწყისი
          "ძაან ქვემოთაა" საჩივარი ეხებოდა ეკრანის ნამდვილ ქვედა კიდესთან
          სიახლოვეს (Android-ის gesture-ნავიგაციის ზოლთან თითქმის
          გადაფარვას), არა კონტენტიდან მანძილს — footer კონტენტში
          გადატანა overshoot იყო. `paddingBottom` ახლა `insets.bottom`-ზეა
          დაფუძნებული (ChatConversationScreen-ის კომპოზერის იგივე
          პრინციპით) — ოდნავ მაღლა სწევს ღილაკებს ზუსტად imenad safe-area
          inset-ის ოდენობით, gesture-ზოლთან შეხების თავიდან ასაცილებლად. */}
      {variant === 'browse' && (
        <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
          {/* supabase/migrations/0046 — Provider→Customer chat now
              requires a real job_responses row (or assignment) server-side;
              the "any open pending job" exception is gone. Before
              expressing interest there is no such row yet, so the chat
              button would fail server-side — shown only once `expressed`
              is true, matching the new backend rule exactly. */}
          {expressed && (
            <Pressable style={styles.chatButton} onPress={handleChat}>
              <MessageCircle size={17} color={colors.foreground} />
              <Text style={styles.chatButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                ჩატი
              </Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.interestButton, expressed && styles.interestButtonExpressed]}
            onPress={() => !expressed && setOfferSheetOpen(true)}
          >
            {expressed ? (
              <CheckCircle size={17} color={colors.primaryForeground} />
            ) : (
              <ThumbsUp size={17} color={colors.primaryForeground} />
            )}
            <Text style={styles.interestButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {expressed ? (offerPrice ? `შეთავაზდა: ${offerPrice} ₾` : 'დაინტ. ხარ') : 'დაინტერესება'}
            </Text>
          </Pressable>
        </View>
      )}
      {variant === 'active' && (
        <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
          <Pressable style={styles.chatButton} onPress={handleChat}>
            <MessageCircle size={17} color={colors.foreground} />
            <Text style={styles.chatButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              ჩატი
            </Text>
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
              <Text style={styles.completeWorkButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {markingWorkDone ? 'იგზავნება...' : 'სამუშაო დავასრულე'}
              </Text>
            </Pressable>
          )}
        </View>
      )}
      {variant === 'awaiting_confirmation' && (
        <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.waitingText}>ელოდება მომხმარებლის დადასტურებას</Text>
            <Pressable style={[styles.chatButton, { alignSelf: 'stretch' }]} onPress={handleChat}>
              <MessageCircle size={17} color={colors.foreground} />
              <Text style={styles.chatButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                ჩატი
              </Text>
            </Pressable>
          </View>
        </View>
      )}
      {variant === 'disputed' && (
        <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.disputedFooterText}>მომხმარებელმა პრობლემა აღნიშნა — გაარკვიე დეტალები ჩატში.</Text>
            <Pressable style={[styles.chatButton, { alignSelf: 'stretch' }]} onPress={handleChat}>
              <MessageCircle size={17} color={colors.foreground} />
              <Text style={styles.chatButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                ჩატი
              </Text>
            </Pressable>
          </View>
        </View>
      )}
      {variant === 'completed' && (
        <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
          <Pressable style={styles.reviewsButton} onPress={() => navigation.navigate('ProviderReviews')}>
            <Award size={17} color={colors.primary} />
            <Text style={styles.reviewsButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              ჩემი შეფასებები
            </Text>
          </Pressable>
        </View>
      )}
      {variant === 'cancelled' && (
        <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
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
            testID="provider-cancel-menu-row"
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
        <Button
          testID="provider-cancel-submit"
          label="სამუშაოს გაუქმება"
          loadingLabel="უქმდება..."
          variant="destructive"
          onPress={confirmCancel}
          disabled={!canSubmitCancel}
          loading={cancelling}
        />
        <Pressable style={styles.sheetCancelLink} onPress={closeCancelSheet}>
          <Text style={styles.sheetCancelLinkText}>დახურვა</Text>
        </Pressable>
      </BottomSheet>

      {photoPreview && (
        <Pressable style={styles.previewOverlay} onPress={() => setPhotoPreview(null)}>
          <SecureStorageImage reference={photoPreview} style={styles.previewImage} resizeMode="cover" />
          <Pressable style={styles.previewClose} onPress={() => setPhotoPreview(null)}>
            <X size={18} color="#FFFFFF" />
          </Pressable>
        </Pressable>
      )}
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
    flexWrap: 'wrap',
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
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm + 2,
    marginTop: spacing.sm + 2,
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
  },
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '85%',
    maxWidth: 320,
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
  },
  previewClose: {
    position: 'absolute',
    top: 60,
    right: spacing.lg,
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
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
