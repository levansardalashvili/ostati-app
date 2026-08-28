import type { JobQuote } from '../types/quote';
import { INTERESTED_PROVIDERS } from '../data/mockHomeData';

export interface QuoteService {
  // job-ზე დაინტერესებული ოსტატები + მათი ხელით შეთავაზებული ფასები
  // (თუ მითითებულია).
  getQuotesForJob(jobId: string): JobQuote[];
}

// TODO: ჩანაცვლდება Firestore-ის jobResponses collection-ით (providerId,
// jobId, offeredPrice). ჩატში სტრუქტურირებული ფასის შეთავაზება/დათანხმება/
// უარყოფა (ChatMsg-ის type:'offer') ცალკე რჩება — ის კონკრეტული საუბრის
// ნაწილია და chatService-ის დომენშია, არა აქ.
export const quoteService: QuoteService = {
  getQuotesForJob: (jobId) => INTERESTED_PROVIDERS[jobId] ?? [],
};
