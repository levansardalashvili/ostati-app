import { supabase } from './supabaseClient';
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

// რეალური response-იდან აგებული Provider — მხოლოდ დენორმალიზებული
// (name/initials/color) ველებია ცნობილი, დანარჩენი (rating/reviews/years/...)
// mock `Provider`-ის სრული საჯარო დირექტორიისგან განსხვავებით ჯერ არ
// არსებობს (#48-ის შენიშვნა) — ნაგულისხმევებზეა, `isNewProvider`-ის (#42)
// "ახალი ოსტატი" ვიზუალური მდგომარეობა ამას უკვე გამართულად ამუშავებს.
function fromJobResponseRow(row: JobResponseRow): JobQuote {
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

export type InterestedProvider = { id: string; name: string; initials: string; color: string };

export interface QuoteService {
  // Supabase-ის `job_responses` ცხრილი (#56) — Provider-ის "დაინტერესება"-ს
  // რეალური ჩაწერა/წაკითხვა. "ახალი ოსტატი დაინტერესდა" შეტყობინება Customer-ს
  // ახლა `on_job_response_insert_notify` trigger-ით ეგზავნება ავტომატურად
  // (#73, supabase/migrations/0021), ამ insert-ის გვერდითი ეფექტის სახით —
  // კლიენტს აღარ სჭირდება customerId-ის ცალკე გადაცემა შეტყობინებისთვის.
  // `offeredPrice` სავალდებულო, კონკრეტული რიცხვია (#72) — აღარ არის
  // არასავალდებულო თავისუფალი ტექსტი; "ფასი სამუშაოს ნახვის შემდეგ" აღარ
  // არსებობს, როგორც შესაძლებლობა.
  expressInterest(jobId: string, provider: InterestedProvider, offeredPrice: number): Promise<void>;
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
  async expressInterest(jobId, provider, offeredPrice) {
    const { error } = await supabase.from('job_responses').insert({
      job_id: jobId,
      provider_id: provider.id,
      provider_name: provider.name,
      provider_initials: provider.initials,
      provider_color: provider.color,
      offered_price: offeredPrice,
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
    return (data as JobResponseRow[]).map(fromJobResponseRow);
  },
};
