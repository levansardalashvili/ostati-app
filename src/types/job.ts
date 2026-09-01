// ორმხრივი (two-sided) დასრულების state machine (#72-ის მიხედვით
// გამკვრივებული — რეალურ Postgres RPC-ებზეა აგებული, არა თავისუფალ
// client-side UPDATE-ზე, იხ. supabase/migrations/0014_job_workflow_rpcs.sql):
// pending (Provider ჯერ არ არჩეულა)
//   → active (select_provider() RPC — Customer-მა Provider აირჩია;
//     ატომურად ინიშნება provider_id + agreed_price, ამ ბოლოს პირდაპირ
//     Provider-ის job_responses.offered_price-დან, RPC-ის შიგნით)
//   → awaiting_customer_confirmation (provider_request_completion() RPC —
//     Provider-ს პირდაპირ დასრულება არ შეუძლია, მხოლოდ ამ შუალედურ
//     state-ში გადასვლა)
//   → confirmed_awaiting_rating (customer_confirm_completion() RPC —
//     Customer ეთანხმება, მაგრამ job ჯერ არ არის "completed")
//   → completed (მხოლოდ reviews-ის INSERT trigger-ის (0015) გვერდითი
//     ეფექტით, მას შემდეგ რაც სავალდებულო RatingScreen ვარსკვლავს
//     გააგზავნის — არცერთი RPC პირდაპირ არ აყენებს "completed"-ს)
//   ან → disputed (customer_report_problem() RPC, მიზეზის ტექსტით —
//     job არასდროს ხდება completed ამ short-circuit-ით)
// "cancelled" ამ ციკლის მიღმაა (გამონაკლისი/terminal state, კვლავ
// მხოლოდ ლოკალური UI-ს დონეზე, არასდროს Supabase-ში ჩაწერილი — #47-ის
// ცნობილი შეზღუდვა).
//
// შენიშვნა: StatusPill.tsx ამ ტიპს რეექსპორტავს (`export type { JobStatus }`),
// რომ არსებული `import { StatusPill, type JobStatus } from '../components/StatusPill'`
// import-ები ხელუხლებელი დარჩეს.
// 'draft' — third hardening pass, priority 2 (supabase/migrations/0053):
// create_job() creates a row in this status; it is invisible to every
// Provider read and every workflow RPC, readable only by the owning
// Customer (used to resume a failed publish attempt — see
// PostJobScreen.tsx). It is never expected to reach StatusPill in normal
// use (jobService.listMyJobPosts() excludes it), but is part of the type
// because a direct getJobPostById() read can legitimately return one.
export type JobStatus =
  | 'draft'
  | 'active'
  | 'pending'
  | 'awaiting_customer_confirmation'
  | 'confirmed_awaiting_rating'
  | 'disputed'
  | 'completed'
  | 'cancelled';

// job_posts.time_slot-ის ფიქსირებული მნიშვნელობები (supabase/migrations/
// 0041, `job_posts_time_slot_check`-ის ზუსტი ანარეკლი) — PostJobScreen-ის
// "სასურველი დრო" BottomSheet-ის თითოეული ვარიანტი. `job_scheduled_start()`
// SQL ფუნქცია (იქვე) განსაზღვრავს, რომელი დროიდან ითვლება job-ის
// "დაწყებული" — 'flexible'/`undefined`-ისთვის უბრალოდ თარიღის დასაწყისი
// (00:00, Asia/Tbilisi).
export type TimeSlot = '09-12' | '12-15' | '15-18' | '18-21' | 'flexible';

