import { supabase } from './supabaseClient';
import type { CustomerJob, FeedJob, JobStatus } from '../types/job';

// `job_posts` ცხრილის Postgres row shape — CustomerJob-ის (camelCase)
// შესატყვისი, სერვისის საზღვარზე კონვერტაციით. `provider` ველი აქ არასდროს
// არ იწერება/იკითხება, რადგან Provider-ის მინიჭება job_responses-ის
// საქმეა (მომავალი ეტაპი) — ახლად შექმნილი/წაკითხული job ყოველთვის
// `provider: null`-ია. `customer_name` დუბლირებულია (denormalized) job_posts-ში
// თავად შექმნისას (#54-ის "ეტაპი B") — Provider-ის Job Feed-ს სჭირდება
// Customer-ის სახელი, მაგრამ `users` ცხრილის RLS მხოლოდ owner-ს უშვებს,
// join-ით წაკითხვა შეუძლებელია; ამის მაგივრად სახელი თავად job_posts-ის
// მწკრივშივეა, ცალკე RLS-გვერდის ავლის გარეშე.
type JobPostRow = {
  id: string;
  customer_id: string;
  customer_name: string;
  title: string;
  category: string;
  description: string;
  address: string;
  date: string;
  status: CustomerJob['status'];
  photos: string[];
  created_at: string;
  provider_id: string | null;
  // Provider-ის სახელი დენორმალიზებულია job_posts-შივე (#69, `customer_name`-ის
  // იგივე პრინციპით) — Customer-ს "ჩემი job" კითხვისას provider_profiles-ის
  // RLS-ის (owner-only) გვერდის ავლა არ სჭირდება.
  provider_name: string | null;
};

function fromJobPostRow(row: JobPostRow): CustomerJob {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    status: row.status,
    provider: row.provider_name,
    providerId: row.provider_id ?? undefined,
    date: row.date,
    address: row.address,
    desc: row.description,
    photos: row.photos,
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
    title: row.title,
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
  };
}

async function fetchJobPostRow(id: string): Promise<JobPostRow | null> {
  const { data, error } = await supabase.from('job_posts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as JobPostRow | null) ?? null;
}

export type NewJobPostInput = {
  title: string;
  category: string;
  description: string;
  address: string;
  date: string;
  customerName: string;
  photos: string[];
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

  // ორმხრივი დასრულების state machine-ის (#47, JobStatusContext.tsx)
  // რეალური Supabase-ის მხარე (#67) — `providerId`/`providerName` მხოლოდ
  // `pending`→`active` გადასვლას სჭირდება (job-ის Provider-ზე "მინიჭება"),
  // დანარჩენ გადასვლებზე გამოტოვებულია (job_posts.provider_id/provider_name
  // უკვე შევსებულია).
  updateJobStatus(jobId: string, status: JobStatus, providerId?: string, providerName?: string): Promise<void>;
}

export const jobService: JobService = {
  async createCustomerJob(customerId, input) {
    const { data, error } = await supabase
      .from('job_posts')
      .insert({
        customer_id: customerId,
        customer_name: input.customerName,
        title: input.title,
        category: input.category,
        description: input.description,
        address: input.address,
        date: input.date,
        status: 'pending',
        photos: input.photos,
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
  async updateJobStatus(jobId, status, providerId, providerName) {
    const patch: { status: JobStatus; provider_id?: string; provider_name?: string } = { status };
    if (providerId) patch.provider_id = providerId;
    if (providerName) patch.provider_name = providerName;
    const { error } = await supabase.from('job_posts').update(patch).eq('id', jobId);
    if (error) throw error;
  },
};
