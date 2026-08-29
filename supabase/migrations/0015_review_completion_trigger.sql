-- 0015_review_completion_trigger.sql
-- Enforces "Customer rating is mandatory before final completed status"
-- at the database level: a job can only become 'completed' as a direct
-- side effect of a review actually being inserted for it, and only if
-- the job was already 'confirmed_awaiting_rating' (i.e. the Customer
-- went through customer_confirm_completion first). This is why there is
-- no separate "mark completed" RPC in 0014 — submitting the review *is*
-- what completes the job.
--
-- reviews' own RLS (0008_reviews.sql) already restricts who may insert a
-- review at all (only the job's own customer_id, and 0008's
-- `reviews_one_per_job` unique constraint plus `reviews_stars_range`
-- check already cover "one review per job" and "rating 1-5"). This
-- trigger adds the workflow-state precondition on top of that.

create or replace function public.handle_review_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status from public.job_posts where id = new.job_id for update;
  if v_status is null then
    raise exception 'Review references a job that does not exist';
  end if;
  if v_status <> 'confirmed_awaiting_rating' then
    raise exception 'Job must be confirmed by the customer before it can be reviewed (current status=%)', v_status;
  end if;

  update public.job_posts set status = 'completed' where id = new.job_id;
  return new;
end;
$$;

comment on function public.handle_review_completion() is
  'AFTER INSERT ON reviews: rejects the review unless its job is confirmed_awaiting_rating, then flips that job to completed. This is the ONLY path to the completed status.';

drop trigger if exists on_review_insert_complete_job on public.reviews;
create trigger on_review_insert_complete_job
  after insert on public.reviews
  for each row
  execute function public.handle_review_completion();
