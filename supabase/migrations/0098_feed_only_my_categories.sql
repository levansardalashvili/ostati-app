-- Provider job feed can be limited to the provider's own specialties (= job categories, 0088).
-- p_only_mine = false keeps the old behaviour (used by "my jobs" / chat lookups that need every open job).
-- A provider with no non-custom specialty sees everything (nothing to match against).
-- Area is NOT filtered: job addresses are free text, so matching them to areas is unreliable.

drop function if exists public.get_open_provider_feed();

create or replace function public.get_open_provider_feed(p_only_mine boolean default false)
returns table(id uuid, customer_id uuid, customer_name text, category text, description text, address text,
  address_is_exact boolean, date text, status text, photos text[], provider_id uuid, provider_name text,
  agreed_price numeric, dispute_reason text, cancellation_actor text, preferred_date date, time_slot text,
  created_at timestamp with time zone)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_cats text[];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider') then
    raise exception 'Only a Provider account can browse the open job feed';
  end if;

  if p_only_mine then
    select array_agg(distinct public.specialty_to_category(s->>'id')) into v_cats
      from public.provider_profiles pp, jsonb_array_elements(pp.specialty) s
     where pp.id = auth.uid() and s->>'id' not like 'custom:%';
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
    and jp.created_at > now() - interval '30 days'
    and (jp.invited_provider_id is null or jp.invited_provider_id = auth.uid())
    and not (auth.uid() = any(jp.excluded_provider_ids))
    and not public.is_blocked_pair(jp.customer_id, auth.uid())
    and (v_cats is null or jp.category = any(v_cats) or jp.invited_provider_id = auth.uid())
  order by jp.created_at desc;
end;
$$;

revoke execute on function public.get_open_provider_feed(boolean) from public, anon;
grant execute on function public.get_open_provider_feed(boolean) to authenticated;
