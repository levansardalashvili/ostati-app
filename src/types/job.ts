// ორმხრივი (two-sided) დასრულების state machine:
// pending (Provider ჯერ არ არჩეულა)
//   → active (= "provider_selected" — Customer-მა Provider აირჩია)
//   → awaiting_customer_confirmation (Provider-მა დააჭირა "სამუშაო დავასრულე" —
//     Provider-ს პირდაპირ დასრულება არ შეუძლია, მხოლოდ ამ შუალედურ state-ში გადასვლა)
//   → completed (მხოლოდ მას შემდეგ რაც Customer დაადასტურებს ("დადასტურება")
//     და სავალდებულო RatingScreen-ზე ვარსკვლავს გაგზავნის — status "completed"
//     ხდება ვარსკვლავის გაგზავნის მომენტში, არა უფრო ადრე)
//   ან → disputed (Customer-მა "პრობლემა მაქვს" აირჩია — job არასდროს ხდება
//     completed ამ short-circuit-ით, პრობლემის flow განაგრძობს ცალკე)
// "cancelled" ამ ციკლის მიღმაა (გამონაკლისი/terminal state).
//
// სახელები განზრახ არჩეულია მომავალი ბარათით გადახდის უსაფრთხოდ დამატებისთვის —
// მაგ. 'payment_pending'/'paid' შეიძლება ჩაისვას 'awaiting_customer_confirmation'-სა
// და 'completed'-ს შორის (ან 'completed'-ის შემდეგ) სტრუქტურის შეცვლის გარეშე,
// რადგან job-ის სტატუსი უკვე string-keyed union-ია, არა boolean flag-ების ნაკრები.
//
// შენიშვნა: StatusPill.tsx ამ ტიპს რეექსპორტავს (`export type { JobStatus }`),
// რომ არსებული `import { StatusPill, type JobStatus } from '../components/StatusPill'`
// import-ები ხელუხლებელი დარჩეს.
export type JobStatus = 'active' | 'pending' | 'awaiting_customer_confirmation' | 'disputed' | 'completed' | 'cancelled';

// Provider-ის მხრიდან ხილული job-ის ჩანაწერი (Job Feed) — TODO: Firestore-ის
// jobPosts collection-ის Provider-ისთვის ხილვადი queries.
export type FeedJob = {
  id: string;
  category: string;
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
};

// Customer-ის მხრიდან ხილული job-ის ჩანაწერი — TODO: Firestore-ის jobPosts
// collection-ის Customer-ისთვის ხილვადი queries.
export type CustomerJob = {
  id: string;
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
};
