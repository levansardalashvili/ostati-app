// Job status, changed only by RPCs/triggers:
// draft → pending → active (provider selected, price fixed)
// → awaiting_customer_confirmation (provider marked done)
// → confirmed_awaiting_rating → completed (only via the review insert trigger).
// Side branches: disputed (customer reported a problem), cancelled.
// 'draft' is visible only to its owner (an unfinished publish).
export type JobStatus =
  | 'draft'
  | 'active'
  | 'pending'
  | 'awaiting_customer_confirmation'
  | 'confirmed_awaiting_rating'
  | 'disputed'
  | 'completed'
  | 'cancelled';

// 'HH-HH' in Georgian time (e.g. '09-10'; old jobs '09-12') or 'flexible' — see data/timeSlots.ts.
export type TimeSlot = string;

// A job as the provider sees it (feed, assigned jobs).
export type FeedJob = {
  id: string;
  category: string;
  // derived from the category
  title: string;
  customer: string;
  location: string;
  date: string;
  ago: string;
  urgent: boolean;
  hasPhoto: boolean;
  photos?: string[];
  desc: string;
  // the selected provider; set = the job is no longer open
  assignedProviderId?: string | null;
  // same as id; key for JobStatusContext
  customerJobId?: string;
  // set only on assigned jobs (open feed jobs are always 'pending')
  status?: JobStatus;
  customerId?: string;
  // copied from the chosen response's offered_price on selection
  agreedPrice?: number | null;
  // who cancelled — set by the server
  cancellationActor?: 'customer' | 'provider' | 'admin' | null;
  // canonical schedule (null on old jobs); `date` is display text
  preferredDate?: string | null;
  timeSlot?: TimeSlot | null;
};

// A job as its customer sees it.
export type CustomerJob = {
  id: string;
  // private job ("მიწერა"/rehire) and whether that provider declined
  invitedProviderId?: string | null;
  inviteDeclinedAt?: string | null;
  // derived from the category
  title: string;
  category: string;
  status: JobStatus;
  provider: string | null;
  providerId?: string;
  date: string;
  address: string;
  // structured district/city (undefined on old jobs)
  district?: string;
  desc: string;
  photos?: string[];
  agreedPrice?: number | null;
  // reopen is offered only when the provider cancelled
  cancellationActor?: 'customer' | 'provider' | 'admin' | null;
  createdAt?: string;
  // set while 'disputed'
  disputeReason?: string | null;
  preferredDate?: string | null;
  timeSlot?: TimeSlot | null;
};
