import { supabase } from './supabaseClient';
import { userService } from './userService';
import type { Provider } from '../types/provider';
import type { JobQuote } from '../types/quote';

// Provider name/initials/color are denormalized: the customer can't read provider rows via join.
type JobResponseRow = {
  id: string;
  job_id: string;
  provider_id: string;
  provider_name: string;
  provider_initials: string;
  provider_color: string;
  // null only on very old responses
  offered_price: number | null;
};

// Fallback when the provider profile couldn't be loaded.
function fromJobResponseRowFallback(row: JobResponseRow): JobQuote {
  return {
    provider: {
      id: row.provider_id,
      name: row.provider_name,
      category: '',
      categories: [],
      years: 0,
      rating: 0,
      reviews: 0,
      location: '',
      areas: [],
      jobs: 0,
      verified: false,
      verificationStatus: 'unverified',
      online: false,
      initials: row.provider_initials,
      color: row.provider_color,
      bio: '',
      skills: [],
      certificates: [],
      portfolio: [],
      specialties: [],
    },
    offeredPrice: row.offered_price ?? undefined,
  };
}

export const quoteService = {
  // RPC-only. The server takes the provider's id and display name from the session;
  // a trigger notifies the customer.
  async expressInterest(jobId: string, offeredPrice: number): Promise<void> {
    const { error } = await supabase.rpc('express_interest', {
      p_job_id: jobId,
      p_offered_price: offeredPrice,
    });
    if (error) throw error;
  },
  // Only while the job is pending (checked by the RPC).
  async withdrawInterest(jobId: string): Promise<void> {
    const { error } = await supabase.rpc('withdraw_interest', { p_job_id: jobId });
    if (error) throw error;
  },
  // Job ids this provider already responded to.
  async listMyResponseJobIds(providerId: string): Promise<Set<string>> {
    const { data, error } = await supabase.from('job_responses').select('job_id').eq('provider_id', providerId);
    if (error) throw error;
    return new Set((data as { job_id: string }[]).map((r) => r.job_id));
  },
  async listResponsesForJob(jobId: string): Promise<JobQuote[]> {
    const { data, error } = await supabase
      .from('job_responses')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const rows = data as JobResponseRow[];
    if (rows.length === 0) return [];

    // One batched profile lookup; on failure fall back per row instead of failing the list.
    const providerIds = rows.map((r) => r.provider_id);
    const realProviders = await userService.getRealProvidersByIds(providerIds).catch(() => [] as Provider[]);
    const providerMap = new Map(realProviders.map((p) => [p.id, p]));

    return rows.map((row) => {
      const real = providerMap.get(row.provider_id);
      return {
        provider: real ?? fromJobResponseRowFallback(row).provider,
        offeredPrice: row.offered_price ?? undefined,
      };
    });
  },
};
