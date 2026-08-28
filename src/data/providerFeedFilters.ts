import { PROVIDER_FEED, type FeedJob } from './mockHomeData';

// მიმდინარე Provider-ის mock id (PROVIDERS[0]-ის შესატყვისი) — Job Feed-ის
// "ეს Provider აირჩიეს" vs "სხვამ აირჩია" განსხვავებისთვის.
export const CURRENT_PROVIDER_ID = 'p1';

// ღია Job-ები — ჯერ არავისთვის არ არის დახურული (`assignedProviderId`
// ცარიელია). ProviderHomeScreen-სა და ProviderJobFeedScreen-ს შორის
// გაზიარებული, რომ ორივემ ერთნაირად "დახუროს" job სხვა Provider-ის
// არჩევისას.
export function getOpenProviderFeed(): FeedJob[] {
  return PROVIDER_FEED.filter((j) => !j.assignedProviderId);
}
