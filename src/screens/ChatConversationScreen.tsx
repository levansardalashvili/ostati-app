import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { StatusPill } from '../components/StatusPill';
import { colors, radius, spacing, typography } from '../theme';
import { CATEGORIES } from '../data/categories';
import { CHATS_LIST, CHAT_MESSAGES, ChatMsg, MsgState } from '../data/mockChats';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatConversation'>;

// D2 — საუბრის ეკრანი (product-spec.md; დიზაინის რეფერენსის
// ChatConversation-ის მიხედვით). D3 — ფასის შეთანხმების სტრუქტურირებული
// ბარათი (product-spec.md-ის დაფიქსირებული წესი #2) — ზიპში რეფერენსი არ
// არსებობდა, აქედან გამომდინარე დიზაინი თავიდან შემუშავდა. Provider
// აგზავნის შეთავაზებას ცალკე ბარათის სახით (არა თავისუფალი ტექსტით),
// Customer ეთანხმება/უარყოფს პირდაპირ ბარათიდან. დათანხმებული ფასის
// შენახვა job-ის ჩანაწერში (Firestore) ჯერ არ არის დაკავშირებული —
// ეს ცვლილება ამ ეტაპზე მხოლოდ ჩატის ლოკალურ state-შია.
export function ChatConversationScreen({ navigation, route }: Props) {
  const { chatId, name, initials, color, role } = route.params;
  const chatEntry = CHATS_LIST.find((c) => c.id === chatId);
  const online = chatEntry?.online ?? false;

  const [messages, setMessages] = useState<ChatMsg[]>(() => CHAT_MESSAGES[chatId] ?? []);
  const [msgText, setMsgText] = useState('');
  const [attachSheetOpen, setAttachSheetOpen] = useState(false);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [offerSheetOpen, setOfferSheetOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerComment, setOfferComment] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const jobDetailScreen = role === 'provider' ? 'ProviderJobDetail' : 'CustomerJobDetail';

  const sendMsg = () => {
    const text = msgText.trim();
    if (!text) return;
    const id = `new-${Date.now()}`;
    setMessages((prev) => [...prev, { id, type: 'text', from: 'me', text, t: 'ახლა', state: 'sending' }]);
    setMsgText('');
    setTimeout(() => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, state: 'sent' } : m)));
    }, 800);
  };

  const sendImg = (imgColor: string) => {
    const id = `img-${Date.now()}`;
    setMessages((prev) => [...prev, { id, type: 'image', from: 'me', imgColor, t: 'ახლა', state: 'sending' }]);
    setAttachSheetOpen(false);
    setTimeout(() => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, state: 'sent' } : m)));
    }, 1000);
  };

  const retryMsg = (id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, state: 'sending' } : m)));
    setTimeout(() => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, state: 'sent' } : m)));
    }, 900);
  };

  const sendOffer = () => {
    const amount = parseInt(offerAmount, 10);
    if (!amount || amount <= 0) return;
    const id = `offer-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id,
        type: 'offer',
        from: 'me',
        t: 'ახლა',
        state: 'sending',
        amount,
        comment: offerComment.trim() || undefined,
        offerStatus: 'pending',
      },
    ]);
    setOfferSheetOpen(false);
    setOfferAmount('');
    setOfferComment('');
    setTimeout(() => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, state: 'sent' } : m)));
    }, 800);
  };

  const respondToOffer = (id: string, offerStatus: 'accepted' | 'declined') => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, offerStatus } : m)));
    // TODO: დათანხმებული ფასის შენახვა job-ის ჩანაწერში (Firestore) — job status/price ველი ჯერ არ არსებობს.
  };

  const handleOpenJobDetail = () => {
    if (!chatEntry?.jobId) return;
    if (jobDetailScreen === 'ProviderJobDetail') {
      navigation.navigate('ProviderJobDetail', { id: chatEntry.jobId });
    } else {
      navigation.navigate('CustomerJobDetail', { jobId: chatEntry.jobId });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={18} color={colors.foreground} />
        </Pressable>
        <Avatar initials={initials} color={color} size={38} online={online} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerName} numberOfLines={1}>
            {name}
          </Text>
          {online ? (
            <Text style={styles.headerOnline}>ონლაინ</Text>
          ) : (
            <Text style={styles.headerOffline}>ბოლოს ნახული: გუშინ</Text>
          )}
        </View>
        <Pressable style={styles.backButton}>
          <MoreVertical size={16} color={colors.foreground} />
        </Pressable>
      </View>

      {chatEntry?.jobTitle && (
        <View style={styles.jobCard}>
          <View style={[styles.jobIcon, { backgroundColor: CATEGORIES.find((c) => c.id === chatEntry.jobCategory)?.bg ?? colors.secondary }]}>
            <Text style={{ fontSize: 18 }}>{CATEGORIES.find((c) => c.id === chatEntry.jobCategory)?.icon ?? '🔧'}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.jobTitle} numberOfLines={1}>
              {chatEntry.jobTitle}
            </Text>
            <Text style={styles.jobMeta} numberOfLines={1}>
              {chatEntry.jobDistrict} · {chatEntry.jobDate}
              {chatEntry.jobBudget ? ` · ${chatEntry.jobBudget}` : ''}
            </Text>
          </View>
          <View style={styles.jobActions}>
            {chatEntry.jobStatus && <StatusPill status={chatEntry.jobStatus} />}
            <Pressable onPress={handleOpenJobDetail}>
              <Text style={styles.jobDetailLink}>დეტ. ნახვა</Text>
            </Pressable>
          </View>
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
                    </View>
                  </View>
                </View>
              );
            }

            if (m.type === 'image') {
              return (
                <View key={m.id} style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther, showSpacing && styles.msgSpacing]}>
                  <View>
                    <Pressable
                      style={[styles.imageMsg, { backgroundColor: m.imgColor ?? '#DBEAFE' }]}
                      onPress={() => setImgPreview(m.imgColor ?? '#DBEAFE')}
                    >
                      <ImageIcon size={28} color="rgba(100,116,139,0.6)" />
                    </Pressable>
                    <View style={[styles.msgFooter, isMe ? styles.msgFooterMe : styles.msgFooterOther]}>
                      <Text style={styles.msgTime}>{m.t}</Text>
                      <MessageStateIcon state={m.state} isMine={isMe} />
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

        <View style={styles.composer}>
          <Pressable style={styles.attachButton} onPress={() => setAttachSheetOpen(true)}>
            <Camera size={17} color={colors.mutedForeground} />
          </Pressable>
          {role === 'provider' && (
            <Pressable style={styles.attachButton} onPress={() => setOfferSheetOpen(true)}>
              <Wallet size={17} color={colors.mutedForeground} />
            </Pressable>
          )}
          <View style={styles.textInputWrap}>
            <TextInput
              value={msgText}
              onChangeText={setMsgText}
              placeholder="დაწერე შეტყობინება..."
              placeholderTextColor={colors.mutedForeground}
              style={styles.textInput}
              multiline
            />
          </View>
          <Pressable
            style={[styles.sendButton, msgText.trim() && styles.sendButtonActive]}
            onPress={sendMsg}
            disabled={!msgText.trim()}
          >
            <Send size={15} color={msgText.trim() ? colors.primaryForeground : colors.mutedForeground} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <BottomSheet visible={attachSheetOpen} onClose={() => setAttachSheetOpen(false)}>
        <Pressable style={styles.attachOption} onPress={() => sendImg('#D1FAE5')}>
          <View style={styles.attachOptionIcon}>
            <Camera size={20} color={colors.foreground} />
          </View>
          <Text style={styles.attachOptionText}>ფოტოს გადაღება</Text>
        </Pressable>
        <Pressable style={styles.attachOption} onPress={() => sendImg('#FEF3C7')}>
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
        <Text style={styles.sheetSubtitle}>Customer-მა უნდა დაადასტუროს, სანამ ფასი ძალაში შევა.</Text>
        <View style={styles.offerAmountInputWrap}>
          <TextInput
            value={offerAmount}
            onChangeText={(t) => setOfferAmount(t.replace(/[^0-9]/g, ''))}
            placeholder="მიუთითეთ ფასი"
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
          <View style={[styles.previewImage, { backgroundColor: imgPreview }]} />
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
  headerOnline: {
    ...typography.small,
    color: colors.success,
    fontWeight: '700',
  },
  headerOffline: {
    ...typography.small,
    color: colors.mutedForeground,
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
  jobIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobTitle: {
    ...typography.small,
    color: colors.foreground,
    fontWeight: '700',
  },
  jobMeta: {
    ...typography.small,
    color: colors.mutedForeground,
  },
  jobActions: {
    alignItems: 'flex-end',
    gap: 4,
  },
  jobDetailLink: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '700',
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
  offerAmountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  offerAmountInput: {
    ...typography.h1,
    color: colors.foreground,
    textAlign: 'center',
    minWidth: 80,
    padding: 0,
  },
  offerAmountSuffix: {
    ...typography.h2,
    color: colors.mutedForeground,
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
    paddingBottom: spacing.lg,
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
