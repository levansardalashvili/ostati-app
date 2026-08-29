export type NotificationTarget =
  | { screen: 'CustomerJobDetail'; jobId: string }
  | { screen: 'ProviderJobDetail'; id: string; mode?: 'browse' | 'selected' | 'completed' }
  | { screen: 'ChatConversation'; chatId: string; name: string; initials: string; color: string }
  | { screen: 'ProviderReviews' };

export type NotificationEntry = {
  id: string;
  iconType: 'avatar' | 'icon';
  iconEmoji?: string;
  iconInitials?: string;
  iconColor: string;
  iconBg: string;
  title: string;
  text: string;
  time: string;
  read: boolean;
  target?: NotificationTarget;
};
