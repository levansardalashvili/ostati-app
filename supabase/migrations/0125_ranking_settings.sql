-- 0125: ოსტატების რანჟირების ფორმულის პარამეტრები ადმინიდან (ადრე providerRank.ts-ში ჰარდქოდი იყო).
-- Bayesian საშუალო: (n/(n+K))·rating + (K/(n+K))·M, სადაც K = ვირტუალური ხმები, M = ბაზისური საშუალო;
-- ქულას ემატება log10(დასრულებული სამუშაო+1)·W. წილადები მთელ რიცხვებად ინახება (app_settings.value integer).
insert into public.app_settings (key, value) values
  ('rating_prior_count', 15),       -- K
  ('rating_prior_mean_x10', 43),    -- M·10 (4.3)
  ('ranking_jobs_weight_x100', 15)  -- W·100 (0.15)
on conflict (key) do nothing;

create or replace function public.admin_set_app_setting(p_key text, p_value integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_min integer; v_max integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select r.mn, r.mx into v_min, v_max from (values
    ('max_open_jobs', 1, 50), ('job_expiry_days', 7, 90), ('dispute_limit', 1, 10),
    ('offer_expiry_days', 1, 30), ('confirmation_grace_hours', 12, 336), ('stale_interest_hours', 12, 336),
    ('rating_prior_count', 1, 100), ('rating_prior_mean_x10', 30, 50), ('ranking_jobs_weight_x100', 1, 50)
  ) as r(k, mn, mx) where r.k = p_key;
  if v_min is null then raise exception 'Unknown setting'; end if;
  if p_value < v_min or p_value > v_max then raise exception 'Value out of range (% - %)', v_min, v_max; end if;
  update public.app_settings set value = p_value, updated_at = now() where key = p_key;
  perform public.log_admin_action('setting_change', 'setting', p_key, jsonb_build_object('value', p_value));
end;
$$;
revoke execute on function public.admin_set_app_setting(text, integer) from public, anon;
grant execute on function public.admin_set_app_setting(text, integer) to authenticated;

-- ოსტატების სიის დასალაგებლად აპს ეს პარამეტრები სჭირდება (ცხრილი პირდაპირ მხოლოდ ადმინს იკითხება)
create or replace function public.get_ranking_config() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'prior_count', public.app_setting('rating_prior_count', 15),
    'prior_mean', public.app_setting('rating_prior_mean_x10', 43)::numeric / 10,
    'jobs_weight', public.app_setting('ranking_jobs_weight_x100', 15)::numeric / 100);
$$;
revoke execute on function public.get_ranking_config() from public;
grant execute on function public.get_ranking_config() to anon, authenticated; -- ჯერ არ შესულ მომხმარებელსაც სჭირდება (გაშვების warm-up), არასენსიტიურია
