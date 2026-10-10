import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabaseClient';

// All push permission/token logic lives here (React wiring: PushNotificationsBootstrap).
// Writes go through RPCs, which take user_id from auth.uid().

// This device's token, needed to deactivate it on logout.
let cachedDeviceToken: string | null = null;

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 200, 200],
    lightColor: '#2563EB',
  });
}

// Don't ask again after a denial.
async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  if (current.status === 'denied' && !current.canAskAgain) return false;
  if (current.status === 'undetermined') {
    const requested = await Notifications.requestPermissionsAsync();
    return requested.status === 'granted';
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

export const pushTokenService = {
  // Silent no-op on emulators, without an EAS projectId, or when permission is denied.
  async registerForPushNotifications(): Promise<void> {
    try {
      if (!Device.isDevice) return;

      const granted = await ensurePermission();
      if (!granted) return;

      await ensureAndroidChannel();

      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) {
        console.warn('[push] EAS projectId ვერ მოიძებნა — გაუშვი `eas init`, რომ push token-ის გამოთხოვა იმუშაოს.');
        return;
      }

      const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
      const expoPushToken = data;
      cachedDeviceToken = expoPushToken;

      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      const { error } = await supabase.rpc('register_push_token', {
        p_expo_push_token: expoPushToken,
        p_platform: platform,
        p_device_id: Constants.sessionId ?? null,
      });
      if (error) throw error;
    } catch (err) {
      // Never blocks sign-in or app start.
      console.warn('[push] registerForPushNotifications ჩავარდა:', err);
    }
  },

  // Called from signOut before the session ends (the RPC needs auth.uid()).
  async deactivateCurrentToken(): Promise<void> {
    if (!cachedDeviceToken) return;
    try {
      const { error } = await supabase.rpc('deactivate_push_token', { p_expo_push_token: cachedDeviceToken });
      if (error) throw error;
    } catch (err) {
      console.warn('[push] deactivateCurrentToken ჩავარდა:', err);
    } finally {
      cachedDeviceToken = null;
    }
  },
};
