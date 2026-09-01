import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Briefcase,
  Check,
  Clock,
  Flag,
  MapPin,
  MessageCircle,
  MoreVertical,
  Pencil,
  Star,
  X,
  Image as ImageIcon,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { BackHeader } from '../components/BackHeader';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { CategoryIcon } from '../components/CategoryIcon';
import { ReportJobSheet } from '../components/ReportJobSheet';
import { SecureStorageImage } from '../components/SecureStorageImage';
import { Skeleton } from '../components/Skeleton';
import { StatusPill, type JobStatus } from '../components/StatusPill';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { colors, radius, spacing, typography } from '../theme';
import { SPECIALTY_LABEL } from '../data/categories';
import { authService } from '../services/authService';
import { jobService } from '../services/jobService';
import { quoteService } from '../services/quoteService';
import { reviewService } from '../services/reviewService';
import { useCustomerProfile } from '../state/CustomerProfileContext';
import { useJobStatus } from '../state/JobStatusContext';
import type { CustomerJob } from '../types/job';
import type { Provider } from '../types/provider';
import type { JobQuote } from '../types/quote';
import type { RatingData } from '../types/review';
import { isNewProvider, weightedRating } from '../utils/providerRank';
import { isUuid } from '../utils/isUuid';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerJobDetail'>;

const PROBLEM_OPTIONS = ['ოსტატი ჯერ არ მოსულა', 'სამუშაო ჯერ არ დასრულებულა', 'სამუშაოს ხარისხი დაბალია', 'სხვა'];

// route-ს job param-ის არარსებობისას (ჩატის/Home-ის/notification-ის
// deep-link, სადაც მხოლოდ jobId ცნობილია) — placeholder, სანამ რეალური
// fetch (jobService.getJobPostById) არ დასრულდება. ცარიელი id (`''`) არასდროს
// ემთხვევა რეალურ job-ს, ამიტომ ქვემოთ hook-ების `[job.id]`-ზე დამოკიდებული
// fetch-ები უსაფრთხოდ no-op-ობენ, სანამ ნამდვილი job არ ჩაიტვირთება.
const EMPTY_JOB: CustomerJob = {
  id: '',
  title: '',
  category: '',
  status: 'pending',
  provider: null,
  date: '',
  address: '',
  desc: '',
  photos: [],
};

