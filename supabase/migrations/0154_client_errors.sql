-- In-app crash reporting without a third-party service (no Sentry account /
-- native rebuild needed): the app's global JS error handler and its React
-- ErrorBoundary call log_client_error(); the admin panel lists the rows.
-- Covers JS exceptions (the vast majority in RN); native-only crashes are
-- not captured — add Sentry later if that ever matters.
--
-- Writes only through the RPC (open to anon too: crashes happen before
-- login). Sizes are truncated and rate-limited (per user/hour and globally)
-- so the table can't be flooded. Only admins can read it.

create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  stack text,
  context text,
  is_fatal boolean not null default false,
  app_version text,
  platform text
);

create index if not exists client_errors_created_at_idx on public.client_errors (created_at desc);

alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;
grant select on public.client_errors to authenticated;

drop policy if exists "Admins read client errors" on public.client_errors;
create policy "Admins read client errors"
  on public.client_errors for select to authenticated
  using (public.is_admin());

create or replace function public.log_client_error(
  p_message text, p_stack text default null, p_context text default null,
  p_is_fatal boolean default false, p_app_version text default null, p_platform text default null
)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if coalesce(btrim(p_message), '') = '' then return; end if;
  -- ponytail: count-based limits; a dedicated rate-limit table if volume grows
  if (select count(*) from public.client_errors where created_at > now() - interval '1 hour') >= 2000 then
    return;
  end if;
  if v_uid is not null and (select count(*) from public.client_errors
        where user_id = v_uid and created_at > now() - interval '1 hour') >= 30 then
    return;
  end if;

  insert into public.client_errors (user_id, message, stack, context, is_fatal, app_version, platform)
  values (v_uid, left(p_message, 500), left(p_stack, 4000), left(p_context, 200),
          coalesce(p_is_fatal, false), left(p_app_version, 20), left(p_platform, 20));
end;
$function$;

revoke execute on function public.log_client_error(text, text, text, boolean, text, text) from public;
grant execute on function public.log_client_error(text, text, text, boolean, text, text) to anon, authenticated;
