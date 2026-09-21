-- Store requirements: (1) in-app account deletion, (2) block / report another user in chat.

-- ---------------------------------------------------------------------------------------------
-- 1) Account deletion. Most FKs already cascade from auth.users. The two that don't:
--    job_posts.provider_id / invited_provider_id (would block deleting a provider) -> SET NULL,
--    so finished job history survives without the deleted person.
-- ---------------------------------------------------------------------------------------------
alter table public.job_posts drop constraint if exists job_posts_provider_id_fkey;
alter table public.job_posts
  add constraint job_posts_provider_id_fkey
  foreign key (provider_id) references auth.users(id) on delete set null;

alter table public.job_posts drop constraint if exists job_posts_invited_provider_id_fkey;
alter table public.job_posts
  add constraint job_posts_invited_provider_id_fkey
  foreign key (invited_provider_id) references auth.users(id) on delete set null;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.users where id = auth.uid();
  if v_role is null then raise exception 'Account not found'; end if;
  if v_role = 'admin' then raise exception 'Admin accounts cannot be deleted from the app'; end if;

  -- Work in progress must be finished or cancelled first — the other side depends on it.
  if exists (
    select 1 from public.job_posts jp
    where (jp.customer_id = auth.uid() or jp.provider_id = auth.uid())
      and jp.status in ('active', 'awaiting_customer_confirmation', 'confirmed_awaiting_rating', 'disputed')
  ) then
    raise exception 'ACCOUNT_HAS_ACTIVE_JOBS: finish or cancel your active jobs before deleting the account';
  end if;

  -- Private jobs invited to this provider would otherwise stay dead / become public: cancel them.
  update public.job_posts
     set status = 'cancelled', cancelled_at = now(), cancellation_actor = 'provider',
         cancellation_reason = 'ოსტატმა ანგარიში წაშალა'
   where invited_provider_id = auth.uid() and status in ('draft', 'pending');

  -- Keep history but drop the person's name from other people's job rows.
  update public.job_posts set provider_name = 'წაშლილი ოსტატი' where provider_id = auth.uid();

  -- Everything else cascades (profile, messages, conversations, reviews, tokens, favorites, ...).
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2) Blocking. Writes are RPC-only; a block stops messages in BOTH directions.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon, authenticated;
grant select on public.user_blocks to authenticated;
create policy "Owner can read own blocks" on public.user_blocks
  for select to authenticated using (blocker_id = auth.uid());

