import { supabase } from './supabaseClient';
import { userService } from './userService';
import type { Provider } from '../types/provider';
import type { JobQuote } from '../types/quote';

// `job_responses` ცხრილის Postgres row shape — Provider-ის საჯარო
// ჩვენებადი ველები (name/initials/color) დუბლირებულია (denormalized)
// job_responses-ის მწკრივშივე, `job_posts`-ის `customer_name`-ის (#55)
// იგივე მიზეზით: `users`/`provider_profiles`-ის RLS მხოლოდ owner-ს
// უშვებს, join-ით Customer ვერ წაიკითხავდა Provider-ის სახელს.
type JobResponseRow = {
  id: string;
  job_id: string;
  provider_id: string;
  provider_name: string;
  provider_initials: string;
  provider_color: string;
  // #72: numeric, არა text — Provider ყოველთვის კონკრეტულ რიცხვს
  // წარადგენს. `null` მხოლოდ migration-მდელ ისტორიულ response-ებზეა
  // შესაძლებელი (იხ. supabase/migrations/0012_job_responses_price_numeric.sql).
  offered_price: number | null;
};

// Task 5 (audit) — მანამდე `listResponsesForJob` ყოველთვის ამ minimal
// reconstruction-ს აბრუნებდა (rating/reviews/years/jobs/verified/areas/
// specialties ყველა ნაგულისხმევზე, #48-ის ძველი შენიშვნა) — Customer-ს
// დაინტერესებული Provider-ების რეალურად ვერ შეედარებინა. ახლა ეს
// მხოლოდ **fallback**-ია (`listResponsesForJob`-ში), თუ Provider-ს
// რატომღაც `provider_profiles` row საერთოდ არ ჰყავს (თეორიულად
// არარსებული მდგომარეობა, რადგან რეგისტრაცია ყოველთვის ქმნის მას, #53) —
// ჩვეულებრივ ყოველთვის `userService.getRealProvidersByIds`-ის სრული,
// რეალური Provider ობიექტი გამოიყენება.
function fromJobResponseRowFallback(row: JobResponseRow): JobQuote {
  return {
    provider: {
      id: row.provider_id,
      name: row.provider_name,
      category: '',
      years: 0,
      rating: 0,
      reviews: 0,
      location: '',
      areas: [],
      price: '',
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

export interface QuoteService {
  // Supabase-ის `job_responses` ცხრილი (#56) — Provider-ის "დაინტერესება"-ს
  // რეალური ჩაწერა/წაკითხვა. "ახალი ოსტატი დაინტერესდა" შეტყობინება Customer-ს
  // ახლა `on_job_response_insert_notify` trigger-ით ეგზავნება ავტომატურად
  // (#73, supabase/migrations/0021), ამ insert-ის გვერდითი ეფექტის სახით —
  // კლიენტს აღარ სჭირდება customerId-ის ცალკე გადაცემა შეტყობინებისთვის.
  // `offeredPrice` სავალდებულო, კონკრეტული რიცხვია (#72) — აღარ არის
  // არასავალდებულო თავისუფალი ტექსტი; "ფასი სამუშაოს ნახვის შემდეგ" აღარ
  // არსებობს, როგორც შესაძლებლობა.
  //
  // Latest hardening pass — RPC-only (supabase/migrations/0064,
  // `express_interest`). Provider identity (id/name/initials/color) is no
  // longer a parameter at all — the RPC derives provider_id from
  // auth.uid() and provider_name/initials/color from the caller's own
  // provider_profiles row server-side, so a client can never spoof
  // another display identity. Direct client INSERT on job_responses is
  // revoked; this RPC is the only way to create a response.
  expressInterest(jobId: string, offeredPrice: number): Promise<void>;
  // Provider-ის საკუთარი პასუხების job-id-ების სია — Feed/დეტალის ეკრანებზე
  // "უკვე დაინტერესებული ხარ" state-ის აღსადგენად.
  listMyResponseJobIds(providerId: string): Promise<Set<string>>;
  // job-ზე დაინტერესებული ოსტატები რეალურად (job_posts-ის Customer-ისთვის).
  listResponsesForJob(jobId: string): Promise<JobQuote[]>;
}

// TODO: ჩატში სტრუქტურირებული ფასის შეთავაზება/დათანხმება/უარყოფა
// (ChatMsg-ის type:'offer') ცალკე რჩება — ის კონკრეტული საუბრის ნაწილია
// და chatService-ის დომენშია, არა აქ.
export const quoteService: QuoteService = {
  async expressInterest(jobId, offeredPrice) {
    const { error } = await supabase.rpc('express_interest', {
      p_job_id: jobId,
      p_offered_price: offeredPrice,
    });
    if (error) throw error;
  },
  async listMyResponseJobIds(providerId) {
    const { data, error } = await supabase.from('job_responses').select('job_id').eq('provider_id', providerId);
    if (error) throw error;
    return new Set((data as { job_id: string }[]).map((r) => r.job_id));
  },
  async listResponsesForJob(jobId) {
    const { data, error } = await supabase
      .from('job_responses')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const rows = data as JobResponseRow[];
    if (rows.length === 0) return [];

    // ერთი batched query ყველა დაინტერესებული Provider-ისთვის (N+1-ის
    // გარეშე) — enrichment-ის ჩავარდნაზე (ქსელი/RPC) ყველა row უბრალოდ
    // fallback-ზე vardebა, სია მაინც ბრუნდება ცარიელი/crashed-ის ნაცვლად.
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
