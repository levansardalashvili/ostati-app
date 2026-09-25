-- Admin sanction mechanism (chat_reports/job_reports had a status but nothing that actually
-- "did" anything — #133's known gap). One button in the admin panel + a check on sign-in, same
-- pattern as is_blocked_pair()/is_admin(): a boolean helper, an admin-only RPC, and a server-side
-- backstop on the highest-leverage abuse surface (chat).

alter table public.users
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text;

-- Owner already reads their own users row (existing policy) — the client checks its own
-- suspended_at/suspension_reason right after sign-in with a plain select, no new RLS needed.

create or replace function public.is_suspended(p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select suspended_at is not null from public.users where id = p_uid), false);
$$;
revoke execute on function public.is_suspended(uuid) from public, anon;
grant execute on function public.is_suspended(uuid) to authenticated;

create or replace function public.admin_set_user_suspended(p_user_id uuid, p_suspended boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select role into v_role from public.users where id = p_user_id;
  if v_role is null then raise exception 'User not found'; end if;
  if v_role = 'admin' then raise exception 'Admin accounts cannot be suspended'; end if;

  update public.users
     set suspended_at = case when p_suspended then now() else null end,
         suspension_reason = case when p_suspended then nullif(btrim(coalesce(p_reason, '')), '') else null end
   where id = p_user_id;

  -- Courtesy push — if it reaches them before/while the app blocks their next sign-in, it's the
  -- only place a locked-out user will see why. Best-effort like every other notification insert.
  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (
    p_user_id,
    case when p_suspended then 'ანგარიში შეჩერებულია' else 'ანგარიში აღდგენილია' end,
    case when p_suspended then coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'წესების დარღვევის გამო') else 'შეგიძლიათ ისევ შეხვიდეთ აპში' end,
    case when p_suspended then '⛔' else '✅' end,
    case when p_suspended then '#DC2626' else '#059669' end,
    null,
    'account_suspension'
  );
end;
$$;
revoke execute on function public.admin_set_user_suspended(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_user_suspended(uuid, boolean, text) to authenticated;

-- Admin needs to see current suspension state to render the button correctly — already covered
-- by the existing "Admin can read all users" policy (0072), no change needed there.

-- Server-side backstop: a suspended account cannot send chat messages even mid-session
-- (client-side sign-in gate is the primary defense, this is defense in depth).
drop policy if exists "No messages from suspended users" on public.messages;
create policy "No messages from suspended users"
  on public.messages as restrictive for insert
  with check (not public.is_suspended(sender_id));
