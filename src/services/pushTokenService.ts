import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabaseClient';

// pushTokenService — ერთადერთი ადგილი, სადაც push permission/token
// logic ცხოვრობს (task: "Do not scatter push-token logic across many
// screens"). არ არის React hook/component — მხოლოდ სუფთა ფუნქციები,
// ისევე როგორც userService/jobService/... — react-side wiring
// (auth-state-ზე რეაქცია, tap-listener) ცალკე, `PushNotificationsBootstrap`
// კომპონენტშია (src/components/PushNotificationsBootstrap.tsx).
//
// ორივე Supabase-write RPC-ით ხდება (`register_push_token`/
// `deactivate_push_token`, supabase/migrations/0037) — არა პირდაპირი
// `.insert()`/`.upsert()` — RPC-ს user_id ყოველთვის `auth.uid()`-იდანაა,
// client-ს არ შეუძლია სხვისთვის token-ის დარეგისტრირება (მიუხედავად
// იმისა, თუ ვის ეკუთვნოდა ეს ტოკენი მანამდე — გაზიარებული/ხელახლა
// გამოყენებული მოწყობილობის შემთხვევა, RPC-ის საკუთარი კომენტარი).

// ერთადერთი, module-level cache-ი — "ეს device-ი რას აგზავნის ამჟამად"
// — deactivateCurrentToken()-ს სჭირდება ეს (logout-ისას), ხელახლა
// getExpoPushTokenAsync()-ის გამოძახების/scope-ის გართულების გარეშე.
let cachedDeviceToken: string | null = null;

export interface PushTokenService {
  // Permission + token + Supabase registration, ერთად. უსაფრთხოდ
  // no-op-ობს simulator/emulator-ზე (Device.isDevice === false) და
  // EAS projectId-ის არარსებობისას — არცერთი crash-ს არ იწვევს, მხოლოდ
  // ჩუმად ჩერდება (task: "gracefully handle simulator/emulator...
  // do not crash if permissions are denied").
  registerForPushNotifications(uid: string): Promise<void>;
  // Logout — ამ device-ის ტოკენს აქტიურობას აშორებს (არა შლის) Supabase-ში.
  // authService.signOut()-იდან იძახება, სესიის დახურვამდე (auth.uid()-ს
  // RPC-ს სჭირდება).
  deactivateCurrentToken(): Promise<void>;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 200, 200],
    lightColor: '#2563EB',
  });
}

// Permission — თუ სტატუსი უკვე 'denied'-ია, აღარასდროს ვთხოვთ ხელახლა
// (task: "do not repeatedly prompt after denial") — OS-იც ისედაც
// ბლოკავს ხელახალ prompt-ს Android 13+/iOS-ზე, მაგრამ ეს დამატებით
// ხელს უშლის ჩვენც ზედმეტი `requestPermissionsAsync()`-ის გამოძახებას.
async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  if (current.status === 'denied' && !current.canAskAgain) return false;
  if (current.status === 'undetermined') {
    const requested = await Notifications.requestPermissionsAsync();
    return requested.status === 'granted';
  }
  // 'denied', but canAskAgain === true (iOS-ის ერთ-ერთი კონკრეტული
  // შემთხვევა) — მაინც ერთხელ ვცდით.
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

export const pushTokenService: PushTokenService = {
  async registerForPushNotifications(uid) {
    try {
      // Physical-device მოთხოვნა — Expo push token-ს simulator/emulator
      // საერთოდ ვერ გასცემს (task: "handle physical-device requirement").
      if (!Device.isDevice) return;

      const granted = await ensurePermission();
      if (!granted) return;

      await ensureAndroidChannel();

      // EAS projectId — app.json-ს/eas.json-ს უნდა ჰქონდეს ეს (task:
      // "Do not manually hardcode project IDs if Expo config can provide
      // them safely") — თუ პროექტი ჯერ არ არის EAS-თან დაკავშირებული
      // (`eas init`), ეს არასდროს არსებობს და getExpoPushTokenAsync
      // ისვრის; ჩუმად ვჩერდებით, აპს არ ვაჩერებთ.
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
      // Push registration არასდროს არ უნდა შეაფერხოს ავტორიზაცია/აპის
      // გახსნა — ჩუმად ჩუმდება, error-ს მხოლოდ console-ში ტოვებს.
      console.warn('[push] registerForPushNotifications ჩავარდა:', err);
    }
  },

  async deactivateCurrentToken() {
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
