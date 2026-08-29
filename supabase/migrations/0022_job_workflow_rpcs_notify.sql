-- 0022_job_workflow_rpcs_notify.sql
-- Task 3 — "Provider selected" and "completion requested" notifications.
-- Previously created client-side (CustomerJobDetailScreen.confirmSelection
-- / ProviderJobDetailScreen.markWorkDone called notificationService.create
-- directly, right after awaiting the corresponding RPC). That only ever
-- worked because of 0009's now-removed open INSERT policy — and even
-- setting that aside, it trusted the client to correctly report "the RPC
-- I just called actually succeeded and I am who I claim".
--
-- These three functions (0014) are already SECURITY DEFINER with their
-- own internal auth.uid()/status re-validation, so they are the correct
-- place to add the notification insert too — CREATE OR REPLACE with the
-- exact same signature/behavior, plus one insert into `notifications`
-- once the state transition has actually been committed to job_posts.
-- select_provider/provider_request_completion/customer_report_problem
-- are otherwise byte-for-byte identical to 0014.

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

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target)
  values (
    p_provider_id,
    'შენ აგირჩიეს სამუშაოსთვის',
    public.job_category_label(v_job.category),
    '🏆',
    '#059669',
    jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'selected')
  );
end;
$$;

comment on function public.select_provider(uuid, uuid) is
  'Customer selects a Provider for their job: validates the Provider has a priced response, copies that price into agreed_price, assigns provider_id, moves status pending -> active, and notifies the selected Provider. Atomic; only callable by the job''s own customer.';

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

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target)
  values (
    v_job.customer_id,
    'სამუშაო დასრულდა?',
    public.job_category_label(v_job.category),
    '⏰',
    '#D97706',
    jsonb_build_object('screen', 'CustomerJobDetail', 'jobId', p_job_id)
  );
end;
$$;

comment on function public.provider_request_completion(uuid) is
  'Assigned Provider marks their work done: active -> awaiting_customer_confirmation, and notifies the Customer. A Provider can never mark a job completed directly.';

grant execute on function public.provider_request_completion(uuid) to authenticated;


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

  if v_job.provider_id is not null then
    insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target)
    values (
      v_job.provider_id,
      'მომხმარებელმა პრობლემა აღნიშნა',
      public.job_category_label(v_job.category),
      '⚠️',
      '#DC2626',
      jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'selected')
    );
  end if;
end;
$$;

comment on function public.customer_report_problem(uuid, text) is
  'Customer disputes the Provider''s completion request instead of confirming it: awaiting_customer_confirmation -> disputed, storing the given reason, and notifies the assigned Provider.';

grant execute on function public.customer_report_problem(uuid, text) to authenticated;
