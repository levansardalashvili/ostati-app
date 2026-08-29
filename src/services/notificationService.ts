import { supabase } from './supabaseClient';
import type { NotificationEntry, NotificationTarget } from '../types/notification';

// `notifications` ცხრილის Postgres row shape (#70). #73-მდე შეტყობინება
// იქმნებოდა client-side-ზე (`notificationService.create`) — ეს **მოცილებულია**:
// `notifications`-ის INSERT RLS policy მთლიანად ჩაკეტილია (supabase/migrations/
// 0018), რადგან ნებისმიერ ავტორიზებულ კლიენტს შეეძლო ამ open policy-ით
// ნებისმიერი user_id-სთვის ნებისმიერი შეტყობინების ჩაწერა. ყველა რეალური
// მოვლენა (ახალი შეტყობინება, ახალი დაინტერესება, Provider-ის არჩევა,
// დასრულების მოთხოვნა, job-ის სტატუსის ცვლილება) ახლა SECURITY DEFINER
// trigger-ით/RPC-ით იქმნება სერვერის მხარეს (0020-0023) — მხოლოდ წაკითხვა/
// mark-read რჩება კლიენტისთვის ღია.
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

export interface NotificationService {
  listMine(userId: string): Promise<NotificationEntry[]>;
  markRead(id: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
  subscribeToUnreadCount(userId: string, onChange: (count: number) => void): () => void;

  // Task 3 — `notification_preferences` (NotificationSettingsScreen-ის
  // toggle-ები, მანამდე ლოკალური useState). key→enabled jsonb-ს ინახავს,
  // owner-only RLS. `getPreferences` აბრუნებს მხოლოდ მას, რაც ბაზაშია
  // შენახული (missing key = "მომხმარებელს ჯერ არასდროს გამორთვია", UI-ის
  // მხარეს default true-დ ითვლება) — ასე მომავალში ახალი toggle-ის
  // დამატება არსებული მომხმარებლისთვის "ჩუმად გამორთულს" არ გახდის.
  getPreferences(userId: string): Promise<Record<string, boolean>>;
  setPreference(userId: string, key: string, enabled: boolean): Promise<void>;
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
    // შემთხვევითი suffix topic-ის სახელში — ეს მეთოდი ერთდროულად რამდენიმე
    // ეკრანიდან იძახება იმავე userId-ით (Home-ის ბელი + Profile-ის ბეჯი,
    // ორივე ერთდროულად mounted-ია Bottom Tab-ის ეკრანების სტანდარტული
    // ქცევის გამო) — იდენტური topic-ის სახელით ორი ერთდროული subscribe()
    // ერთმანეთს ეჯახება ("cannot add postgres_changes callbacks... after
    // subscribe()").
    const channel = supabase
      .channel(`notifications-unread-${userId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, fetchCount)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
  async getPreferences(userId) {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('prefs')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return (data as { prefs: Record<string, boolean> } | null)?.prefs ?? {};
  },
  async setPreference(userId, key, enabled) {
    // read-modify-upsert — ერთი toggle-ის ცვლილება არ უნდა წაშალოს
    // დანარჩენი, ადრე შენახული toggle-ების მნიშვნელობები.
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
