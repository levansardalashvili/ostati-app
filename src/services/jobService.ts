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

// `job_posts` ცხრილის Postgres row shape — CustomerJob-ის (camelCase)
// შესატყვისი, სერვისის საზღვარზე კონვერტაციით. `provider_id`/`provider_name`
// რეალურად იწერება `select_provider()` RPC-ის მიერ (#67/#72,
// supabase/migrations/0022) — job-ის შექმნისას `null`-ია, Provider-ის
// არჩევის შემდეგ შევსებული. `customer_name` დუბლირებულია (denormalized)
// job_posts-ში თავად შექმნისას (#54-ის "ეტაპი B") — Provider-ის Job
// Feed-ს სჭირდება Customer-ის სახელი, მაგრამ `users` ცხრილის RLS
// მხოლოდ owner-ს უშვებს, join-ით წაკითხვა შეუძლებელია; ამის მაგივრად
// სახელი თავად job_posts-ის მწკრივშივეა, ცალკე RLS-გვერდის ავლის გარეშე.
//
// #72: `title` აღარ არსებობს, როგორც სვეტი (canonical model-იდან
// წაშლილია — supabase/migrations/0011_job_posts_workflow_columns.sql).
// `agreed_price`/`dispute_reason` ახალია — ორივეს მხოლოდ RPC-ები წერენ
// (იხ. ქვემოთ), არასდროს პირდაპირი client-side UPDATE (0013-ით ჩაკეტილი).
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
  // supabase/migrations/0036 — ვინ გააუქმა (`cancel_job`/`provider_cancel_job`-ში
  // სერვერზეა derived). `FeedJob`-ში მხოლოდ (Provider-ის 'cancelled'
  // variant-ის ტექსტისთვის) — `CustomerJob`-ს ჯერ არ სჭირდება, generic
  // StatusPill-ი უკვე საკმარისია Customer-ის მხარეს.
  cancellation_actor: 'customer' | 'provider' | 'admin' | null;
  // supabase/migrations/0041 — კანონიკური განრიგის ველები, თავისუფალ-ტექსტური
  // `date`-ის გვერდით (რომელიც უცვლელად რჩება, ჩვენებისთვის). იხ.
  // src/types/job.ts-ის FeedJob/CustomerJob-ის იგივე შენიშვნა.
  preferred_date: string | null;
  time_slot: TimeSlot | null;
  invited_provider_id?: string | null;
  invite_declined_at?: string | null;
};

// `title` აღარ ინახება ბაზაში — ყოველთვის კატეგორიის სახელიდანაა
// გამოთვლილი (ეს ისედაც იყო ერთადერთი წყარო job-ის შექმნისას, #23),
// ამიტომ ეს drop მონაცემის დაკარგვა არ არის. UI-ს (`job.title`)
// ცვლილება არ სჭირდება.
//
// Task 6 (audit) — `CATEGORIES`-ის (local, static) პირდაპირი `.find()`-ის
// ნაცვლად `categoryService.getCategoryName()` (სინქრონული, cache-ზეა
// აგებული — backend-დან, თუ ჩატვირთულა, თორემ იმავე სტატიკურ სიაზე
// fallback-ით) — კატეგორიის სახელი ახლა ბექენდიდანაა სანდო, ძველი
// job-ების ჩვენებაც ისევე მუშაობს (fallback ზუსტად ძველ მონაცემს
// იმეორებს).
function deriveJobTitle(category: string): string {
  return categoryService.getCategoryName(category);
}

// გატანილია PostJobScreen.tsx-იდან — იგივე Georgian error-mapping ახლა
// StartJobChatSheet.tsx-საც სჭირდება (cold-chat quick-job creation), რომ
// ორივე გამომძახებელს ერთი და იგივე ცნობილი, permanent შეცდომების
// ტექსტი ჰქონდეს, დუბლირებული/დროთა განმავლობაში ერთმანეთისგან
// გადახრილი ასლების ნაცვლად. `create_job`/`update_job_draft`/
// `set_job_photos`/`finalize_job_publish`-ის specific, actionable
// Postgres exceptions-ს მაპავს ცნობილ (permanent — იგივე input-ით
// ხელახლა ცდა ისევ ჩაივარდნება) ქართულ ტექსტზე; ნებისმიერი სხვა
// (გარდამავალი ქსელური/RPC ჩავარდნა) ორიგინალ, ზოგად ტექსტს იღებს.
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
    // real job_posts ერთადერთი ცხრილია (არა ორი ცალკე mock-კუნძული, #47-ის
    // შენიშვნის საწინააღმდეგოდ) — customerJobId ყოველთვის თავად job-ის id-ის
    // ტოლია.
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

