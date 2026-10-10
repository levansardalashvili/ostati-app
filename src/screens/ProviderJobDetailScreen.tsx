import { useEffect, useState } from 'react';
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
  ShieldCheck,
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
import { notificationService } from '../services/notificationService';
import { quoteService } from '../services/quoteService';
import { useJobStatus } from '../state/JobStatusContext';
import { useProviderProfile } from '../state/ProviderProfileContext';
import type { FeedJob } from '../types/job';
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

// Must match job_posts_cancellation_reason_code_check.
const PROVIDER_CANCEL_REASONS: { code: string; label: string }[] = [
  { code: 'provider_unavailable', label: 'აღარ ვარ ხელმისაწვდომი' },
  { code: 'schedule_conflict', label: 'დროის კონფლიქტი' },
  { code: 'cannot_complete_job', label: 'სამუშაოს შესრულებას ვერ შევძლებ' },
  { code: 'customer_unreachable', label: 'მომხმარებელს ვერ ვუკავშირდები' },
  { code: 'incorrect_job_information', label: 'სამუშაოს ინფორმაცია არასწორია' },
  { code: 'other', label: 'სხვა' },
];

// Provider's view of a job: price offer while pending; once selected,
// "სამუშაო დავასრულე" which waits for the customer's confirmation.
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

  // Verification check here is UX only; express_interest enforces it (PROVIDER_NOT_VERIFIED).
  const { profile: providerProfile } = useProviderProfile();
  const isVerified = providerProfile.verificationStatus === 'verified';
  const [expressed, setExpressed] = useState(false);
  // autoOpenOffer: the feed sends the provider here to see the details before offering a price.
  const [offerSheetOpen, setOfferSheetOpen] = useState(false);
  const [verifySheetOpen, setVerifySheetOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const { getStatus, setStatus } = useJobStatus();

  // Restore "already interested" from job_responses.
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

  // Local JobStatusContext first, else the freshly fetched job.status — this device
  // never hears about the customer's actions (e.g. a cancel) locally.
  const linkedStatus = (job.customerJobId ? getStatus(job.customerJobId) : undefined) ?? job.status;
  const variant: 'browse' | 'active' | 'awaiting_confirmation' | 'disputed' | 'completed' | 'cancelled' =
    linkedStatus === 'cancelled'
      ? 'cancelled'
      : linkedStatus === 'awaiting_customer_confirmation'
        ? 'awaiting_confirmation'
        : linkedStatus === 'disputed'
          ? 'disputed'
          : // Pre-existing gap, surfaced (not introduced) by 0079's auto-expiry:
            // confirmed_awaiting_rating uses the 'completed' variant (stars render only once a review exists).
            linkedStatus === 'completed' || linkedStatus === 'confirmed_awaiting_rating'
            ? 'completed'
            : linkedStatus === 'active'
              ? 'active'
              : mode === 'completed'
                ? 'completed'
                : mode === 'selected'
                  ? 'active'
                  : 'browse';

  // Private job sent only to this provider — they can decline it.
  const [isInvite, setIsInvite] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declining, setDeclining] = useState(false);
  useEffect(() => {
    if (variant !== 'browse' || !job.id) return;
    jobService.isMyJobInvite(job.id).then(setIsInvite).catch(() => {});
  }, [variant, job.id]);
  const declineInvite = async () => {
    if (declining) return;
    setDeclining(true);
    try {
      await jobService.declineInvitedJob(job.id);
      setDeclineOpen(false);
      navigation.goBack();
    } catch {
      Alert.alert('ვერ მოხერხდა', 'უარის გაგზავნა ვერ მოხერხდა — სცადე თავიდან.');
    } finally {
      setDeclining(false);
    }
  };

  // Dispute: the customer's reason and the provider's side (shown to the admin).
  const [dispute, setDispute] = useState<{ reason: string | null; providerResponse: string | null } | null>(null);
  const [disputeDraft, setDisputeDraft] = useState('');
  const [sendingDispute, setSendingDispute] = useState(false);
  useEffect(() => {
    if (variant !== 'disputed' || !job.id) return;
    jobService.getDisputeInfo(job.id).then(setDispute).catch(() => {});
  }, [variant, job.id]);
  const sendDisputeResponse = async () => {
    const text = disputeDraft.trim();
    if (text.length < 5 || sendingDispute) return;
    setSendingDispute(true);
    try {
      await jobService.respondToDispute(job.id, text);
      setDispute((d) => ({ reason: d?.reason ?? null, providerResponse: text }));
      setDisputeDraft('');
    } catch {
      Alert.alert('ვერ მოხერხდა', 'პასუხის გაგზავნა ვერ მოხერხდა — სცადე თავიდან.');
    } finally {
      setSendingDispute(false);
    }
  };

  // Apply the auto-confirm deadline on open (cron does it too); no-op before 72h.
  useEffect(() => {
    if (linkedStatus !== 'awaiting_customer_confirmation' || !job.customerJobId) return;
    const jobId = job.customerJobId;
    jobService
      .expireStaleJobConfirmation(jobId)
      .then((expired) => {
        if (expired) setStatus(jobId, 'confirmed_awaiting_rating');
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedStatus, job.customerJobId]);

  useEffect(() => {
    if (job.id) notificationService.markJobNotificationsRead(job.id).catch(() => {});
  }, [job.id]);
  const [markingWorkDone, setMarkingWorkDone] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  // Footer sits above the gesture bar (SafeAreaView reserves only the top).
  const insets = useSafeAreaInsets();
  const footerBottomPadding = insets.bottom > 0 ? insets.bottom + spacing.xs : spacing.md;
  const markWorkDone = async () => {
    if (!job.customerJobId || markingWorkDone) return;
    setMarkingWorkDone(true);
    try {
      await jobService.providerRequestCompletion(job.customerJobId);
      setStatus(job.customerJobId, 'awaiting_customer_confirmation');
    } catch (err) {
      // Marker error from the RPC when the scheduled time hasn't started yet.
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

  const handleChat = () => {
    if (!job.customerId) return;
    navigation.navigate('ChatConversation', {
      chatId: job.customerId,
      name: job.customer,
      initials: job.customer[0],
      color: '#64748B',
      role: 'provider',
      jobId: job.customerJobId,
      // linkedStatus, not the possibly stale job.status — hides the chat offer button once the job isn't pending.
      jobStatus: linkedStatus,
    });
  };
  // "…" menu: report + cancel. Separate from the completion dispute.
  const [reportSheetOpen, setReportSheetOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const handleMore = () => {
    setActionMenuOpen(true);
  };

  // Cancel is offered only on 'active' (guarded in the menu JSX).
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
      // `job` was fetched before this cancel — update the actor so the banner says the provider cancelled.
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
  // Interest always carries a concrete price.
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
      // Also post the price as an offer card in the chat — best-effort, the interest itself already succeeded.
      if (job.customerId) {
        chatService.sendRealOffer(job.customerId, uid, uid, priceNum, undefined, job.id).catch(() => {});
      }
    } catch (err) {
      const message = (err as { message?: string } | null)?.message ?? '';
      if (message.includes('PROVIDER_NOT_VERIFIED')) {
        setOfferSheetOpen(false);
        setVerifySheetOpen(true);
      } else if (message.includes('ACCOUNT_SUSPENDED')) {
        Alert.alert('ანგარიში შეჩერებულია', 'თქვენი ანგარიში შეჩერებულია — მოქმედება მიუწვდომელია.');
      } else {
        Alert.alert('ვერ მოხერხდა', 'ინტერესის გაგზავნა ვერ მოხერხდა — სცადე თავიდან.');
      }
    } finally {
      setSendingInterest(false);
    }
  };

  // Withdraw while still pending (the RPC checks).
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawSheetOpen, setWithdrawSheetOpen] = useState(false);
  const handleWithdraw = () => {
    if (withdrawing) return;
    setWithdrawSheetOpen(true);
  };
  const confirmWithdraw = async () => {
    setWithdrawing(true);
    try {
      await quoteService.withdrawInterest(job.id);
      setExpressed(false);
      setOfferPrice('');
      setWithdrawSheetOpen(false);
    } catch {
      setWithdrawSheetOpen(false);
      Alert.alert('ვერ მოხერხდა', 'ვერ გავაუქმეთ — job შეიძლება უკვე მინიჭებული იყოს, სცადე ხელახლა.');
    } finally {
      setWithdrawing(false);
    }
  };

  // One persistent JSX tree for loading→loaded (two returns crash Fabric).
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <BackHeader
        title="განცხადება"
        onBack={() => navigation.goBack()}
        right={
          jobLoading || variant === 'browse' ? undefined : (
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
              <Text style={styles.selectedBannerTitle}>თქვენ აგირჩიეს ამ სამუშაოსთვის</Text>
            </View>
            <Text style={styles.selectedBannerText}>
              დაასრულეთ სამუშაო და დააკლიკეთ „სამუშაო დავასრულე" - მომხმარებელი დაადასტურებს დასრულებას
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
            {!!dispute?.reason && (
              <Text style={[styles.disputedBannerText, styles.disputeQuote]}>„{dispute.reason}“</Text>
            )}
            <Text style={[styles.disputedBannerTitle, { marginTop: spacing.md }]}>შენი მხარე</Text>
            {dispute?.providerResponse ? (
              <Text style={styles.disputedBannerText}>
                {dispute.providerResponse}
                {'\n'}ადმინისტრაცია განიხილავს ორივე მხარეს.
              </Text>
            ) : (
              <>
                <Text style={styles.disputedBannerText}>
                  აღწერე, როგორ შესრულდა სამუშაო — ადმინისტრაცია ორივე მხარეს განიხილავს.
                </Text>
                <TextInput
                  testID="dispute-response-input"
                  value={disputeDraft}
                  onChangeText={setDisputeDraft}
                  placeholder="შენი პასუხი..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  maxLength={1000}
                  style={styles.disputeInput}
                />
                <Button
                  testID="dispute-response-send"
                  label="გაგზავნა"
                  loadingLabel="იგზავნება..."
                  compact
                  onPress={sendDisputeResponse}
                  disabled={disputeDraft.trim().length < 5}
                  loading={sendingDispute}
                />
              </>
            )}
          </View>
        )}

        {variant === 'browse' && isInvite && !expressed && (
          <View style={styles.inviteBanner}>
            <Text style={styles.inviteBannerTitle}>მოთხოვნა პირადად თქვენთვისაა</Text>
            <Text style={styles.inviteBannerText}>
              მომხმარებელმა ეს სამუშაო მხოლოდ თქვენ გამოგიგზავნათ. თუ ვერ შეასრულებთ, უთხარით უარი — მომხმარებელს შეეძლება სხვა ოსტატების მოძებნა.
            </Text>
            <Pressable testID="decline-invite-button" onPress={() => setDeclineOpen(true)} hitSlop={6}>
              <Text style={styles.inviteDeclineLink}>უარის თქმა</Text>
            </Pressable>
          </View>
        )}

        {variant === 'cancelled' && (
          <View style={styles.disputedBanner}>
            <View style={styles.bannerHeaderRow}>
              <AlertTriangle size={16} color={colors.destructive} />
              <Text style={styles.disputedBannerTitle}>მოთხოვნა გაუქმებულია</Text>
            </View>
            {/* cancellationActor is set by the server — tells who cancelled. */}
            <Text style={styles.disputedBannerText}>
              {job.cancellationActor === 'provider'
                ? 'შენ გააუქმე ეს სამუშაო.'
                : job.cancellationActor === 'admin'
                  ? 'ეს მოთხოვნა ადმინისტრაციამ გააუქმა.'
                  : 'მომხმარებელმა ეს მოთხოვნა გააუქმა.'}
            </Text>
          </View>
        )}

        {variant === 'completed' && (
          <View style={styles.completedBanner}>
            <View style={styles.bannerHeaderRow}>
              <Award size={16} color={colors.primary} />
              <Text style={styles.completedBannerTitle}>სამუშაო დასრულებულად დადასტურდა</Text>
            </View>
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
                {/* Requested date/time (Calendar icon; Clock is used for the posting age). */}
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
          {job.photos && job.photos.length > 0 && (
            <View style={styles.photoRow}>
              {job.photos.map((uri) => (
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

      {/* Pinned footer; paddingBottom = safe-area inset (keeps clear of the gesture bar). */}
      {variant === 'browse' && (
        <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
          {/* Chat only after expressing interest — the server allows provider→customer
             messages only with a job_responses row or an assignment. */}
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
            onPress={() => {
              if (expressed) return;
              if (!isVerified) {
                setVerifySheetOpen(true);
                return;
              }
              setOfferSheetOpen(true);
            }}
          >
            {expressed && <CheckCircle size={17} color={colors.primaryForeground} />}
            <Text style={styles.interestButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {expressed ? (offerPrice ? `შეთავაზდა: ${offerPrice} ₾` : 'დაინტ. ხარ') : 'ფასის შეთავაზება'}
            </Text>
          </Pressable>
          {/* Withdraw interest (shown only while pending). */}
          {expressed && (
            <Pressable
              style={styles.withdrawButton}
              onPress={handleWithdraw}
              disabled={withdrawing}
              accessibilityLabel="დაინტერესების გაუქმება"
            >
              <X size={17} color={colors.mutedForeground} />
            </Pressable>
          )}
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
          {/* Moves the job to awaiting_customer_confirmation only — never straight to completed. */}
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
              {job.cancellationActor === 'provider'
                ? 'შენ გააუქმე ეს სამუშაო.'
                : job.cancellationActor === 'admin'
                  ? 'მოთხოვნა ადმინისტრაციამ გააუქმა.'
                  : 'მომხმარებელმა მოთხოვნა გააუქმა.'}
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

      <BottomSheet visible={verifySheetOpen} onClose={() => setVerifySheetOpen(false)}>
        <View style={styles.verifyIconWrap}>
          <ShieldCheck size={30} color={colors.primary} />
        </View>
        <Text style={styles.sheetTitle}>საჭიროა ვერიფიკაცია</Text>
        <Text style={styles.sheetSubtitle}>ფასის შესათავაზებლად საჭიროა ვერიფიკაციის გავლა</Text>
        <Button
          label="ვერიფიკაცია"
          onPress={() => {
            setVerifySheetOpen(false);
            // ვერიფიკაციის ბარათი პროფილის ტაბზეა (VerificationRequestCard)
            (navigation as any).navigate('ProviderHome', { screen: 'Profile' });
          }}
        />
        <Pressable style={styles.sheetCancelLink} onPress={() => setVerifySheetOpen(false)}>
          <Text style={styles.sheetCancelLinkText}>დახურვა</Text>
        </Pressable>
      </BottomSheet>

      <BottomSheet visible={withdrawSheetOpen} onClose={() => setWithdrawSheetOpen(false)}>
        <View style={styles.cancelIcon}>
          <X size={22} color={colors.destructive} />
        </View>
        <Text style={styles.sheetTitle}>დაინტერესების გაუქმება</Text>
        <Text style={styles.sheetSubtitle}>ნამდვილად გინდა ამ job-ზე გამოხატული ინტერესის გაუქმება?</Text>
        <Button
          label="დიახ, გავაუქმებ"
          loadingLabel="უქმდება..."
          variant="destructive"
          onPress={confirmWithdraw}
          loading={withdrawing}
        />
        <Pressable style={styles.sheetCancelLink} onPress={() => setWithdrawSheetOpen(false)}>
          <Text style={styles.sheetCancelLinkText}>არა</Text>
        </Pressable>
      </BottomSheet>

      <BottomSheet visible={declineOpen} onClose={() => setDeclineOpen(false)}>
        <View style={styles.cancelIcon}>
          <X size={22} color={colors.destructive} />
        </View>
        <Text style={styles.sheetTitle}>უარის თქმა</Text>
        <Text style={styles.sheetSubtitle}>
          მოთხოვნა აღარ გამოგიჩნდებათ, მომხმარებელი კი მიიღებს შეტყობინებას, რომ სხვა ოსტატი მოძებნოს.
        </Text>
        <Button
          testID="decline-invite-confirm"
          label="უარის თქმა"
          loadingLabel="იგზავნება..."
          variant="destructive"
          onPress={declineInvite}
          loading={declining}
        />
        <Pressable style={styles.sheetCancelLink} onPress={() => setDeclineOpen(false)}>
          <Text style={styles.sheetCancelLinkText}>არა</Text>
        </Pressable>
      </BottomSheet>

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
  inviteBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    padding: spacing.md,
    gap: spacing.xs,
  },
  inviteBannerTitle: {
    ...typography.captionMedium,
    color: colors.primary,
    fontWeight: '700',
  },
  inviteBannerText: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  inviteDeclineLink: {
    ...typography.captionMedium,
    color: colors.destructive,
    marginTop: spacing.xs,
  },
  disputeQuote: {
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  disputeInput: {
    ...typography.caption,
    color: colors.foreground,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    minHeight: 72,
    textAlignVertical: 'top',
    marginVertical: spacing.sm,
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
  withdrawButton: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    minHeight: 52,
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
  verifyIconWrap: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
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