-- true if either side blocked the other (SECURITY DEFINER: the blocked person must not need to read the row)
create or replace function public.is_blocked_pair(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$$;
revoke execute on function public.is_blocked_pair(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_pair(uuid, uuid) to authenticated;

create or replace function public.block_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_user_id is null or p_user_id = auth.uid() then raise exception 'Invalid user'; end if;
  if not exists (select 1 from public.users where id = p_user_id and role in ('customer', 'provider')) then
    raise exception 'User not found';
  end if;
  insert into public.user_blocks (blocker_id, blocked_id) values (auth.uid(), p_user_id) on conflict do nothing;
end;
$$;

create or replace function public.unblock_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.user_blocks where blocker_id = auth.uid() and blocked_id = p_user_id;
end;
$$;

revoke execute on function public.block_user(uuid), public.unblock_user(uuid) from public, anon;
grant execute on function public.block_user(uuid), public.unblock_user(uuid) to authenticated;

-- No messages between blocked users (restrictive: AND-ed with the existing INSERT policies).
drop policy if exists "No messages between blocked users" on public.messages;
create policy "No messages between blocked users" on public.messages
  as restrictive for insert to authenticated
  with check (not public.is_blocked_pair(customer_id, provider_id));

-- Blocked pairs cannot start / continue a deal either.
create or replace function public.express_interest(p_job_id uuid, p_offered_price numeric)
returns public.job_responses language plpgsql security definer set search_path = '' as $$
declare
  v_job public.job_posts%rowtype;
  v_profile public.provider_profiles%rowtype;
  v_provider_name text;
  v_initials text;
  v_response public.job_responses%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider') then
    raise exception 'Only a Provider account can express interest';
  end if;
  if not public.is_valid_job_price(p_offered_price) then
    raise exception 'A valid, positive offered price is required';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then raise exception 'Job not found'; end if;
  if v_job.status <> 'pending' then
    raise exception 'Job is not open for interest (status=%)', v_job.status;
  end if;
  if v_job.customer_id = auth.uid() then
    raise exception 'A customer cannot express interest in their own job';
  end if;
  if v_job.invited_provider_id is not null and v_job.invited_provider_id <> auth.uid() then
    raise exception 'Job not found';
  end if;
  if public.is_blocked_pair(v_job.customer_id, auth.uid()) then
    raise exception 'Job not found';
  end if;

  select * into v_profile from public.provider_profiles where id = auth.uid();
  if v_profile.id is null then
    raise exception 'A provider profile is required before expressing interest';
  end if;
  if v_profile.verification_status <> 'verified' then
    raise exception 'PROVIDER_NOT_VERIFIED: complete verification before expressing interest in a job';
  end if;

  v_provider_name := nullif(btrim(coalesce(v_profile.first_name, '') || ' ' || coalesce(v_profile.last_name, '')), '');
  v_provider_name := coalesce(v_provider_name, 'ოსტატი');
  v_initials := upper(
    coalesce(nullif(left(btrim(coalesce(v_profile.first_name, '')), 1), ''), '')
    || coalesce(nullif(left(btrim(coalesce(v_profile.last_name, '')), 1), ''), '')
  );
  if v_initials = '' then v_initials := 'O'; end if;

  insert into public.job_responses (job_id, provider_id, provider_name, provider_initials, provider_color, offered_price)
  values (p_job_id, auth.uid(), v_provider_name, v_initials, '#2563EB', p_offered_price)
  returning * into v_response;
  return v_response;
end;
$$;

-- Providers do not see jobs of customers they blocked (or who blocked them) in the feed.
create or replace function public.get_open_provider_feed()
returns table(id uuid, customer_id uuid, customer_name text, category text, description text, address text,
  address_is_exact boolean, date text, status text, photos text[], provider_id uuid, provider_name text,
  agreed_price numeric, dispute_reason text, cancellation_actor text, preferred_date date, time_slot text,
  created_at timestamp with time zone)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider') then
    raise exception 'Only a Provider account can browse the open job feed';
  end if;
  return query
  select jp.id, jp.customer_id, jp.customer_name, jp.category, jp.description,
    coalesce(jp.area_label, public.job_safe_area_label(jp.address)) as address,
    false as address_is_exact,
    jp.date, jp.status, jp.photos, jp.provider_id, jp.provider_name,
    jp.agreed_price, jp.dispute_reason, jp.cancellation_actor,
    jp.preferred_date, jp.time_slot, jp.created_at
  from public.job_posts jp
  where jp.status = 'pending'
    and (jp.invited_provider_id is null or jp.invited_provider_id = auth.uid())
    and not public.is_blocked_pair(jp.customer_id, auth.uid())
  order by jp.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 3) Reporting a user from a chat (works for any participant, with or without a shared job).
-- ---------------------------------------------------------------------------------------------
create table if not exists public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate_content', 'scam', 'other')),
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);
alter table public.chat_reports enable row level security;
revoke all on public.chat_reports from anon, authenticated;
grant select on public.chat_reports to authenticated;
create policy "Reporter can read own chat reports" on public.chat_reports
  for select to authenticated using (reporter_id = auth.uid());
create policy "Admin can read all chat reports" on public.chat_reports
  for select to authenticated using (public.is_admin());
create policy "Admin can update chat report status" on public.chat_reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
grant update (status) on public.chat_reports to authenticated;

create or replace function public.report_chat_user(p_user_id uuid, p_reason text, p_details text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_user_id is null or p_user_id = auth.uid() then raise exception 'Invalid user'; end if;
  if p_reason is null or p_reason not in ('spam', 'harassment', 'inappropriate_content', 'scam', 'other') then
    raise exception 'Invalid reason';
  end if;
  if p_reason = 'other' and btrim(coalesce(p_details, '')) = '' then
    raise exception 'Details are required for reason "other"';
  end if;
  -- only someone who actually shares a conversation with the reported user can report them
  if not exists (
    select 1 from public.conversations c
    where (c.customer_id = auth.uid() and c.provider_id = p_user_id)
       or (c.provider_id = auth.uid() and c.customer_id = p_user_id)
  ) then
    raise exception 'No conversation with this user';
  end if;
  insert into public.chat_reports (reporter_id, reported_user_id, reason, details)
  values (auth.uid(), p_user_id, p_reason, left(nullif(btrim(coalesce(p_details, '')), ''), 1000));
end;
$$;
revoke execute on function public.report_chat_user(uuid, text, text) from public, anon;
grant execute on function public.report_chat_user(uuid, text, text) to authenticated;
