import { supabase } from './supabaseClient';

export type AppGate = { minVersion: string; maintenance: boolean; message: string; updateUrl: string };

// ქსელის/სერვერის ჩავარდნაზე null — აპი არასდროს იბლოკება იმის გამო, რომ ბლოკის შემოწმება ვერ მოხერხდა
export async function fetchAppGate(): Promise<AppGate | null> {
  try {
    const { data, error } = await supabase.rpc('get_app_gate');
    if (error || !data) return null;
    const g = data as { min_version?: string; maintenance?: boolean; message?: string; update_url?: string };
    return {
      minVersion: g.min_version ?? '',
      maintenance: !!g.maintenance,
      message: g.message ?? '',
      updateUrl: g.update_url ?? '',
    };
  } catch {
    return null;
  }
}
