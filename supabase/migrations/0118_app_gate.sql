-- 0118: აპის მინიმალური ვერსია და ტექნიკური რეჟიმი ადმინ-პანელიდან. ერთი სტრიქონი (id=1). get_app_gate() ღიაა anon-ისთვისაც
-- (აპი შესვლამდე ამოწმებს), ჩაწერა მხოლოდ admin_set_app_gate()-ით (ლოგირდება, 0117).
create table if not exists public.app_gate (
  id integer primary key check (id = 1),
  min_version text not null default '',
  maintenance boolean not null default false,
  maintenance_message text not null default '',
  update_url text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.app_gate (id) values (1) on conflict (id) do nothing;
alter table public.app_gate enable row level security;
revoke all on public.app_gate from public, anon, authenticated;
grant select on public.app_gate to authenticated;
drop policy if exists "Admin can read app gate" on public.app_gate;
create policy "Admin can read app gate" on public.app_gate for select to authenticated using (public.is_admin());

create or replace function public.get_app_gate()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('min_version', g.min_version, 'maintenance', g.maintenance,
                            'message', g.maintenance_message, 'update_url', g.update_url)
    from public.app_gate g where g.id = 1;
$$;
revoke execute on function public.get_app_gate() from public;
grant execute on function public.get_app_gate() to anon, authenticated;

create or replace function public.admin_set_app_gate(p_min_version text, p_maintenance boolean, p_message text, p_update_url text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_min text := btrim(coalesce(p_min_version, ''));
  v_msg text := btrim(coalesce(p_message, ''));
  v_url text := btrim(coalesce(p_update_url, ''));
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if v_min <> '' and v_min !~ '^\d{1,3}\.\d{1,3}\.\d{1,3}$' then raise exception 'Version must look like 1.2.3'; end if;
  if char_length(v_msg) > 200 then raise exception 'Message too long (max 200)'; end if;
  if v_url <> '' and (char_length(v_url) > 300 or v_url !~ '^(https://|market://|itms-apps://)') then
    raise exception 'Update URL must start with https://, market:// or itms-apps://';
  end if;
  update public.app_gate
     set min_version = v_min, maintenance = coalesce(p_maintenance, false),
         maintenance_message = v_msg, update_url = v_url, updated_at = now()
   where id = 1;
  perform public.log_admin_action('app_gate_change', 'app_gate', '1',
    jsonb_build_object('min_version', v_min, 'maintenance', coalesce(p_maintenance, false), 'message', v_msg, 'update_url', v_url));
end;
$$;
revoke execute on function public.admin_set_app_gate(text, boolean, text, text) from public, anon;
grant execute on function public.admin_set_app_gate(text, boolean, text, text) to authenticated;