// Third hardening pass, priority 1 — `job_posts_feed` (a security_invoker
// VIEW) is gone: it never granted row access by itself, and a direct
// `job_posts` SELECT policy for Providers browsing pending jobs was the
// actual (leaky) access path. That base-table policy is now removed
// entirely (supabase/migrations/0052) — Provider open-job reads go
// through two SECURITY DEFINER RPCs instead, which are themselves the
// security boundary (never "the client happens to query the safe view").
async function fetchFeedJobPostRow(id: string): Promise<JobPostRow | null> {
  const { data, error } = await supabase.rpc('get_feed_job_by_id', { p_job_id: id }).maybeSingle();
  if (error) throw error;
  return (data as JobPostRow | null) ?? null;
}

// `title` აღარ არის ველი — #72-ის მიხედვით Customer არასდროს წერდა
// თავისუფალ title-ს (ის ისედაც კატეგორიის label-ს იმეორებდა), ამიტომ
// input-იდანაც მოცილებულია. `photos` აღარაა შექმნის ველი (second
// hardening pass, item 4) — job-ის ფოტოები კერძო storage-ში იტვირთება
// job-ის id-ის ცოდნის შემდეგ, ცალკე `setJobPhotos`-ით.
export type NewJobPostInput = {
  // თუ მითითებულია — განცხადება პირადია და მხოლოდ ამ ოსტატს ეჩვენება (0094)
  invitedProviderId?: string;
  category: string;
  description: string;
  address: string;
  date: string;
  // Third hardening pass, priority 3 — `customerName` აღარ არსებობს ამ
  // ტიპში: create_job() RPC აღარ იღებს client-supplied სახელს (RPC თავად
  // derives-ს `public.users`-იდან, supabase/migrations/0053) — client
  // ვეღარასდროს "იმპერსონირებს" სხვა display name-ს Provider-ის feed-ში.
  // supabase/migrations/0041 — კანონიკური განრიგის ველები, `date`-ის
  // (თავისუფალი ტექსტის) გვერდით. ორივე optional — `undefined`/`null`,
  // თუ Customer-მა თარიღი/დრო არ აირჩია (PostJobScreen-ის ორივე ველი
  // არასავალდებულოა).
  preferredDate?: string | null;
  timeSlot?: TimeSlot | null;
};

export interface JobService {
  // Supabase-ის `job_posts` ცხრილი — #54. "ეტაპი A" (Customer-ის მხარე) და
  // "ეტაპი B" (Provider-ის Job Feed, ღია job-ების საჯარო წაკითხვა).
  createCustomerJob(customerId: string, input: NewJobPostInput): Promise<CustomerJob>;
  listMyJobPosts(customerId: string): Promise<CustomerJob[]>;
  // The customer's oldest job confirmed but not yet rated — rating is
  // mandatory, so the app reopens RatingScreen for it on every launch.
  getPendingRatingJob(customerId: string): Promise<{ id: string; providerId: string; providerName: string } | null>;
  // onlyMine — მხოლოდ ოსტატის საკუთარი სპეციალობების კატეგორიები (0098)
  getOpenProviderFeedPosts(onlyMine?: boolean): Promise<FeedJob[]>;

  // ერთი job-ის პირდაპირი წაკითხვა id-ით (#71) — route param-ში `job`
  // ობიექტის არარსებობისას fallback (მაგ. notification deep-link, სადაც
  // მხოლოდ id ჩანს).
  getJobPostById(id: string): Promise<CustomerJob | null>;
  getFeedJobPostById(id: string): Promise<FeedJob | null>;

  // Provider-ზე რეალურად მინიჭებული job-ები (`job_posts.provider_id = me`),
  // ნებისმიერი სტატუსით — "მიმდინარე სამუშაო" ბარათისა (#69) და "ჩემი
  // სამუშაოები" ტაბის (ProviderMyJobsScreen) რეალური წყარო.
  listMyAssignedJobs(providerId: string): Promise<FeedJob[]>;

  // Task — ChatsListScreen-იდან ჩატის გახსნისას `jobId` route param-ად არ
  // გადაეცემა (`conversations` job-თან საერთოდ არ არის დაკავშირებული,
  // #57-ის განზრახული გამარტივება) — ChatConversationScreen-ს ამ
  // best-effort ძებნა სჭირდება, რომ header-ის "დეტ. ნახვა" ბმულმა მაინც
  // იმუშაოს ამ შესვლის წერტილიდანაც. ჯერ ცდილობს რეალურად მინიჭებულ
  // job-ს (`provider_id`-ით — ყველაზე ცალსახა, RLS-ითაც უპრობლემოდ
  // წაკითხვადი), თუ არ მოიძებნა — ბოლო job_responses-ს (ჯერ არჩეული არაა,
  // მაგრამ job კვლავ 'pending'-ია, ისევ წაკითხვადი).
  findLatestSharedJobId(customerId: string, providerId: string): Promise<string | null>;

