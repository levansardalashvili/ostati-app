-- 0115: რეგიონები/რაიონები ბაზაში (ადმინ-პანელიდან იმართება). ოსტატის სამუშაო არეალი და განცხადების რაიონი ინახავს
-- რაიონის **სახელს** (ტექსტს), ამიტომ სახელი არასდროს იცვლება/იშლება — მხოლოდ ემატება ან ითიშება (is_active).
create table if not exists public.region_districts (
  id uuid primary key default gen_random_uuid(),
  region_id text not null,
  region_label text not null,
  region_sort integer not null,
  district text not null,
  sort_order integer not null,
  is_active boolean not null default true,
  unique (region_id, district)
);
alter table public.region_districts enable row level security;
revoke all on public.region_districts from anon, authenticated;
grant select on public.region_districts to authenticated;
drop policy if exists "Anyone signed in can read districts" on public.region_districts;
create policy "Anyone signed in can read districts" on public.region_districts for select to authenticated using (true);

insert into public.region_districts (region_id, region_label, region_sort, district, sort_order) values
  ('tbilisi', 'თბილისი', 0, 'ვაკე', 0),
  ('tbilisi', 'თბილისი', 0, 'საბურთალო', 1),
  ('tbilisi', 'თბილისი', 0, 'ვერა', 2),
  ('tbilisi', 'თბილისი', 0, 'მთაწმინდა', 3),
  ('tbilisi', 'თბილისი', 0, 'დიდუბე', 4),
  ('tbilisi', 'თბილისი', 0, 'გლდანი', 5),
  ('tbilisi', 'თბილისი', 0, 'ისანი', 6),
  ('tbilisi', 'თბილისი', 0, 'სამგორი', 7),
  ('adjara', 'აჭარა', 1, 'ბათუმი', 0),
  ('adjara', 'აჭარა', 1, 'ქობულეთი', 1),
  ('adjara', 'აჭარა', 1, 'ხელვაჩაური', 2),
  ('adjara', 'აჭარა', 1, 'ქედა', 3),
  ('adjara', 'აჭარა', 1, 'შუახევი', 4),
  ('adjara', 'აჭარა', 1, 'ხულო', 5),
  ('guria', 'გურია', 2, 'ოზურგეთი', 0),
  ('guria', 'გურია', 2, 'ლანჩხუთი', 1),
  ('guria', 'გურია', 2, 'ჩოხატაური', 2),
  ('imereti', 'იმერეთი', 3, 'ქუთაისი', 0),
  ('imereti', 'იმერეთი', 3, 'ზესტაფონი', 1),
  ('imereti', 'იმერეთი', 3, 'ტყიბული', 2),
  ('imereti', 'იმერეთი', 3, 'საჩხერე', 3),
  ('imereti', 'იმერეთი', 3, 'ჭიათურა', 4),
  ('imereti', 'იმერეთი', 3, 'სამტრედია', 5),
  ('imereti', 'იმერეთი', 3, 'ხონი', 6),
  ('imereti', 'იმერეთი', 3, 'თერჯოლა', 7),
  ('imereti', 'იმერეთი', 3, 'ბაღდათი', 8),
  ('imereti', 'იმერეთი', 3, 'ვანი', 9),
  ('kakheti', 'კახეთი', 4, 'თელავი', 0),
  ('kakheti', 'კახეთი', 4, 'გურჯაანი', 1),
  ('kakheti', 'კახეთი', 4, 'სიღნაღი', 2),
  ('kakheti', 'კახეთი', 4, 'ყვარელი', 3),
  ('kakheti', 'კახეთი', 4, 'ლაგოდეხი', 4),
  ('kakheti', 'კახეთი', 4, 'საგარეჯო', 5),
  ('kakheti', 'კახეთი', 4, 'დედოფლისწყარო', 6),
  ('kakheti', 'კახეთი', 4, 'ახმეტა', 7),
  ('mtskheta-mtianeti', 'მცხეთა-მთიანეთი', 5, 'მცხეთა', 0),
  ('mtskheta-mtianeti', 'მცხეთა-მთიანეთი', 5, 'დუშეთი', 1),
  ('mtskheta-mtianeti', 'მცხეთა-მთიანეთი', 5, 'თიანეთი', 2),
  ('mtskheta-mtianeti', 'მცხეთა-მთიანეთი', 5, 'ყაზბეგი', 3),
  ('racha-lechkhumi', 'რაჭა-ლეჩხუმი და ქვემო სვანეთი', 6, 'ამბროლაური', 0),
  ('racha-lechkhumi', 'რაჭა-ლეჩხუმი და ქვემო სვანეთი', 6, 'ონი', 1),
  ('racha-lechkhumi', 'რაჭა-ლეჩხუმი და ქვემო სვანეთი', 6, 'ცაგერი', 2),
  ('racha-lechkhumi', 'რაჭა-ლეჩხუმი და ქვემო სვანეთი', 6, 'ლენტეხი', 3),
  ('samegrelo', 'სამეგრელო-ზემო სვანეთი', 7, 'ზუგდიდი', 0),
  ('samegrelo', 'სამეგრელო-ზემო სვანეთი', 7, 'სენაკი', 1),
  ('samegrelo', 'სამეგრელო-ზემო სვანეთი', 7, 'ფოთი', 2),
  ('samegrelo', 'სამეგრელო-ზემო სვანეთი', 7, 'ხობი', 3),
  ('samegrelo', 'სამეგრელო-ზემო სვანეთი', 7, 'მარტვილი', 4),
  ('samegrelo', 'სამეგრელო-ზემო სვანეთი', 7, 'აბაშა', 5),
  ('samegrelo', 'სამეგრელო-ზემო სვანეთი', 7, 'ჩხოროწყუ', 6),
  ('samegrelo', 'სამეგრელო-ზემო სვანეთი', 7, 'მესტია', 7),
  ('samtskhe-javakheti', 'სამცხე-ჯავახეთი', 8, 'ახალციხე', 0),
  ('samtskhe-javakheti', 'სამცხე-ჯავახეთი', 8, 'ბორჯომი', 1),
  ('samtskhe-javakheti', 'სამცხე-ჯავახეთი', 8, 'ახალქალაქი', 2),
  ('samtskhe-javakheti', 'სამცხე-ჯავახეთი', 8, 'ასპინძა', 3),
  ('samtskhe-javakheti', 'სამცხე-ჯავახეთი', 8, 'ადიგენი', 4),
  ('samtskhe-javakheti', 'სამცხე-ჯავახეთი', 8, 'ნინოწმინდა', 5),
  ('kvemo-kartli', 'ქვემო ქართლი', 9, 'რუსთავი', 0),
  ('kvemo-kartli', 'ქვემო ქართლი', 9, 'გარდაბანი', 1),
  ('kvemo-kartli', 'ქვემო ქართლი', 9, 'მარნეული', 2),
  ('kvemo-kartli', 'ქვემო ქართლი', 9, 'ბოლნისი', 3),
  ('kvemo-kartli', 'ქვემო ქართლი', 9, 'დმანისი', 4),
  ('kvemo-kartli', 'ქვემო ქართლი', 9, 'წალკა', 5),
  ('kvemo-kartli', 'ქვემო ქართლი', 9, 'თეთრიწყარო', 6),
  ('shida-kartli', 'შიდა ქართლი', 10, 'გორი', 0),
  ('shida-kartli', 'შიდა ქართლი', 10, 'კასპი', 1),
  ('shida-kartli', 'შიდა ქართლი', 10, 'ხაშური', 2),
  ('shida-kartli', 'შიდა ქართლი', 10, 'ქარელი', 3)
