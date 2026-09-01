-- 0057_messages_job_id_delete_policy.sql
-- Third hardening pass, PRIORITY 8. `messages.job_id` (0049) was added as
--   `references public.job_posts(id) on delete set null`
-- alongside a CHECK constraint added the same migration:
--   `check (type <> 'offer' or job_id is not null)`
-- These two are contradictory: ON DELETE SET NULL is implemented as an
-- UPDATE on the referencing row when the referenced job_posts row is
-- deleted, and that trigger-driven UPDATE is itself subject to the same
-- CHECK constraint as any other write. Deleting a job_posts row that has
-- an offer-type message pointing at it would therefore hit the CHECK
-- constraint mid-delete and fail with a confusing FK-vs-CHECK error,
-- instead of either cleanly cascading or cleanly restricting.
--
-- Chosen policy: RESTRICT. No code path in this product hard-deletes a
-- job_posts row at all — jobs only ever move through the status state
-- machine (0014/0032/0036), including the 'cancelled' terminal state;
-- there is no DELETE anywhere in src/services/jobService.ts or any RPC.
-- RESTRICT turns that existing assumption into an enforced database
-- invariant instead of an implicit one, preserves full message/offer
-- history unconditionally (nothing is ever silently nulled or cascaded
-- away), and eliminates the FK-vs-CHECK contradiction outright: a
-- referenced job_posts row simply cannot be deleted while any message
-- (offer or otherwise) still references it, so the CHECK constraint can
-- never be put in a position to be violated by a cascading action.

alter table public.messages drop constraint if exists messages_job_id_fkey;
alter table public.messages
  add constraint messages_job_id_fkey
  foreign key (job_id) references public.job_posts(id) on delete restrict;

comment on column public.messages.job_id is
  'The job a structured price offer (type=offer) refers to (0049) — required for offer rows via messages_offer_requires_job_id, always null for text/image rows. ON DELETE RESTRICT (0057): job_posts rows are never hard-deleted by this product (status-machine only), and RESTRICT makes that an enforced invariant, avoiding any contradiction with the offer-requires-job_id CHECK constraint.';
