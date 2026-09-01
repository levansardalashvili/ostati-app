-- 0045_role_enforcement.sql
-- Second hardening pass, item 1 — the database must not trust that a
-- caller is a Customer or Provider merely because they named their own
-- auth.uid() as customer_id/provider_id. Every INSERT policy that
-- creates a customer_id/provider_id-owning row is tightened to also
-- verify the caller's actual `users.role`, and every workflow RPC that
-- assumes "this uid is a Provider" gets an explicit, redundant check —
-- defense in depth on top of the row-ownership checks these functions
-- already had. No behavior changes for a correctly-behaving client;
-- this only closes paths a malicious/malformed direct REST or RPC call
-- could otherwise use.

-- ============================================================
-- job_posts — only a Customer may create a job post
-- ============================================================
drop policy if exists "Customer can create own jobs" on public.job_posts;
create policy "Customer can create own jobs"
  on public.job_posts for insert
  with check (
    customer_id = auth.uid()
    and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer')
  );

-- ============================================================
-- job_responses — only a Provider may express interest, and only on a
-- job that is genuinely still open (pending). Previously the INSERT
-- policy checked nothing but `provider_id = auth.uid()` — a Customer
-- account could insert a job_responses row naming themselves, and a
-- Provider could respond to a job that was already active/completed/
-- cancelled.
-- ============================================================
drop policy if exists "Provider can express interest as self" on public.job_responses;
create policy "Provider can express interest as self"
  on public.job_responses for insert
  with check (
    provider_id = auth.uid()
    and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider')
    and exists (select 1 from public.job_posts jp where jp.id = job_id and jp.status = 'pending')
  );

-- ============================================================
-- provider_profiles — only a Provider account may create its own
-- profile row. Previously the INSERT policy only checked
-- `auth.uid() = id and verification_status = 'unverified'` — a
-- Customer account could create a provider_profiles row for their own
-- uid, which would then surface them in the public Provider directory
-- (listRealProviders reads every provider_profiles row) despite
-- `users.role` still saying 'customer'.
-- ============================================================
drop policy if exists "Provider can insert own profile" on public.provider_profiles;
create policy "Provider can insert own profile"
  on public.provider_profiles for insert
  with check (
    auth.uid() = id
    and verification_status = 'unverified'
    and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider')
  );

-- ============================================================
-- select_provider() — Customer selects a Provider for their job.
-- Adds: caller must actually be a Customer (redundant with the
-- ownership check below once job_posts.customer_id can only ever
-- belong to a Customer, per this migration's own fix above — kept
-- explicit anyway, per the task's "Customer-only RPCs must require
-- users.role='customer'"), p_provider_id must belong to a real
-- Provider account, and p_provider_id can never equal the job's own
-- customer_id (self-selection).
-- ============================================================
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
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can select a provider';
  end if;

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

  if p_provider_id = v_job.customer_id then
    raise exception 'A job cannot be assigned to its own customer';
  end if;
  if not exists (select 1 from public.users u where u.id = p_provider_id and u.role = 'provider') then
    raise exception 'Selected id does not belong to a Provider account';
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

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (
    p_provider_id,
    'შენ აგირჩიეს სამუშაოსთვის',
    public.job_category_label(v_job.category),
    '🏆',
    '#059669',
    jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'selected'),
    'job_selected'
  );
end;
$$;

comment on function public.select_provider(uuid, uuid) is
  'Customer selects a Provider: pending -> active, notifies the selected Provider (type=job_selected). Requires caller.role=customer, rejects self-selection, and requires p_provider_id to belong to a real Provider account.';

-- Explicit, self-contained revoke+grant (not relying on 0044 having run
-- first — CREATE OR REPLACE preserves prior grants, but this migration
-- should be correct even applied to a database that somehow skipped
-- 0044).
revoke execute on function public.select_provider(uuid, uuid) from public, anon;
grant execute on function public.select_provider(uuid, uuid) to authenticated;