// Provider-ის მხრიდან ხილული job-ის ჩანაწერი (Job Feed) — რეალურად
// Supabase-ის `job_posts` ცხრილზეა აგებული (#55 "ეტაპი B", jobService.ts-ის
// `getOpenProviderFeedPosts`/`listMyAssignedJobs`).
export type FeedJob = {
  id: string;
  category: string;
  // job_posts-ს აღარ აქვს `title` სვეტი (#72 — ლეგასი, user-entered
  // title წაშლილია canonical მოდელიდან, იხ.
  // supabase/migrations/0011_job_posts_workflow_columns.sql). ეს ველი
  // UI-ს გამო რჩება (ეკრანების ცვლილება არ დასჭირდა), მაგრამ
  // jobService.ts-ში კატეგორიიდან გამოითვლება (`deriveJobTitle`), არა
  // ბაზიდან წაკითხული.
  title: string;
  customer: string;
  location: string;
  date: string;
  ago: string;
  interested: number;
  urgent: boolean;
  hasPhoto: boolean;
  desc: string;
  // Customer-ის მიერ არჩეული Provider-ის id, თუ job უკვე გადაწყვეტილია.
  // CURRENT_PROVIDER_ID-ს დამთხვევისას job Feed-იდან ქრება და "მიმდინარე
  // სამუშაო" ხდება Provider Home-ზე; ნებისმიერი სხვა id-ით — უბრალოდ ქრება
  // Feed-იდან (job სხვა Provider-ისთვის დაიხურა). undefined/null — job
  // ჯერ კიდევ ღიაა ინტერესის გამოსახატად.
  assignedProviderId?: string | null;
  // თუ ეს Feed-job ზუსტად შეესაბამება CUSTOMER_JOBS-ის რომელიმე ჩანაწერს
  // (იგივე "namdvili" job ორივე მხრიდან), მისი id აქ — ორმხრივი დასრულების
  // state machine (JobStatusContext.tsx) ამ id-ით კითხულობს/წერს გაზიარებულ
  // სტატუსს ProviderJobDetailScreen-ზე. undefined — ეს Feed-job მხოლოდ
  // Provider-მხრიდანაა მოდელირებული, Customer-ის მხარეს შესატყვისი ჩანაწერი
  // არ არსებობს.
  customerJobId?: string;
  // რეალური job_posts.status (#69) — შევსებულია მხოლოდ `listMyAssignedJobs`-ის
  // შედეგზე ("ჩემი სამუშაოები"/"მიმდინარე სამუშაო" ბარათებისთვის),
  // undefined Job Feed-ის ღია (ყოველთვის 'pending') ჩანაწერებზე.
  status?: JobStatus;
  // job_posts.customer_id (#70) — Provider-ის "დაინტერესებისას"/"სამუშაო
  // დავასრულე"-ს დროს საჭიროა, რომ ვიცოდეთ Customer-ს (job-ის owner-ს)
  // ვის შევუთხოვოთ შეტყობინება. undefined mock demo ჩანაწერებზე.
  customerId?: string;
  // job_posts.agreed_price (#72) — select_provider() RPC-ის მიერ
  // ატომურად კოპირებული არჩეული Provider-ის job_responses.offered_price-დან.
  // undefined/null სანამ Provider ჯერ არ არჩეულა.
  agreedPrice?: number | null;
  // job_posts.cancellation_actor (supabase/migrations/0036) — ვინ
  // გააუქმა (`cancel_job`/`provider_cancel_job` RPC-ებში სერვერზეა
  // derived, არასდროს client-ის claim). `undefined`/`null` — job
  // არასდროს გაუქმებულა, ან ძველი, migration-მდელი ჩანაწერია.
  // `ProviderJobDetailScreen`-ის 'cancelled' variant-ის ტექსტს იყენებს,
  // რომ არასწორად "მომხმარებელმა გააუქმა" არ დაწეროს, როცა სინამდვილეში
  // Provider-მა თავად გააუქმა საკუთარი job.
  cancellationActor?: 'customer' | 'provider' | 'admin' | null;
  // job_posts.preferred_date/time_slot (supabase/migrations/0041) —
  // კანონიკური (structured) დანართი არსებული თავისუფალ-ტექსტური
  // `date`-ის გვერდით, რომელიც ჩვენებისთვის უცვლელად რჩება. `undefined`
  // ძველ, migration-მდელ job-ებზე (განრიგის შეზღუდვის გარეშე, ისევე
  // როგორც აქამდე). `provider_request_completion()` RPC (0041) სწორედ
  // ამ ორ ველზეა აგებული, არა თავისუფალ `date`-ზე.
  preferredDate?: string | null;
  timeSlot?: TimeSlot | null;
};

// Customer-ის მხრიდან ხილული job-ის ჩანაწერი — რეალურად Supabase-ის
// `job_posts` ცხრილზეა აგებული (#54 "ეტაპი A", jobService.ts-ის
// `createCustomerJob`/`listMyJobPosts`/`getJobPostById`).
export type CustomerJob = {
  id: string;
  // job_posts-ს აღარ აქვს `title` სვეტი (#72) — იხ. FeedJob.title-ის
  // იგივე შენიშვნა ზემოთ.
  title: string;
  category: string;
  // სრული JobStatus union-ია (#67) — ადრე ვიწრო '`active`|`pending`|
  // `completed`|`cancelled`' იყო, `JobStatusContext`-ის რეალურად უფრო
  // ფართო მდგომარეობებთან (`awaiting_customer_confirmation`/`disputed`)
  // შეუსაბამოდ.
  status: JobStatus;
  provider: string | null;
  // job_posts.provider_id (#71) — Provider-ის რეალურ id-ზე დაფუძნებული
  // ჩატის გახსნა (CustomerJobsScreen-ის "ჩატი" ღილაკი), `provider`
  // (სახელი) ცალკეა ისტორიულად, ჩვენებისთვის საკმარისი იყო.
  providerId?: string;
  date: string;
  address: string;
  desc: string;
  // Supabase Storage-ის საჯარო URL-ები (#63) — `undefined` ძველ mock
  // demo-ჩანაწერებზე (j1/j2/j3, #61-ის წინა), ცარიელი მასივი რეალურ
  // job-ზე ფოტოს გარეშე, შევსებული მასივი — რეალურ ატვირთულ ფოტოებზე.
  photos?: string[];
  // job_posts.agreed_price (#72) — იხ. FeedJob-ის იგივე ველი ზემოთ.
  agreedPrice?: number | null;
  // job_posts.dispute_reason (#72) — customer_report_problem() RPC-ის
  // მიერ შენახული თავისუფალი ტექსტი, მხოლოდ 'disputed' სტატუსზე.
  disputeReason?: string | null;
  // იხ. FeedJob-ის იგივე ველების შენიშვნა ზემოთ (supabase/migrations/0041).
  preferredDate?: string | null;
  timeSlot?: TimeSlot | null;
};
