-- 0116: შეუსაბამო კონტენტის მოხსნა ანგარიშის შეჩერების გარეშე — ოსტატის პროფილის ფოტო/ტექსტი/სერთიფიკატი/ნამუშევარი და
-- განცხადების ფოტო. DB-ში მოხსნა RPC-ით (is_admin()), ფაილების წაშლა ადმინ-პანელიდან storage policy-ებით (service_role-ის გარეშე).
-- პატრონს ეცნობება. ვერიფიკაცია არ იცვლება (ავატარი და ვერიფიკაცია ერთმანეთს არ უკავშირდება).

create or replace function public.admin_moderate_provider_content(
  p_provider_id uuid, p_action text, p_uri text default null, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_label text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_action not in ('photo', 'about', 'certificate', 'portfolio') then raise exception 'Invalid action'; end if;
  if p_action in ('certificate', 'portfolio') and nullif(btrim(coalesce(p_uri, '')), '') is null then
    raise exception 'Item uri required';
  end if;
  perform 1 from public.provider_profiles where id = p_provider_id for update;
  if not found then raise exception 'Provider profile not found'; end if;

  if p_action = 'photo' then
    update public.provider_profiles set photo_url = null where id = p_provider_id;
    v_label := 'პროფილის ფოტო';
  elsif p_action = 'about' then
    update public.provider_profiles set about = '' where id = p_provider_id;
    v_label := 'აღწერის ტექსტი';
  elsif p_action = 'certificate' then
    update public.provider_profiles
       set certificates = coalesce((select jsonb_agg(e) from jsonb_array_elements(certificates) e where e->>'uri' is distinct from p_uri), '[]'::jsonb)
     where id = p_provider_id;
    v_label := 'სერთიფიკატი';
  else
    update public.provider_profiles
       set portfolio = coalesce((select jsonb_agg(e) from jsonb_array_elements(portfolio) e where e->>'uri' is distinct from p_uri), '[]'::jsonb)
     where id = p_provider_id;
    v_label := 'ნამუშევრის ფოტო';
  end if;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (p_provider_id, 'პროფილიდან მოიხსნა: ' || v_label,
          coalesce(v_reason, 'კონტენტი არ შეესაბამებოდა წესებს'), '⚠️', '#DC2626', null, 'profile_moderation');
end;
$$;
revoke execute on function public.admin_moderate_provider_content(uuid, text, text, text) from public, anon;
grant execute on function public.admin_moderate_provider_content(uuid, text, text, text) to authenticated;

-- p_ref = null → განცხადების ყველა ფოტო
create or replace function public.admin_remove_job_photo(p_job_id uuid, p_ref text default null, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_customer uuid;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  update public.job_posts
     set photos = case when p_ref is null then '{}'::text[] else array_remove(photos, p_ref) end
   where id = p_job_id
  returning customer_id into v_customer;
  if not found then raise exception 'Job not found'; end if;
  if v_customer is not null then
    insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
    values (v_customer, 'განცხადების ფოტო მოიხსნა', coalesce(v_reason, 'ფოტო არ შეესაბამებოდა წესებს'),
            '⚠️', '#DC2626', jsonb_build_object('screen', 'CustomerJobDetail', 'jobId', p_job_id), 'profile_moderation');
  end if;
end;
$$;
revoke execute on function public.admin_remove_job_photo(uuid, text, text) from public, anon;
grant execute on function public.admin_remove_job_photo(uuid, text, text) to authenticated;

-- ადმინს შეუძლია ნახოს/წაშალოს მოდერაციისთვის: საჯარო მედია (user-media, ძველი job-photos) და განცხადების კერძო ფოტოები
drop policy if exists "Admin can delete public media" on storage.objects;
create policy "Admin can delete public media" on storage.objects for delete to authenticated
  using (bucket_id in ('user-media', 'job-photos') and public.is_admin());

drop policy if exists "Admin can read job photos" on storage.objects;
create policy "Admin can read job photos" on storage.objects for select to authenticated
  using (bucket_id = 'private-media' and (storage.foldername(name))[1] = 'job' and public.is_admin());

drop policy if exists "Admin can delete job photos" on storage.objects;
create policy "Admin can delete job photos" on storage.objects for delete to authenticated
  using (bucket_id = 'private-media' and (storage.foldername(name))[1] = 'job' and public.is_admin());
-- Storage API-ს remove() DELETE-ს RETURNING-ით ასრულებს, ამიტომ წასაშლელი მწკრივის SELECT-იც სჭირდება
drop policy if exists "Admin can read public media" on storage.objects;
create policy "Admin can read public media" on storage.objects for select to authenticated
  using (bucket_id in ('user-media', 'job-photos') and public.is_admin());
