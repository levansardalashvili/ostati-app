import { supabase } from './supabaseClient';
import { notificationService } from './notificationService';
import type { ChatEntry, ChatMsg, OfferStatus } from '../types/chat';
import type { Role } from '../types/user';

type MessageRow = {
  id: string;
  customer_id: string;
  provider_id: string;
  sender_id: string;
  type: 'text' | 'offer' | 'image' | 'completion';
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
  if (row.type === 'completion') {
    return { id: row.id, type: 'completion', from, t, state: 'read', jobId: row.job_id ?? undefined };
  }
  if (row.type === 'image') {
    return { id: row.id, type: 'image', from, t, state: 'read', imageUrl: row.image_url ?? undefined, jobId: row.job_id ?? undefined };
  }
  return { id: row.id, type: 'text', from, text: row.text, t, state: 'read', jobId: row.job_id ?? undefined };
}

export const chatService = {
  // A conversation is the (customer_id, provider_id) pair; chatId = the other side's id.
  // The messages INSERT trigger updates conversations and notifies the recipient.
  async listRealMessages(customerId: string, providerId: string, myUid: string): Promise<ChatMsg[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('customer_id', customerId)
      .eq('provider_id', providerId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data as MessageRow[]).map((row) => fromMessageRow(row, myUid));
  },
  // Any message history with this provider? (StartJobChatSheet uses it to avoid creating duplicate jobs.)
  async hasExistingConversation(customerId: string, providerId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('messages')
      .select('id')
      .eq('customer_id', customerId)
      .eq('provider_id', providerId)
      .limit(1);
    if (error) throw error;
    return !!data && data.length > 0;
  },
  // jobId tags the message so findLatestSharedJobId knows which job the chat is about.
  async sendRealMessage(customerId: string, providerId: string, senderId: string, text: string, jobId?: string): Promise<ChatMsg> {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        customer_id: customerId,
        provider_id: providerId,
        sender_id: senderId,
        type: 'text',
        text,
        job_id: jobId ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return fromMessageRow(data as MessageRow, senderId);
  },
  // Every offer is tied to a job.
  async sendRealOffer(customerId: string, providerId: string, senderId: string, amount: number, comment: string | undefined, jobId: string): Promise<ChatMsg> {
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
  async sendRealImage(customerId: string, providerId: string, senderId: string, imageUrl: string, jobId?: string): Promise<ChatMsg> {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        customer_id: customerId,
        provider_id: providerId,
        sender_id: senderId,
        type: 'image',
        text: '',
        image_url: imageUrl,
        job_id: jobId ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return fromMessageRow(data as MessageRow, senderId);
  },
  async respondToRealOffer(messageId: string, status: Extract<OfferStatus, 'accepted' | 'declined'>): Promise<void> {
    // RPC-only: accepting also syncs job_responses.offered_price and selects the provider.
    const { error } = await supabase.rpc('respond_to_chat_offer', { p_message_id: messageId, p_response: status });
    if (error) throw error;
  },
  subscribeToMessages(customerId: string, providerId: string, myUid: string, onMessage: (msg: ChatMsg) => void): () => void {
    // Random suffix: two mounted screens must not share a channel topic.
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

  // conversations holds the last message + unread counters (kept by the messages trigger).
  async listMyConversations(myUid: string, myRole: Role): Promise<ChatEntry[]> {
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
  // RPC resets the caller's own unread counter.
  async markConversationRead(customerId: string, providerId: string): Promise<void> {
    const { error } = await supabase.rpc('mark_conversation_read', {
      p_customer_id: customerId,
      p_provider_id: providerId,
    });
    if (error) throw error;
    // Mark this chat's notifications read; never blocks opening the chat.
    notificationService.markChatNotificationsRead([customerId, providerId]).catch(() => {});
  },

  // Live unread count for the tab badge.
  subscribeToUnreadCount(myUid: string, myRole: Role, onChange: (count: number) => void): () => void {
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
