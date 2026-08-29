-- 0023_review_completion_notify.sql
-- Task 3 — "job status changes" (final leg): notifies the Provider once
-- their job is actually completed. Previously done client-side in
-- CustomerJobDetailScreen's openRating().onRate, right after awaiting
-- reviewService.submitReview() — same pattern/gap as 0022's two RPCs.
--
-- CREATE OR REPLACE on 0015's trigger function, same signature/behavior,
-- plus one notification insert once the completed transition has
-- actually been committed. reviews rows already carry provider_id
-- (0008), so no extra lookup is needed for the recipient.

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

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target)
  values (
    new.provider_id,
    'სამუშაო დასრულებულად დადასტურდა',
    public.job_category_label(v_category),
    '✅',
    '#059669',
    jsonb_build_object('screen', 'ProviderJobDetail', 'id', new.job_id, 'mode', 'completed')
  );

  return new;
end;
$$;

comment on function public.handle_review_completion() is
  'AFTER INSERT ON reviews: rejects the review unless its job is confirmed_awaiting_rating, flips that job to completed, and notifies the Provider. This is the ONLY path to the completed status.';

-- Trigger itself is unchanged (still on_review_insert_complete_job from
-- 0015) — only the function body changed, via CREATE OR REPLACE above.
