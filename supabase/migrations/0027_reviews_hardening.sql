-- 0027_reviews_hardening.sql
-- Security audit — reviews. 0008's INSERT policy already required
-- customer_id = auth.uid() and that the referenced job belongs to that
-- customer. Two real gaps remained:
--   1. Nothing checked the job's status at INSERT time (only 0015/0023's
--      AFTER INSERT trigger did, which does reject the write, but only
--      after Postgres has already done the work of accepting the row).
--   2. NOTHING validated `reviews.provider_id` against the job's actual
--      assigned provider — a Customer could submit
--      `insert into reviews (job_id, customer_id, provider_id, stars, ...)`
--      with ANY provider_id they wanted, attributing a review (good or
--      bad) to a Provider who never did that job. This is the exact
--      "client must not be able to attribute a review to another
--      Provider" hole the task calls out.
--
-- Fix, per the task's "prefer deriving provider_id/customer_id
-- server-side if practical": a BEFORE INSERT trigger that ignores
-- whatever the client sent for customer_id/provider_id and derives both
-- from the job itself — auth.uid() for the customer, job_posts.provider_id
-- for the provider — while also re-validating ownership + status. This
-- is strictly stronger than an RLS check (which can only accept/reject
-- what the client sent): it's structurally impossible to submit a wrong
-- provider_id, not just rejected when caught. RLS is also updated to
-- match, as a second, independent layer.

create or replace function public.set_review_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
begin
  select * into v_job from public.job_posts where id = new.job_id for update;
  if v_job.id is null then
    raise exception 'Review references a job that does not exist';
  end if;
  if v_job.customer_id <> auth.uid() then
    raise exception 'Only the job owner can review it';
  end if;
  if v_job.status <> 'confirmed_awaiting_rating' then
    raise exception 'Job must be confirmed by the customer before it can be reviewed (current status=%)', v_job.status;
  end if;
  if v_job.provider_id is null then
    raise exception 'Job has no assigned provider to review';
  end if;

  -- Whatever the client sent for these two columns is discarded —
  -- always derived from the job itself, never trusted from the insert.
  new.customer_id := auth.uid();
  new.provider_id := v_job.provider_id;
  return new;
end;
$$;

comment on function public.set_review_identity() is
  'BEFORE INSERT ON reviews: re-validates job ownership/status and overwrites customer_id/provider_id from job_posts, so a review can never be attributed to the wrong provider or submitted by anyone but the job''s own customer, regardless of what the client sends.';

drop trigger if exists set_review_identity on public.reviews;
create trigger set_review_identity
  before insert on public.reviews
  for each row
  execute function public.set_review_identity();

-- RLS — second, independent layer (defense in depth): re-checks job
-- ownership AND status via a cross-table subquery on job_posts (not a
-- self-reference on reviews itself, so this carries none of the
-- recursion risk fixed in 0026). stars range (1-5) and one-review-per-job
-- are already enforced by 0008's check/unique constraints — untouched.
drop policy if exists "Customer can review own completed job" on public.reviews;
create policy "Customer can review own completed job"
  on public.reviews for insert
  with check (
    customer_id = auth.uid()
    and exists (
      select 1 from public.job_posts jp
      where jp.id = reviews.job_id
        and jp.customer_id = auth.uid()
        and jp.status = 'confirmed_awaiting_rating'
    )
  );
