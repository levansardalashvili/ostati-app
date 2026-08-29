-- 0014_job_workflow_rpcs.sql
-- The four critical job-workflow transitions, each as a SECURITY
-- DEFINER function with its own internal authorization check (so it
-- works correctly even though 0013 has locked the client out of writing
-- these columns directly via RLS). Each function:
--   - locks the job_posts row (`for update`) so concurrent calls can't
--     race each other into an inconsistent state — this is what makes
--     each one atomic, on top of already running inside one implicit
--     transaction as a single function call;
--   - re-validates the caller's identity and the job's current status
--     server-side, never trusting anything the client claims;
--   - raises a descriptive exception (surfaced to the client as a
--     Postgres error) on any rule violation, rather than silently
--     no-op'ing.
--
-- `set search_path = ''` on every function avoids the classic SECURITY
-- DEFINER search_path hijack — every reference below is fully schema
-- qualified (public.job_posts, public.job_responses) precisely because
-- of this.

create or replace function public.select_provider(p_job_id uuid, p_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
  v_response public.job_responses%rowtype;
begin
  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id <> auth.uid() then
    raise exception 'Only the job owner can select a provider';
  end if;
  if v_job.status <> 'pending' then
    raise exception 'Job is not open for provider selection (status=%)', v_job.status;
  end if;

  select * into v_response from public.job_responses
    where job_id = p_job_id and provider_id = p_provider_id;
  if v_response.id is null then
    raise exception 'Selected provider has not responded to this job';
  end if;
  if v_response.offered_price is null or v_response.offered_price <= 0 then
    raise exception 'Selected provider response has no valid price';
  end if;

  update public.job_posts
  set
    provider_id = p_provider_id,
    provider_name = v_response.provider_name,
    agreed_price = v_response.offered_price,
    status = 'active'
  where id = p_job_id;
end;
$$;

comment on function public.select_provider(uuid, uuid) is
  'Customer selects a Provider for their job: validates the Provider has a priced response, copies that price into agreed_price, assigns provider_id, and moves status pending -> active. Atomic; only callable by the job''s own customer.';

grant execute on function public.select_provider(uuid, uuid) to authenticated;


create or replace function public.provider_request_completion(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
begin
  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.provider_id is distinct from auth.uid() then
    raise exception 'Only the assigned provider can request completion';
  end if;
  if v_job.status <> 'active' then
    raise exception 'Job is not in a state that can request completion (status=%)', v_job.status;
  end if;

  update public.job_posts set status = 'awaiting_customer_confirmation' where id = p_job_id;
end;
$$;

comment on function public.provider_request_completion(uuid) is
  'Assigned Provider marks their work done: active -> awaiting_customer_confirmation. A Provider can never mark a job completed directly.';

grant execute on function public.provider_request_completion(uuid) to authenticated;


create or replace function public.customer_confirm_completion(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
begin
  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id <> auth.uid() then
    raise exception 'Only the job owner can confirm completion';
  end if;
  if v_job.status <> 'awaiting_customer_confirmation' then
    raise exception 'Job is not awaiting confirmation (status=%)', v_job.status;
  end if;

  update public.job_posts set status = 'confirmed_awaiting_rating' where id = p_job_id;
end;
$$;

comment on function public.customer_confirm_completion(uuid) is
  'Customer accepts the Provider''s completion request: awaiting_customer_confirmation -> confirmed_awaiting_rating. Job only reaches "completed" once a review is actually submitted (see 0015''s trigger) — rating is mandatory, not optional.';

grant execute on function public.customer_confirm_completion(uuid) to authenticated;


create or replace function public.customer_report_problem(p_job_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
begin
  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id <> auth.uid() then
    raise exception 'Only the job owner can report a problem';
  end if;
  if v_job.status <> 'awaiting_customer_confirmation' then
    raise exception 'Job is not awaiting confirmation (status=%)', v_job.status;
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required';
  end if;

  update public.job_posts
  set status = 'disputed', dispute_reason = p_reason
  where id = p_job_id;
end;
$$;

comment on function public.customer_report_problem(uuid, text) is
  'Customer disputes the Provider''s completion request instead of confirming it: awaiting_customer_confirmation -> disputed, storing the given reason.';

grant execute on function public.customer_report_problem(uuid, text) to authenticated;
