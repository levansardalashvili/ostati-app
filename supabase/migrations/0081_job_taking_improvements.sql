-- 0081_job_taking_improvements.sql
-- Two gaps found while reviewing the "Provider takes a job" flow
-- (express_interest -> select_provider), alongside 0078/0079's
-- job-completion fixes.
--
-- GAP 1 — a Provider who expressed interest but was NOT selected is
-- never told. select_provider()/assign_job_provider() (0075) only ever
-- notified the WINNING provider ("შენ აგირჩიეს") — every other
-- job_responses row for that job just sits there, and the job silently
-- vanishes from those Providers' Job Feed (get_open_provider_feed(),
-- 0052, hard-filters to status='pending') with zero explanation. Fixed
-- inside the shared assign_job_provider() helper (used by both
-- select_provider() and respond_to_chat_offer()'s chat-offer-acceptance
-- auto-select, 0075) so both assignment paths get this for free — one
-- INSERT...SELECT notifies every OTHER provider with a job_responses row
-- on this job. `target` is null (not a bare oversight): once the job is
-- `active`, a non-selected Provider is neither its customer_id nor
-- provider_id, so get_feed_job_by_id()/get_open_provider_feed() (0052)
-- both correctly refuse to show it to them any more — there is no safe
-- screen left to deep-link into. navigateToNotificationTarget() already
-- treats a null target as a no-op tap (src/utils/notificationNavigation.ts),
-- so this is not new client-side handling, just relying on the existing
-- fallback.
create or replace function public.assign_job_provider(
  p_job_id uuid,
  p_provider_id uuid,
  p_provider_name text,
  p_agreed_price numeric,
  p_category text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.job_posts
  set
    provider_id = p_provider_id,
    provider_name = p_provider_name,
    agreed_price = p_agreed_price,
    status = 'active'
  where id = p_job_id;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (
    p_provider_id,
    'შენ აგირჩიეს სამუშაოსთვის',
    public.job_category_label(p_category),
    '🏆',
    '#059669',
    jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'selected'),
    'job_selected'
  );

  -- NEW — every other interested Provider on this job learns it's gone,
  -- instead of it just disappearing from their feed unexplained.
  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  select
    jr.provider_id,
    'სამუშაო სხვა ოსტატს გადაეცა',
    public.job_category_label(p_category),
    'ℹ️',
    '#64748B',
    null,
    'job_status_change'
  from public.job_responses jr
  where jr.job_id = p_job_id
    and jr.provider_id <> p_provider_id;
end;
$$;

revoke all on function public.assign_job_provider(uuid, uuid, text, numeric, text) from public, anon, authenticated;

-- GAP 2 — no way to withdraw an expressed interest. express_interest()
-- (0064/0066) is the only writer to job_responses; nothing ever deletes
-- a row. A Provider who offered a price by mistake, or changed their
-- mind, was permanently on record as interested with no way back.
--
-- Locking pattern mirrors express_interest() exactly (0066's own fix for
-- the analogous race): lock job_posts `for update` BEFORE checking
-- status, so a concurrent select_provider() choosing this exact Provider
-- cannot be undone by a withdrawal that arrives a moment later, and a
-- withdrawal that arrives first correctly blocks that selection (the
-- job_responses row select_provider() looks up is simply gone). Only
-- allowed while the job is still `pending` — once a Provider is selected
-- (this one or another), "withdrawing" no longer means anything: the
-- decision is already made.
create or replace function public.withdraw_interest(p_job_id uuid)
returns void
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
  if v_job.status <> 'pending' then
    raise exception 'Interest can no longer be withdrawn once a provider is selected';
  end if;

  delete from public.job_responses where job_id = p_job_id and provider_id = auth.uid();
  if not found then
    raise exception 'No response on file for this job';
  end if;
end;
$$;

comment on function public.withdraw_interest(uuid) is
  'The only way to delete a job_responses row — a Provider retracting their own expressed interest. Locks job_posts for update before checking status=pending (mirrors express_interest()''s 0066 race fix), so this cannot race a concurrent select_provider() on the same job. Raises if the job is no longer pending (a provider has already been selected) or if the caller has no response on file for it.';

revoke all on function public.withdraw_interest(uuid) from public, anon;
grant execute on function public.withdraw_interest(uuid) to authenticated;
