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
  t?: string;
  state?: MsgState;
  label?: string;
  amount?: number;
  comment?: string;
  offerStatus?: OfferStatus;
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
