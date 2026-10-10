import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Ban,
  Check,
  CheckCircle,
  ChevronRight,
  Clock,
  Image as ImageIcon,
  MoreVertical,
  Send,
  Wallet,
  X,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { blockService, type ChatReportReason } from '../services/blockService';
import { CategoryIcon } from '../components/CategoryIcon';
import { colors, radius, spacing, typography } from '../theme';
import { authService } from '../services/authService';
import { chatService } from '../services/chatService';
import { jobService } from '../services/jobService';
import { storageService } from '../services/storageService';
import type { ChatMsg, MsgState } from '../types/chat';
import type { JobStatus } from '../types/job';
import type { RootStackParamList } from '../navigation/types';
import { SecureStorageImage } from '../components/SecureStorageImage';
import { useJobStatus } from '../state/JobStatusContext';


type Props = NativeStackScreenProps<RootStackParamList, 'ChatConversation'>;

// Chat between a customer and a provider. A price offer is a structured card;
// accepting it (respond_to_chat_offer) also selects the provider for the job.
export function ChatConversationScreen({ navigation, route }: Props) {
  const { chatId, name, initials, color, role, jobId, draftMessage } = route.params;
  const myUid = authService.getCurrentUser()?.uid ?? null;
  const customerId = role === 'customer' ? myUid : chatId;
  const providerId = role === 'provider' ? myUid : chatId;
  const { getStatus, setStatus } = useJobStatus();

  // jobId comes as a route param only from job screens; from the chat list it is
  // guessed with findLatestSharedJobId().
  const [autoJobId, setAutoJobId] = useState<string | null>(null);
  useEffect(() => {
    if (jobId || !customerId || !providerId) return;
    let cancelled = false;
    jobService
      .findLatestSharedJobId(customerId, providerId)
      .then((found) => {
        if (!cancelled) setAutoJobId(found);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [jobId, customerId, providerId]);
  const linkJobId = jobId ?? autoJobId ?? undefined;

  const handleOpenJobDetail = () => {
    if (!linkJobId) return;
    if (role === 'customer') {
      navigation.navigate('CustomerJobDetail', { jobId: linkJobId });
    } else {
      navigation.navigate('ProviderJobDetail', { id: linkJobId });
    }
  };

  // Live job status for the in-chat status card; JobStatusContext overrides it
  // immediately after actions taken here (same rule as the job detail screens).
  const [fetchedJobStatus, setFetchedJobStatus] = useState<JobStatus | null>(null);
  // Job summary card at the top of the chat. The provider's location comes
  // already masked by get_feed_job_by_id (exact address only once selected).
  const [jobSummary, setJobSummary] = useState<{ title: string; desc: string; location: string; category: string } | null>(
    null,
  );
  useEffect(() => {
    if (!linkJobId) {
      setJobSummary(null);
      return;
    }
    let cancelled = false;
    const fetchStatus =
      role === 'provider' ? jobService.getFeedJobPostById(linkJobId) : jobService.getJobPostById(linkJobId);
    fetchStatus
      .then((j) => {
        if (cancelled || !j) return;
        setFetchedJobStatus(j.status ?? null);
        setJobSummary({
          title: j.title,
          desc: j.desc,
          category: j.category,
          location: 'location' in j ? j.location : j.address,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [linkJobId, role]);
  const liveJobStatus: JobStatus | undefined = linkJobId
    ? (getStatus(linkJobId) ?? fetchedJobStatus ?? undefined)
    : undefined;

  const statusCardTitle = (() => {
    if (!liveJobStatus || liveJobStatus === 'pending' || liveJobStatus === 'draft') return null;
    if (role === 'provider') {
      switch (liveJobStatus) {
        case 'active':
          return 'თქვენ აგირჩიეს ამ სამუშაოსთვის';
        case 'awaiting_customer_confirmation':
          return 'ელოდება მომხმარებლის დადასტურებას';
        case 'disputed':
          return 'მომხმარებელმა პრობლემა აღნიშნა';
        case 'confirmed_awaiting_rating':
        case 'completed':
          return 'სამუშაო დასრულებულია';
        case 'cancelled':
          return 'სამუშაო გაუქმებულია';
        default:
          return null;
      }
    }
    switch (liveJobStatus) {
      case 'active':
        return 'ოსტატი მუშაობს სამუშაოზე';
      case 'awaiting_customer_confirmation':
        return 'ოსტატმა სამუშაო დაასრულა';
      case 'disputed':
        return 'პრობლემა გაგზავნილია';
      case 'confirmed_awaiting_rating':
      case 'completed':
        return 'სამუშაო დასრულებულია';
      case 'cancelled':
        return 'სამუშაო გაუქმებულია';
      default:
        return null;
    }
  })();

  // Provider "სამუშაო დავასრულე" — same RPC and errors as ProviderJobDetailScreen.
  const [markingWorkDone, setMarkingWorkDone] = useState(false);
  const markWorkDoneFromChat = async () => {
    if (!linkJobId || markingWorkDone) return;
    setMarkingWorkDone(true);
    try {
      await jobService.providerRequestCompletion(linkJobId);
      setStatus(linkJobId, 'awaiting_customer_confirmation');
    } catch (err) {
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

  // Customer "დადასტურება" goes straight to RatingScreen (rating is mandatory).
  const goToRatingFromChat = () => {
    if (!linkJobId) return;
    navigation.navigate('RatingScreen', {
      jobId: linkJobId,
      providerName: name,
      providerInitials: initials,
      providerColor: color,
    });
  };

  // Customer "პრობლემა მაქვს" — same options and RPC as CustomerJobDetailScreen.
  const PROBLEM_OPTIONS = ['ოსტატი ჯერ არ მოსულა', 'სამუშაო ჯერ არ დასრულებულა', 'სამუშაოს ხარისხი დაბალია', 'სხვა'];
  const [problemSheetOpen, setProblemSheetOpen] = useState(false);
  const [problemOption, setProblemOption] = useState<string | null>(null);
  const [problemOther, setProblemOther] = useState('');
  const [reportingProblem, setReportingProblem] = useState(false);
  const submitProblemFromChat = async () => {
    if (!linkJobId || !problemOption || (problemOption === 'სხვა' && !problemOther.trim()) || reportingProblem) return;
    const reason = problemOption === 'სხვა' ? problemOther.trim() : problemOption;
    setReportingProblem(true);
    try {
      await jobService.customerReportProblem(linkJobId, reason);
      setProblemSheetOpen(false);
      setProblemOption(null);
      setProblemOther('');
      setStatus(linkJobId, 'disputed');
    } catch {
      Alert.alert('ვერ მოხერხდა', 'პრობლემის შეტყობინება ვერ გაიგზავნა — სცადე თავიდან.');
    } finally {
      setReportingProblem(false);
    }
  };


  const [messages, setMessages] = useState<ChatMsg[]>([]);

  // One chat per customer/provider pair: when it spans 2+ jobs, a divider marks each job change.
  const [jobLabels, setJobLabels] = useState<Record<string, string>>({});
  const jobIdsKey = [...new Set(messages.map((m) => m.jobId).filter((x): x is string => !!x))].join(',');
  useEffect(() => {
    const ids = jobIdsKey ? jobIdsKey.split(',') : [];
    if (ids.length < 2) return;
    let cancelled = false;
    Promise.all(
      ids.map((jid) =>
        (role === 'provider' ? jobService.getFeedJobPostById(jid) : jobService.getJobPostById(jid))
          .then((j) => [jid, j ? `${j.title}${j.date ? ' · ' + j.date : ''}` : ''] as const)
          .catch(() => [jid, ''] as const),
      ),
    ).then((pairs) => {
      if (!cancelled) setJobLabels(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [jobIdsKey, role]);
  const displayMessages: ChatMsg[] = (() => {
    if (!jobIdsKey.includes(',')) return messages;
    const out: ChatMsg[] = [];
    let last: string | undefined;
    for (const m of messages) {
      if (m.jobId && m.jobId !== last) {
        last = m.jobId;
        out.push({ id: `jobdiv-${m.id}`, type: 'date', from: 'other', label: jobLabels[m.jobId] || 'სამუშაო' });
      }
      out.push(m);
    }
    return out;
  })();

  useEffect(() => {
    if (!customerId || !providerId || !myUid) return;
    let cancelled = false;
    chatService
      .listRealMessages(customerId, providerId, myUid)
      .then((real) => {
        if (!cancelled) setMessages(real);
      })
      .catch(() => {});
    chatService.markConversationRead(customerId, providerId).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [customerId, providerId, myUid, role]);

  // Realtime: the other side's messages appear without reopening.
  useEffect(() => {
    if (!customerId || !providerId || !myUid) return;
    return chatService.subscribeToMessages(customerId, providerId, myUid, (msg) => {
      let isNewIncoming = false;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === msg.id);
        if (idx === -1) {
          isNewIncoming = true;
          return [...prev, msg];
        }
        const next = [...prev];
        next[idx] = msg;
        return next;
      });
      // A message arriving while the chat is open still bumps my unread counter
      // server-side — clear it again (only for new incoming INSERTs, not offer updates).
      if (isNewIncoming) {
        chatService.markConversationRead(customerId, providerId).catch(() => {});
      }
    });
  }, [customerId, providerId, myUid]);

  // draftMessage: the first message from StartJobChatSheet, only if sending it failed.
  const [msgText, setMsgText] = useState(draftMessage ?? '');

  // A new request is one-sided until the provider answers: the customer can't send more until then.
  const awaitingProviderResponse =
    role === 'customer' && !!linkJobId && liveJobStatus === 'pending' && !messages.some((m) => m.from === 'other');
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  // Block / report. Being blocked locks the composer like composerLocked.
  const [menuOpen, setMenuOpen] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ChatReportReason | null>(null);
  const [reportDetails, setReportDetails] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  useEffect(() => {
    blockService.isBlockedByMe(chatId).then(setBlockedByMe).catch(() => {});
  }, [chatId]);
  const toggleBlock = async () => {
    if (blockBusy) return;
    setBlockBusy(true);
    try {
      if (blockedByMe) await blockService.unblock(chatId);
      else await blockService.block(chatId);
      setBlockedByMe(!blockedByMe);
      setMenuOpen(false);
    } catch {
      Alert.alert('ვერ მოხერხდა', 'სცადეთ თავიდან.');
    } finally {
      setBlockBusy(false);
    }
  };
  const submitReport = async () => {
    if (!reportReason || reportSending || (reportReason === 'other' && !reportDetails.trim())) return;
    setReportSending(true);
    try {
      await blockService.reportUser(chatId, reportReason, reportDetails.trim() || undefined);
      setReportDone(true);
    } catch {
      Alert.alert('ვერ მოხერხდა', 'შეტყობინების გაგზავნა ვერ მოხერხდა. სცადეთ თავიდან.');
    } finally {
      setReportSending(false);
    }
  };
  const closeReport = () => {
    setReportOpen(false);
    setReportReason(null);
    setReportDetails('');
    setReportDone(false);
  };
  const composerLocked = awaitingProviderResponse || blockedByMe;
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [offerSheetOpen, setOfferSheetOpen] = useState(false);
  // Accepting a chat offer also selects this Provider (respond_to_chat_offer
  // -> assign_job_provider) and closes the job to everyone else — confirm first.
  const [acceptOfferId, setAcceptOfferId] = useState<string | null>(null);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerComment, setOfferComment] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  // Real bottom inset; SafeAreaView reserves only `top` (see the composer).
  const insets = useSafeAreaInsets();

  // Keep the latest message visible when the keyboard opens.
  useEffect(() => {
    const sub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  // Price status banner — from the latest offer message.
  const latestOffer = [...messages].reverse().find((m) => m.type === 'offer');
  const offerStatusText = !latestOffer
    ? null
    : latestOffer.offerStatus === 'accepted'
      ? `ფასი შეთანხმებულია: ${latestOffer.amount} ₾`
      : latestOffer.offerStatus === 'declined'
        ? 'ფასი უარყოფილია'
        : latestOffer.from === 'me'
          ? `თქვენი შეთავაზება: ${latestOffer.amount} ₾`
          : `შეთავაზებული ფასი: ${latestOffer.amount} ₾`;

  const sendMsg = () => {
    const text = msgText.trim();
    if (!text || composerLocked) return;
    const id = `new-${Date.now()}`;
    setMessages((prev) => [...prev, { id, type: 'text', from: 'me', text, t: 'ახლა', state: 'sending', jobId: linkJobId }]);
    setMsgText('');
    if (!customerId || !providerId || !myUid) return;
    chatService
      .sendRealMessage(customerId, providerId, myUid, text, linkJobId)
      .then((real) => {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...real, state: 'sent' } : m)));
      })
      .catch(() => {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, state: 'failed' } : m)));
      });
  };

  const pickAndSendImage = async (source: 'camera' | 'library') => {
    setAttachSheetOpen(false);
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (result.canceled || !result.assets[0]) return;
    const localUri = result.assets[0].uri;

    const id = `img-${Date.now()}`;
    setMessages((prev) => [...prev, { id, type: 'image', from: 'me', imageUrl: localUri, t: 'ახლა', state: 'sending', jobId: linkJobId }]);

    if (!customerId || !providerId || !myUid) return;
    try {
      const privateReference = await storageService.uploadPrivateChatImage( customerId, providerId, myUid, localUri, );
      const real = await chatService.sendRealImage(customerId, providerId, myUid, privateReference, linkJobId);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...real, state: 'sent' } : m)));
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, state: 'failed' } : m)));
    }
  };

  const sendOffer = () => {
    const amount = parseInt(offerAmount, 10);
    // linkJobId (route param or guessed), not route.params.jobId — that is missing when opened from the chat list.
    if (!amount || amount <= 0 || !linkJobId) return;
    const id = `offer-${Date.now()}`;
    const comment = offerComment.trim() || undefined;
    setMessages((prev) => [
      ...prev,
      {
        id,
        type: 'offer',
        from: 'me',
        t: 'ახლა',
        state: 'sending',
        amount,
        comment,
        offerStatus: 'pending',
        jobId: linkJobId,
      },
    ]);
    setOfferSheetOpen(false);
    setOfferAmount('');
    setOfferComment('');
    if (!customerId || !providerId || !myUid) return;
    chatService
      .sendRealOffer(customerId, providerId, myUid, amount, comment, linkJobId)
      .then((real) => {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...real, state: 'sent' } : m)));
      })
      .catch(() => {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, state: 'failed' } : m)));
      });
  };

  // Retry re-sends for real. retryingRef is a synchronous guard: two fast taps
  // in one render both still see 'failed' in state.
  const retryingRef = useRef<Set<string>>(new Set());
  const retryMsg = async (id: string) => {
    if (retryingRef.current.has(id) || !customerId || !providerId || !myUid) return;
    const msg = messages.find((m) => m.id === id);
    if (!msg || msg.state !== 'failed') return;
    retryingRef.current.add(id);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, state: 'sending' } : m)));
    try {
      let real: ChatMsg;
      if (msg.type === 'text') {
        real = await chatService.sendRealMessage(customerId, providerId, myUid, msg.text ?? '', msg.jobId);
      } else if (msg.type === 'offer') {
        if (!msg.jobId) throw new Error('Offer message is missing jobId');
        real = await chatService.sendRealOffer(customerId, providerId, myUid, msg.amount ?? 0, msg.comment, msg.jobId);
      } else if (msg.type === 'image') {
        // If the upload succeeded and only the insert failed, imageUrl is already remote — don't upload again.
       let uploadedUrl = msg.imageUrl ?? '';

if (
  uploadedUrl &&
  !/^https?:\/\//.test(uploadedUrl) &&
  !storageService.isPrivateReference(uploadedUrl)
) {
  uploadedUrl = await storageService.uploadPrivateChatImage(
    customerId,
    providerId,
    myUid,
    uploadedUrl,
  );
}
        real = await chatService.sendRealImage(customerId, providerId, myUid, uploadedUrl, msg.jobId);
      } else {
        retryingRef.current.delete(id);
        return;
      }
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...real, state: 'sent' } : m)));
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, state: 'failed' } : m)));
    } finally {
      retryingRef.current.delete(id);
    }
  };

  const acceptOffer = acceptOfferId ? messages.find((m) => m.id === acceptOfferId) : undefined;

  const respondToOffer = (id: string, offerStatus: 'accepted' | 'declined') => {
    const previous = messages.find((m) => m.id === id)?.offerStatus;
    const msgJobId = messages.find((m) => m.id === id)?.jobId;
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, offerStatus } : m)));
    chatService
      .respondToRealOffer(id, offerStatus)
      .then(() => {
        // Accepting selects the provider server-side; sync JobStatusContext right away.
        if (offerStatus === 'accepted' && msgJobId) {
          setStatus(msgJobId, 'active');
        }
      })
      .catch((e) => {
        // The RPC can reject (e.g. the job was assigned meanwhile) — roll back the optimistic update.
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, offerStatus: previous } : m)));
        const expired = ((e as { message?: string } | null)?.message ?? '').includes('OFFER_EXPIRED');
        Alert.alert(
          'ვერ მოხერხდა',
          expired
            ? 'ეს შეთავაზება 7 დღეზე ძველია და აღარ მოქმედებს — სთხოვეთ ოსტატს ახალი შეთავაზება.'
            : 'ფასზე პასუხის გაგზავნა ვერ მოხერხდა — სცადე თავიდან.',
        );
      });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.foreground} />
        </Pressable>
        <Avatar initials={initials} color={color} size={38} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerName} numberOfLines={1}>
            {name}
          </Text>
          {/* Link to the job whenever the chat has a job context. */}
          {linkJobId && (
            <Pressable style={styles.headerJobLink} onPress={handleOpenJobDetail} hitSlop={6}>
              <Text style={styles.headerJobLinkText} numberOfLines={1}>
                დეტ. ნახვა
              </Text>
              <ChevronRight size={12} color={colors.primary} />
            </Pressable>
          )}
        </View>
        <Pressable testID="chat-menu-button" style={styles.backButton} onPress={() => setMenuOpen(true)}>
          <MoreVertical size={16} color={colors.foreground} />
        </Pressable>
      </View>

      {blockedByMe && (
        <View style={styles.awaitingBanner}>
          <AlertCircle size={16} color={colors.warning} />
          <Text style={styles.awaitingBannerText}>თქვენ დაბლოკეთ ეს მომხმარებელი. შეტყობინებების გასაგრძელებლად განბლოკეთ.</Text>
        </View>
      )}

      {awaitingProviderResponse && (
        <View style={styles.awaitingBanner}>
          <AlertCircle size={16} color={colors.warning} />
          <Text style={styles.awaitingBannerText}>
            თქვენი მოთხოვნა გაიგზავნა, საუბრის გასაგრძელებლად ოსტატმა უნდა გიპასუხოთ
          </Text>
        </View>
      )}

      {offerStatusText && (
        <View style={styles.jobCard}>
          <View style={styles.offerBannerIcon}>
            <Wallet size={16} color={colors.primary} />
          </View>
          <Text style={styles.jobOfferText} numberOfLines={1}>
            {offerStatusText}
          </Text>
        </View>
      )}

      {/* Job status card with the next action, right in the chat. */}
      {statusCardTitle && (
        <View style={styles.statusCard}>
          <View style={styles.statusCardHeaderRow}>
            <CheckCircle size={16} color={colors.success} />
            <Text style={styles.statusCardTitle}>{statusCardTitle}</Text>
          </View>
          {role === 'provider' && liveJobStatus === 'active' && (
            <Button
              label="სამუშაო დავასრულე"
              loadingLabel="იგზავნება..."
              onPress={markWorkDoneFromChat}
              loading={markingWorkDone}
              style={{ marginTop: spacing.sm + 2 }}
            />
          )}
          {role === 'customer' && liveJobStatus === 'awaiting_customer_confirmation' && (
            <View style={styles.statusCardActionsRow}>
              <Pressable style={styles.statusProblemButton} onPress={() => setProblemSheetOpen(true)}>
                <Text style={styles.statusProblemButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                  პრობლემა მაქვს
                </Text>
              </Pressable>
              <Pressable style={styles.statusConfirmButton} onPress={goToRatingFromChat}>
                <Text style={styles.statusConfirmButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                  დადასტურება
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* 'height' on Android: edge-to-edge makes the native window resize a no-op. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {/* Job summary as the first item of the history, for both sides. */}
          {jobSummary && (
            <View style={styles.jobSummaryCard}>
              <View style={styles.jobSummaryHeaderRow}>
                <CategoryIcon categoryId={jobSummary.category} size={32} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.jobSummaryTitle} numberOfLines={1}>
                    {jobSummary.title}
                  </Text>
                  <Text style={styles.jobSummaryLocation} numberOfLines={1}>
                    {jobSummary.location}
                  </Text>
                </View>
              </View>
              {!!jobSummary.desc && (
                <Text style={styles.jobSummaryDesc} numberOfLines={4}>
                  {jobSummary.desc}
                </Text>
              )}
            </View>
          )}
          {displayMessages.map((m, idx) => {
            if (m.type === 'date') {
              return (
                <View key={m.id} style={styles.dateRow}>
                  <Text style={styles.dateLabel}>{m.label}</Text>
                </View>
              );
            }

            const isMe = m.from === 'me';
            const prevMsg = displayMessages[idx - 1];
            const showSpacing = prevMsg && prevMsg.type !== 'date' && prevMsg.from !== m.from;

            if (m.type === 'completion') {
              return (
                <View key={m.id} style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther, showSpacing && styles.msgSpacing]}>
                  <View style={styles.offerCardWrap}>
                    <View style={[styles.offerCard, { borderColor: colors.success }]}>
                      <View style={styles.offerHeaderRow}>
                        <View style={[styles.offerIcon, { backgroundColor: colors.muted }]}>
                          <CheckCircle size={15} color={colors.success} />
                        </View>
                        <Text style={styles.offerLabel}>სამუშაო დასრულებულია</Text>
                      </View>
                      <Text style={styles.offerComment}>
                        {role === 'customer'
                          ? 'ოსტატმა სამუშაო დასრულებულად მონიშნა — გთხოვთ, დაადასტუროთ განცხადების გვერდიდან.'
                          : 'დასრულება გაიგზავნა — ველოდებით მომხმარებლის დადასტურებას.'}
                      </Text>
                      <Pressable
                        style={[styles.offerAcceptButton, { flex: 0, marginTop: spacing.md }]}
                        onPress={() => {
                          const target = m.jobId ?? linkJobId;
                          if (!target) return;
                          if (role === 'customer') navigation.navigate('CustomerJobDetail', { jobId: target });
                          else navigation.navigate('ProviderJobDetail', { id: target });
                        }}
                      >
                        <Text style={styles.offerAcceptText} numberOfLines={1}>
                          {role === 'customer' ? 'დადასტურება' : 'განცხადების ნახვა'}
                        </Text>
                      </Pressable>
                    </View>
                    <View style={[styles.msgFooter, isMe ? styles.msgFooterMe : styles.msgFooterOther]}>
                      <Text style={styles.msgTime}>{m.t}</Text>
                    </View>
                  </View>
                </View>
              );
            }

            if (m.type === 'offer') {
              const canRespond = role === 'customer' && !isMe && m.offerStatus === 'pending';
              return (
                <View key={m.id} style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther, showSpacing && styles.msgSpacing]}>
                  <View style={styles.offerCardWrap}>
                    <View style={styles.offerCard}>
                      <View style={styles.offerHeaderRow}>
                        <View style={styles.offerIcon}>
                          <Wallet size={15} color={colors.primary} />
                        </View>
                        <Text style={styles.offerLabel}>ფასის შეთავაზება</Text>
                      </View>
                      <Text style={styles.offerAmount}>{m.amount} ₾</Text>
                      {m.comment && <Text style={styles.offerComment}>{m.comment}</Text>}

                      {canRespond ? (
                        <View style={styles.offerActionsRow}>
                          <Pressable style={styles.offerAcceptButton} onPress={() => setAcceptOfferId(m.id)}>
                            <Text style={styles.offerAcceptText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                              დათანხმება
                            </Text>
                          </Pressable>
                          <Pressable style={styles.offerDeclineButton} onPress={() => respondToOffer(m.id, 'declined')}>
                            <Text style={styles.offerDeclineText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                              უარყოფა
                            </Text>
                          </Pressable>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.offerStatusBadge,
                            m.offerStatus === 'accepted' && styles.offerStatusBadgeAccepted,
                            m.offerStatus === 'declined' && styles.offerStatusBadgeDeclined,
                          ]}
                        >
                          {m.offerStatus === 'accepted' && <Check size={12} color={colors.success} strokeWidth={2.5} />}
                          {m.offerStatus === 'declined' && <X size={12} color={colors.destructive} strokeWidth={2.5} />}
                          {m.offerStatus === 'pending' && <Clock size={12} color={colors.mutedForeground} />}
                          {/* A newer offer marks older pending ones 'superseded' (DB trigger) — display only. */}
                          {m.offerStatus === 'superseded' && <Clock size={12} color={colors.mutedForeground} />}
                          <Text
                            style={[
                              styles.offerStatusText,
                              m.offerStatus === 'accepted' && styles.offerStatusTextAccepted,
                              m.offerStatus === 'declined' && styles.offerStatusTextDeclined,
                            ]}
                          >
                            {m.offerStatus === 'accepted' && 'ფასი დათანხმებულია'}
                            {m.offerStatus === 'declined' && 'ფასი უარყოფილია'}
                            {m.offerStatus === 'pending' && 'ელოდება პასუხს'}
                            {m.offerStatus === 'superseded' && 'მოძველებულია — ახალი შეთავაზება გაიგზავნა'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={[styles.msgFooter, isMe ? styles.msgFooterMe : styles.msgFooterOther]}>
                      <Text style={styles.msgTime}>{m.t}</Text>
                      <MessageStateIcon state={m.state} isMine={isMe} />
                      {m.state === 'failed' && (
                        <Pressable onPress={() => retryMsg(m.id)}>
                          <Text style={styles.retryText}>ხელახლა</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              );
            }

            if (m.type === 'image') {
              return (
                <View key={m.id} style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther, showSpacing && styles.msgSpacing]}>
                  <View>
                    {m.imageUrl ? (
                      <Pressable onPress={() => setImgPreview(m.imageUrl ?? null)}>
                        <SecureStorageImage reference={ m.imageUrl } style={styles.imageMsg} />
                      </Pressable>
                    ) : (
                      <View style={[styles.imageMsg, { backgroundColor: m.imgColor ?? '#DBEAFE' }]}>
                        <ImageIcon size={28} color="rgba(100,116,139,0.6)" />
                      </View>
                    )}
                    <View style={[styles.msgFooter, isMe ? styles.msgFooterMe : styles.msgFooterOther]}>
                      <Text style={styles.msgTime}>{m.t}</Text>
                      <MessageStateIcon state={m.state} isMine={isMe} />
                      {m.state === 'failed' && (
                        <Pressable onPress={() => retryMsg(m.id)}>
                          <Text style={styles.retryText}>ხელახლა</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              );
            }

            return (
              <View key={m.id} style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther, showSpacing && styles.msgSpacing]}>
                <View style={styles.bubbleWrap}>
                  <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
                    <Text style={isMe ? styles.bubbleTextMe : styles.bubbleTextOther}>{m.text}</Text>
                  </View>
                  <View style={[styles.msgFooter, isMe ? styles.msgFooterMe : styles.msgFooterOther]}>
                    <Text style={styles.msgTime}>{m.t}</Text>
                    <MessageStateIcon state={m.state} isMine={isMe} />
                    {m.state === 'failed' && (
                      <Pressable onPress={() => retryMsg(m.id)}>
                        <Text style={styles.retryText}>ხელახლა</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Bottom padding = safe-area inset (top-only SafeAreaView avoids doubling it
           with the keyboard padding); a small floor on phones without a gesture bar. */}
        <View style={[styles.composer, { paddingBottom: insets.bottom > 0 ? insets.bottom + spacing.xs : spacing.sm + 2 }]}>
          <Pressable
            testID="chat-attach-button"
            style={[styles.attachButton, composerLocked && styles.attachButtonDisabled]}
            onPress={() => setAttachSheetOpen(true)}
            disabled={composerLocked}
          >
            <Camera size={17} color={colors.mutedForeground} />
          </Pressable>
          {/* Offer button uses the resolved linkJobId/liveJobStatus, so it works when opened from the chat list too. */}
          {role === 'provider' && linkJobId && liveJobStatus === 'pending' && (
            <Pressable
              testID="chat-offer-open"
              style={styles.attachButton}
              onPress={() => setOfferSheetOpen(true)}
            >
              <Wallet size={17} color={colors.mutedForeground} />
            </Pressable>
          )}
          <View style={styles.textInputWrap}>
            {/* Never toggle `editable` (Android loses focus for good). Sending is blocked
               by the disabled button and an early return in sendMsg instead. */}
            <TextInput
              testID="chat-message-input"
              value={msgText}
              onChangeText={setMsgText}
              placeholder={blockedByMe ? 'მომხმარებელი დაბლოკილია' : awaitingProviderResponse ? 'ოსტატის პასუხს ელოდებით...' : 'დაწერე შეტყობინება...'}
              placeholderTextColor={colors.mutedForeground}
              style={[styles.textInput, composerLocked && styles.textInputLocked]}
              multiline
            />
          </View>
          <Pressable
            testID="chat-send-button"
            style={[styles.sendButton, msgText.trim() && !composerLocked && styles.sendButtonActive]}
            onPress={sendMsg}
            disabled={!msgText.trim() || composerLocked}
          >
            <Send size={15} color={msgText.trim() && !composerLocked ? colors.primaryForeground : colors.mutedForeground} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <BottomSheet visible={attachSheetOpen} onClose={() => setAttachSheetOpen(false)}>
        <Pressable style={styles.attachOption} onPress={() => pickAndSendImage('camera')}>
          <View style={styles.attachOptionIcon}>
            <Camera size={20} color={colors.foreground} />
          </View>
          <Text style={styles.attachOptionText}>ფოტოს გადაღება</Text>
        </Pressable>
        <Pressable style={styles.attachOption} onPress={() => pickAndSendImage('library')}>
          <View style={styles.attachOptionIcon}>
            <ImageIcon size={20} color={colors.foreground} />
          </View>
          <Text style={styles.attachOptionText}>გალერეიდან არჩევა</Text>
        </Pressable>
      </BottomSheet>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <Pressable
          testID="chat-report-user"
          style={styles.attachOption}
          onPress={() => {
            setMenuOpen(false);
            setReportOpen(true);
          }}
        >
          <View style={styles.attachOptionIcon}>
            <AlertCircle size={20} color={colors.foreground} />
          </View>
          <Text style={styles.attachOptionText}>მომხმარებლის დარეპორტება</Text>
        </Pressable>
        <Pressable testID="chat-block-user" style={styles.attachOption} onPress={toggleBlock} disabled={blockBusy}>
          <View style={styles.attachOptionIcon}>
            <Ban size={20} color={colors.destructive} />
          </View>
          <Text style={[styles.attachOptionText, { color: colors.destructive }]}>
            {blockedByMe ? 'განბლოკვა' : 'დაბლოკვა'}
          </Text>
        </Pressable>
      </BottomSheet>

      <BottomSheet visible={reportOpen} onClose={closeReport}>
        {reportDone ? (
          <>
            <Text style={styles.attachOptionText}>რეპორტი მიღებულია, გმადლობთ. განვიხილავთ.</Text>
            <View style={{ height: spacing.md }} />
            <Button label="დახურვა" onPress={closeReport} />
          </>
        ) : (
          <>
            {([
              ['spam', 'სპამი'],
              ['harassment', 'შეურაცხყოფა / შევიწროება'],
              ['inappropriate_content', 'შეუფერებელი შინაარსი'],
              ['scam', 'თაღლითობა'],
              ['other', 'სხვა'],
            ] as [ChatReportReason, string][]).map(([code, label]) => (
              <Pressable key={code} style={styles.attachOption} onPress={() => setReportReason(code)}>
                <View style={styles.attachOptionIcon}>
                  {reportReason === code ? <Check size={18} color={colors.primary} strokeWidth={3} /> : null}
                </View>
                <Text style={styles.attachOptionText}>{label}</Text>
              </Pressable>
            ))}
            {reportReason === 'other' && (
              <TextInput
                value={reportDetails}
                onChangeText={setReportDetails}
                placeholder="აღწერეთ მოკლედ..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                style={styles.textInput}
              />
            )}
            <View style={{ height: spacing.sm }} />
            <Button
              label="გაგზავნა"
              loadingLabel="იგზავნება..."
              onPress={submitReport}
              loading={reportSending}
              disabled={!reportReason || (reportReason === 'other' && !reportDetails.trim())}
            />
          </>
        )}
      </BottomSheet>

      <BottomSheet
        visible={offerSheetOpen}
        onClose={() => {
          setOfferSheetOpen(false);
          setOfferAmount('');
          setOfferComment('');
        }}
      >
        <Text style={styles.sheetTitle}>ფასის შეთავაზება</Text>
        <Text style={styles.sheetSubtitle}>შემკვეთმა უნდა დაადასტუროს, სანამ ფასი ძალაში შევა.</Text>
        <Text style={styles.offerAmountLabel}>შეთავაზებული ფასი</Text>
        <View style={styles.offerAmountInputWrap}>
          <TextInput
            value={offerAmount}
            onChangeText={(t) => setOfferAmount(t.replace(/[^0-9]/g, ''))}
            placeholder="ჩაწერეთ თანხა"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            style={styles.offerAmountInput}
          />
          <Text style={styles.offerAmountSuffix}>₾</Text>
        </View>
        <TextInput
          value={offerComment}
          onChangeText={setOfferComment}
          placeholder="კომენტარი (არასავალდებულო)"
          placeholderTextColor={colors.mutedForeground}
          style={styles.offerCommentInput}
          multiline
        />
        <Button
          label="გაგზავნა"
          onPress={sendOffer}
          disabled={!offerAmount || parseInt(offerAmount, 10) <= 0}
        />
      </BottomSheet>

      <BottomSheet visible={!!acceptOfferId} onClose={() => setAcceptOfferId(null)}>
        <Text style={styles.sheetTitle}>
          ფასზე დათანხმება{acceptOffer?.amount ? `: ${acceptOffer.amount} ₾` : ''}
        </Text>
        <Text style={styles.sheetSubtitle}>
          {acceptOffer?.jobId
            ? 'დათანხმებით ამ ოსტატს აირჩევთ სამუშაოსთვის — განცხადება სხვა ოსტატებისთვის დაიხურება.'
            : 'დარწმუნებული ხართ, რომ ეთანხმებით ამ ფასს?'}
        </Text>
        <Button
          testID="accept-offer-confirm"
          label="დათანხმება"
          onPress={() => {
            const id = acceptOfferId;
            setAcceptOfferId(null);
            if (id) respondToOffer(id, 'accepted');
          }}
        />
        <Button label="გაუქმება" variant="text" onPress={() => setAcceptOfferId(null)} />
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
            <Pressable
              key={opt}
              style={[styles.problemOption, on && styles.problemOptionOn]}
              onPress={() => setProblemOption(opt)}
            >
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
          onPress={submitProblemFromChat}
          disabled={!problemOption || (problemOption === 'სხვა' && !problemOther.trim())}
          loading={reportingProblem}
          style={{ marginTop: spacing.sm }}
        />
      </BottomSheet>

      {imgPreview && (
        <Pressable style={styles.previewOverlay} onPress={() => setImgPreview(null)}>
          <SecureStorageImage reference={imgPreview} style={styles.previewImage} resizeMode="cover"/>
          <Pressable style={styles.previewClose} onPress={() => setImgPreview(null)}>
            <X size={18} color="#FFFFFF" />
          </Pressable>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

function MessageStateIcon({ state, isMine }: { state?: MsgState; isMine: boolean }) {
  if (!isMine || !state) return null;
  if (state === 'sending') {
    return <ActivityIndicator size="small" color={colors.primary} style={{ transform: [{ scale: 0.5 }], marginLeft: 4 }} />;
  }
  if (state === 'failed') {
    return <AlertCircle size={10} color={colors.destructive} style={{ marginLeft: 4 }} />;
  }
  if (state === 'read') {
    return (
      <View style={{ flexDirection: 'row', marginLeft: 4, gap: -4 }}>
        <Check size={10} color="#93C5FD" strokeWidth={2.5} />
        <Check size={10} color="#93C5FD" strokeWidth={2.5} style={{ marginLeft: -6 }} />
      </View>
    );
  }
  return <Check size={10} color="#93C5FD" strokeWidth={2.5} style={{ marginLeft: 4 }} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
  },
  headerJobLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  headerJobLinkText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '600',
  },
  jobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  jobSummaryCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignSelf: 'stretch',
  },
  jobSummaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    marginBottom: spacing.xs,
  },
  jobSummaryTitle: {
    ...typography.captionMedium,
    color: colors.foreground,
    fontWeight: '700',
  },
  jobSummaryLocation: {
    ...typography.small,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  jobSummaryDesc: {
    ...typography.small,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  awaitingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.warningBackground,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  awaitingBannerText: {
    ...typography.small,
    color: colors.warning,
    fontWeight: '600',
    flex: 1,
  },
  offerBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobOfferText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '700',
    flexShrink: 1,
  },
  statusCard: {
    backgroundColor: colors.successBackground,
    borderBottomWidth: 1,
    borderBottomColor: '#A7F3D0',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  statusCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusCardTitle: {
    ...typography.small,
    color: colors.success,
    fontWeight: '700',
    flexShrink: 1,
  },
  statusCardActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm + 2,
  },
  statusProblemButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  statusProblemButtonText: {
    ...typography.small,
    color: colors.foreground,
    fontWeight: '700',
  },
  statusConfirmButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  statusConfirmButtonText: {
    ...typography.small,
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
  messages: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  dateRow: {
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
  },
  dateLabel: {
    ...typography.small,
    color: colors.mutedForeground,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  msgRow: {
    flexDirection: 'row',
  },
  msgRowMe: {
    justifyContent: 'flex-end',
  },
  msgRowOther: {
    justifyContent: 'flex-start',
  },
  msgSpacing: {
    marginTop: spacing.sm + 2,
  },
  bubbleWrap: {
    maxWidth: '80%',
  },
  bubble: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm + 6,
    paddingVertical: spacing.sm + 2,
  },
  bubbleMe: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleTextMe: {
    ...typography.caption,
    color: colors.primaryForeground,
  },
  bubbleTextOther: {
    ...typography.caption,
    color: colors.foreground,
  },
  msgFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    paddingHorizontal: 4,
  },
  msgFooterMe: {
    justifyContent: 'flex-end',
  },
  msgFooterOther: {
    justifyContent: 'flex-start',
  },
  msgTime: {
    fontSize: 10,
    color: colors.mutedForeground,
  },
  retryText: {
    fontSize: 10,
    color: colors.destructive,
    fontWeight: '600',
    marginLeft: 6,
  },
  imageMsg: {
    width: 160,
    height: 120,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerCardWrap: {
    // minWidth must stay below 85% of the narrowest screen, or it overrides maxWidth.
    maxWidth: '85%',
    minWidth: 200,
  },
  offerCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  offerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  offerIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerLabel: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '700',
  },
  offerAmount: {
    ...typography.h2,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  offerComment: {
    ...typography.small,
    color: colors.mutedForeground,
    marginBottom: spacing.sm + 2,
  },
  offerActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  offerDeclineButton: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  offerDeclineText: {
    ...typography.small,
    color: colors.foreground,
    fontWeight: '700',
  },
  offerAcceptButton: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  offerAcceptText: {
    ...typography.small,
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  offerStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: colors.muted,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    marginTop: spacing.xs,
  },
  offerStatusBadgeAccepted: {
    backgroundColor: colors.successBackground,
  },
  offerStatusBadgeDeclined: {
    backgroundColor: colors.dangerBackground,
  },
  offerStatusText: {
    ...typography.small,
    flexShrink: 1,
    color: colors.mutedForeground,
    fontWeight: '700',
  },
  offerStatusTextAccepted: {
    color: colors.success,
  },
  offerStatusTextDeclined: {
    color: colors.destructive,
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
  offerAmountLabel: {
    ...typography.small,
    color: colors.mutedForeground,
    fontWeight: '700',
    marginBottom: spacing.xs + 2,
  },
  offerAmountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  offerAmountInput: {
    ...typography.bodyMedium,
    color: colors.foreground,
    flex: 1,
    padding: 0,
  },
  offerAmountSuffix: {
    ...typography.bodyMedium,
    color: colors.mutedForeground,
    fontWeight: '700',
  },
  offerCommentInput: {
    ...typography.caption,
    color: colors.foreground,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.sm + 4,
    paddingTop: spacing.sm + 2,
    // paddingBottom is set inline (safe-area aware).
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachButtonDisabled: {
    opacity: 0.5,
  },
  textInputWrap: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm + 6,
    paddingVertical: spacing.sm,
    minHeight: 38,
    justifyContent: 'center',
  },
  textInput: {
    ...typography.caption,
    color: colors.foreground,
    maxHeight: 100,
    padding: 0,
  },
  textInputLocked: {
    color: colors.mutedForeground,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: colors.primary,
  },
  attachOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  attachOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachOptionText: {
    ...typography.bodyMedium,
    color: colors.foreground,
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
});
