import type { NotificationTarget } from '../types/notification';
import type { Role } from '../types/user';
import type { RootStackParamList } from '../navigation/types';

// notification target → navigate. Shared by the in-app list and push taps
// (screen navigation prop or navigationRef).
type Navigate = <RouteName extends keyof RootStackParamList>(
  ...args: RootStackParamList[RouteName] extends undefined
    ? [screen: RouteName]
    : [screen: RouteName, params: RootStackParamList[RouteName]]
) => void;

export function navigateToNotificationTarget(navigate: Navigate, target: NotificationTarget | undefined, role: Role) {
  if (!target) return;
  switch (target.screen) {
    case 'CustomerJobDetail':
      navigate('CustomerJobDetail', { jobId: target.jobId });
      break;
    case 'ProviderJobDetail':
      navigate('ProviderJobDetail', { id: target.id, mode: target.mode });
      break;
    case 'ChatConversation':
      navigate('ChatConversation', {
        chatId: target.chatId,
        name: target.name,
        initials: target.initials,
        color: target.color,
        role,
      });
      break;
    case 'ProviderReviews':
      navigate('ProviderReviews');
      break;
  }
}
