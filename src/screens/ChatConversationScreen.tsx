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
import { colors, radius, spacing, typography } from '../theme';
import { authService } from '../services/authService';
import { chatService } from '../services/chatService';
import { storageService } from '../services/storageService';
import type { ChatMsg, MsgState } from '../types/chat';
import type { RootStackParamList } from '../navigation/types';
import { SecureStorageImage } from '../components/SecureStorageImage';


type Props = NativeStackScreenProps<RootStackParamList, 'ChatConversation'>;

// D2 — საუბრის ეკრანი (product-spec.md; დიზაინის რეფერენსის
// ChatConversation-ის მიხედვით). D3 — ფასის შეთანხმების სტრუქტურირებული
// ბარათი (product-spec.md-ის დაფიქსირებული წესი #2) — ზიპში რეფერენსი არ
// არსებობდა, აქედან გამომდინარე დიზაინი თავიდან შემუშავდა. Provider
// აგზავნის შეთავაზებას ცალკე ბარათის სახით (არა თავისუფალი ტექსტით),
// Customer ეთანხმება/უარყოფს პირდაპირ ბარათიდან — ორივე მოქმედება რეალურად
// Supabase-ის `messages` ცხრილშია (#66/#73). დათანხმებული ფასი job-ის
// ჩანაწერში (`job_posts.agreed_price`) ჯერ მხოლოდ Provider-ის არჩევის
// მომენტში იწერება (`select_provider()` RPC, #72) — ჩატში დათანხმებული
// ფასის ამ ველში ავტომატურად ასახვა ცალკე, დარჩენილი ეტაპია.
export function ChatConversationScreen({ navigation, route }: Props) {
  const { chatId, name, initials, color, role, jobId, jobStatus } = route.params;
  // ყველა navigation call site (#71) რეალურ Supabase UUID-ს გადასცემს
  // chatId-ად (მეორე მხარის auth.users.id) — mock chat-ის კუნძული
  // მთლიანად წაშლილია, ეს ეკრანი აღარ საჭიროებს mock/real branching-ს.
  const myUid = authService.getCurrentUser()?.uid ?? null;
  const customerId = role === 'customer' ? myUid : chatId;
  const providerId = role === 'provider' ? myUid : chatId;

  // #73: sendReal*-ს აღარ სჭირდება participants — `messages`-ის INSERT
  // trigger (on_message_insert_notify) მონაწილეთა სახელებს/ინიციალებს
  // პირდაპირ `users`/`provider_profiles`-იდან კითხულობს, სერვერის მხარეს.

  const [messages, setMessages] = useState<ChatMsg[]>([]);

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

  const [msgText, setMsgText] = useState('');
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
    if (!text) return;
    const id = `new-${Date.now()}`;
    setMessages((prev) => [...prev, { id, type: 'text', from: 'me', text, t: 'ახლა', state: 'sending' }]);
    setMsgText('');
    if (!customerId || !providerId || !myUid) return;
    chatService
      .sendRealMessage(customerId, providerId, myUid, text)
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
    setMessages((prev) => [...prev, { id, type: 'image', from: 'me', imageUrl: localUri, t: 'ახლა', state: 'sending' }]);

    if (!customerId || !providerId || !myUid) return;
    try {
      const privateReference = await storageService.uploadPrivateChatImage( customerId, providerId, myUid, localUri, );
      const real = await chatService.sendRealImage( customerId, providerId, myUid, privateReference,);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...real, state: 'sent' } : m)));
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, state: 'failed' } : m)));
    }
  };

  const sendOffer = () => {
    const amount = parseInt(offerAmount, 10);
    // Second hardening pass, item 5 — ყოველ offer-ს job_id სჭირდება
    // (supabase/migrations/0049); route.params.jobId Provider-ის ყველა
    // ლეგიტიმური შესვლის წერტილიდან ხელთაა (ProviderJobDetailScreen/
    // ProviderHomeScreen/ProviderJobFeedScreen) — offer-ის კომპოზერი
    // ღილაკიც ჩანს მხოლოდ, როცა jobId არსებობს (footer-ის JSX).
    if (!amount || amount <= 0 || !jobId) return;
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
        jobId,
      },
    ]);
    setOfferSheetOpen(false);
    setOfferAmount('');
    setOfferComment('');
    if (!customerId || !providerId || !myUid) return;
    chatService
      .sendRealOffer(customerId, providerId, myUid, amount, comment, jobId)
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
        real = await chatService.sendRealMessage(customerId, providerId, myUid, msg.text ?? '');
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
        real = await chatService.sendRealImage(customerId, providerId, myUid, uploadedUrl);
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
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, offerStatus } : m)));
    chatService.respondToRealOffer(id, offerStatus).catch(() => {
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
    // შენიშვნა: დათანხმებული ფასის job-ის ჩანაწერში (job_posts) შენახვა
    // ცალკე, დარჩენილი ეტაპია — job_posts-ს ჯერ არ აქვს დათანხმებული
    // ფასის ველი.
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
        </View>
        <Pressable style={styles.backButton}>
          <MoreVertical size={16} color={colors.foreground} />
        </Pressable>
      </View>

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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m, idx) => {
            if (m.type === 'date') {
              return (
                <View key={m.id} style={styles.dateRow}>
                  <Text style={styles.dateLabel}>{m.label}</Text>
                </View>
              );
            }

            const isMe = m.from === 'me';
            const prevMsg = messages[idx - 1];
            const showSpacing = prevMsg && prevMsg.type !== 'date' && prevMsg.from !== m.from;

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
                          <Pressable style={styles.offerDeclineButton} onPress={() => respondToOffer(m.id, 'declined')}>
                            <Text style={styles.offerDeclineText}>უარყოფა</Text>
                          </Pressable>
                          <Pressable style={styles.offerAcceptButton} onPress={() => respondToOffer(m.id, 'accepted')}>
                            <Text style={styles.offerAcceptText}>დათანხმება</Text>
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
          <Pressable style={styles.attachButton} onPress={() => setAttachSheetOpen(true)}>
            <Camera size={17} color={colors.mutedForeground} />
          </Pressable>
          {/* Second hardening pass, item 5 — offer-ს job_id სჭირდება
              (supabase/migrations/0049), ამიტომ ღილაკი ჩანს მხოლოდ, როცა
              route.params.jobId არსებობს. Audit fix — დამატებით მხოლოდ
              status='pending'-ზე: Provider-ის არჩევის (select_provider())
              შემდეგ ფასი job_posts.agreed_price-ზეა ჩაკეტილი და
              respond_to_chat_offer() (0049/0066) ისედაც უარყოფდა ახალ
              შეთავაზებას აქტიურ job-ზე — ღილაკი აქამდე მაინც ჩანდა
              (ProviderJobDetailScreen-ის 'active'/'awaiting_confirmation'/
              'disputed' variant-ებზეც), ფასის გაგზავნა კი ყოველთვის
              ჩუმად ვარდებოდა. */}
          {role === 'provider' && jobId && jobStatus === 'pending' && (
            <Pressable style={styles.attachButton} onPress={() => setOfferSheetOpen(true)}>
              <Wallet size={17} color={colors.mutedForeground} />
            </Pressable>
          )}
          <View style={styles.textInputWrap}>
            <TextInput
              testID="chat-message-input"
              value={msgText}
              onChangeText={setMsgText}
              placeholder="დაწერე შეტყობინება..."
              placeholderTextColor={colors.mutedForeground}
              style={styles.textInput}
              multiline
            />
          </View>
          <Pressable
            testID="chat-send-button"
            style={[styles.sendButton, msgText.trim() && styles.sendButtonActive]}
            onPress={sendMsg}
            disabled={!msgText.trim()}
          >
            <Send size={15} color={msgText.trim() ? colors.primaryForeground : colors.mutedForeground} />
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
    maxWidth: '85%',
    minWidth: 220,
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
    marginTop: spacing.xs,
  },
  offerDeclineButton: {
    flex: 1,
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
    width: 320,
    height: 240,
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
