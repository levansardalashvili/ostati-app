import { supabase } from './supabaseClient';
import { categoryService } from './categoryService';
import type { CustomerJob, FeedJob, TimeSlot } from '../types/job';
import { formatPickedDate } from '../components/CalendarPicker';
import { timeSlotLabel } from '../data/timeSlots';

// The stored `date` text was written once with relative words ("დღეს"/"ხვალ"),
// which go stale the next day. When the canonical preferred_date exists,
// build the label at read time instead; old rows keep their stored text.
function displayDate(row: { date: string; preferred_date: string | null; time_slot: TimeSlot | null }): string {
  if (!row.preferred_date) return row.date;
  const [y, m, d] = row.preferred_date.split('-').map(Number);
  const slot = timeSlotLabel(row.time_slot);
  return `${formatPickedDate(new Date(y, m - 1, d))}${slot ? ` ${slot}` : ''}`;
}

// `job_posts` row. `customer_name` is denormalized because users' RLS hides
// other people's rows; provider_*/agreed_price/status are written only by RPCs.
type JobPostRow = {
  id: string;
  customer_id: string;
  customer_name: string;
  category: string;
  description: string;
  address: string;
  district?: string | null;
  date: string;
  status: CustomerJob['status'];
  photos: string[];
  created_at: string;
  provider_id: string | null;
  provider_name: string | null;
  agreed_price: number | null;
  dispute_reason: string | null;
  cancellation_actor: 'customer' | 'provider' | 'admin' | null;
  // canonical schedule; `date` is the legacy display text
  preferred_date: string | null;
  time_slot: TimeSlot | null;
  invited_provider_id?: string | null;
  invite_declined_at?: string | null;
};

// A job has no stored title — it is the category name.
function deriveJobTitle(category: string): string {
  return categoryService.getCategoryName(category);
}

// Known publish errors (retrying with the same input fails again) → Georgian
// text; anything else (network) gets the generic message. Shared by PostJob
// and StartJobChatSheet.
export function getPublishErrorMessage(err: unknown): string {
  const message = (err as { message?: string } | null)?.message ?? '';
  if (message.includes('category is no longer available')) {
    return 'არჩეული კატეგორია აღარ არის ხელმისაწვდომი — აირჩიე სხვა კატეგორია და სცადე თავიდან.';
  }
  if (message.includes('Description must be')) {
    return 'აღწერა უნდა იყოს 20–500 სიმბოლოს ფარგლებში — შეასწორე და სცადე თავიდან.';
  }
  if (message.includes('TOO_MANY_OPEN_JOBS')) {
    return 'ღია განცხადებების ლიმიტი ამოიწურა — ზედმეტი გააუქმეთ და სცადეთ თავიდან.';
  }
  if (message.includes('ACCOUNT_SUSPENDED')) {
    return 'თქვენი ანგარიში შეჩერებულია — მოქმედება მიუწვდომელია.';
  }
  if (message.includes('DATE_TIME_REQUIRED')) {
    return 'სასურველი თარიღი და დრო სავალდებულოა — აირჩიე ორივე და სცადე თავიდან.';
  }
  if (message.includes('PROVIDER_NOT_VERIFIED')) {
    return 'ეს ოსტატი ჯერ არ არის ვერიფიცირებული — აირჩიეთ სხვა ოსტატი ან გამოაქვეყნეთ განცხადება ყველასთვის.';
  }
  if (message.includes('DATE_IN_PAST')) {
    return 'სასურველი თარიღი წარსულშია — აირჩიე დღევანდელი ან მომავალი თარიღი.';
  }
  if (message.includes('exact address is required')) {
    return 'მისამართი სავალდებულოა — შეავსე ველი და სცადე თავიდან.';
  }
  return 'მოთხოვნის გამოქვეყნება ვერ მოხერხდა';
}

function fromJobPostRow(row: JobPostRow): CustomerJob {
  return {
    id: row.id,
    title: deriveJobTitle(row.category),
    category: row.category,
    status: row.status,
    provider: row.provider_name,
    providerId: row.provider_id ?? undefined,
    date: displayDate(row),
    address: row.address,
    district: row.district ?? undefined,
    desc: row.description,
    photos: row.photos,
    agreedPrice: row.agreed_price,
    cancellationActor: row.cancellation_actor,
    preferredDate: row.preferred_date,
    timeSlot: row.time_slot,
    createdAt: row.created_at,
    invitedProviderId: row.invited_provider_id ?? null,
    inviteDeclinedAt: row.invite_declined_at ?? null,
  };
}

