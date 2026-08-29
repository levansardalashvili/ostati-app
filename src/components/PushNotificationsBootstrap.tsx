import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { authService } from '../services/authService';
import { pushTokenService } from '../services/pushTokenService';
import { navigateToNotificationTarget } from '../utils/notificationNavigation';
import { navigationRef } from '../navigation/navigationRef';
import type { NotificationTarget } from '../types/notification';
import type { Role } from '../types/user';

// Foreground behavior — task section 13: "existing in-app notification
// UI remains source of truth... optionally show system banner." We show
// the system banner too (so a backgrounded-then-foregrounded tap still
// works the same way, and the user isn't left wondering why nothing
// appeared) — the in-app NotificationsScreen/bell-badge stay the actual
// source of truth for the persisted list; this is purely the OS-level
// presentation of the push itself, not a second parallel notification
// system. Module-level (not inside the component below) — must be set
// once, before any notification can arrive, not re-set per mount/render.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// გადმოსცემს push-ის `data` payload-ს (Edge Function-ის მიერ აწყობილი,
// supabase/functions/send-push-notifications/index.ts — `{...target,
// type, notificationId, role}`) იმავე `NotificationTarget`-ად, რასაც
// in-app სია (`notifications.target` column) იყენებს — ერთი გაზიარებული
// `navigateToNotificationTarget` ორივეს ემსახურება.
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

// App.tsx-ის root-ზე ერთხელ mounted, ვიზუალური გამოსახულების გარეშე —
// მხოლოდ side-effect wiring:
//   1. push token-ის რეგისტრაცია auth-state-ის ცვლილებაზე
//      (FavoriteProvidersContext-ის, #78, იგივე `subscribeToAuthState` +
//      uid-guard პატერნი — ერთი listener ფარავს cold-start
//      session-restore-საც, login-საც; logout-ის token-deactivation
//      ცალკეა, `authService.signOut()`-შივეა, სესიის დახურვამდე).
//   2. push-ის tap → navigate, სამივე შემთხვევაში (foreground/background
//      listener + killed-app cold-start-ის `getLastNotificationResponseAsync`).
export function PushNotificationsBootstrap() {
  const uidRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = authService.subscribeToAuthState((user) => {
      const nextUid = user?.uid ?? null;
      if (nextUid === uidRef.current) return;
      uidRef.current = nextUid;
      if (nextUid) {
        pushTokenService.registerForPushNotifications(nextUid).catch(() => {});
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
