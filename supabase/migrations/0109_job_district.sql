-- 0109: განცხადებას აქვს სტრუქტურირებული რაიონი/ქალაქი (job_posts.district) — იგივე მნიშვნელობა, რასაც ოსტატი
-- provider_profiles.areas-ში ირჩევს (georgiaRegions-ის რაიონი). მისამართი თავისუფალი ტექსტი რჩება, მაგრამ
-- არეალის დამთხვევა (შეტყობინება + "ჩემი სპეციალობა" ლენტა) ახლა ზუსტი ტოლობითაა, არა ტექსტში ძებნით.
-- ძველ განცხადებებს district არ აქვთ — მათზე ძველი ქცევა რჩება (ilike / ლენტაში ყოველთვის ჩანს).
alter table public.job_posts add column if not exists district text;

-- ცალკე პატარა RPC, რომ create_job/update_job_draft/update_pending_job არ გადაიწეროს; კლიენტი მას
-- finalize-მდე (ან რედაქტირების შემდეგ) იძახებს.
create or replace function public.set_job_district(p_job_id uuid, p_district text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_district text := btrim(coalesce(p_district, ''));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(v_district) not between 1 and 60 then raise exception 'Invalid district'; end if;
  update public.job_posts set district = v_district
   where id = p_job_id and customer_id = auth.uid() and status in ('draft', 'pending');
  if not found then raise exception 'Job not found or not editable'; end if;
end;
$$;
revoke execute on function public.set_job_district(uuid, text) from public, anon;
grant execute on function public.set_job_district(uuid, text) to authenticated;

create or replace function public.handle_new_job_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'pending' or new.invited_provider_id is not null then
    return new;
  end if;
  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  select p.id, 'ახალი მოთხოვნა შენს არეალში', public.job_category_label(new.category), '🆕', '#2563EB',
    jsonb_build_object('screen', 'ProviderJobDetail', 'id', new.id, 'mode', 'browse'),
    'new_jobs_in_area'
  from public.provider_profiles p
  where p.is_available = true
    and exists (select 1 from jsonb_array_elements(p.specialty) s
                where public.specialty_to_category(s->>'id') = new.category)
    and (
      (new.district is not null and new.district = any(p.areas))
      or (new.district is null and exists (select 1 from unnest(p.areas) as area where new.address ilike '%' || area || '%'))
    );
  return new;
end;
$$;

-- ლენტა (p_only_mine=true): კატეგორიას ემატება არეალი — განცხადება, რომლის district ოსტატის areas-ში არ არის,
-- იმალება. district-ის გარეშე (ძველი) განცხადებები და პირადი მოწვევა ყოველთვის ჩანს; ცარიელი areas = ფილტრი არ მოქმედებს.
create or replace function public.get_open_provider_feed(p_only_mine boolean default false)
returns table(id uuid, customer_id uuid, customer_name text, category text, description text, address text,
  address_is_exact boolean, date text, status text, photos text[], provider_id uuid, provider_name text,
  agreed_price numeric, dispute_reason text, cancellation_actor text, preferred_date date, time_slot text,
  created_at timestamp with time zone)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_cats text[];
  v_areas text[];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider') then
    raise exception 'Only a Provider account can browse the open job feed';
  end if;

  if p_only_mine then
    if not exists (
      select 1 from public.provider_profiles pp, jsonb_array_elements(pp.specialty) s
       where pp.id = auth.uid() and s->>'id' like 'custom:%'
    ) then
      select array_agg(distinct public.specialty_to_category(s->>'id')) into v_cats
        from public.provider_profiles pp, jsonb_array_elements(pp.specialty) s
       where pp.id = auth.uid();
    end if;
    select pp.areas into v_areas from public.provider_profiles pp where pp.id = auth.uid();
    if coalesce(array_length(v_areas, 1), 0) = 0 then v_areas := null; end if;
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
    and (v_areas is null or jp.district is null or jp.district = any(v_areas) or jp.invited_provider_id = auth.uid())
  order by jp.created_at desc;
end;
$$;
revoke execute on function public.get_open_provider_feed(boolean) from public, anon;
grant execute on function public.get_open_provider_feed(boolean) to authenticated;
