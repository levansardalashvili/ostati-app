import { supabase } from './supabaseClient';
import { setRankingConfig } from '../utils/providerRank';

// ადმინიდან შესაცვლელი რანჟირების პარამეტრები (0125). ქსელის ჩავარდნაზე რჩება ბოლო/ნაგულისხმევი მნიშვნელობა.
export async function loadRankingConfig(): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('get_ranking_config');
    if (error || !data) return;
    const c = data as { prior_count?: number; prior_mean?: number; jobs_weight?: number };
    setRankingConfig({ priorCount: c.prior_count, priorMean: c.prior_mean, jobsWeight: c.jobs_weight });
  } catch {
    // ნაგულისხმევი მნიშვნელობები ძალაშია
  }
}
