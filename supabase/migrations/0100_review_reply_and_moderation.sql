-- Reviews: (1) the reviewed provider can reply once (public, under the review);
-- (2) admin can hide a review — hidden reviews disappear from the public list and from rating/count.

alter table public.reviews
  add column if not exists provider_reply text,
  add column if not exists provider_replied_at timestamptz,
  add column if not exists hidden boolean not null default false;

-- Public list now also returns id (needed to reply) and the reply; hidden reviews are excluded.
drop function if exists public.get_provider_reviews(uuid);
create function public.get_provider_reviews(p_provider_id uuid)
returns table (id uuid, stars int, review_text text, created_at timestamptz, provider_reply text, provider_replied_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.stars, r.review_text, r.created_at, r.provider_reply, r.provider_replied_at
  from public.reviews r
  where r.provider_id = p_provider_id and not r.hidden
  order by r.created_at desc;
$$;
revoke all on function public.get_provider_reviews(uuid) from public, anon;
grant execute on function public.get_provider_reviews(uuid) to authenticated;

-- Hidden reviews do not count towards rating / review_count (both overloads).
create or replace function public.get_provider_stats()
returns table(provider_id uuid, avg_rating numeric, review_count bigint, completed_jobs bigint)
language sql stable security definer set search_path = '' as $$
  select
    pp.id as provider_id,
    coalesce(r.avg_rating, 0) as avg_rating,
    coalesce(r.review_count, 0) as review_count,
    coalesce(j.completed_jobs, 0) as completed_jobs
  from public.provider_profiles pp
  left join (
    select provider_id, round(avg(stars)::numeric, 1) as avg_rating, count(*) as review_count
    from public.reviews where not hidden group by provider_id
  ) r on r.provider_id = pp.id
  left join (
    select provider_id, count(*) as completed_jobs
    from public.job_posts where status = 'completed' group by provider_id
  ) j on j.provider_id = pp.id;
$$;

create or replace function public.get_provider_stats(p_provider_id uuid default null)
returns table(provider_id uuid, avg_rating numeric, review_count bigint, completed_jobs bigint)
language sql stable security definer set search_path = '' as $$
  select
    pp.id as provider_id,
    coalesce(r.avg_rating, 0) as avg_rating,
    coalesce(r.review_count, 0) as review_count,
    coalesce(j.completed_jobs, 0) as completed_jobs
  from public.provider_profiles pp
  left join (
    select provider_id, round(avg(stars)::numeric, 1) as avg_rating, count(*) as review_count
    from public.reviews where not hidden group by provider_id
  ) r on r.provider_id = pp.id
  left join (
    select provider_id, count(*) as completed_jobs
    from public.job_posts where status = 'completed' group by provider_id
  ) j on j.provider_id = pp.id
  where p_provider_id is null or pp.id = p_provider_id;
$$;

revoke execute on function public.get_provider_stats() from public, anon;
revoke execute on function public.get_provider_stats(uuid) from public, anon;
grant execute on function public.get_provider_stats() to authenticated;
grant execute on function public.get_provider_stats(uuid) to authenticated;

-- The reviewed provider replies once.
create or replace function public.reply_to_review(p_review_id uuid, p_reply text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reply text := btrim(coalesce(p_reply, ''));
  v_review public.reviews%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if length(v_reply) < 2 or length(v_reply) > 500 then
    raise exception 'Reply must be 2–500 characters';
  end if;
  select * into v_review from public.reviews where id = p_review_id for update;
  if v_review.id is null or v_review.provider_id <> auth.uid() then raise exception 'Review not found'; end if;
  if v_review.hidden then raise exception 'Review not found'; end if;
  if v_review.provider_reply is not null then raise exception 'REVIEW_ALREADY_REPLIED'; end if;
  update public.reviews set provider_reply = v_reply, provider_replied_at = now() where id = p_review_id;
end;
$$;
revoke execute on function public.reply_to_review(uuid, text) from public, anon;
grant execute on function public.reply_to_review(uuid, text) to authenticated;

-- Admin: read every review (author stays hidden in the UI) and hide/unhide.
drop policy if exists "Admin can read all reviews" on public.reviews;
create policy "Admin can read all reviews" on public.reviews for select to authenticated using (public.is_admin());

create or replace function public.admin_set_review_hidden(p_review_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  update public.reviews set hidden = p_hidden where id = p_review_id;
  if not found then raise exception 'Review not found'; end if;
end;
$$;
revoke execute on function public.admin_set_review_hidden(uuid, boolean) from public, anon;
grant execute on function public.admin_set_review_hidden(uuid, boolean) to authenticated;
