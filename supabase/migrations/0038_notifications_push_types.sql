-- 0038_notifications_push_types.sql
-- Expo Push Notifications, step 2 — tags every notification with a
-- `type`, so the push-sending Edge Function (triggered per-row by a
-- Database Webhook on INSERT, configured outside SQL — see
-- supabase/functions/send-push-notifications/README.md) knows which
-- notification_preferences key to check before sending an OS push, and
-- the mobile client can special-case push body sanitization for chat
-- messages. This migration does NOT send any push itself and does NOT
-- change what triggers an in-app notification row, when, or its
-- content — only CREATE OR REPLACEs the 8 existing notification-writing
-- functions (0020/0021/0022 x3/0023/0033/0036 x2) to add one more column
-- to their existing INSERT, byte-for-byte identical otherwise.
--
-- `type` values match src/screens/NotificationSettingsScreen.tsx's
-- existing CUSTOMER_TOGGLES/PROVIDER_TOGGLES keys exactly (new_interest,
-- new_chat_message, job_status_change, completion_reminder,
-- new_jobs_in_area, job_selected) — no second, unrelated vocabulary
-- invented. 'new_jobs_in_area' is introduced by the very next migration
-- (0039); 'new_review' (an existing PROVIDER_TOGGLES key) has no writer
-- here because nothing in this schema creates a review-received
-- notification today (a pre-existing gap, not introduced by this task).

alter table public.notifications add column if not exists type text;

-- Best-effort backfill for rows that predate this column, matched
-- against the exact title/target strings each function has always used
-- (verified against 0020/0021/0022/0023/0033's current bodies, not
-- guessed). Historical rows this can't classify (title text that never
-- matched any of these, e.g. very old/edited data) are simply left NULL
-- — the Edge Function treats a NULL type as "send, don't gate on a
-- preference key" (see its own comments), so this is safe either way.
update public.notifications set type = case
  when target->>'screen' = 'ChatConversation' then 'new_chat_message'
  when title = 'ახალი ოსტატი დაინტერესდა' then 'new_interest'
  when title = 'შენ აგირჩიეს სამუშაოსთვის' then 'job_selected'
  when title = 'სამუშაო დასრულდა?' then 'completion_reminder'
  when title in (
    'მომხმარებელმა პრობლემა აღნიშნა',
    'სამუშაო დასრულებულად დადასტურდა',
    'მომხმარებელმა მოთხოვნა გააუქმა',
    'ოსტატმა სამუშაო გააუქმა'
  ) then 'job_status_change'
  else type
end
where type is null;

-- ============================================================
-- 0020 — new chat message
-- ============================================================
create or replace function public.handle_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_name text;
  v_customer_initials text;
  v_provider_name text;
  v_provider_initials text;
  v_body text;
  v_recipient uuid;
  v_sender_name text;
  v_sender_initials text;
  v_inc_customer int;
  v_inc_provider int;
begin
  select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'მომხმარებელი'),
         upper(left(coalesce(first_name, ''), 1) || left(coalesce(last_name, ''), 1))
    into v_customer_name, v_customer_initials
    from public.users where id = new.customer_id;

  select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'ოსტატი'),
         upper(left(coalesce(first_name, ''), 1) || left(coalesce(last_name, ''), 1))
    into v_provider_name, v_provider_initials
    from public.provider_profiles where id = new.provider_id;

  v_body := case new.type
    when 'offer' then 'შეთავაზებული ფასი: ' || trim(to_char(coalesce(new.amount, 0), 'FM999999990')) || ' ₾'
    when 'image' then '📷 ფოტო'
    else new.text
  end;

  v_inc_customer := case when new.sender_id = new.customer_id then 0 else 1 end;
  v_inc_provider := case when new.sender_id = new.customer_id then 1 else 0 end;

  insert into public.conversations (
    customer_id, provider_id, customer_name, customer_initials, customer_color,
    provider_name, provider_initials, provider_color, last_message, last_message_at,
    customer_unread, provider_unread
  ) values (
    new.customer_id, new.provider_id,
    coalesce(v_customer_name, ''), coalesce(v_customer_initials, ''), '#2563EB',
    coalesce(v_provider_name, ''), coalesce(v_provider_initials, ''), '#2563EB',
    v_body, new.created_at, v_inc_customer, v_inc_provider
  )
  on conflict (customer_id, provider_id) do update set
    customer_name = excluded.customer_name,
    customer_initials = excluded.customer_initials,
    provider_name = excluded.provider_name,
    provider_initials = excluded.provider_initials,
    last_message = excluded.last_message,
    last_message_at = excluded.last_message_at,
    customer_unread = public.conversations.customer_unread + v_inc_customer,
    provider_unread = public.conversations.provider_unread + v_inc_provider;

  v_recipient := case when new.sender_id = new.customer_id then new.provider_id else new.customer_id end;
  v_sender_name := case when new.sender_id = new.customer_id then v_customer_name else v_provider_name end;
  v_sender_initials := case when new.sender_id = new.customer_id then v_customer_initials else v_provider_initials end;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (
    v_recipient,
    'ახალი შეტყობინება',
    v_body,
    '💬',
    '#2563EB',
    jsonb_build_object(
      'screen', 'ChatConversation',
      'chatId', new.sender_id,
      'name', coalesce(v_sender_name, ''),
      'initials', coalesce(v_sender_initials, ''),
      'color', '#2563EB'
    ),
    'new_chat_message'
  );

  return new;