// C3 — Job-ის დეტალი + დაინტერესებული ოსტატების სია, და C4 — ოსტატის
// არჩევის დადასტურება (product-spec.md; დიზაინის რეფერენსში ეს ორივე ერთი
// და იმავე CustomerJobDetail კომპონენტის ორი მდგომარეობაა — ჩვენც ასე
// ავაშენეთ). სამუშაოს დასრულების დადასტურება/შეფასების ნაკადი (product-spec.md
// პუნქტი #14) — ზუსტად ზიპის App.tsx-ის CustomerJobDetail-ის მიხედვით.
export function CustomerJobDetailScreen({ navigation, route }: Props) {
  const [job, setJob] = useState<CustomerJob>(() => route.params.job ?? EMPTY_JOB);
  const [jobLoading, setJobLoading] = useState(!route.params.job);
  useEffect(() => {
    if (route.params.job) {
      setJob(route.params.job);
      setJobLoading(false);
      return;
    }
    let cancelled = false;
    setJobLoading(true);
    jobService
      .getJobPostById(route.params.jobId)
      .then((real) => {
        if (!cancelled && real) setJob(real);
      })
      .catch(() => {
        // ჩავარდნისას EMPTY_JOB-ზე ვრჩებით — loading მაინც უნდა მოიხსნას,
        // რომ ეკრანი დაკიდებული არ დარჩეს.
      })
      .finally(() => {
        if (!cancelled) setJobLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [route.params.job, route.params.jobId]);

  const [interestedList, setInterestedList] = useState<JobQuote[]>([]);
  useEffect(() => {
    if (!job.id) return;
    let cancelled = false;
    quoteService
      .listResponsesForJob(job.id)
      .then((real) => {
        if (!cancelled) setInterestedList(real);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [job.id]);
  const { getStatus, setStatus } = useJobStatus();
  const { profile: customerProfile } = useCustomerProfile();

  const [menuOpen, setMenuOpen] = useState(false);
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  // #84 — ზოგადი moderation-რეპორტი (job_reports/create_job_report),
  // completion-dispute-ის ("პრობლემა მაქვს") მთლიანად ცალკე, დამოუკიდებელი
  // მოქმედება — იხ. src/components/ReportJobSheet.tsx-ის თავსართის შენიშვნა.
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [confirmProvider, setConfirmProvider] = useState<Provider | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(
    () => interestedList.find((entry) => entry.provider.name === job.provider)?.provider ?? null,
  );
  const [sortBy, setSortBy] = useState<'price' | 'rating' | 'experience' | null>(null);

  // #72: Provider ყოველთვის კონკრეტულ რიცხვს წარადგენს — "ფასი სამუშაოს
  // ნახვის შემდეგ განისაზღვრება"/inspection-ფასის ცნება აღარ არსებობს.
  // `offeredPrice === undefined` მხოლოდ migration-მდელ ისტორიულ
  // response-ებზეა შესაძლებელი (0012-ის backfill-შენიშვნა).
  const priceValue = (entry: (typeof interestedList)[number]) =>
    entry.offeredPrice ?? Number.POSITIVE_INFINITY;
  const priceLabel = (entry: (typeof interestedList)[number]) =>
    entry.offeredPrice !== undefined ? `შეთავაზებული ფასი: ${entry.offeredPrice} ₾` : 'ფასი არ არის მითითებული';
  const sortedInterestedList = useMemo(() => {
    if (!sortBy) return interestedList;
    const copy = [...interestedList];
    if (sortBy === 'price') copy.sort((a, b) => priceValue(a) - priceValue(b));
    // წონიანი რეიტინგი (src/utils/providerRank.ts) — არა უბრალო `rating`,
    // რომ ერთმა 5-ვარსკვლავიანმა შეფასებამ ვერ გადააჭარბოს ასობით კარგ
    // შეფასებას მანიპულაციით.
    if (sortBy === 'rating') copy.sort((a, b) => weightedRating(b.provider) - weightedRating(a.provider));
    if (sortBy === 'experience') copy.sort((a, b) => b.provider.years - a.provider.years);
    return copy;
  }, [interestedList, sortBy]);

  // Provider-ის არჩევის შემდეგ job სხვა ოსტატებისთვის იხურება — მხოლოდ
  // არჩეული ოსტატი ჩანს, როგორც აქტიური კანდიდატი (მომხმარებლის მოთხოვნით).
  const visibleInterestedList = selectedProvider
    ? sortedInterestedList.filter((entry) => entry.provider.id === selectedProvider.id)
    : sortedInterestedList;

  // დასრულების/პრობლემის/შეფასების ნაკადი — ორმხრივი state machine
  // (JobStatusContext.tsx, StatusPill.tsx) — Customer-ს პირდაპირ "დასრულების"
  // შესაძლებლობა აღარ აქვს, მხოლოდ Provider-ის "სამუშაო დავასრულე"-ს შემდეგ
  // ხედავს დადასტურების ბარათს (მომხმარებლის მოთხოვნით).
  const [problemSheetOpen, setProblemSheetOpen] = useState(false);
  const [problemOption, setProblemOption] = useState<string | null>(null);
  const [problemOther, setProblemOther] = useState('');
  const [ratingData, setRatingData] = useState<RatingData | null>(null);
  useEffect(() => {
    if (!job.id) return;
    let cancelled = false;
    reviewService
      .getReviewByJobId(job.id)
      .then((real) => {
        if (!cancelled && real) setRatingData(real);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  const sharedStatus = getStatus(job.id) ?? job.status;
  // #79: "cancelled" ცალკე ლოკალურ boolean-ად აღარ ინახება — cancelJob()
  // RPC-ის წარმატებაზე `setStatus(job.id,'cancelled')`-ს ვიძახებთ, იმავე
  // გაზიარებულ JobStatusContext-ში, რასაც confirmSelection/confirmCompletion/
  // submitProblem-იც იყენებენ — `sharedStatus` თავად უკვე ასახავს.
  const effectiveStatus: JobStatus = sharedStatus;
  const showCompletionConfirmCard = effectiveStatus === 'awaiting_customer_confirmation';

  const progressSteps = [
    { label: 'მოთხოვნა გამოქვეყნდა', done: true },
    { label: 'ოსტატი შეირჩა', done: !!selectedProvider },
    { label: 'სამუშაო დასრულდა', done: effectiveStatus === 'completed' },
  ];

  const handleEdit = () => {
    // TODO: სამუშაოს რედაქტირების ეკრანი ჯერ არ არსებობს
    setMenuOpen(false);
  };
  const handleOpenChat = (provider: Provider) => {
    navigation.navigate('ChatConversation', {
      chatId: provider.id,
      name: provider.name,
      initials: provider.initials,
      color: provider.color,
      role: 'customer',
    });
  };
  const handleOpenProfile = (provider: Provider) => {
    navigation.navigate('ViewProviderProfile', { id: provider.id });
  };
  // #72: კრიტიკული გადასვლები (Provider-ის არჩევა/დასრულების
  // დადასტურება/პრობლემის შეტყობინება) აღარ არის "ჯერ ლოკალურად, მერე
  // ფონურად Supabase-ში" — ჯერ RPC-ს ვიძახებთ და ველოდებით (`await`),
  // მხოლოდ წარმატებაზე ვცვლით ლოკალურ state-ს/ვნავიგირებთ. RPC-ის
  // ჩავარდნისას (მაგ. Provider-მა უკვე გამოითხოვა თანხმობა, ან job-ის
  // სტატუსი შუალედში შეიცვალა) მომხმარებელს პირდაპირ ვატყობინებთ, ლოკალურ
  // state-ს არასწორად აღარ "ვაჩვენებთ" წარმატებულად.
  const [selecting, setSelecting] = useState(false);
  const confirmSelection = async () => {
    if (!confirmProvider || selecting) return;
    setSelecting(true);
    try {
      await jobService.selectProvider(job.id, confirmProvider.id);
      setSelectedProvider(confirmProvider);
      setStatus(job.id, 'active');
      setJob((prev) => ({ ...prev, status: 'active', provider: confirmProvider.name, providerId: confirmProvider.id }));
      setConfirmProvider(null);
      // #73: "შენ აგირჩიეს სამუშაოსთვის" ახლა select_provider RPC-ის მხრიდან
      // იგზავნება, სერვერის მხარეს — იხ. supabase/migrations/0022.
    } catch {
      Alert.alert('ვერ მოხერხდა', 'ოსტატის არჩევა ვერ დასრულდა — სცადე თავიდან.');
    } finally {
      setSelecting(false);
    }
  };
  // #82: "active" job-ს (Provider უკვე მინიჭებული) გაუქმებისას მიზეზი
  // ახლა UI-დანაც შეგროვდება (#79-ის RPC-ს ეს ველი ისედაც შეეძლო მიეღო,
  // მხოლოდ sheet-ს არ ჰქონდა ველი) — "pending" job-ზე (Provider ჯერ არ
  // მინიჭებულა) კვლავ არ მოითხოვება, ზუსტად #79-ის "pending job may be
  // cancelled" / "active job may be cancelled with a reason" წესის მიხედვით.
  const cancelRequiresReason = effectiveStatus === 'active';
  const confirmCancel = async () => {
    if (cancelling || (cancelRequiresReason && !cancelReason.trim())) return;
    setCancelling(true);
    try {
      await jobService.cancelJob(job.id, cancelReason.trim() || undefined);
      setStatus(job.id, 'cancelled');
      setCancelSheetOpen(false);
      setCancelReason('');
    } catch {
      Alert.alert('ვერ მოხერხდა', 'მოთხოვნის გაუქმება ვერ მოხერხდა — სცადე თავიდან.');
    } finally {
      setCancelling(false);
    }
  };
  // Customer-ის "დადასტურება" — Provider-ის დასრულების მოთხოვნას ეთანხმება
  // (customer_confirm_completion() RPC, awaiting_customer_confirmation →
  // confirmed_awaiting_rating) და მხოლოდ წარმატებაზე გადადის სავალდებულო
  // შეფასებაზე. Job "completed" ხდება მხოლოდ მას შემდეგ, რაც
  // ვარსკვლავიანი შეფასება რეალურად გაიგზავნება და reviews-ის INSERT
  // trigger-ი (Supabase-ის მხარეს) status-ს "completed"-ზე გადაიყვანს —
  // არც ეს ღილაკი და არც RatingScreen-ის onRate აღარ აყენებენ
  // "completed"-ს პირდაპირ, კლიენტიდან.
  const [confirming, setConfirming] = useState(false);
  const confirmCompletion = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      await jobService.customerConfirmCompletion(job.id);
      setStatus(job.id, 'confirmed_awaiting_rating');
      openRating();
    } catch {
      Alert.alert('ვერ მოხერხდა', 'დასრულების დადასტურება ვერ მოხერხდა — სცადე თავიდან.');
    } finally {
      setConfirming(false);
    }
  };
  const openRating = () => {
    navigation.navigate('RatingScreen', {
      jobId: job.id,
      providerName: selectedProvider?.name ?? 'გიორგი ბერიძე',
      providerInitials: selectedProvider?.initials ?? 'გბ',
      providerColor: selectedProvider?.color ?? colors.primary,
      onRate: async (data) => {
        const uid = authService.getCurrentUser()?.uid;
        if (!uid || !selectedProvider || !isUuid(selectedProvider.id) || !isUuid(job.id)) return;
        try {
          // reviews-ის INSERT-ს job_posts.status-ს "completed"-ზე გადაჰყავს
          // (0015_review_completion_trigger.sql) — ეს ერთადერთი გზაა
          // completed-მდე მისასვლელად, ამიტომ ლოკალურ state-საც მხოლოდ
          // ამ insert-ის წარმატების შემდეგ ვცვლით.
          await reviewService.submitReview(
            job.id,
            uid,
            selectedProvider.id,
            `${customerProfile.firstName} ${customerProfile.lastName}`.trim(),
            data,
          );
          setRatingData(data);
          setStatus(job.id, 'completed');
          // #73: "სამუშაო დასრულებულად დადასტურდა" ახლა reviews-ის INSERT
          // trigger-ის (handle_review_completion) მხრიდან იგზავნება, იმავე
          // transaction-ში, სადაც status "completed"-ზე გადადის — იხ.
          // supabase/migrations/0023.
        } catch {
          // RatingScreen უკვე "submitted" ეკრანზეა გადასული (optimistic,
          // RatingScreen.tsx-ის საკუთარი ქცევა) — job-ის დეტალის ეკრანზე
          // დაბრუნებისას ratingData/effectiveStatus კვლავ "ელოდება
          // შეფასებას"-ს აჩვენებს, არასწორად "დასრულებულს" არ ვცვლით.
        }
      },
    });
  };
  const [reportingProblem, setReportingProblem] = useState(false);
  const submitProblem = async () => {
    if (!problemOption || (problemOption === 'სხვა' && !problemOther.trim()) || reportingProblem) return;
    const reason = problemOption === 'სხვა' ? problemOther.trim() : problemOption;
    setReportingProblem(true);
    try {
      await jobService.customerReportProblem(job.id, reason);
      setProblemSheetOpen(false);
      setStatus(job.id, 'disputed');
      // #73: "მომხმარებელმა პრობლემა აღნიშნა" ახლა customer_report_problem
      // RPC-ის მხრიდან იგზავნება, სერვერის მხარეს — იხ. supabase/migrations/0022.
    } catch {
      Alert.alert('ვერ მოხერხდა', 'პრობლემის შეტყობინება ვერ გაიგზავნა — სცადე თავიდან.');
    } finally {
      setReportingProblem(false);
    }
  };

  // ერთი მუდმივი JSX ხე jobLoading→loaded გადასვლისას (არა ორი ცალკე
  // `return` სხვადასხვა SafeAreaView-ით) — Fabric-ის ("addViewAt: failed
  // to insert view" / "child already has a parent") crash-ის თავიდან
  // ასაცილებლად, რომელიც ხდება, როცა ერთი კომპონენტის ორ render-ს შორის
  // მთელი ზედა-დონის ხე იცვლება navigation-transition-ის დროს.
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader
        title="მოთხოვნის დეტალები"
        onBack={() => navigation.goBack()}
        right={
          jobLoading ? undefined : (
            <Pressable style={styles.iconButton} onPress={() => setMenuOpen(true)}>
              <MoreVertical size={18} color={colors.foreground} />
            </Pressable>
          )
        }
      />

      {jobLoading ? (
        <View style={styles.bodyContent}>
          <Skeleton width="100%" height={140} borderRadius={radius.lg} />
        </View>
      ) : (
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.jobCard}>
          <View style={styles.jobHeaderRow}>
            <CategoryIcon categoryId={job.category} size={44} />
            <View style={{ flex: 1 }}>
              <View style={styles.titleStatusRow}>
                <Text style={styles.jobTitle}>{job.title}</Text>
                <StatusPill status={effectiveStatus} />
              </View>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <MapPin size={11} color={colors.mutedForeground} />
                  <Text style={styles.metaText}>{job.address}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Clock size={11} color={colors.mutedForeground} />
                  <Text style={styles.metaText}>{job.date}</Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.jobDesc}>{job.desc}</Text>

          {job.photos && job.photos.length > 0 && (
            <View style={styles.photoRow}>
              {job.photos.map((uri) => (
                <View key={uri} style={styles.photoThumb}>
                  <SecureStorageImage reference={uri} style={styles.photoThumbImage} />
                </View>
              ))}
            </View>
          )}
        </View>

        {selectedProvider && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>სამუშაოს პროგრესი</Text>
            {progressSteps.map((step, i) => (
              <View key={i} style={styles.progressRow}>
                <View style={styles.progressIconColumn}>
                  <View style={[styles.progressDot, step.done && styles.progressDotDone]}>
                    {step.done ? (
                      <Check size={14} color={colors.primaryForeground} strokeWidth={2.5} />
                    ) : (
                      <View style={styles.progressDotInner} />
                    )}
                  </View>
                  {i < progressSteps.length - 1 && (
                    <View
                      style={[
                        styles.progressLine,
                        step.done && progressSteps[i + 1].done && styles.progressLineDone,
                      ]}
                    />
                  )}
                </View>
                <View style={styles.progressTextWrap}>
                  <Text style={[styles.progressLabel, step.done && styles.progressLabelDone]}>{step.label}</Text>
                  {i === 1 && selectedProvider && <Text style={styles.progressProviderName}>{selectedProvider.name}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {showCompletionConfirmCard && (
          <View style={styles.completionCard}>
            <View style={styles.completionHeaderRow}>
              <Clock size={15} color={colors.warning} />
              <Text style={styles.completionTitle}>ოსტატმა სამუშაო დასრულებულად მონიშნა</Text>
            </View>
            <Text style={styles.completionSubtitle}>დაადასტურე დასრულება, ან შეატყობინე პრობლემის შესახებ.</Text>
            {selectedProvider && (
              <View style={styles.completionProviderRow}>
                <Avatar initials={selectedProvider.initials} color={selectedProvider.color} size={38} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.completionProviderName}>{selectedProvider.name}</Text>
                  <View style={styles.providerStat}>
                    <Star size={11} color="#FBBF24" fill="#FBBF24" />
                    <Text style={styles.providerStatMuted}>{selectedProvider.rating}</Text>
                  </View>
                </View>
              </View>
            )}
            <View style={styles.completionActionsRow}>
              <Pressable style={styles.problemButton} onPress={() => setProblemSheetOpen(true)} disabled={confirming}>
                <Text style={styles.problemButtonText}>პრობლემა მაქვს</Text>
              </Pressable>
              <Pressable style={[styles.completeButton, confirming && styles.completeButtonDisabled]} onPress={confirmCompletion} disabled={confirming}>
                <Text style={styles.completeButtonText}>{confirming ? 'დადასტურდება...' : 'დადასტურება'}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {effectiveStatus === 'confirmed_awaiting_rating' && (
          <View style={styles.section}>
            <Text style={styles.problemSubmittedText}>
              დასრულება დადასტურებულია — მხოლოდ ოსტატის შეფასებაა დარჩენილი.
            </Text>
            <Pressable style={styles.rateButton} onPress={openRating}>
              <Star size={15} color={colors.primaryForeground} fill={colors.primaryForeground} />
              <Text style={styles.rateButtonText}>ოსტატის შეფასება</Text>
            </Pressable>
          </View>
        )}

        {effectiveStatus === 'disputed' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>მოთხოვნა ჯერ არ არის დასრულებული</Text>
            <Text style={styles.problemSubmittedText}>შეგიძლია გააგრძელო საუბარი ოსტატთან ჩატში.</Text>
            {selectedProvider && (
              <Pressable style={styles.chatOpenButton} onPress={() => handleOpenChat(selectedProvider)}>
                <MessageCircle size={14} color={colors.primaryForeground} />
                <Text style={styles.chatOpenButtonText}>ჩატის გახსნა</Text>
              </Pressable>
            )}
          </View>
        )}

        {effectiveStatus === 'completed' && (
          <View style={styles.section}>
            {ratingData ? (
              <>
                <Text style={styles.sectionTitle}>შენი შეფასება</Text>
                <View style={styles.ratingStarsRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} size={20} color="#FBBF24" fill={ratingData.stars >= s ? '#FBBF24' : 'transparent'} />
                  ))}
                  <Text style={styles.ratingStarsLabel}>{ratingData.stars}.0</Text>
                </View>
                {ratingData.chips.length > 0 && (
                  <View style={styles.ratingChipsRow}>
                    {ratingData.chips.map((c) => (
                      <View key={c} style={styles.ratingChip}>
                        <Text style={styles.ratingChipText}>{c}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {!!ratingData.review && <Text style={styles.ratingReviewText}>"{ratingData.review}"</Text>}
                {ratingData.photos && ratingData.photos.length > 0 && (
                  <View style={styles.ratingPhotoRow}>
                    {ratingData.photos.map((photo) => (
                      <View key={photo.id} style={[styles.ratingPhotoThumb, { backgroundColor: photo.bg }]}>
                        <ImageIcon size={18} color="rgba(100,116,139,0.6)" />
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.problemSubmittedText}>სამუშაო დასრულდა. შეგიძლია შეაფასო ოსტატი.</Text>
                <Pressable style={styles.rateButton} onPress={openRating}>
                  <Star size={15} color={colors.primaryForeground} fill={colors.primaryForeground} />
                  <Text style={styles.rateButtonText}>ოსტატის შეფასება</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        <View style={styles.interestedSection}>
          <View style={styles.interestedHeaderRow}>
            <Text style={styles.interestedTitle}>დაინტერესებული ოსტატები</Text>
            {visibleInterestedList.length > 0 && (
              <View style={styles.interestedCountBadge}>
                <Text style={styles.interestedCountText}>{visibleInterestedList.length}</Text>
              </View>
            )}
          </View>

          {interestedList.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Briefcase size={22} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyText}>
                ჯერ არ გაუხატეს ინტერესი.{'\n'}ოსტატები მალე გამოეხმაურებიან.
              </Text>
            </View>
          ) : (
            <>
              {selectedProvider && interestedList.length > 1 && (
                <Text style={styles.closedNote}>
                  მოთხოვნა დაიხურა სხვა ოსტატებისთვის — მხოლოდ არჩეული ოსტატია აქტიური.
                </Text>
              )}
              {!selectedProvider && interestedList.length > 1 && (
                <View style={styles.sortRow}>
                  <Text style={styles.sortLabel}>დაალაგე:</Text>
                  {(
                    [
                      { key: 'price', label: 'ფასით' },
                      { key: 'rating', label: 'რეიტინგით' },
                      { key: 'experience', label: 'გამოცდილებით' },
                    ] as const
                  ).map((opt) => {
                    const on = sortBy === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        style={[styles.sortChip, on && styles.sortChipOn]}
                        onPress={() => setSortBy((prev) => (prev === opt.key ? null : opt.key))}
                      >
                        <Text style={[styles.sortChipText, on && styles.sortChipTextOn]}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              <View style={{ gap: spacing.md }}>
                {visibleInterestedList.map((entry) => {
                  const prov = entry.provider;
                  const isSelected = selectedProvider?.id === prov.id;
                  return (
                    <View key={prov.id} style={[styles.providerCard, isSelected && styles.providerCardSelected]}>
                      {isSelected && (
                        <View style={styles.selectedBadge}>
                          <Check size={13} color={colors.primary} strokeWidth={2.5} />
                          <Text style={styles.selectedBadgeText}>შერჩეული ოსტატი</Text>
                        </View>
                      )}
                      <View style={styles.providerRow}>
                        <Avatar initials={prov.initials} color={prov.color} size={46} online={prov.online} />
                        <View style={{ flex: 1 }}>
                          <View style={styles.providerNameRow}>
                            <Text style={styles.providerName}>{prov.name}</Text>
                            {prov.verified && <VerifiedBadge size={14} />}
                          </View>
                          <Text style={styles.providerMeta}>
                            {SPECIALTY_LABEL[prov.category] ?? prov.category} · {prov.years} წელი
                          </Text>
                          <View style={styles.providerStatsRow}>
                            {isNewProvider(prov) ? (
                              <Text style={styles.providerStatMuted}>ახალი ოსტატი</Text>
                            ) : (
                              <View style={styles.providerStat}>
                                <Star size={11} color="#FBBF24" fill="#FBBF24" />
                                <Text style={styles.providerStatText}>{prov.rating}</Text>
                              </View>
                            )}
                            {!isNewProvider(prov) && <Text style={styles.providerStatMuted}>{prov.reviews} შეფ.</Text>}
                            <Text style={styles.providerStatMuted}>{prov.jobs} სამ.</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.priceRow}>
                        <Text style={[styles.priceRowText, entry.offeredPrice === undefined && styles.priceRowTextMuted]}>
                          {priceLabel(entry)}
                        </Text>
                      </View>
                      <View style={styles.providerActions}>
                        <Pressable style={styles.secondaryAction} onPress={() => handleOpenProfile(prov)}>
                          <Text style={styles.secondaryActionText}>პროფილი</Text>
                        </Pressable>
                        <Pressable style={styles.secondaryAction} onPress={() => handleOpenChat(prov)}>
                          <MessageCircle size={12} color={colors.foreground} />
                          <Text style={styles.secondaryActionText}>მიწერა</Text>
                        </Pressable>
                        {!selectedProvider && (
                          <Pressable style={styles.selectAction} onPress={() => setConfirmProvider(prov)}>
                            <Text style={styles.selectActionText}>არჩევა</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </ScrollView>
      )}

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        {effectiveStatus === 'pending' && (
          <Pressable style={styles.menuRow} onPress={handleEdit}>
            <Pencil size={15} color={colors.mutedForeground} />
            <Text style={styles.menuRowText}>სამუშაოს რედაქტირება</Text>
          </Pressable>
        )}
        <Pressable
          style={styles.menuRow}
          onPress={() => {
            setMenuOpen(false);
            setReportSheetOpen(true);
          }}
        >
          <Flag size={15} color={colors.mutedForeground} />
          <Text style={styles.menuRowText}>პრობლემის შეტყობინება</Text>
        </Pressable>
        <Pressable
          style={styles.menuRow}
          onPress={() => {
            setMenuOpen(false);
            setCancelSheetOpen(true);
          }}
        >
          <X size={15} color={colors.destructive} />
          <Text style={[styles.menuRowText, { color: colors.destructive }]}>გაუქმება</Text>
        </Pressable>
      </BottomSheet>

      <ReportJobSheet
        visible={reportSheetOpen}
        jobId={job.id}
        role="customer"
        onClose={() => setReportSheetOpen(false)}
      />

      <BottomSheet visible={!!confirmProvider} onClose={() => setConfirmProvider(null)}>
        {confirmProvider && (
          <>
            <Text style={styles.sheetTitle}>ოსტატის არჩევა</Text>
            <Text style={styles.sheetSubtitle}>
              გსურთ <Text style={styles.sheetSubtitleBold}>{confirmProvider.name}</Text>-ის დანიშვნა ამ სამუშაოსთვის?
            </Text>
            <View style={styles.sheetProviderRow}>
              <Avatar initials={confirmProvider.initials} color={confirmProvider.color} size={44} />
              <View>
                <View style={styles.providerNameRow}>
                  <Text style={styles.providerName}>{confirmProvider.name}</Text>
                  {confirmProvider.verified && <VerifiedBadge size={13} />}
                </View>
                <View style={styles.providerStat}>
                  <Star size={11} color="#FBBF24" fill="#FBBF24" />
                  <Text style={styles.providerStatText}>{confirmProvider.rating}</Text>
                  <Text style={styles.providerStatMuted}> · {confirmProvider.reviews} შეფ.</Text>
                </View>
              </View>
            </View>
            <Button label="დადასტურება" loadingLabel="ინიშნება..." onPress={confirmSelection} loading={selecting} />
            <Pressable style={styles.sheetCancelLink} onPress={() => setConfirmProvider(null)}>
              <Text style={styles.sheetCancelLinkText}>გაუქმება</Text>
            </Pressable>
          </>
        )}
      </BottomSheet>

      <BottomSheet
        visible={cancelSheetOpen}
        onClose={() => {
          setCancelSheetOpen(false);
          setCancelReason('');
        }}
      >
        <View style={styles.cancelIcon}>
          <X size={22} color={colors.destructive} />
        </View>
        <Text style={styles.sheetTitle}>მოთხოვნის გაუქმება</Text>
        <Text style={styles.sheetSubtitle}>ნამდვილად გსურთ ამ სამუშაო მოთხოვნის გაუქმება?</Text>
        {cancelRequiresReason && (
          <TextInput
            value={cancelReason}
            onChangeText={setCancelReason}
            placeholder="მიუთითე გაუქმების მიზეზი..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            style={styles.problemTextarea}
          />
        )}
        <Button
          label="გაუქმება"
          loadingLabel="უქმდება..."
          variant="destructive"
          onPress={confirmCancel}
          disabled={cancelRequiresReason && !cancelReason.trim()}
          loading={cancelling}
        />
        <Pressable
          style={styles.sheetCancelLink}
          onPress={() => {
            setCancelSheetOpen(false);
            setCancelReason('');
          }}
        >
          <Text style={styles.sheetCancelLinkText}>დახურვა</Text>
        </Pressable>
      </BottomSheet>

      <BottomSheet
        visible={problemSheetOpen}
        onClose={() => {
          setProblemSheetOpen(false);
          setProblemOption(null);
          setProblemOther('');
        }}
      >
        <Text style={styles.sheetTitle}>რა პრობლემა გაქვს?</Text>
        <Text style={styles.problemIntro}>აირჩიე სიტუაცია, რომელიც შენი სიტუაციის შესაბამისია.</Text>
        {PROBLEM_OPTIONS.map((opt) => {
          const on = problemOption === opt;
          return (
            <Pressable key={opt} style={[styles.problemOption, on && styles.problemOptionOn]} onPress={() => setProblemOption(opt)}>
              <View style={[styles.radioOuter, on && styles.radioOuterOn]}>{on && <View style={styles.radioInner} />}</View>
              <Text style={[styles.problemOptionText, on && styles.problemOptionTextOn]}>{opt}</Text>
            </Pressable>
          );
        })}
        {problemOption === 'სხვა' && (
          <TextInput
            value={problemOther}
            onChangeText={setProblemOther}
            placeholder="აღწერე პრობლემა..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            style={styles.problemTextarea}
          />
        )}
        <Button
          label="გაგზავნა"
          loadingLabel="იგზავნება..."
          onPress={submitProblem}
          disabled={!problemOption || (problemOption === 'სხვა' && !problemOther.trim())}
          loading={reportingProblem}
          style={{ marginTop: spacing.sm }}
        />
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
  jobCard: {
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  jobHeaderRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm + 2,
  },
  titleStatusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  jobTitle: {
    ...typography.h3,
    color: colors.foreground,
    flex: 1,
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
    ...typography.small,
    color: colors.mutedForeground,
  },
  jobDesc: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.sm + 2,
  },
  photoRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
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
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
  },
  progressIconColumn: {
    alignItems: 'center',
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  progressDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  progressLine: {
    width: 2,
    height: 24,
    marginTop: 2,
    backgroundColor: colors.border,
  },
  progressLineDone: {
    backgroundColor: colors.primary,
  },
  progressTextWrap: {
    paddingBottom: spacing.lg,
  },
  progressLabel: {
    ...typography.captionMedium,
    color: colors.mutedForeground,
  },
  progressLabelDone: {
    color: colors.foreground,
  },
  progressProviderName: {
    ...typography.small,
    color: colors.primary,
    marginTop: 2,
  },
  interestedSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  interestedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm + 2,
  },
  interestedTitle: {
    ...typography.h3,
    color: colors.foreground,
  },
  interestedCountBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  interestedCountText: {
    ...typography.small,
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  emptyState: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm + 2,
  },
  emptyText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  closedNote: {
    ...typography.small,
    color: colors.mutedForeground,
    fontStyle: 'italic',
    marginBottom: spacing.sm + 2,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginBottom: spacing.sm + 2,
  },
  sortLabel: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '600',
  },
  sortChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  sortChipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  sortChipTextOn: {
    color: colors.primaryForeground,
  },
  providerCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  priceRow: {
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 4,
    marginBottom: spacing.sm + 2,
  },
  priceRowText: {
    ...typography.small,
    color: colors.foreground,
    fontWeight: '700',
  },
  priceRowTextMuted: {
    color: colors.mutedForeground,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  providerCardSelected: {
    borderColor: colors.primary,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.sm + 2,
    alignSelf: 'flex-start',
  },
  selectedBadgeText: {
    ...typography.small,
    color: colors.secondaryForeground,
    fontWeight: '700',
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
    marginBottom: spacing.sm + 2,
  },
  providerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  providerName: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
  },
  providerMeta: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  providerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    marginTop: spacing.xs + 2,
  },
  providerStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  providerStatText: {
    ...typography.small,
    color: colors.foreground,
    fontWeight: '700',
  },
  providerStatMuted: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  providerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  secondaryActionText: {
    ...typography.small,
    color: colors.foreground,
    fontWeight: '600',
  },
  selectAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  selectActionText: {
    ...typography.small,
    color: colors.primaryForeground,
    fontWeight: '600',
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
  sheetSubtitleBold: {
    color: colors.foreground,
    fontWeight: '700',
  },
  sheetProviderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
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
  completionCard: {
    backgroundColor: colors.warningBackground,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  completionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginBottom: spacing.xs,
  },
  completionTitle: {
    ...typography.captionMedium,
    color: colors.warning,
    fontWeight: '700',
  },
  completionSubtitle: {
    ...typography.small,
    color: colors.warning,
    marginBottom: spacing.sm + 2,
    lineHeight: 18,
  },
  completionProviderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    marginBottom: spacing.sm + 2,
  },
  completionProviderName: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '600',
  },
  completionActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  problemButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  problemButtonText: {
    ...typography.small,
    color: colors.foreground,
    fontWeight: '600',
  },
  completeButton: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  completeButtonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    ...typography.small,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  problemSubmittedText: {
    ...typography.small,
    color: colors.mutedForeground,
    marginBottom: spacing.sm + 2,
    lineHeight: 18,
  },
  chatOpenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  chatOpenButtonText: {
    ...typography.small,
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  ratingStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: spacing.sm,
  },
  ratingStarsLabel: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '700',
    marginLeft: spacing.xs + 2,
  },
  ratingChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginBottom: spacing.sm,
  },
  ratingChip: {
    backgroundColor: colors.secondary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  ratingChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.secondaryForeground,
  },
  ratingReviewText: {
    ...typography.small,
    color: colors.mutedForeground,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  ratingPhotoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm + 2,
  },
  ratingPhotoThumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 6,
  },
  rateButtonText: {
    ...typography.captionMedium,
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  problemIntro: {
    ...typography.small,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
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
