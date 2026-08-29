import { supabase } from './supabaseClient';
import { notificationService } from './notificationService';
import type { ChatEntry, ChatMsg, OfferStatus } from '../types/chat';
import type { Role } from '../types/user';

// მონაწილის საჩვენებელი ინფო (სახელი/ინიციალები/ფერი) — sendReal*-ის
// ყოველ გამოძახებაზე გადაეცემა, რომ `conversations`-ის (#68) row-ი
// (touchConversation) ყოველთვის განახლდეს უახლესი მონაცემით.
export type ChatParticipants = {
  customerName: string;
  customerInitials: string;
  customerColor: string;
  providerName: string;
  providerInitials: string;
  providerColor: string;
};

export interface ChatService {
  // Supabase-ის `messages` ცხრილი (#57/#59/#66/#68) — ტექსტი, Realtime,
  // structured "offer", სურათი. "საუბრის" იდენტობა ცალკე `conversations`
  // ცხრილის (#68) გარეშეა მოდელირებული — უბრალოდ (customer_id, provider_id)
  // წყვილი, რომ ყველა არსებული "ჩატი" ღილაკის navigation call site
  // უცვლელი დარჩეს (chatId კვლავ "მეორე მხარის id"-ია).
  listRealMessages(customerId: string, providerId: string, myUid: string): Promise<ChatMsg[]>;
  sendRealMessage(
    customerId: string,
    providerId: string,
    senderId: string,
    text: string,
    participants: ChatParticipants,
  ): Promise<ChatMsg>;
  sendRealOffer(
    customerId: string,
    providerId: string,
    senderId: string,
    amount: number,
    comment: string | undefined,
    participants: ChatParticipants,
  ): Promise<ChatMsg>;
  sendRealImage(
    customerId: string,
    providerId: string,
    senderId: string,
    imageUrl: string,
    participants: ChatParticipants,
  ): Promise<ChatMsg>;
  respondToRealOffer(messageId: string, status: Extract<OfferStatus, 'accepted' | 'declined'>): Promise<void>;
  subscribeToMessages(
    customerId: string,
    providerId: string,
    myUid: string,
    onMessage: (msg: ChatMsg) => void,
  ): () => void;

  // `conversations` ცხრილი (#68) — ჩატების სიის (ChatsListScreen) რეალური
  // მონაცემი. ცალკე ცხრილია (არა `messages`-იდან on-the-fly აგრეგირებული),
  // რადგან "ბოლო შეტყობინება + წაუკითხავის რაოდენობა თითო საუბარზე"
  // PostgREST-ის უბრალო query-ით არ გამოითვლება — ინახება/ნახლდება
  // sendReal*-ის მხრიდან, გვერდითი ეფექტის სახით (`touchConversation`).
  listMyConversations(myUid: string, myRole: Role): Promise<ChatEntry[]>;
  markConversationRead(customerId: string, providerId: string, myRole: Role): Promise<void>;

  // Tab-bar-ის წაუკითხავი-ჩატის წითელი წერტილისთვის (CustomerTabs/
  // ProviderTabs) — ნებისმიერი `conversations`-ის row-ის ცვლილებაზე (ახალი
  // შეტყობინება/წაკითხვა) ხელახლა ითვლის და აბრუნებს callback-ს, რომ
  // badge-იც ცოცხალი იყოს, არა მხოლოდ mount-ის მომენტში გამოთვლილი.
  subscribeToUnreadCount(myUid: string, myRole: Role, onChange: (count: number) => void): () => void;
}

type MessageRow = {
  id: string;
  customer_id: string;
  provider_id: string;
  sender_id: string;
  type: 'text' | 'offer' | 'image';
  text: string;
  image_url: string | null;
  amount: number | null;
  comment: string | null;
  offer_status: OfferStatus | null;
  created_at: string;
};

