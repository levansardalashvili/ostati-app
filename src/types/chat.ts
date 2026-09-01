import type { JobStatus } from './job';
import type { QuoteStatus } from './quote';

export type MsgState = 'sending' | 'sent' | 'read' | 'failed';

// ალიასი QuoteStatus-ზე (src/types/quote.ts) — იგივე კონცეფცია, ჩატის
// ერთი შეტყობინების დონეზე.
export type OfferStatus = QuoteStatus;

export type ChatMsg = {
  id: string;
  type: 'text' | 'image' | 'date' | 'offer';
  from: 'me' | 'other';
  text?: string;
  imgColor?: string;
  // რეალური Supabase Storage-ის URL (#68) — თუ არსებობს, რეალურ სურათს
  // ასახავს, `imgColor`-ის (mock placeholder) ნაცვლად.
  imageUrl?: string;
  t?: string;
  state?: MsgState;
  label?: string;
  amount?: number;
  comment?: string;
  offerStatus?: OfferStatus;
  // Second hardening pass, item 5 (supabase/migrations/0049) — job-ის
  // id, რომელსაც ეს ფასის შეთავაზება ეხება. `undefined` ისტორიულ
  // (job-scoping-მდელ) offer-ებზე.
  jobId?: string;
};

export type ChatEntry = {
  id: string;
  name: string;
  initials: string;
  color: string;
  last: string;
  time: string;
  unread: number;
  online: boolean;
  jobId?: string;
  jobTitle?: string;
  jobCategory?: string;
  jobDistrict?: string;
  jobDate?: string;
  jobStatus?: JobStatus;
};