// "N წუთი/საათი/დღე" — FeedJob.ago-ს ფორმატი (ProviderFeedJobCard `{ago} წინ`-ს
// თავად ამატებს სუფიქსს, ამიტომ აქ "წინ" არ ემატება).
function formatAgo(createdAt: string): string {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes} წუთი`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} საათი`;
  return `${Math.floor(hours / 24)} დღე`;
}

function fromJobPostRowToFeedJob(row: JobPostRow): FeedJob {
  return {
    id: row.id,
    category: row.category,
    title: deriveJobTitle(row.category),
    customer: row.customer_name,
    location: row.address,
    date: displayDate(row),
    ago: formatAgo(row.created_at),
    urgent: false,
    hasPhoto: row.photos.length > 0,
    photos: row.photos,
    desc: row.description,
    assignedProviderId: row.provider_id,
    customerJobId: row.id,
    status: row.status,
    customerId: row.customer_id,
    agreedPrice: row.agreed_price,
    cancellationActor: row.cancellation_actor,
    preferredDate: row.preferred_date,
    timeSlot: row.time_slot,
  };
}

async function fetchJobPostRow(id: string): Promise<JobPostRow | null> {
  const { data, error } = await supabase.from('job_posts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as JobPostRow | null) ?? null;
}

// Providers can't read pending job_posts directly (exact address privacy) —
// only through the masked feed RPCs.
async function fetchFeedJobPostRow(id: string): Promise<JobPostRow | null> {
  const { data, error } = await supabase.rpc('get_feed_job_by_id', { p_job_id: id }).maybeSingle();
  if (error) throw error;
  return (data as JobPostRow | null) ?? null;
}

// Photos are attached after creation (setJobPhotos) — their storage path needs the job id.
export type NewJobPostInput = {
  // თუ მითითებულია — განცხადება პირადია და მხოლოდ ამ ოსტატს ეჩვენება (0094)
  invitedProviderId?: string;
  category: string;
  description: string;
  address: string;
  date: string;
  preferredDate?: string | null;
  timeSlot?: TimeSlot | null;
};

export const jobService = {
  // Creates a DRAFT (invisible to Providers until finalizeJobPublish). The RPC
  // takes the owner and name from the session and re-validates every field.
  async createCustomerJob(input: NewJobPostInput): Promise<CustomerJob> {
    const { data, error } = await supabase.rpc('create_job', {
      p_category: input.category,
      p_description: input.description,
      p_address: input.address,
      p_date: input.date,
      p_preferred_date: input.preferredDate ?? null,
      p_time_slot: input.timeSlot ?? null,
      p_invited_provider_id: input.invitedProviderId ?? null,
    });
    if (error) throw error;
    return fromJobPostRow(data as JobPostRow);
  },
  // Retry after a failed publish: sync the edited form into the existing draft.
  async updateJobDraft(jobId: string, input: NewJobPostInput): Promise<CustomerJob> {
    const { data, error } = await supabase.rpc('update_job_draft', {
      p_job_id: jobId,
      p_category: input.category,
      p_description: input.description,
      p_address: input.address,
      p_date: input.date,
      p_preferred_date: input.preferredDate ?? null,
      p_time_slot: input.timeSlot ?? null,
    });
    if (error) throw error;
    return fromJobPostRow(data as JobPostRow);
  },
  async updatePendingJob(jobId: string, input: NewJobPostInput): Promise<CustomerJob> {
    const { data, error } = await supabase.rpc('update_pending_job', {
      p_job_id: jobId,
      p_category: input.category,
      p_description: input.description,
      p_address: input.address,
      p_date: input.date,
      p_preferred_date: input.preferredDate ?? null,
      p_time_slot: input.timeSlot ?? null,
    });
    if (error) throw error;
    return fromJobPostRow(data as JobPostRow);
  },
  // district uses the same values as provider areas (matching for the feed and notifications)
  async setJobDistrict(jobId: string, district: string): Promise<void> {
    const { error } = await supabase.rpc('set_job_district', { p_job_id: jobId, p_district: district });
    if (error) throw error;
  },

  // owner-only, draft-only, max 3, every path must belong to this job
  async setJobPhotos(jobId: string, photos: string[]): Promise<void> {
    const { error } = await supabase.rpc('set_job_photos', { p_job_id: jobId, p_photos: photos });
    if (error) throw error;
  },
  // draft → pending: the only way a job becomes visible to Providers
  async finalizeJobPublish(jobId: string): Promise<CustomerJob> {
    const { data, error } = await supabase.rpc('finalize_job_publish', { p_job_id: jobId });
    if (error) throw error;
    return fromJobPostRow(data as JobPostRow);
  },
  async listMyJobPosts(customerId: string): Promise<CustomerJob[]> {
    // expire stale pending jobs first (cron does it too — this keeps the list fresh); drafts are never shown
    await supabase.rpc('expire_my_stale_jobs').then(() => {}, () => {});
    const { data, error } = await supabase
      .from('job_posts')
      .select('*')
      .eq('customer_id', customerId)
      .neq('status', 'draft')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as JobPostRow[]).map(fromJobPostRow);
  },
  // The customer's oldest job confirmed but not yet rated — rating is
  // mandatory, so the app reopens RatingScreen for it on every launch.
  async getPendingRatingJob(customerId: string): Promise<{ id: string; providerId: string; providerName: string } | null> {
    const { data, error } = await supabase
      .from('job_posts')
      .select('id, provider_id, provider_name')
      .eq('customer_id', customerId)
      .eq('status', 'confirmed_awaiting_rating')
      .not('provider_id', 'is', null)
      .order('updated_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { id: data.id, providerId: data.provider_id, providerName: data.provider_name ?? 'ოსტატი' };
  },
  // onlyMine — მხოლოდ ოსტატის საკუთარი სპეციალობების კატეგორიები (0098)
  async getOpenProviderFeedPosts(onlyMine?: boolean): Promise<FeedJob[]> {
    const { data, error } = await supabase.rpc('get_open_provider_feed', { p_only_mine: onlyMine });
    if (error) throw error;
    return (data as JobPostRow[]).map(fromJobPostRowToFeedJob);
  },
  // used when only the id is known (e.g. a notification deep link)
  async getJobPostById(id: string): Promise<CustomerJob | null> {
    const row = await fetchJobPostRow(id);
    return row ? fromJobPostRow(row) : null;
  },
  async getFeedJobPostById(id: string): Promise<FeedJob | null> {
    const row = await fetchFeedJobPostRow(id);
    return row ? fromJobPostRowToFeedJob(row) : null;
  },
  // jobs assigned to this provider, any status
  async listMyAssignedJobs(providerId: string): Promise<FeedJob[]> {
    const { data, error } = await supabase
      .from('job_posts')
      .select('*')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as JobPostRow[]).map(fromJobPostRowToFeedJob);
  },
  // A conversation is per (customer, provider) pair, not per job — best-effort
  // guess of which job a chat opened from the chat list is about. In order:
  // latest message tagged with a job, an assigned job, a job this provider responded to.
  async findLatestSharedJobId(customerId: string, providerId: string): Promise<string | null> {
    const { data: taggedMsg } = await supabase
      .from('messages')
      .select('job_id')
      .eq('customer_id', customerId)
      .eq('provider_id', providerId)
      .not('job_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);
    if (taggedMsg && taggedMsg[0]) return (taggedMsg[0] as { job_id: string }).job_id;

    const { data: assigned } = await supabase
      .from('job_posts')
      .select('id')
      .eq('customer_id', customerId)
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (assigned && assigned[0]) return (assigned[0] as { id: string }).id;

    const { data: responses } = await supabase
      .from('job_responses')
      .select('job_id')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false })
      .limit(10);
    const jobIds = ((responses ?? []) as { job_id: string }[]).map((r) => r.job_id);
    if (jobIds.length === 0) return null;

    const { data: posts } = await supabase
      .from('job_posts')
      .select('id')
      .eq('customer_id', customerId)
      .in('id', jobIds)
      .order('created_at', { ascending: false })
      .limit(1);
    if (posts?.[0]) return (posts[0] as { id: string }).id;

    // Provider side: pending jobs are no longer directly readable (address privacy, 0092) —
    // resolve through the masked feed RPC instead. Errors (e.g. Customer caller) → null.
    const { data: feed } = await supabase.rpc('get_open_provider_feed');
    const match = ((feed ?? []) as { id: string; customer_id: string }[]).find(
      (r) => r.customer_id === customerId && jobIds.includes(r.id),
    );
    return match?.id ?? null;
  },
  // Status changes are RPC-only; each RPC checks the caller and the current status server-side.
  async selectProvider(jobId: string, providerId: string): Promise<void> {
    const { error } = await supabase.rpc('select_provider', { p_job_id: jobId, p_provider_id: providerId });
    if (error) throw error;
  },
  async providerRequestCompletion(jobId: string): Promise<void> {
    const { error } = await supabase.rpc('provider_request_completion', { p_job_id: jobId });
    if (error) throw error;
  },
  async customerConfirmCompletion(jobId: string): Promise<void> {
    const { error } = await supabase.rpc('customer_confirm_completion', { p_job_id: jobId });
    if (error) throw error;
  },
  // after the scheduled start, if the provider never pressed "დავასრულე"
  async customerMarkCompleted(jobId: string): Promise<void> {
    const { error } = await supabase.rpc('customer_mark_completed', { p_job_id: jobId });
    if (error) throw error;
  },
  async rescheduleActiveJob(jobId: string, preferredDate: string, timeSlot: string, dateLabel: string): Promise<void> {
    const { error } = await supabase.rpc('reschedule_active_job', {
      p_job_id: jobId,
      p_preferred_date: preferredDate,
      p_time_slot: timeSlot,
      p_date: dateLabel,
    });
    if (error) throw error;
  },
  // private (invited) jobs
  async declineInvitedJob(jobId: string): Promise<void> {
    const { error } = await supabase.rpc('decline_invited_job', { p_job_id: jobId });
    if (error) throw error;
  },
  async openJobToAll(jobId: string): Promise<void> {
    const { error } = await supabase.rpc('open_job_to_all', { p_job_id: jobId });
    if (error) throw error;
  },
  async isMyJobInvite(jobId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('get_my_job_invite', { p_job_id: jobId });
    if (error) throw error;
    return data === true;
  },
  // provider's side of a dispute (shown to the admin)
  async respondToDispute(jobId: string, response: string): Promise<void> {
    const { error } = await supabase.rpc('provider_respond_to_dispute', { p_job_id: jobId, p_response: response });
    if (error) throw error;
  },
  async getDisputeInfo(jobId: string): Promise<{ reason: string | null; providerResponse: string | null }> {
    const { data, error } = await supabase
      .from('job_posts')
      .select('dispute_reason, dispute_provider_response')
      .eq('id', jobId)
      .maybeSingle();
    if (error) throw error;
    return { reason: data?.dispute_reason ?? null, providerResponse: data?.dispute_provider_response ?? null };
  },
  async customerReportProblem(jobId: string, reason: string): Promise<void> {
    const { error } = await supabase.rpc('customer_report_problem', { p_job_id: jobId, p_reason: reason });
    if (error) throw error;
  },
  // allowed only in the last days before expiry
  async renewJob(jobId: string): Promise<void> {
    const { error } = await supabase.rpc('renew_job', { p_job_id: jobId });
    if (error) throw error;
  },
  // after the chosen provider cancelled — reopen for the other interested providers
  async reopenJob(jobId: string): Promise<void> {
    const { error } = await supabase.rpc('reopen_job', { p_job_id: jobId });
    if (error) throw error;
  },
  // customer: the UI asks for a reason once a provider is assigned
  async cancelJob(jobId: string, reason?: string): Promise<void> {
    const { error } = await supabase.rpc('cancel_job', { p_job_id: jobId, p_reason: reason ?? null });
    if (error) throw error;
  },
  // provider: active → cancelled only; details required when reasonCode is 'other'
  async providerCancelJob(jobId: string, reasonCode: string, details?: string): Promise<void> {
    const { error } = await supabase.rpc('provider_cancel_job', {
      p_job_id: jobId,
      p_reason_code: reasonCode,
      p_details: details ?? null,
    });
    if (error) throw error;
  },
  // Auto-confirm after the grace period (cron runs it too; calling it on open
  // just applies it sooner). No-op before the deadline. Returns whether the job
  // moved, so the caller can update JobStatusContext at once.
  async expireStaleJobConfirmation(jobId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('expire_stale_job_confirmation', { p_job_id: jobId });
    if (error) throw error;
    return !!data;
  },
  // one-time "nobody is interested yet" reminder (cron runs it too); doesn't change status
  async checkStaleJobInterest(jobId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('check_stale_job_interest', { p_job_id: jobId });
    if (error) throw error;
    return !!data;
  },
};