on conflict (region_id, district) do nothing;

create or replace function public.admin_add_district(p_region_id text, p_region_label text, p_district text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_district text := btrim(coalesce(p_district, ''));
  v_label text := btrim(coalesce(p_region_label, ''));
  v_region_id text := btrim(coalesce(p_region_id, ''));
  v_sort integer;
  v_existing_label text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if char_length(v_district) not between 1 and 60 then raise exception 'Invalid district name'; end if;
  if v_region_id !~ '^[a-z0-9-]{2,40}$' then raise exception 'Invalid region id'; end if;

  select r.region_label, r.region_sort into v_existing_label, v_sort
    from public.region_districts r where r.region_id = v_region_id limit 1;
  if v_existing_label is null then
    if char_length(v_label) not between 1 and 60 then raise exception 'Region label required'; end if;
    select coalesce(max(region_sort), -1) + 1 into v_sort from public.region_districts;
    v_existing_label := v_label;
  end if;

  insert into public.region_districts (region_id, region_label, region_sort, district, sort_order)
  values (v_region_id, v_existing_label, v_sort, v_district,
          (select coalesce(max(sort_order), -1) + 1 from public.region_districts where region_id = v_region_id))
  on conflict (region_id, district) do update set is_active = true;
end;
$$;
revoke execute on function public.admin_add_district(text, text, text) from public, anon;
grant execute on function public.admin_add_district(text, text, text) to authenticated;

create or replace function public.admin_set_district_active(p_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  update public.region_districts set is_active = p_active where id = p_id;
  if not found then raise exception 'District not found'; end if;
end;
$$;
revoke execute on function public.admin_set_district_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_district_active(uuid, boolean) to authenticated;