-- ============================================================
-- provider_request_completion() — additionally requires the assigned
-- uid to genuinely be a Provider account (defense in depth: after this
-- migration job_posts.provider_id can only ever be set by
-- select_provider(), which already enforces this, but this function
-- re-checks independently rather than trusting that invariant blindly).
-- ============================================================
create or replace function public.provider_request_completion(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
  v_scheduled_start timestamptz;
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider') then
    raise exception 'Only a Provider account can request completion';
  end if;

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

  v_scheduled_start := public.job_scheduled_start(v_job.preferred_date, v_job.time_slot);
  if v_scheduled_start is not null and now() < v_scheduled_start then
    raise exception 'SCHEDULED_TIME_NOT_REACHED: job is scheduled to start at %, which has not yet arrived', v_scheduled_start;
  end if;

  update public.job_posts set status = 'awaiting_customer_confirmation' where id = p_job_id;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (
    v_job.customer_id,
    'სამუშაო დასრულდა?',
    public.job_category_label(v_job.category),
    '⏰',
    '#D97706',
    jsonb_build_object('screen', 'CustomerJobDetail', 'jobId', p_job_id),
    'completion_reminder'
  );
end;
$$;

comment on function public.provider_request_completion(uuid) is
  'Assigned Provider marks their work done: active -> awaiting_customer_confirmation, notifies the Customer (type=completion_reminder). Requires caller.role=provider in addition to the provider_id ownership check. Rejects (SCHEDULED_TIME_NOT_REACHED) before the job''s scheduled window starts.';

revoke execute on function public.provider_request_completion(uuid) from public, anon;
grant execute on function public.provider_request_completion(uuid) to authenticated;

-- ============================================================
-- provider_cancel_job() — role check added
-- ============================================================
create or replace function public.provider_cancel_job(p_job_id uuid, p_reason_code text, p_details text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider') then
    raise exception 'Only a Provider account can cancel a job this way';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;

  if v_job.provider_id is distinct from auth.uid() then
    raise exception 'Only the assigned provider can cancel this job';
  end if;

  if v_job.status <> 'active' then
    raise exception 'Job cannot be cancelled by the provider from its current status (status=%)', v_job.status;
  end if;

  if p_reason_code is null or p_reason_code not in (
    'provider_unavailable', 'schedule_conflict', 'cannot_complete_job',
    'customer_unreachable', 'incorrect_job_information', 'other'
  ) then
    raise exception 'Invalid cancellation reason: %', p_reason_code;
  end if;

  if p_reason_code = 'other' and (p_details is null or btrim(p_details) = '') then
    raise exception 'Details are required when reason is "other"';
  end if;

  update public.job_posts
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_actor = 'provider',
    cancellation_reason_code = p_reason_code,
    cancellation_reason = nullif(btrim(coalesce(p_details, '')), '')
  where id = p_job_id;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (
    v_job.customer_id,
    'ოსტატმა სამუშაო გააუქმა',
    public.job_category_label(v_job.category),
    '🚫',
    '#DC2626',
    jsonb_build_object('screen', 'CustomerJobDetail', 'jobId', p_job_id),
    'job_status_change'
  );
end;
$$;

comment on function public.provider_cancel_job(uuid, text, text) is
  'Assigned Provider cancels their own active job: active -> cancelled only, notifies the Customer (type=job_status_change). Requires caller.role=provider in addition to the provider_id ownership check.';

revoke execute on function public.provider_cancel_job(uuid, text, text) from public, anon;
grant execute on function public.provider_cancel_job(uuid, text, text) to authenticated;

-- ============================================================
-- cancel_job() — role check added (Customer-only)
-- ============================================================
create or replace function public.cancel_job(p_job_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can cancel this job';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;

  if v_job.customer_id <> auth.uid() then
    raise exception 'Only the job owner can cancel it';
  end if;

  if v_job.status not in ('pending', 'active') then
    raise exception 'Job cannot be cancelled from its current status (status=%)', v_job.status;
  end if;

  update public.job_posts
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_actor = 'customer',
    cancellation_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where id = p_job_id;

  if v_job.provider_id is not null then
    insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
    values (
      v_job.provider_id,
      'მომხმარებელმა მოთხოვნა გააუქმა',
      public.job_category_label(v_job.category),
      '🚫',
      '#DC2626',
      jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'selected'),
      'job_status_change'
    );
  end if;
end;
$$;

comment on function public.cancel_job(uuid, text) is
  'Customer cancels their own job: pending or active -> cancelled, notifies the assigned Provider if any (type=job_status_change). Requires caller.role=customer in addition to the customer_id ownership check.';

revoke execute on function public.cancel_job(uuid, text) from public, anon;
grant execute on function public.cancel_job(uuid, text) to authenticated;

-- ============================================================
-- customer_confirm_completion() / customer_report_problem() — role
-- check added (Customer-only)
-- ============================================================
create or replace function public.customer_confirm_completion(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can confirm completion';
  end if;

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
  'Customer accepts the Provider''s completion request: awaiting_customer_confirmation -> confirmed_awaiting_rating. Requires caller.role=customer in addition to the customer_id ownership check.';

revoke execute on function public.customer_confirm_completion(uuid) from public, anon;
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
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can report a problem';
  end if;

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
    insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
    values (
      v_job.provider_id,
      'მომხმარებელმა პრობლემა აღნიშნა',
      public.job_category_label(v_job.category),
      '⚠️',
      '#DC2626',
      jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'selected'),
      'job_status_change'
    );
  end if;
end;
$$;

comment on function public.customer_report_problem(uuid, text) is
  'Customer disputes the Provider''s completion request: awaiting_customer_confirmation -> disputed, notifies the assigned Provider (type=job_status_change). Requires caller.role=customer in addition to the customer_id ownership check.';

revoke execute on function public.customer_report_problem(uuid, text) from public, anon;
grant execute on function public.customer_report_problem(uuid, text) to authenticated;

-- Grants unchanged from 0044 (CREATE OR REPLACE preserves prior GRANTs;
-- these six were already authenticated-only, PUBLIC/anon-revoked) —
-- explicit grant statements above are for clarity/idempotency only.
