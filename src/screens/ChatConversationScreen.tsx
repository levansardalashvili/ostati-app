import React, { useEffect, useRef, useState } from 'react';
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

// D2 — საუბრის ეკრანი (product-spec.md; დიზაინის რეფერენსის
// ChatConversation-ის მიხედვით). D3 — ფასის შეთანხმების სტრუქტურირებული
// ბარათი (product-spec.md-ის დაფიქსირებული წესი #2) — ზიპში რეფერენსი არ
// არსებობდა, აქედან გამომდინარე დიზაინი თავიდან შემუშავდა. Provider
// აგზავნის შეთავაზებას ცალკე ბარათის სახით (არა თავისუფალი ტექსტით),
// Customer ეთანხმება/უარყოფს პირდაპირ ბარათიდან — ორივე მოქმედება რეალურად
// Supabase-ის `messages` ცხრილშია (#66/#73). "დათანხმებაზე" `respond_to_chat_offer()`
// RPC ატომურად ასრულებს Provider-ის არჩევასაც (`job_posts.provider_id`/
// `agreed_price`/`status='active'`) — იგივე `assign_job_provider()` ლოგიკა,
// რასაც `select_provider()` იძახებს Job Detail-ის ეკრანზე — Customer-ს
// აღარ სჭირდება იქ დაბრუნება იმავე Provider-ის ხელახლა ასარჩევად. ჯერ-ის
// ბანერზე "სამუშაოს დეტალების ნახვა" (jobId-ის არსებობისას) იხსნის
// შესაბამის Job Detail ეკრანს პირდაპირ ჩატიდან.
export function ChatConversationScreen({ navigation, route }: Props) {
  const { chatId, name, initials, color, role, jobId, draftMessage } = route.params;
  // ყველა navigation call site (#71) რეალურ Supabase UUID-ს გადასცემს
  // chatId-ად (მეორე მხარის auth.users.id) — mock chat-ის კუნძული
  // მთლიანად წაშლილია, ეს ეკრანი აღარ საჭიროებს mock/real branching-ს.
  const myUid = authService.getCurrentUser()?.uid ?? null;
  const customerId = role === 'customer' ? myUid : chatId;
  const providerId = role === 'provider' ? myUid : chatId;
  const { getStatus, setStatus } = useJobStatus();

  // Task — `jobId` route param-ად მოდის მხოლოდ job-კონკრეტული შესვლის
  // წერტილებიდან (Job Detail/Feed ეკრანები). `ChatsListScreen`-იდან
  // გახსნისას საერთოდ არ არსებობს (conversations job-თან არ არის
  // დაკავშირებული, #57) — ეს `useEffect` best-effort ავსებს ამ ხარვეზს
  // `findLatestSharedJobId()`-ით, მხოლოდ header-ის "დეტ. ნახვა" ბმულისთვის
  // (composer-ის Wallet-ღილაკის `jobId && jobStatus==='pending'` პირობას
  // არ ეხება — ეს კვლავ მხოლოდ ცალსახა, route param-ად გადმოცემულ
  // jobId/jobStatus-ზეა, არა ამ auto-resolved მნიშვნელობაზე).
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

  // Task — job-ის დასრულების ნაკადი (Provider-ის "სამუშაო დავასრულე",
  // Customer-ის "დადასტურება"/"პრობლემა მაქვს") ახლა ჩატშივეა
  // ხელმისაწვდომი, "დეტ. ნახვა"-ზე გავლის გარეშე. `route.params.jobStatus`
  // (მხოლოდ composer-ის Wallet-ღილაკისთვის, route-ის მომენტის snapshot-ია)
  // ამ ბარათისთვის არასაკმარისია — ეს ერთხელ fetch-დება mount-ზე, ხოლო
  // ამ ჩატშივე შესრულებული მოქმედებებისთვის (offer-ის დათანხმება,
  // "სამუშაო დავასრულე") `JobStatusContext`-ის ლოკალური cache-ი (`getStatus`)
  // მყისიერად override-ავს — ზუსტად იმ პრინციპით, რასაც Job Detail
  // ეკრანებიც იყენებენ (`getStatus(id) ?? job.status`).
  const [fetchedJobStatus, setFetchedJobStatus] = useState<JobStatus | null>(null);
  // task: job-ის რეზიუმე ჩატშივე, სტრუქტურირებული ბარათის სახით (იგივე
  // "ჩატი-ს დასაწყისში, ისტორიის ნაწილად" პრინციპი, რასაც ფასის
  // შეთავაზების ბარათი უკვე იყენებს) — რომ Provider-მაც და Customer-მაც
  // job-ის კონტექსტი ჩატის დასაწყისშივე დაინახონ, "დეტ. ნახვა"-ზე
  // გადასვლის/ისტორიაში ზემოთ ატსქროლვის გარეშე.
  //
  // Audit fix (მეორე რაუნდი) — `location` პირველად სულ ამოვიღე, მაგრამ
  // ეს არასწორი მიდგომა იყო: მოთხოვნა არასდროს ყოფილა "location არავის
  // ეჩვენოს", არამედ **იგივე დამტკიცებული მასკირების წესის** დაცვა
  // (#47/#97), რომელიც ეს ველი უკვე ჰქონდა. ის აქ ბრუნდება, მაგრამ
  // **წყაროც უცვლელია** — `role==='provider'`-ისთვის `FeedJob.location`,
  // რომელსაც `get_feed_job_by_id()` RPC (0052) **სერვერზევე** მასკირებს
  // area_label-ზე, სანამ `jp.provider_id <> auth.uid()` (ანუ ეს
  // კონკრეტული Provider ჯერ არ არჩეულა): `case when v_uid=jp.customer_id
  // or v_uid=jp.provider_id then jp.address else area_label end`. ეს
  // "არჩევა" ატომურადვე ხდება ფასის დადასტურებასთან ერთად
  // (`select_provider()`/`respond_to_chat_offer()` ერთსა და იმავე
  // ტრანზაქციაში წერს provider_id-საც და agreed_price-საც) — ანუ "ფასზე
  // დადასტურებამდე მისამართი არ ჩანდეს" ზუსტად ის წესია, რასაც ეს RPC
  // უკვე უზრუნველყოფს, client-ს არაფრის დამატება არ სჭირდება. Customer-ის
  // მხარეს (`getJobPostById`/`CustomerJob.address`) კი ეს **საკუთარი**
  // მისამართია (RLS owner-only) — ყოველთვის ნამდვილი, ჩვეულებრივი, ისევე
  // როგორც PostJob/Job Detail ეკრანებზეც უცვლელად ჩანს.
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

  // Provider — "სამუშაო დავასრულე", ProviderJobDetailScreen-ის `markWorkDone`-ის
  // იგივე RPC/error-handling (`SCHEDULED_TIME_NOT_REACHED`, #91).
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

  // Customer — "დადასტურება" პირდაპირ RatingScreen-ზე გადადის (შეფასება
  // სავალდებულოა, #6/#47/#18-ის დაფიქსირებული წესი — ჩატში მისი სრული
  // ჩაშენება scope-ს სცდება). `name`/`initials`/`color` route param-ები
  // Customer-ის ჩატში უკვე Provider-ის საკუთარი ინფოა (`chatId===providerId`).
  const goToRatingFromChat = () => {
    if (!linkJobId) return;
    navigation.navigate('RatingScreen', {
      jobId: linkJobId,
      providerName: name,
      providerInitials: initials,
      providerColor: color,
    });
  };

  // Customer — "პრობლემა მაქვს", CustomerJobDetailScreen-ის problem-sheet-ის
  // ზუსტი ანარეკლი (იგივე PROBLEM_OPTIONS/RPC), ჩატში ჩაშენებული.
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

  // #73: sendReal*-ს აღარ სჭირდება participants — `messages`-ის INSERT
  // trigger (on_message_insert_notify) მონაწილეთა სახელებს/ინიციალებს
  // პირდაპირ `users`/`provider_profiles`-იდან კითხულობს, სერვერის მხარეს.

  const [messages, setMessages] = useState<ChatMsg[]>([]);

  // ერთ წყვილს რამდენიმე job რომ აქვს, მესიჯები ერთ ჩატში ერევა — როცა
  // ჩატში 2+ განსხვავებული job_id ჩანს, job-ის შეცვლისას გამყოფი ჩნდება
  // (არსებული 'date' ტიპის ხაზი, ახალი ტიპი არ დაგვჭირდა).
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

  // Realtime (#59) — მეორე მხარის ახალი შეტყობინება მაშინვე ემატება, ეკრანის
  // ხელახლა გახსნის გარეშე.
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
      // Chat-fix pass, task 3 — the mount-time markConversationRead()
      // below only covers messages that already existed when the screen
      // opened. If the OTHER participant sends something new while this
      // screen is still open (realtime), the server-side trigger still
      // increments this user's own unread counter (they weren't the
      // sender) even though it's on screen right now — re-clear it here
      // too. `subscribeToMessages` already filters out the caller's own
      // new INSERTs (chatService.ts), so `msg` here is always something
      // genuinely incoming, never an outgoing message being echoed back;
      // `isNewIncoming` additionally excludes UPDATE events (e.g. an
      // offer's accepted/declined status changing) from triggering this,
      // since those aren't "new unread messages".
      if (isNewIncoming) {
        chatService.markConversationRead(customerId, providerId).catch(() => {});
      }
    });
  }, [customerId, providerId, myUid]);

  // StartJobChatSheet.tsx-ის draftMessage — fallback მხოლოდ იმ
  // შემთხვევისთვის, თუ პირველი შეტყობინების ავტომატური გაგზავნა
  // ჩავარდა (ქსელი) — ჩვეულებრივ ცარიელია, რადგან სასურველ შემთხვევაში
  // შეტყობინება ჩატის გახსნამდეც უკვე გაგზავნილია.
  const [msgText, setMsgText] = useState(draftMessage ?? '');

  // მომხმარებლის მოთხოვნა — Customer-ისთვის ცხადი გამაფრთხილებელი
  // ნიშანი, რომ ახალი, job-ზე-დამყარებული მოთხოვნა ჯერ ერთმხრივია:
  // საუბრის ნორმალურად გასაგრძელებლად Provider-მა ჯერ უნდა ნახოს/
  // უპასუხოს. Job კვლავ 'pending'-ია (ჯერ არავინ არჩეულა) და Provider-ს
  // ჯერ არცერთი შეტყობინება არ გაუგზავნია ამ საუბარში — წმინდა
  // client-side derived flag-ია, ახალი RPC/სვეტი არ დასჭირდა.
  const awaitingProviderResponse =
    role === 'customer' && !!linkJobId && liveJobStatus === 'pending' && !messages.some((m) => m.from === 'other');
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [offerSheetOpen, setOfferSheetOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerComment, setOfferComment] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  // Chat-fix pass, task 1 — real bottom safe-area inset (home indicator/
  // gesture bar), not a fixed guess (`SafeAreaView` above only reserves
  // `top`, deliberately — see the composer style comment below for why).
  const insets = useSafeAreaInsets();

  // "message list adjusts correctly" — when the keyboard opens, the
  // ScrollView's own height shrinks (KeyboardAvoidingView's `padding`
  // behavior on iOS, native `windowSoftInputMode="resize"` on Android,
  // app.json), which can leave the latest message hidden behind the
  // now-taller composer/keyboard until the user manually scrolls. Re-run
  // the same scrollToEnd() used for new messages whenever the keyboard
  // shows, on both platforms.
  useEffect(() => {
    const sub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  // ჩატის ზედა ბანერზე ფასის სტატუსი ბოლო 'offer' შეტყობინებიდან
  // გამოითვლება დინამიურად (არა სტატიკური mock ველი) — "მომლოდინე"
  // (offerStatus==='pending'), "თქვენი შეთავაზება"/"შეთავაზებული ფასი"
  // (ვინ გაგზავნა), ან "ფასი შეთანხმებულია"/"ფასი უარყოფილია".
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
    if (!text || awaitingProviderResponse) return;
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
    // Cold-DM reply fix — `linkJobId` (resolved: route param OR
    // `findLatestSharedJobId()`), არა raw route.params.jobId, რომელიც
    // Chats-ის სიიდან/შეტყობინებიდან შესვლისას (StartJobChatSheet-ის
    // ახალი ჩატის ჩათვლით) ყოველთვის undefined იყო — იხ. offer-ის
    // კომპოზერი ღილაკის იგივე ფიქსი ზემოთ.
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

  // Task 2 — Retry ახლა რეალურად ხელახლა უგზავნის შეტყობინებას შესაბამის
  // chatService-ის მეთოდს (ვიზუალურ state-ს ცვლის, real send-ის გარეშე
  // აღარ ვმუშაობთ). `retryingRef` — სინქრონული (არა useState) guard,
  // რომ სწრაფი ორმაგი დაჭერა ერთსა და იმავე render-ში ორივემ ვერ
  // "დაინახოს" ჯერ კიდევ 'failed' state (React-ის state batching-ის
  // გამო `messages`-ის ცვლილება ერთ event handler-ში სინქრონულად ვერ
  // აისახება), ვერც ორმაგი re-send მოხდეს.
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
        // თუ ატვირთვა უკვე მოხერხდა და მხოლოდ insert ჩავარდა, `imageUrl`
        // უკვე რეალური http(s) URL-ია — ხელახლა აღარ ვტვირთავთ (image
        // payload-ის შენარჩუნება). თუ ლოკალური file URI-ღაა, ატვირთვაც
        // ხელახლა სჭირდება.
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

  const respondToOffer = (id: string, offerStatus: 'accepted' | 'declined') => {
    const previous = messages.find((m) => m.id === id)?.offerStatus;
    const msgJobId = messages.find((m) => m.id === id)?.jobId;
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, offerStatus } : m)));
    chatService
      .respondToRealOffer(id, offerStatus)
      .then(() => {
        // Provider selection is now automatic on acceptance
        // (supabase/migrations/0052, respond_to_chat_offer() ->
        // assign_job_provider()) — the Customer no longer has to go back
        // to the job-detail screen and pick the same Provider again.
        // Sync the local cache so screens reading JobStatusContext (not
        // yet re-fetched from Supabase) reflect this immediately too.
        if (offerStatus === 'accepted' && msgJobId) {
          setStatus(msgJobId, 'active');
        }
      })
      .catch(() => {
        // Audit fix — `respond_to_chat_offer()` (0049/0066) legitimately
        // rejects this (e.g. the job stopped being 'pending' between the
        // offer being sent and this tap — the Customer selected a Provider
        // through the normal "select" flow in the meantime). The optimistic
        // update above must be rolled back here, or the UI permanently
        // shows "accepted"/"declined" while the database still has
        // 'pending' — until an unrelated refetch corrects it.
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, offerStatus: previous } : m)));
        Alert.alert('ვერ მოხერხდა', 'ფასზე პასუხის გაგზავნა ვერ მოხერხდა — სცადე თავიდან.');
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
          {/* Task — "დეტ. ნახვა" ლინკი ყოველთვის ჩანს, როცა ჩატს
              job-კონტექსტი აქვს (`linkJobId` — route param-იდან, ან
              best-effort ავტომატურად ამოხსნილი, იხ. ზემოთ), ფასის
              სტატუსის დამოუკიდებლად — ცალკე, სტაბილური შესასვლელია
              job-დეტალებზე (feed-ბარათის "დეტ. ნახვა" ღილაკის იგივე
              ტერმინი, #98-შემდგომი). ქვედა ფასის-ბანერი (offerStatusText)
              ამის დამოუკიდებლად, უცვლელად რჩება — მხოლოდ საინფორმაციო. */}
          {linkJobId && (
            <Pressable style={styles.headerJobLink} onPress={handleOpenJobDetail} hitSlop={6}>
              <Text style={styles.headerJobLinkText} numberOfLines={1}>
                დეტ. ნახვა
              </Text>
              <ChevronRight size={12} color={colors.primary} />
            </Pressable>
          )}
        </View>
        <Pressable style={styles.backButton}>
          <MoreVertical size={16} color={colors.foreground} />
        </Pressable>
      </View>

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

      {/* Task — job-ის lifecycle-სტატუსი (offer-ის ფასის სტატუსისგან
          დამოუკიდებელი) + შესაბამისი მოქმედება, პირდაპირ ჩატში. */}
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

      {/* `behavior: undefined` on Android used to rely entirely on the
          native window resize (`android.softwareKeyboardLayoutMode:
          "resize"`, app.json) to push the composer up when the keyboard
          opens — but Android's edge-to-edge rendering (on by default since
          Expo SDK 52+) makes that native resize silently no-op, so the
          composer (and whatever the user is typing) ended up completely
          hidden behind the keyboard instead of just covered. `'height'`
          shrinks this view by the keyboard's height directly in JS,
          independent of that broken native behavior. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {/* task — job-ის რეზიუმე ისტორიის ნაწილად, ბარათის სახით (ფასის
              შეთავაზების ბარათის იგივე პრინციპი) — ჩანს **ორივე** მხარეს,
              ერთხელ, ისტორიის თავში (ქრონოლოგიურად პირველი) — საუბრის
              გაზრდისას ისტორიაში ზემოთ "იწევს" ჩვეულებრივი შეტყობინების
              მსგავსად, header-ის "დეტ. ნახვა" ბმული კი (უცვლელი) მუდამ
              ხელმისაწვდომია სწრაფი წვდომისთვის, ისტორიის სქროლვის
              გარეშე. */}
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
                          <Pressable style={styles.offerAcceptButton} onPress={() => respondToOffer(m.id, 'accepted')}>
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
                          {/* supabase migration — ახალი offer ავტომატურად
                              "superseded"-ად ნიშნავს იმავე job-ზე იმავე
                              Provider-ის ძველ, ჯერ-კიდევ-pending
                              შეთავაზებებს (DB trigger) — აქ უბრალოდ
                              ვასახავთ, აქცია აღარ სჭირდება (canRespond
                              ისედაც false-ია). */}
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
                      {/* Audit fix — retryMsg() already handled type==='offer'
                          (msg.jobId re-send), but no bubble ever rendered this
                          link for a failed offer — the send-failure dead-ended
                          with no way to recover except reopening the sheet. */}
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
                      {/* Audit fix — same gap as the offer bubble above: image
                          retry was already implemented in retryMsg() but the
                          bubble itself never surfaced a way to trigger it. */}
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

        {/* Chat-fix pass, task 1 — root cause: `paddingBottom: spacing.lg`
            was a fixed guess, not tied to the device's real safe-area
            inset (`edges={['top']}` on the SafeAreaView above deliberately
            does NOT reserve `bottom` itself — if it did, that fixed inset
            padding would stack with KeyboardAvoidingView's own dynamic
            keyboard-height padding once the keyboard opens, leaving an
            extra empty gap above it). `insets.bottom` is 0 on devices with
            no home-indicator/gesture-bar (older phones), where a small
            fixed floor is still wanted for visual breathing room. */}
        <View style={[styles.composer, { paddingBottom: insets.bottom > 0 ? insets.bottom + spacing.xs : spacing.sm + 2 }]}>
          <Pressable
            testID="chat-attach-button"
            style={[styles.attachButton, awaitingProviderResponse && styles.attachButtonDisabled]}
            onPress={() => setAttachSheetOpen(true)}
            disabled={awaitingProviderResponse}
          >
            <Camera size={17} color={colors.mutedForeground} />
          </Pressable>
          {/* Cold-DM reply fix (0077-შემდეგ) — ეს ღილაკი მანამდე მხოლოდ
              route.params-ად პირდაპირ გადმოცემულ jobId/jobStatus-ს
              ენდობოდა, რომელიც მხოლოდ Job Detail/Feed-დან შესვლისას
              არსებობს — Chats-ის სიიდან ან შეტყობინებიდან შესვლისას
              (StartJobChatSheet-ის ახალი "ცივი" ჩატის ჩათვლით) ეს ორივე
              param ყოველთვის undefined იყო, ღილაკი კი საერთოდ არასდროს
              ჩანდა, თუნდაც job რეალურად არსებობდეს და pending იყოს.
              ახლა resolved `linkJobId`/`liveJobStatus`-ს იყენებს — იგივე
              მნიშვნელობებს, რასაც header-ის "დეტ. ნახვა" ბმულიც. */}
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
            {/* Task (მეორე რაუნდი) — `editable={false}`-ის TextInput-ზე
                გადართვა Android-ზე ცნობილად ტოვებდა native EditText-ს
                ფოკუსის-მიღების უუნაროდ, `key`-ის ხელახალი-mount-ითაც კი
                (ეს ცდა არ დაეხმარა) — ველი ისე რჩებოდა, თითქოს
                კლავიატურა "აღარ ჩანდა". ახლა ველი **ყოველთვის
                editable/focusable-ია** (native focus-ის ბაგი ფიზიკურად
                აღარ არსებობს, რადგან `editable` აღარასდროს იცვლება) —
                "სანამ ოსტატი არ უპასუხებს, ვერ გააგზავნი" კი დაცულია
                ორმაგად: (1) გაგზავნის ღილაკი disabled-ია, (2) `sendMsg`
                თავადაც no-op-ია ამ მდგომარეობაში (Enter-კლავიშითაც ვერ
                გვერდის აუვლი). */}
            <TextInput
              testID="chat-message-input"
              value={msgText}
              onChangeText={setMsgText}
              placeholder={awaitingProviderResponse ? 'ოსტატის პასუხს ელოდებით...' : 'დაწერე შეტყობინება...'}
              placeholderTextColor={colors.mutedForeground}
              style={[styles.textInput, awaitingProviderResponse && styles.textInputLocked]}
              multiline
            />
          </View>
          <Pressable
            testID="chat-send-button"
            style={[styles.sendButton, msgText.trim() && !awaitingProviderResponse && styles.sendButtonActive]}
            onPress={sendMsg}
            disabled={!msgText.trim() || awaitingProviderResponse}
          >
            <Send size={15} color={msgText.trim() && !awaitingProviderResponse ? colors.primaryForeground : colors.mutedForeground} />
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
        {/* Chat-fix pass, task 2 — clearer label + a real bordered field
            (was a borderless, centered "hero number" with a vague
            "მიუთითეთ ფასი" placeholder) — same state/validation/RPC call
            underneath, only the wording and input styling changed. */}
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
    // `minWidth` wins over `maxWidth` in RN's layout when they conflict —
    // kept comfortably below `maxWidth: '85%'`'s narrowest realistic value
    // (85% of a 320pt-wide screen, minus this screen's own horizontal
    // padding) so the 85% cap always actually applies, on any device.
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
  // Chat-fix pass, task 2 — a real bordered field ("[ ჩაწერეთ თანხა   ₾ ]"),
  // not the previous borderless, centered large-number display.
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
    // paddingBottom is applied inline (safe-area-aware, see call site) —
    // not a fixed value here.
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