type ConversationRow = {
  customer_id: string;
  provider_id: string;
  customer_name: string;
  customer_initials: string;
  customer_color: string;
  provider_name: string;
  provider_initials: string;
  provider_color: string;
  last_message: string;
  last_message_at: string;
  customer_unread: number;
  provider_unread: number;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'გუშინ';
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  return `${days} დ.`;
}

function fromMessageRow(row: MessageRow, myUid: string): ChatMsg {
  const from = row.sender_id === myUid ? 'me' : 'other';
  const t = formatTime(row.created_at);
  if (row.type === 'offer') {
    return {
      id: row.id,
      type: 'offer',
      from,
      t,
      state: 'read',
      amount: row.amount ?? undefined,
      comment: row.comment ?? undefined,
      offerStatus: row.offer_status ?? 'pending',
    };
  }
  if (row.type === 'image') {
    return { id: row.id, type: 'image', from, t, state: 'read', imageUrl: row.image_url ?? undefined };
  }
  return { id: row.id, type: 'text', from, text: row.text, t, state: 'read' };
}

// `messages`-ის ყოველი გაგზავნის შემდეგ `conversations`-ის row-ს ქმნის ან
// ანახლებს — ბოლო შეტყობინება/დრო/მიმღების წაუკითხავის counter+1. Read-
// modify-write (2 round trip) — მისაღები pragmatism, ამ აპის scale-ზე.
async function touchConversation(
  customerId: string,
  providerId: string,
  senderId: string,
  lastMessage: string,
  p: ChatParticipants,
): Promise<void> {
  const { data: existing } = await supabase
    .from('conversations')
    .select('customer_unread, provider_unread')
    .eq('customer_id', customerId)
    .eq('provider_id', providerId)
    .maybeSingle();
  const isFromCustomer = senderId === customerId;
  const base = {
    customer_id: customerId,
    provider_id: providerId,
    customer_name: p.customerName,
    customer_initials: p.customerInitials,
    customer_color: p.customerColor,
    provider_name: p.providerName,
    provider_initials: p.providerInitials,
    provider_color: p.providerColor,
    last_message: lastMessage,
    last_message_at: new Date().toISOString(),
  };
  if (existing) {
    await supabase
      .from('conversations')
      .update({
        ...base,
        customer_unread: isFromCustomer ? existing.customer_unread : existing.customer_unread + 1,
        provider_unread: isFromCustomer ? existing.provider_unread + 1 : existing.provider_unread,
      })
      .eq('customer_id', customerId)
      .eq('provider_id', providerId);
  } else {
    await supabase.from('conversations').insert({
      ...base,
      customer_unread: isFromCustomer ? 0 : 1,
      provider_unread: isFromCustomer ? 1 : 0,
    });
  }
}

// ახალი შეტყობინების შეტყობინება (#70) — მიმღები ყოველთვის "მეორე მხარეა"
// (არა sender), `ChatConversation`-ის target-ის `chatId` მიმღების
// პერსპექტივიდან sender-ის id-ია (route param-ის იგივე კონვენცია, რასაც
// ყველა "ჩატი" ღილაკი იყენებს).
async function notifySender(
  customerId: string,
  providerId: string,
  senderId: string,
  body: string,
  p: ChatParticipants,
): Promise<void> {
  const isFromCustomer = senderId === customerId;
  const recipientId = isFromCustomer ? providerId : customerId;
  await notificationService.create(recipientId, {
    title: 'ახალი შეტყობინება',
    body,
    iconEmoji: '💬',
    iconBg: '#2563EB',
    target: {
      screen: 'ChatConversation',
      chatId: senderId,
      name: isFromCustomer ? p.customerName : p.providerName,
      initials: isFromCustomer ? p.customerInitials : p.providerInitials,
      color: isFromCustomer ? p.customerColor : p.providerColor,
    },
  });
}

