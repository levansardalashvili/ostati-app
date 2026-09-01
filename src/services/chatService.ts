import { supabase } from './supabaseClient';
import type { ChatEntry, ChatMsg, OfferStatus } from '../types/chat';
import type { Role } from '../types/user';

export interface ChatService {
  // Supabase-ის `messages` ცხრილი (#57/#59/#66/#68) — ტექსტი, Realtime,
  // structured "offer", სურათი. "საუბრის" იდენტობა ცალკე `conversations`
  // ცხრილის (#68) გარეშეა მოდელირებული — უბრალოდ (customer_id, provider_id)
  // წყვილი, რომ ყველა არსებული "ჩატი" ღილაკის navigation call site
  // უცვლელი დარჩეს (chatId კვლავ "მეორე მხარის id"-ია).
  //
  // #73 — sendReal*-ს აღარ სჭირდება ChatParticipants პარამეტრი: `messages`-ის
  // insert-ის შემდეგ ყველაფერს (conversations-ის ატომური upsert +
  // მიმღების შეტყობინება) `on_message_insert_notify` trigger აკეთებს
  // ერთსა და იმავე ტრანზაქციაში (supabase/migrations/0020) — ის
  // მონაწილეთა სახელებს/ინიციალებს პირდაპირ `users`/`provider_profiles`-იდან
  // კითხულობს (SECURITY DEFINER), კლიენტის მტკიცებას აღარ ენდობა.
  listRealMessages(customerId: string, providerId: string, myUid: string): Promise<ChatMsg[]>;
  sendRealMessage(customerId: string, providerId: string, senderId: string, text: string): Promise<ChatMsg>;
  // `jobId` — second hardening pass, item 5 (supabase/migrations/0049):
  // ყოველ ფასის შეთავაზებას ახლა თან ახლავს, რომელ job-ს ეხება,
  // `respond_to_chat_offer`-ის (customer_id, provider_id)-დან
  // "გამოცნობის" ნაცვლად.
  sendRealOffer(
    customerId: string,
    providerId: string,
    senderId: string,
    amount: number,
    comment: string | undefined,
    jobId: string,
  ): Promise<ChatMsg>;
  sendRealImage(customerId: string, providerId: string, senderId: string, imageUrl: string): Promise<ChatMsg>;
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
  // PostgREST-ის უბრალო query-ით არ გამოითვლება — ინახება/ნახლდება ატომურად,
  // `messages`-ის INSERT trigger-ის მხრიდან (#73, `on_message_insert_notify`,
  // supabase/migrations/0020) — აღარ არის ცალკე კლიენტის read-modify-write.
  listMyConversations(myUid: string, myRole: Role): Promise<ChatEntry[]>;
  // Task 4 (security audit) — `mark_conversation_read` RPC-ს იძახებს,
  // საკუთარი unread counter-ის auth.uid()-იდან თავად დგინდება სერვერზე.
  markConversationRead(customerId: string, providerId: string): Promise<void>;

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
  job_id: string | null;
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
      jobId: row.job_id ?? undefined,
    };
  }
  if (row.type === 'image') {
    return { id: row.id, type: 'image', from, t, state: 'read', imageUrl: row.image_url ?? undefined };
  }
  return { id: row.id, type: 'text', from, text: row.text, t, state: 'read' };
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
  async sendRealMessage(customerId, providerId, senderId, text) {
    const { data, error } = await supabase
      .from('messages')
      .insert({ customer_id: customerId, provider_id: providerId, sender_id: senderId, type: 'text', text })
      .select()
      .single();
    if (error) throw error;
    return fromMessageRow(data as MessageRow, senderId);
  },
  async sendRealOffer(customerId, providerId, senderId, amount, comment, jobId) {
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
        job_id: jobId,
      })
      .select()
      .single();
    if (error) throw error;
    return fromMessageRow(data as MessageRow, senderId);
  },
  async sendRealImage(customerId, providerId, senderId, imageUrl) {
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
    return fromMessageRow(data as MessageRow, senderId);
  },
  async respondToRealOffer(messageId, status) {
    // Task 4 (audit) — RPC-only, supabase/migrations/0042. Accepting also
    // atomically syncs the canonical `job_responses.offered_price` when
    // exactly one still-open job connects this Customer/Provider pair —
    // a plain column-scoped `.update()` could never do that safely. The
    // client's own optimistic UI update (respondToOffer, ChatConversationScreen)
    // is unaffected — it already treats this as fire-and-forget.
    const { error } = await supabase.rpc('respond_to_chat_offer', { p_message_id: messageId, p_response: status });
    if (error) throw error;
  },
  subscribeToMessages(customerId, providerId, myUid, onMessage) {
    // შემთხვევითი suffix (notificationService.subscribeToUnreadCount-ის
    // იგივე მიზეზით) — topic-ის collision-ის თავიდან ასაცილებლად, თუ ეს
    // ეკრანი ორჯერ აღმოჩნდება mounted (მაგ. navigation-ის race).
    const channel = supabase
      .channel(`messages-${customerId}-${providerId}-${Math.random().toString(36).slice(2)}`)
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
  async markConversationRead(customerId, providerId) {
    // მოცილებულია direct client `.update()` — `conversations`-ს აღარ აქვს
    // client-ისთვის INSERT/UPDATE grant (security audit, supabase/migrations/
    // 0029) — RPC თავად ადგენს, `auth.uid()`-იდან გამომდინარე, საკუთარი
    // unread counter-ის (customer_unread თუ provider_unread) გადატვირთვას,
    // `myRole` პარამეტრი აღარ სჭირდება.
    const { error } = await supabase.rpc('mark_conversation_read', {
      p_customer_id: customerId,
      p_provider_id: providerId,
    });
    if (error) throw error;
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
      .channel(`conversations-unread-${myUid}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `${column}=eq.${myUid}` }, fetchCount)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
};