  // #72 — ოთხივე კრიტიკული სტატუსის გადასვლა Postgres RPC-ებზეა აგებული
  // (supabase/migrations/0014_job_workflow_rpcs.sql), არა თავისუფალ
  // `UPDATE job_posts SET status = ...`-ზე (client-side RLS ამას აღარც
  // კი უშვებს, #013). ყოველი RPC საკუთარ ავტორიზაციასა და state-ის
  // ვალიდაციას აკეთებს სერვერზე — client მხოლოდ იძახებს, არაფერს არ
  // "თვლის" თავად.
  selectProvider(jobId: string, providerId: string): Promise<void>;
  providerRequestCompletion(jobId: string): Promise<void>;
  customerConfirmCompletion(jobId: string): Promise<void>;
  // 0149 — Customer marks an active job done after its scheduled start
  // (when the Provider never pressed "დავასრულე") → confirmed_awaiting_rating.
  customerMarkCompleted(jobId: string): Promise<void>;
  // 0150 — Customer changes date/time of an active job; Provider is notified.
  rescheduleActiveJob(jobId: string, preferredDate: string, timeSlot: string, dateLabel: string): Promise<void>;
  // 0152 — private (invited) jobs: Provider declines / Customer opens to everyone.
  declineInvitedJob(jobId: string): Promise<void>;
  openJobToAll(jobId: string): Promise<void>;
  isMyJobInvite(jobId: string): Promise<boolean>;
  // 0150 — Provider's side of a dispute (shown to admin) + the current dispute texts.
  respondToDispute(jobId: string, response: string): Promise<void>;
  getDisputeInfo(jobId: string): Promise<{ reason: string | null; providerResponse: string | null }>;
  customerReportProblem(jobId: string, reason: string): Promise<void>;

  // Job cancellation — supabase/migrations/0032_job_cancellation.sql,
  // იგივე "RPC-only writes" პრინციპით, რაც ზემოთ ოთხი RPC-ისთვის.
  // `reason` არასავალდებულოა (ცხრილში `cancellation_reason` nullable-ია) —
  // დღეს UI-ს ცალკე ტექსტური ველი გაუქმების მიზეზისთვის არ აქვს
  // (განზრახ, "UI-ს არ ვცვლით" შეზღუდვის ფარგლებში).
  cancelJob(jobId: string, reason?: string): Promise<void>;
  // ოსტატის მიერ გაუქმებული განცხადების ხელახლა გახსნა დანარჩენი დაინტერესებულებისთვის (0097)
  reopenJob(jobId: string): Promise<void>;
  // ვადის ბოლო 3 დღეში განცხადების განახლება (0099)
  renewJob(jobId: string): Promise<void>;

  // Provider-initiated job cancellation — supabase/migrations/0036,
  // ცალკე RPC (`provider_cancel_job`) `cancelJob`-ის (Customer-ის RPC)
  // გვერდით — active → cancelled ერთადერთი დაშვებული გადასვლა,
  // `reasonCode` სავალდებულოა (fixed enum), `details` მხოლოდ
  // `reasonCode === 'other'`-ზეა სავალდებულო (RPC-ივე ამოწმებს სერვერზე).
  providerCancelJob(jobId: string, reasonCode: string, details?: string): Promise<void>;

  // Stale-confirmation auto-expiry — supabase/migrations/0079. Fire-and-
  // forget, opportunistic: no cron exists in this project, so either job-
  // detail screen calls this whenever it loads a job still in
  // `awaiting_customer_confirmation` — the RPC itself enforces the actual
  // 72h grace period server-side and is a safe no-op (returns `false`,
  // not an error) if called too early or on any other status. Resolves
  // to `confirmed_awaiting_rating` (never straight to `completed` —
  // review stays mandatory, #18/#47 unchanged) and notifies both
  // participants. Returns whether it actually transitioned the job, so
  // callers can sync `JobStatusContext`'s local cache immediately instead
  // of waiting on a refetch.
  expireStaleJobConfirmation(jobId: string): Promise<boolean>;