export const chatService: ChatService = {
  async listRealMessages(customerId, providerId, myUid) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('customer_id', customerId)
      .eq('provider_id', providerId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data as MessageRow[]).map((row) => fromMessageRow(row, myUid));
  },
  async sendRealMessage(customerId, providerId, senderId, text, participants) {
    const { data, error } = await supabase
      .from('messages')
      .insert({ customer_id: customerId, provider_id: providerId, sender_id: senderId, type: 'text', text })
      .select()
      .single();
    if (error) throw error;
    await touchConversation(customerId, providerId, senderId, text, participants);
    notifySender(customerId, providerId, senderId, text, participants).catch(() => {});
    return fromMessageRow(data as MessageRow, senderId);
  },
  async sendRealOffer(customerId, providerId, senderId, amount, comment, participants) {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        customer_id: customerId,
        provider_id: providerId,
        sender_id: senderId,
        type: 'offer',
        text: '',
        amount,
        comment: comment ?? null,
        offer_status: 'pending',
      })
      .select()
      .single();
    if (error) throw error;
    const summary = `შეთავაზებული ფასი: ${amount} ₾`;
    await touchConversation(customerId, providerId, senderId, summary, participants);
    notifySender(customerId, providerId, senderId, summary, participants).catch(() => {});
    return fromMessageRow(data as MessageRow, senderId);
  },
  async sendRealImage(customerId, providerId, senderId, imageUrl, participants) {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        customer_id: customerId,
        provider_id: providerId,
        sender_id: senderId,
        type: 'image',
        text: '',
        image_url: imageUrl,
      })
      .select()
      .single();
    if (error) throw error;
    await touchConversation(customerId, providerId, senderId, '📷 ფოტო', participants);
    notifySender(customerId, providerId, senderId, '📷 ფოტო', participants).catch(() => {});
    return fromMessageRow(data as MessageRow, senderId);
  },
  async respondToRealOffer(messageId, status) {
    const { error } = await supabase.from('messages').update({ offer_status: status }).eq('id', messageId);
    if (error) throw error;
  },
  subscribeToMessages(customerId, providerId, myUid, onMessage) {
    const channel = supabase
      .channel(`messages-${customerId}-${providerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `customer_id=eq.${customerId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as MessageRow | undefined;
          if (!row || row.provider_id !== providerId) return;
          if (payload.eventType === 'INSERT' && row.sender_id === myUid) return;
          onMessage(fromMessageRow(row, myUid));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },

  async listMyConversations(myUid, myRole) {
    const column = myRole === 'customer' ? 'customer_id' : 'provider_id';
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq(column, myUid)
      .order('last_message_at', { ascending: false });
    if (error) throw error;
    const isCustomer = myRole === 'customer';
    return (data as ConversationRow[]).map((row) => ({
      id: isCustomer ? row.provider_id : row.customer_id,
      name: isCustomer ? row.provider_name : row.customer_name,
      initials: isCustomer ? row.provider_initials : row.customer_initials,
      color: isCustomer ? row.provider_color : row.customer_color,
      last: row.last_message,
      time: formatTime(row.last_message_at),
      unread: isCustomer ? row.customer_unread : row.provider_unread,
      online: false,
    }));
  },
  async markConversationRead(customerId, providerId, myRole) {
    const patch = myRole === 'customer' ? { customer_unread: 0 } : { provider_unread: 0 };
    await supabase.from('conversations').update(patch).eq('customer_id', customerId).eq('provider_id', providerId);
  },

  subscribeToUnreadCount(myUid, myRole, onChange) {
    const column = myRole === 'customer' ? 'customer_id' : 'provider_id';
    const unreadColumn = myRole === 'customer' ? 'customer_unread' : 'provider_unread';
    const fetchCount = () => {
      supabase
        .from('conversations')
        .select(unreadColumn)
        .eq(column, myUid)
        .then(({ data }) => {
          const rows = (data ?? []) as Record<string, number>[];
          const count = rows.filter((r) => r[unreadColumn] > 0).length;
          onChange(count);
        });
    };
    fetchCount();
    const channel = supabase
      .channel(`conversations-unread-${myUid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `${column}=eq.${myUid}` }, fetchCount)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
};
