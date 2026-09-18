-- 0082_offer_supersede_and_stale_interest.sql
-- Two more findings from the same "job-taking logic" review as 0081,
-- both explicitly approved by the user before starting.
--
-- ITEM A — a Provider could send a new chat price offer while an OLDER
-- one they sent on the same job was still sitting `offer_status='pending'`
-- (nothing in sendRealOffer/the messages INSERT policy prevented it).
-- Accepting the NEW offer never touched the old message row at all — it
-- stayed 'pending' forever, a stale offer card sitting in the chat
-- history offering "დათანხმება/უარყოფა" buttons for a price that no
-- longer applies (accepting it would still work mechanically via
-- respond_to_chat_offer, since that function only looks at the one
-- message row + job_posts.status='pending' — but job_posts is already
-- `active` by the time this could happen, so it would raise "Price can
-- no longer be changed", a confusing dead end for the Customer to
-- discover by tapping a stale button). Fixed with a trigger, not a
-- client-side check — offers are inserted via direct client INSERT
-- (RLS-gated, 0066), not a single RPC choke point, so a trigger is the
-- one place guaranteed to see every offer regardless of insert path.
-- SECURITY DEFINER is required: the UPDATE this trigger performs (superseding
-- the SENDER's own prior pending offer) is exactly what "Participant can
-- update messages" (0028/0097) forbids a Provider from doing to their own
-- row directly (offer_status UPDATE is restricted to `sender_id <>
-- auth.uid()` — only the Customer may act on a Provider's offer) — same
-- reasoning 0021/0022's other trigger-only functions are SECURITY
-- DEFINER with no client EXECUTE grant (trigger firing does not check
-- the invoking role's EXECUTE privilege, 0044/0096).
alter table public.messages drop constraint if exists messages_offer_status_check;
alter table public.messages add constraint messages_offer_status_check
  check (offer_status is null or offer_status in ('pending', 'accepted', 'declined', 'superseded'));

create or replace function public.supersede_prior_offers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type = 'offer' then
    update public.messages
    set offer_status = 'superseded'
    where job_id = new.job_id
      and provider_id = new.provider_id
      and type = 'offer'
      and offer_status = 'pending'
      and id <> new.id;
  end if;
  return new;
end;
$$;

comment on function public.supersede_prior_offers() is
  'AFTER INSERT trigger on messages — when a new type=offer message is inserted, marks this same (job_id, provider_id) Provider''s own still-pending prior offers as superseded, so a stale, unanswered offer card never sits actionable in chat history after a newer one replaces it. Scoped to (job_id, provider_id) together, not job_id alone, because multiple different Providers can each have their own separate offer thread on the same open job — one Provider''s new offer must never touch another Provider''s pending offer.';

revoke all on function public.supersede_prior_offers() from public, anon, authenticated;

drop trigger if exists supersede_prior_offers on public.messages;
create trigger supersede_prior_offers
  after insert on public.messages
  for each row
  execute function public.supersede_prior_offers();

-- ITEM B — a job with ZERO interest just sits `pending` forever with no
-- signal to the Customer at all (contrast: the Customer already gets a
-- notification for every new job_responses row that DOES arrive, 0021 —
-- the gap is specifically the case where none ever arrives). No cron
-- infrastructure exists in this project (same reasoning as 0079) — this
-- is the same lazy/opportunistic pattern: a participant-callable RPC
-- that only actually does something once real conditions are met, called
-- fire-and-forget from the client whenever the Customer happens to view
-- the job. Sends AT MOST ONE reminder ever per job (idempotency via the
-- new `stale_interest_reminder_sent_at` timestamp, not a general dedupe
-- query) — a repeated nag every time the Customer reopens the screen
-- would be worse than the silence it's fixing.
alter table public.job_posts add column if not exists stale_interest_reminder_sent_at timestamptz;

create or replace function public.check_stale_job_interest(p_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id <> auth.uid() then
    raise exception 'Only the job owner may check its interest status';
  end if;

  if v_job.status <> 'pending' then
    return false;
  end if;
  if v_job.stale_interest_reminder_sent_at is not null then
    return false;
  end if;
  if v_job.created_at > now() - interval '48 hours' then
    return false;
  end if;
  if exists (select 1 from public.job_responses where job_id = p_job_id) then
    return false;
  end if;

  update public.job_posts set stale_interest_reminder_sent_at = now() where id = p_job_id;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (
    v_job.customer_id,
    'ჯერ არავინ დაინტერესებულა',
    public.job_category_label(v_job.category),
    '🕓',
    '#64748B',
    jsonb_build_object('screen', 'CustomerJobDetail', 'jobId', p_job_id),
    'job_status_change'
  );

  return true;
end;
$$;

comment on function public.check_stale_job_interest(uuid) is
  'Opportunistic, lazily-triggered check (mirrors expire_stale_job_confirmation, 0079): if a job has been pending >=48h with zero job_responses and no reminder has been sent yet (stale_interest_reminder_sent_at), sends the owning Customer exactly one notification and stamps the timestamp so it never repeats. Callable only by the job''s own customer_id; returns false (not an error) whenever conditions are not met — only raises for auth/not-found/non-owner. No status change to job_posts itself, unlike 0078/0079 — there is no automatic resolution for "nobody is interested," only a nudge.';

revoke all on function public.check_stale_job_interest(uuid) from public, anon;
grant execute on function public.check_stale_job_interest(uuid) to authenticated;
