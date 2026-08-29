import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Task 2 — მოცილებულია ჰარდქოდილი URL/anon key წყაროდან. Expo-ს
// `EXPO_PUBLIC_*` პრეფიქსი ავტომატურად ჩაისმევა build-ზე (`.env`-იდან,
// SDK 49+-ის ჩაშენებული ქცევა, დამატებითი Metro/app.json-კონფიგურაცია
// არ სჭირდება) — `.env.example` აჩვენებს ფორმატს, ნამდვილი მნიშვნელობები
// `.env`-შია (`.gitignore`-ით დაცული, ვერასდროს commit-დება). anon key
// (განსხვავებით service_role key-სგან) დანიშნულებით საჯაროა — ის ისედაც
// ყოველ client bundle-შია ჩაშენებული და უსაფრთხოებას RLS უზრუნველყოფს,
// არა key-ის საიდუმლოება — მაგრამ მაინც env-ში გატანა სწორი პრაქტიკაა
// (გარემოებს შორის გადართვა, წყაროში აღარ "წერია" კონკრეტული პროექტი).
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY არ არის მითითებული — შექმენი .env ფაილი (.env.example-ის მაგალითის მიხედვით) პროექტის root-ში და გადატვირთე dev server.',
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