end;
$$;

comment on function public.handle_new_message() is
  'AFTER INSERT ON messages: atomically upserts the conversations summary row and inserts a notification (type=new_chat_message) for the recipient — content derived entirely from the inserted row, never from client input.';

-- ============================================================
-- 0021 — new Provider interest
-- ============================================================
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

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (
    v_customer_id,
    'ახალი ოსტატი დაინტერესდა',
    v_provider_name || ' დაინტერესდა შენი მოთხოვნით (' || public.job_category_label(v_category) || ')',
    '🔧',
    '#2563EB',
    jsonb_build_object('screen', 'CustomerJobDetail', 'jobId', new.job_id),
    'new_interest'
  );

  return new;
end;
$$;

comment on function public.handle_job_response_notify() is
  'AFTER INSERT ON job_responses: notifies the job owner (type=new_interest). Recipient and event legitimacy are re-derived server-side, never trusted from a client parameter.';

-- ============================================================
-- 0022 (x3) — Provider selected / completion requested / problem reported
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
  'Customer selects a Provider: pending -> active, notifies the selected Provider (type=job_selected). Atomic; only callable by the job''s own customer.';

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
  'Assigned Provider marks their work done: active -> awaiting_customer_confirmation, notifies the Customer (type=completion_reminder). A Provider can never mark a job completed directly.';

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
  'Customer disputes the Provider''s completion request: awaiting_customer_confirmation -> disputed, notifies the assigned Provider (type=job_status_change).';

grant execute on function public.customer_report_problem(uuid, text) to authenticated;

-- ============================================================
-- 0023 — job completed
-- ============================================================
create or replace function public.handle_review_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_category text;
begin
  select status, category into v_status, v_category from public.job_posts where id = new.job_id for update;
  if v_status is null then
    raise exception 'Review references a job that does not exist';
  end if;
  if v_status <> 'confirmed_awaiting_rating' then
    raise exception 'Job must be confirmed by the customer before it can be reviewed (current status=%)', v_status;
  end if;

  update public.job_posts set status = 'completed' where id = new.job_id;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (
    new.provider_id,
    'სამუშაო დასრულებულად დადასტურდა',
    public.job_category_label(v_category),
    '✅',
    '#059669',
    jsonb_build_object('screen', 'ProviderJobDetail', 'id', new.job_id, 'mode', 'completed'),
    'job_status_change'
  );

  return new;
end;
$$;

comment on function public.handle_review_completion() is
  'AFTER INSERT ON reviews: rejects the review unless its job is confirmed_awaiting_rating, flips that job to completed, notifies the Provider (type=job_status_change). The ONLY path to the completed status.';

-- ============================================================
-- 0033/0036 — job cancellation (both directions)
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
  'Customer cancels their own job: pending or active -> cancelled, notifies the assigned Provider if any (type=job_status_change).';

grant execute on function public.cancel_job(uuid, text) to authenticated;

create or replace function public.provider_cancel_job(p_job_id uuid, p_reason_code text, p_details text default null)
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
  'Assigned Provider cancels their own active job: active -> cancelled only, notifies the Customer (type=job_status_change).';

grant execute on function public.provider_cancel_job(uuid, text, text) to authenticated;