  // supabase/migrations/0082 — Customer-ის მხარეს იგივე lazy/opportunistic
  // პატერნი: თუ job >=48სთ `pending`-ია ნულოვანი job_responses-ით და ჯერ
  // არასდროს გაგზავნილა შეხსენება, ერთხელ (და მხოლოდ ერთხელ, სერვერზე
  // stamp-ილი) ატყობინებს Customer-ს "ჯერ არავინ დაინტერესებულა". Job-ის
  // სტატუსს არ ცვლის — ავტომატური გადაწყვეტა ამ შემთხვევაში არ არსებობს.
  checkStaleJobInterest(jobId: string): Promise<boolean>;

  // Second hardening pass, item 4 — job-ის ფოტოების ცალკე მიმაგრება
  // `create_job`-ის შემდეგ (`private-media/job/{jobId}/...`-ს job-ის
  // id სჭირდება, რომელიც შექმნამდე არ არსებობს). Owner-only, მხოლოდ
  // `status='draft'`-ზე (third hardening pass-ის მიხედვით გამკვრივებული —
  // supabase/migrations/0054), მაქს. 3 რეფერენცია, ყველა უნდა ეკუთვნოდეს
  // ზუსტად ამ job-ს/ამ caller-ს.
  setJobPhotos(jobId: string, photos: string[]): Promise<void>;
  // 0109 — განცხადების რაიონი (provider areas-ის იგივე მნიშვნელობა), finalize-მდე/რედაქტირების შემდეგ
  setJobDistrict(jobId: string, district: string): Promise<void>;

  // Final pre-beta audit, item 1 — CONFIRMED bug fix. Syncs current form
  // values into an already-created draft before publish, so a Customer
  // who edits category/description/address/date/time between a failed
  // publish attempt and a retry never has those edits silently dropped
  // (owner-only, draft-only — supabase/migrations/0062). Same shape as
  // `NewJobPostInput` minus `customerName` (never was accepted here) —
  // reuses it directly rather than a near-duplicate type.
  updateJobDraft(jobId: string, input: NewJobPostInput): Promise<CustomerJob>;
  updatePendingJob(jobId: string, input: NewJobPostInput): Promise<CustomerJob>;

  // Third hardening pass, priority 2 — draft -> pending. ერთადერთი გზაა,
  // რომლითაც job Provider-ის feed-ში ხილული ხდება (supabase/migrations/0053).
  finalizeJobPublish(jobId: string): Promise<CustomerJob>;
}

