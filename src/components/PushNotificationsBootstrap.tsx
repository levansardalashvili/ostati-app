import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { authService } from '../services/authService';
import { pushTokenService } from '../services/pushTokenService';
import { navigateToNotificationTarget } from '../utils/notificationNavigation';
import { navigationRef } from '../navigation/navigationRef';
import type { NotificationTarget } from '../types/notification';
import type { Role } from '../types/user';

// Show the system banner in the foreground too. Set once at module level,
// before any notification can arrive.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Push data has the same shape as notifications.target, so one navigate function serves both.
function targetFromPushData(data: Record<string, unknown> | undefined): NotificationTarget | undefined {
  if (!data || typeof data.screen !== 'string') return undefined;
  switch (data.screen) {
    case 'CustomerJobDetail':
      return typeof data.jobId === 'string' ? { screen: 'CustomerJobDetail', jobId: data.jobId } : undefined;
    case 'ProviderJobDetail': {
      if (typeof data.id !== 'string') return undefined;
      const mode = data.mode;
      const validMode = mode === 'browse' || mode === 'selected' || mode === 'completed' ? mode : undefined;
      return { screen: 'ProviderJobDetail', id: data.id, mode: validMode };
    }
    case 'ChatConversation':
      return typeof data.chatId === 'string' &&
        typeof data.name === 'string' &&
        typeof data.initials === 'string' &&
        typeof data.color === 'string'
        ? { screen: 'ChatConversation', chatId: data.chatId, name: data.name, initials: data.initials, color: data.color }
        : undefined;
    case 'ProviderReviews':
      return { screen: 'ProviderReviews' };
    default:
      return undefined;
  }
}

function handleTapData(data: Record<string, unknown> | undefined) {
  if (!navigationRef.isReady()) return;
  const target = targetFromPushData(data);
  if (!target) return;
  const role: Role = data?.role === 'provider' ? 'provider' : 'customer';
  navigateToNotificationTarget(navigationRef.navigate, target, role);
}

// Mounted once in App.tsx, no UI: registers the push token on sign-in
// (deactivation is in signOut) and navigates on a push tap, including a cold start.
export function PushNotificationsBootstrap() {
  const uidRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = authService.subscribeToAuthState((user) => {
      const nextUid = user?.uid ?? null;
      if (nextUid === uidRef.current) return;
      uidRef.current = nextUid;
      if (nextUid) {
        pushTokenService.registerForPushNotifications().catch(() => {});
      }
    });

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handleTapData(response.notification.request.content.data as Record<string, unknown> | undefined);
      })
      .catch(() => {});

    const tapSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleTapData(response.notification.request.content.data as Record<string, unknown> | undefined);
    });

    return () => {
      unsubscribeAuth();
      tapSubscription.remove();
    };
  }, []);

  return null;
}
