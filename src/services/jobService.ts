import type { CustomerJob, FeedJob, MyJobRow } from '../types/job';
import { CUSTOMER_JOBS, PROVIDER_FEED } from '../data/mockHomeData';
import { PROVIDER_MY_JOBS_ACTIVE, PROVIDER_MY_JOBS_DONE } from '../data/mockReviews';

// მიმდინარე Provider-ის mock id (PROVIDERS[0]-ის შესატყვისი) — Job Feed-ის
// "ეს Provider აირჩიეს" vs "სხვამ აირჩია" განსხვავებისთვის. (ადრე
// providerFeedFilters.ts-ში იყო — ეს ფაილი ჩანაცვლდა ამ სერვისით.)
export const CURRENT_PROVIDER_ID = 'p1';

export interface JobService {
  listCustomerJobs(): CustomerJob[];
  getCustomerJobById(id: string): CustomerJob | undefined;
  listProviderFeed(): FeedJob[];
  // ღია Job-ები — ჯერ არავისთვის არ არის დახურული (`assignedProviderId`
  // ცარიელია). ProviderHomeScreen-სა და ProviderJobFeedScreen-ს შორის
  // გაზიარებული, რომ ორივემ ერთნაირად "დახუროს" job სხვა Provider-ის
  // არჩევისას.
  getOpenProviderFeed(): FeedJob[];
  getFeedJobById(id: string): FeedJob | undefined;
  listMyActiveJobs(): MyJobRow[];
  listMyDoneJobs(): MyJobRow[];
}

// TODO: ჩანაცვლდება Firestore-ის jobPosts collection-ის queries-ით.
// ჯერჯერობით მხოლოდ mockHomeData.ts/mockReviews.ts-ის მონაცემებზეა
// აგებული — ეკრანებმა ეს ორი ფაილი პირდაპირ აღარ უნდა შემოიტანონ.
export const jobService: JobService = {
  listCustomerJobs: () => CUSTOMER_JOBS,
  getCustomerJobById: (id) => CUSTOMER_JOBS.find((j) => j.id === id),
  listProviderFeed: () => PROVIDER_FEED,
  getOpenProviderFeed: () => PROVIDER_FEED.filter((j) => !j.assignedProviderId),
  getFeedJobById: (id) => PROVIDER_FEED.find((j) => j.id === id),
  listMyActiveJobs: () => PROVIDER_MY_JOBS_ACTIVE,
  listMyDoneJobs: () => PROVIDER_MY_JOBS_DONE,
};