export const jobService: JobService = {
  async createCustomerJob(customerId, input) {
    // Third hardening pass, priorities 2/3/4 — RPC-only
    // (supabase/migrations/0050/0053); `customerId`/`customerName` are no
    // longer sent (the RPC derives both auth.uid() and the display name
    // from public.users server-side — a client can no longer impersonate
    // another display name in the Provider feed). Creates a DRAFT job —
    // invisible to every Provider read until finalizeJobPublish() runs.
    // The RPC itself re-validates description length, address, category,
    // and preferred_date<->time_slot consistency — PostJobScreen's own
    // validation is UX-only, not the security boundary.
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
  async updateJobDraft(jobId, input) {
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
  async updatePendingJob(jobId, input) {
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
  async setJobDistrict(jobId, district) {
    const { error } = await supabase.rpc('set_job_district', { p_job_id: jobId, p_district: district });
    if (error) throw error;
  },

  async setJobPhotos(jobId, photos) {
    const { error } = await supabase.rpc('set_job_photos', { p_job_id: jobId, p_photos: photos });
    if (error) throw error;
  },
  async finalizeJobPublish(jobId) {
    const { data, error } = await supabase.rpc('finalize_job_publish', { p_job_id: jobId });
    if (error) throw error;
    return fromJobPostRow(data as JobPostRow);
  },
  async listMyJobPosts(customerId) {
    // Third hardening pass, priority 2 — drafts (create_job() succeeded
    // but publish was never finalized) must never render as if they were
    // a real posted job.
    // 30 დღეზე ძველი მომლოდინე განცხადებები ავტომატურად უქმდება (0096) — უშედეგოდ არ ვბლოკავთ სიას
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
  async getPendingRatingJob(customerId) {
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
  async getOpenProviderFeedPosts(onlyMine = false) {
    // Third hardening pass, priority 1 — `get_open_provider_feed()` RPC
    // (supabase/migrations/0052), not a view over `job_posts` — Providers
    // have no direct base-table read access to pending rows any more, so
    // this RPC (SECURITY DEFINER, masked address, pending-only) is the
    // only way this list can be read at all.
    const { data, error } = await supabase.rpc('get_open_provider_feed', { p_only_mine: onlyMine });
    if (error) throw error;
    return (data as JobPostRow[]).map(fromJobPostRowToFeedJob);
  },
  async getJobPostById(id) {
    const row = await fetchJobPostRow(id);
    return row ? fromJobPostRow(row) : null;
  },
  async getFeedJobPostById(id) {
    const row = await fetchFeedJobPostRow(id);
    return row ? fromJobPostRowToFeedJob(row) : null;
  },
  async listMyAssignedJobs(providerId) {
    const { data, error } = await supabase
      .from('job_posts')
      .select('*')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as JobPostRow[]).map(fromJobPostRowToFeedJob);
  },
  async findLatestSharedJobId(customerId, providerId) {
    // Priority 0 — the most recent message between this exact pair that
    // explicitly carries a job_id (StartJobChatSheet.tsx's auto-sent
    // first message, or any chat offer, #49) — the most direct signal
    // of "which job this conversation is about". Unlike the checks
    // below, this finds a freshly-created "cold chat" quick-job
    // immediately, before the Provider has responded/been assigned at
    // all (a pure `provider_id`/`job_responses` lookup stays empty
    // until then, which used to make the header's "დეტ. ნახვა" link and
    // the "awaiting provider response" banner both silently disappear
    // on every re-open of the chat).
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
  async selectProvider(jobId, providerId) {
    const { error } = await supabase.rpc('select_provider', { p_job_id: jobId, p_provider_id: providerId });
    if (error) throw error;
  },
  async providerRequestCompletion(jobId) {
    const { error } = await supabase.rpc('provider_request_completion', { p_job_id: jobId });
    if (error) throw error;
  },
  async customerConfirmCompletion(jobId) {
    const { error } = await supabase.rpc('customer_confirm_completion', { p_job_id: jobId });
    if (error) throw error;
  },
  async customerMarkCompleted(jobId) {
    const { error } = await supabase.rpc('customer_mark_completed', { p_job_id: jobId });
    if (error) throw error;
  },
  async rescheduleActiveJob(jobId, preferredDate, timeSlot, dateLabel) {
    const { error } = await supabase.rpc('reschedule_active_job', {
      p_job_id: jobId,
      p_preferred_date: preferredDate,
      p_time_slot: timeSlot,
      p_date: dateLabel,
    });
    if (error) throw error;
  },
  async declineInvitedJob(jobId) {
    const { error } = await supabase.rpc('decline_invited_job', { p_job_id: jobId });
    if (error) throw error;
  },
  async openJobToAll(jobId) {
    const { error } = await supabase.rpc('open_job_to_all', { p_job_id: jobId });
    if (error) throw error;
  },
  async isMyJobInvite(jobId) {
    const { data, error } = await supabase.rpc('get_my_job_invite', { p_job_id: jobId });
    if (error) throw error;
    return data === true;
  },
  async respondToDispute(jobId, response) {
    const { error } = await supabase.rpc('provider_respond_to_dispute', { p_job_id: jobId, p_response: response });
    if (error) throw error;
  },
  async getDisputeInfo(jobId) {
    const { data, error } = await supabase
      .from('job_posts')
      .select('dispute_reason, dispute_provider_response')
      .eq('id', jobId)
      .maybeSingle();
    if (error) throw error;
    return { reason: data?.dispute_reason ?? null, providerResponse: data?.dispute_provider_response ?? null };
  },
  async customerReportProblem(jobId, reason) {
    const { error } = await supabase.rpc('customer_report_problem', { p_job_id: jobId, p_reason: reason });
    if (error) throw error;
  },
  async renewJob(jobId) {
    const { error } = await supabase.rpc('renew_job', { p_job_id: jobId });
    if (error) throw error;
  },
  async reopenJob(jobId) {
    const { error } = await supabase.rpc('reopen_job', { p_job_id: jobId });
    if (error) throw error;
  },
  async cancelJob(jobId, reason) {
    const { error } = await supabase.rpc('cancel_job', { p_job_id: jobId, p_reason: reason ?? null });
    if (error) throw error;
  },
  async providerCancelJob(jobId, reasonCode, details) {
    const { error } = await supabase.rpc('provider_cancel_job', {
      p_job_id: jobId,
      p_reason_code: reasonCode,
      p_details: details ?? null,
    });
    if (error) throw error;
  },
  async expireStaleJobConfirmation(jobId) {
    const { data, error } = await supabase.rpc('expire_stale_job_confirmation', { p_job_id: jobId });
    if (error) throw error;
    return !!data;
  },
  async checkStaleJobInterest(jobId) {
    const { data, error } = await supabase.rpc('check_stale_job_interest', { p_job_id: jobId });
    if (error) throw error;
    return !!data;
  },
};
