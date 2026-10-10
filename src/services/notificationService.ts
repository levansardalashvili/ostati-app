import { supabase } from './supabaseClient';
import type { NotificationEntry, NotificationTarget } from '../types/notification';

// Only the server creates notifications (triggers/RPCs); the client reads and marks them read.
type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  icon_emoji: string;
  icon_bg: string;
  target: NotificationTarget | null;
  read: boolean;
  created_at: string;
};

function formatAgo(iso: string): string {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} წ. წინ`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} სთ. წინ`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'გუშინ';
  return `${days} დ. წინ`;
}

function fromRow(row: NotificationRow): NotificationEntry {
  return {
    id: row.id,
    iconType: 'icon',
    iconEmoji: row.icon_emoji,
    iconColor: '#fff',
    iconBg: row.icon_bg,
    title: row.title,
    text: row.body,
    time: formatAgo(row.created_at),
    read: row.read,
    target: row.target ?? undefined,
  };
}

export const notificationService = {
  async listMine(userId: string): Promise<NotificationEntry[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as NotificationRow[]).map(fromRow);
  },
  async markRead(id: string): Promise<void> {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error) throw error;
  },
  // Opening a chat or job marks its notifications read.
  async markChatNotificationsRead(participantIds: string[]): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('read', false)
      .eq('target->>screen', 'ChatConversation')
      .in('target->>chatId', participantIds);
    if (error) throw error;
  },
  async markJobNotificationsRead(jobId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('read', false)
      .or(`target->>jobId.eq.${jobId},target->>id.eq.${jobId}`);
    if (error) throw error;
  },
  async markAllRead(userId: string): Promise<void> {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
    if (error) throw error;
  },
  subscribeToUnreadCount(userId: string, onChange: (count: number) => void): () => void {
    const fetchCount = () => {
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false)
        .then(({ count }) => onChange(count ?? 0));
    };
    fetchCount();
    // Random suffix: Home bell and Profile badge subscribe at the same time.
    const channel = supabase
      .channel(`notifications-unread-${userId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, fetchCount)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
  // Only stored keys are returned; a missing key means enabled (so new toggles start on).
  async getPreferences(userId: string): Promise<Record<string, boolean>> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('prefs')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return (data as { prefs: Record<string, boolean> } | null)?.prefs ?? {};
  },
  async setPreference(userId: string, key: string, enabled: boolean): Promise<void> {
    // Read-modify-upsert so other toggles are kept.
    const { data, error: readError } = await supabase
      .from('notification_preferences')
      .select('prefs')
      .eq('user_id', userId)
      .maybeSingle();
    if (readError) throw readError;
    const prefs = { ...((data as { prefs: Record<string, boolean> } | null)?.prefs ?? {}), [key]: enabled };
    const { error } = await supabase.from('notification_preferences').upsert({ user_id: userId, prefs });
    if (error) throw error;
  },
};
