-- 0021_job_responses_notify_trigger.sql
-- Task 3 — "Provider interest" notification. Previously
-- src/services/quoteService.ts's expressInterest() called
-- notificationService.create(customerId, ...) directly from the client
-- after inserting the job_responses row — only possible because of
-- 0009's now-removed open INSERT policy on `notifications`. A malicious
-- client could have called that with any customerId/body, unrelated to
-- a real job_responses row.
--
-- Now a trigger does it: 0005_job_responses.sql's own RLS already
-- guarantees NEW.provider_id = auth.uid() for the row to exist at all,
-- so by the time this fires the "interest" is real. The recipient
-- (job_posts.customer_id) and the Provider's display name are both
-- looked up server-side (SECURITY DEFINER bypasses RLS) rather than
-- trusted from job_responses.provider_name, which is technically
-- client-supplied at insert time.

create or replace function public.handle_job_response_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid;
  v_category text;
  v_provider_name text;
begin
  select customer_id, category into v_customer_id, v_category
    from public.job_posts where id = new.job_id;
  if v_customer_id is null then
    return new;
  end if;

  select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), null)
    into v_provider_name
    from public.provider_profiles where id = new.provider_id;
  v_provider_name := coalesce(v_provider_name, nullif(btrim(new.provider_name), ''), 'ოსტატი');

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target)
  values (
    v_customer_id,
    'ახალი ოსტატი დაინტერესდა',
    v_provider_name || ' დაინტერესდა შენი მოთხოვნით (' || public.job_category_label(v_category) || ')',
    '🔧',
    '#2563EB',
    jsonb_build_object('screen', 'CustomerJobDetail', 'jobId', new.job_id)
  );

  return new;
end;
$$;

comment on function public.handle_job_response_notify() is
  'AFTER INSERT ON job_responses: notifies the job owner. Recipient and event legitimacy are both re-derived server-side from job_posts/job_responses, never trusted from a client parameter.';

drop trigger if exists on_job_response_insert_notify on public.job_responses;
create trigger on_job_response_insert_notify
  after insert on public.job_responses
  for each row
  execute function public.handle_job_response_notify();
