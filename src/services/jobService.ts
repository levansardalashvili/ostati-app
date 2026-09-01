import { supabase } from './supabaseClient';
import { categoryService } from './categoryService';
import type { CustomerJob, FeedJob, TimeSlot } from '../types/job';

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
export function deriveJobTitle(category: string): string {
  return categoryService.getCategoryName(category);
}

function fromJobPostRow(row: JobPostRow): CustomerJob {
  return {
    id: row.id,
    title: deriveJobTitle(row.category),
    category: row.category,
    status: row.status,
    provider: row.provider_name,
    providerId: row.provider_id ?? undefined,
    date: row.date,
    address: row.address,
    desc: row.description,
    photos: row.photos,
    agreedPrice: row.agreed_price,
    preferredDate: row.preferred_date,
    timeSlot: row.time_slot,
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
    date: row.date,
    ago: formatAgo(row.created_at),
    interested: 0,
    urgent: false,
    hasPhoto: row.photos.length > 0,
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

// `title` აღარ არის ველი — #72-ის მიხედვით Customer არასდროს წერდა
// თავისუფალ title-ს (ის ისედაც კატეგორიის label-ს იმეორებდა), ამიტომ
// input-იდანაც მოცილებულია.
export type NewJobPostInput = {
  category: string;
  description: string;
  address: string;
  date: string;
  customerName: string;
  photos: string[];
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
  getOpenProviderFeedPosts(): Promise<FeedJob[]>;

  // ერთი job-ის პირდაპირი წაკითხვა id-ით (#71) — route param-ში `job`
  // ობიექტის არარსებობისას fallback (მაგ. notification deep-link, სადაც
  // მხოლოდ id ჩანს).
  getJobPostById(id: string): Promise<CustomerJob | null>;
  getFeedJobPostById(id: string): Promise<FeedJob | null>;

  // Provider-ზე რეალურად მინიჭებული job-ები (`job_posts.provider_id = me`),
  // ნებისმიერი სტატუსით — "მიმდინარე სამუშაო" ბარათისა (#69) და "ჩემი
  // სამუშაოები" ტაბის (ProviderMyJobsScreen) რეალური წყარო.
  listMyAssignedJobs(providerId: string): Promise<FeedJob[]>;

  // #72 — ოთხივე კრიტიკული სტატუსის გადასვლა Postgres RPC-ებზეა აგებული
  // (supabase/migrations/0014_job_workflow_rpcs.sql), არა თავისუფალ
  // `UPDATE job_posts SET status = ...`-ზე (client-side RLS ამას აღარც
  // კი უშვებს, #013). ყოველი RPC საკუთარ ავტორიზაციასა და state-ის
  // ვალიდაციას აკეთებს სერვერზე — client მხოლოდ იძახებს, არაფერს არ
  // "თვლის" თავად.
  selectProvider(jobId: string, providerId: string): Promise<void>;
  providerRequestCompletion(jobId: string): Promise<void>;
  customerConfirmCompletion(jobId: string): Promise<void>;
  customerReportProblem(jobId: string, reason: string): Promise<void>;

  // Job cancellation — supabase/migrations/0032_job_cancellation.sql,
  // იგივე "RPC-only writes" პრინციპით, რაც ზემოთ ოთხი RPC-ისთვის.
  // `reason` არასავალდებულოა (ცხრილში `cancellation_reason` nullable-ია) —
  // დღეს UI-ს ცალკე ტექსტური ველი გაუქმების მიზეზისთვის არ აქვს
  // (განზრახ, "UI-ს არ ვცვლით" შეზღუდვის ფარგლებში).
  cancelJob(jobId: string, reason?: string): Promise<void>;

  // Provider-initiated job cancellation — supabase/migrations/0036,
  // ცალკე RPC (`provider_cancel_job`) `cancelJob`-ის (Customer-ის RPC)
  // გვერდით — active → cancelled ერთადერთი დაშვებული გადასვლა,
  // `reasonCode` სავალდებულოა (fixed enum), `details` მხოლოდ
  // `reasonCode === 'other'`-ზეა სავალდებულო (RPC-ივე ამოწმებს სერვერზე).
  providerCancelJob(jobId: string, reasonCode: string, details?: string): Promise<void>;
}

export const jobService: JobService = {
  async createCustomerJob(customerId, input) {
    const { data, error } = await supabase
      .from('job_posts')
      .insert({
        customer_id: customerId,
        customer_name: input.customerName,
        category: input.category,
        description: input.description,
        address: input.address,
        date: input.date,
        status: 'pending',
        photos: input.photos,
        preferred_date: input.preferredDate ?? null,
        time_slot: input.timeSlot ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return fromJobPostRow(data as JobPostRow);
  },
  async listMyJobPosts(customerId) {
    const { data, error } = await supabase
      .from('job_posts')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as JobPostRow[]).map(fromJobPostRow);
  },
  async getOpenProviderFeedPosts() {
    const { data, error } = await supabase
      .from('job_posts')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as JobPostRow[]).map(fromJobPostRowToFeedJob);
  },
  async getJobPostById(id) {
    const row = await fetchJobPostRow(id);
    return row ? fromJobPostRow(row) : null;
  },
  async getFeedJobPostById(id) {
    const row = await fetchJobPostRow(id);
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
  async customerReportProblem(jobId, reason) {
    const { error } = await supabase.rpc('customer_report_problem', { p_job_id: jobId, p_reason: reason });
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
};
