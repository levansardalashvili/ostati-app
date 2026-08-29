import type { NotificationTarget } from '../types/notification';
import type { Role } from '../types/user';
import type { RootStackParamList } from '../navigation/types';

// გაზიარებული "target → navigate" ლოგიკა — ადრე მხოლოდ
// NotificationsScreen.handleTap-ში იყო inline (in-app შეტყობინების ტაპი).
// Push Notifications-ის დამატებამ ამ ზუსტად იგივე ლოგიკის მეორე
// გამომძახებელი შემოიტანა (OS push-ის tap — navigationRef-ით, screen-ის
// საკუთარი `navigation` prop-ის გარეშე) — ორივემ ერთი, გაზიარებული
// ფუნქცია რომ გამოიყენოს, ორმაგად აღარ დაწერილიყო იგივე switch.
//
// `navigate` სიგნატურა თავად React Navigation-ის `navigation.navigate`-ის
// (screen-ის props-იდან) და `navigationRef.navigate`-ის (push-ის
// bootstrap-იდან) ორივესთვის ერთნაირად თავსებადია.
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
