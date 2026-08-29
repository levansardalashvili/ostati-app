import { supabase } from './supabaseClient';
import type { NotificationEntry, NotificationTarget } from '../types/notification';

// `notifications` ცხრილის Postgres row shape (#70). შეტყობინება იქმნება
// client-side-ზე, იმ სერვისის მეთოდიდან, სადაც რეალური მოვლენა ხდება
// (ახალი ჩატის შეტყობინება, ახალი დაინტერესება, job-ის სტატუსის ცვლილება) —
// არა DB trigger-ით, `touchConversation`-ის (#68) იგივე "გვერდითი ეფექტის"
// პრინციპით.
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

export type NewNotificationInput = {
  title: string;
  body: string;
  iconEmoji: string;
  iconBg: string;
  target?: NotificationTarget;
};

export interface NotificationService {
  listMine(userId: string): Promise<NotificationEntry[]>;
  markRead(id: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
  subscribeToUnreadCount(userId: string, onChange: (count: number) => void): () => void;

  // სხვა სერვისების მიერ გამოსაძახებელი, სხვისთვის შეტყობინების შესაქმნელად
  // (მაგ. Provider-ი ქმნის შეტყობინებას Customer-ისთვის, ახალ დაინტერესებაზე).
  create(userId: string, input: NewNotificationInput): Promise<void>;
}

export const notificationService: NotificationService = {
  async listMine(userId) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as NotificationRow[]).map(fromRow);
  },
  async markRead(id) {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error) throw error;
  },
  async markAllRead(userId) {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
    if (error) throw error;
  },
  subscribeToUnreadCount(userId, onChange) {
    const fetchCount = () => {
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false)
        .then(({ count }) => onChange(count ?? 0));
    };
    fetchCount();
    const channel = supabase
      .channel(`notifications-unread-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, fetchCount)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
  async create(userId, input) {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title: input.title,
      body: input.body,
      icon_emoji: input.iconEmoji,
      icon_bg: input.iconBg,
      target: input.target ?? null,
    });
    if (error) throw error;
  },
};
