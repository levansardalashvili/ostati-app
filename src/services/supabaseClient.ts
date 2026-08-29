import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://sqyfoqwgjoquuhmxwgul.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxeWZvcXdnam9xdXVobXh3Z3VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MzMyMDksImV4cCI6MjEwMzUwOTIwOX0.OnD2Aqmrn8u_Iu3ExcGbFVHwEffuRlyvFr9fjSpdRL4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
