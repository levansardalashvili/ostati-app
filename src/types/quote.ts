import type { Provider } from './provider';

// 'superseded': a newer offer from the same provider on the same job replaced it (DB trigger).
export type QuoteStatus = 'pending' | 'accepted' | 'declined' | 'superseded';

// A provider's interest in a job, with a concrete price (job_responses).
// Chat offer cards (ChatMsg type 'offer') are the other form of a quote.
export type JobQuote = {
  provider: Provider;
  // undefined only on very old responses (they can't be selected)
  offeredPrice?: number;
};
