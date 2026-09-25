-- 0117: ადმინის მოქმედებების ჟურნალი. append-only ცხრილი; ჩანაწერს წერს მხოლოდ log_admin_action() (definer-ფუნქციებიდან და
-- ტრიგერებიდან, client-ისთვის EXECUTE არ აქვს). ყველა ადმინის RPC ცოცხალი განმარტებიდანაა გენერირებული — ემატება მხოლოდ log-ის ზარი.
-- ცხრილებზე პირდაპირი ადმინის ჩაწერა (კატეგორიები, რეპორტის სტატუსი) ტრიგერებით იფარება.

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_action_idx on public.admin_audit_log (action);

alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from public, anon, authenticated;
grant select on public.admin_audit_log to authenticated;
drop policy if exists "Admin can read audit log" on public.admin_audit_log;
create policy "Admin can read audit log" on public.admin_audit_log for select to authenticated using (public.is_admin());

create or replace function public.log_admin_action(p_action text, p_target_type text, p_target_id text, p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'::jsonb));
end;
$$;
revoke execute on function public.log_admin_action(text, text, text, jsonb) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_add_district(p_region_id text, p_region_label text, p_district text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  perform public.log_admin_action('district_add', 'region_district', p_district, jsonb_build_object('region_id',p_region_id,'region_label',p_region_label));
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_cancel_job(p_job_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_job public.job_posts%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then raise exception 'Job not found'; end if;
  if v_job.status not in ('pending', 'active', 'awaiting_customer_confirmation', 'disputed') then
    raise exception 'Job cannot be cancelled from its current status (status=%)', v_job.status;
  end if;

  update public.job_posts
     set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(), cancellation_actor = 'admin',
         cancellation_reason = coalesce(v_reason, 'გაუქმდა ადმინისტრაციის მიერ')
   where id = p_job_id;

  if v_job.customer_id is not null then
    insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
    values (v_job.customer_id, 'განცხადება გაუქმდა ადმინისტრაციის მიერ',
            coalesce(v_reason, public.job_category_label(v_job.category)), '⛔', '#DC2626',
            jsonb_build_object('screen', 'CustomerJobDetail', 'jobId', p_job_id), 'job_status_change');
  end if;
  if v_job.provider_id is not null then
    insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
    values (v_job.provider_id, 'სამუშაო გაუქმდა ადმინისტრაციის მიერ',
            coalesce(v_reason, public.job_category_label(v_job.category)), '⛔', '#DC2626',
            jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'selected'), 'job_status_change');
  end if;
  if v_job.status = 'pending' then
    insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
    select jr.provider_id, 'განცხადება გაუქმდა', public.job_category_label(v_job.category), 'ℹ️', '#64748B', null, 'job_status_change'
      from public.job_responses jr where jr.job_id = p_job_id;
  end if;
  perform public.log_admin_action('job_cancel', 'job', p_job_id::text, jsonb_build_object('reason',p_reason));
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_moderate_provider_content(p_provider_id uuid, p_action text, p_uri text DEFAULT NULL::text, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  perform public.log_admin_action('content_remove', 'user', p_provider_id::text, jsonb_build_object('action',p_action,'uri',p_uri,'reason',p_reason));
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_remove_job_photo(p_job_id uuid, p_ref text DEFAULT NULL::text, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  perform public.log_admin_action('job_photo_remove', 'job', p_job_id::text, jsonb_build_object('ref',p_ref,'reason',p_reason));
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_report_conversation(p_report_id uuid)
 RETURNS TABLE(id uuid, sender_id uuid, type text, body text, amount numeric, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_rep public.chat_reports%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select * into v_rep from public.chat_reports where chat_reports.id = p_report_id;
  if v_rep.id is null or v_rep.reported_user_id is null then return; end if;
  perform public.log_admin_action('chat_view', 'chat_report', p_report_id::text, '{}'::jsonb);
  return query
  select m.id, m.sender_id, m.type, coalesce(m.text, case when m.image_url is not null then '[ფოტო]' end), m.amount, m.created_at
    from (select * from public.messages mm
           where (mm.customer_id = v_rep.reporter_id and mm.provider_id = v_rep.reported_user_id)
              or (mm.provider_id = v_rep.reporter_id and mm.customer_id = v_rep.reported_user_id)
           order by mm.created_at desc limit 40) m
   order by m.created_at asc;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_resolve_job_dispute(p_job_id uuid, p_resolution text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_job public.job_posts%rowtype;
  v_reason text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if p_resolution not in ('reopen', 'cancel') then
    raise exception 'Invalid resolution: % (expected reopen or cancel)', p_resolution;
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.status <> 'disputed' then
    raise exception 'Job is not disputed (current status: %)', v_job.status;
  end if;

  if p_resolution = 'reopen' then
    update public.job_posts
    set status = 'awaiting_customer_confirmation', dispute_reason = null
    where id = p_job_id;

    insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
    values
      (v_job.customer_id, 'დავა განიხილეს', 'ადმინისტრაციამ დავა განიხილა — გთხოვთ, ხელახლა გადაამოწმოთ სამუშაოს დასრულება.', '⚖️', '#2563EB', jsonb_build_object('screen', 'CustomerJobDetail', 'jobId', p_job_id), 'job_status_change'),
      (v_job.provider_id, 'დავა განიხილეს', 'ადმინისტრაციამ დავა განიხილა — მომხმარებელს ხელახლა ეთხოვა დასრულების დადასტურება.', '⚖️', '#2563EB', jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'selected'), 'job_status_change');
  else
    v_reason := nullif(btrim(coalesce(v_job.dispute_reason, '')), '');
    update public.job_posts
    set
      status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      cancellation_actor = 'admin',
      cancellation_reason = coalesce(v_reason, 'ადმინისტრაციამ დავა მომხმარებლის სასარგებლოდ გადაწყვიტა.')
    where id = p_job_id;

    insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
    values
      (v_job.customer_id, 'დავა გადაწყდა', 'ადმინისტრაციამ დავა განიხილა — სამუშაო გაუქმებულია.', '⚖️', '#DC2626', jsonb_build_object('screen', 'CustomerJobDetail', 'jobId', p_job_id), 'job_status_change'),
      (v_job.provider_id, 'დავა გადაწყდა', 'ადმინისტრაციამ დავა განიხილა — სამუშაო გაუქმებულია.', '⚖️', '#DC2626', jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'selected'), 'job_status_change');
  end if;
  perform public.log_admin_action('dispute_resolve', 'job', p_job_id::text, jsonb_build_object('resolution',p_resolution));
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_review_provider_verification(p_provider_id uuid, p_approve boolean, p_rejection_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_provider public.provider_profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_provider from public.provider_profiles where id = p_provider_id for update;
  if v_provider.id is null then
    raise exception 'Provider profile not found';
  end if;

  if v_provider.verification_status <> 'pending' then
    raise exception 'Verification request is not pending (current status: %)', v_provider.verification_status;
  end if;

  if p_approve then
    if not exists (select 1 from public.provider_verification_requests r where r.provider_id = p_provider_id and r.selfie_path is not null) then
      raise exception 'SELFIE_REQUIRED';
    end if;
    update public.provider_profiles set verification_status = 'verified' where id = p_provider_id;
    update public.provider_verification_requests
      set rejection_reason = null
      where provider_id = p_provider_id;

    insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
    values (p_provider_id, 'ვერიფიკაცია დადასტურდა', 'თქვენი პროფილი ვერიფიცირებულია', '✅', '#059669', null, 'verification_status_change');
  else
    update public.provider_profiles set verification_status = 'rejected' where id = p_provider_id;
    update public.provider_verification_requests
      set rejection_reason = nullif(btrim(coalesce(p_rejection_reason, '')), '')
      where provider_id = p_provider_id;

    insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
    values (
      p_provider_id, 'ვერიფიკაცია უარყოფილია',
      coalesce(nullif(btrim(coalesce(p_rejection_reason, '')), ''), 'გაიარეთ ხელახლა პროფილის შევსების შემდეგ'),
      '⚠️', '#DC2626', null, 'verification_status_change'
    );
  end if;
  perform public.log_admin_action('verification_review', 'user', p_provider_id::text, jsonb_build_object('approve',p_approve,'reason',p_rejection_reason));
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_revoke_verification(p_provider_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  update public.provider_profiles set verification_status = 'unverified'
   where id = p_provider_id and verification_status = 'verified';
  if not found then raise exception 'Provider is not verified'; end if;
  update public.provider_verification_requests set rejection_reason = v_reason where provider_id = p_provider_id;
  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (p_provider_id, 'ვერიფიკაცია მოიხსნა', coalesce(v_reason, 'შეგიძლიათ ხელახლა გაიაროთ ვერიფიკაცია'),
          '⚠️', '#DC2626', null, 'verification_status_change');
  perform public.log_admin_action('verification_revoke', 'user', p_provider_id::text, jsonb_build_object('reason',p_reason));
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_send_broadcast(p_title text, p_body text, p_audience text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_count integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_audience not in ('all', 'customer', 'provider') then raise exception 'Invalid audience'; end if;
  if char_length(v_title) not between 1 and 80 then raise exception 'Title must be 1-80 characters'; end if;
  if char_length(v_body) not between 1 and 300 then raise exception 'Body must be 1-300 characters'; end if;
  -- ორმაგი დაჭერის/განმეორების დაცვა
  if exists (select 1 from public.admin_broadcasts b
              where b.title = v_title and b.body = v_body and b.audience = p_audience
                and b.created_at > now() - interval '10 minutes') then
    raise exception 'DUPLICATE_BROADCAST';
  end if;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  select u.id, v_title, v_body, '📢', '#2563EB', null, 'announcement'
    from public.users u
   where u.role in ('customer', 'provider')
     and (p_audience = 'all' or u.role = p_audience)
     and u.suspended_at is null;
  get diagnostics v_count = row_count;

  insert into public.admin_broadcasts (admin_id, title, body, audience, recipient_count)
  values (auth.uid(), v_title, v_body, p_audience, v_count);
  perform public.log_admin_action('broadcast_send', 'broadcast', null, jsonb_build_object('audience', p_audience, 'title', v_title, 'recipients', v_count));
  return v_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_app_setting(p_key text, p_value integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_min integer; v_max integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select r.mn, r.mx into v_min, v_max from (values
    ('max_open_jobs', 1, 50), ('job_expiry_days', 7, 90), ('dispute_limit', 1, 10),
    ('offer_expiry_days', 1, 30), ('confirmation_grace_hours', 12, 336), ('stale_interest_hours', 12, 336)
  ) as r(k, mn, mx) where r.k = p_key;
  if v_min is null then raise exception 'Unknown setting'; end if;
  if p_value < v_min or p_value > v_max then raise exception 'Value out of range (% - %)', v_min, v_max; end if;
  update public.app_settings set value = p_value, updated_at = now() where key = p_key;
  perform public.log_admin_action('setting_change', 'setting', p_key, jsonb_build_object('value',p_value));
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_district_active(p_id uuid, p_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  update public.region_districts set is_active = p_active where id = p_id;
  if not found then raise exception 'District not found'; end if;
  perform public.log_admin_action('district_toggle', 'region_district', p_id::text, jsonb_build_object('active',p_active));
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_review_hidden(p_review_id uuid, p_hidden boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  update public.reviews set hidden = p_hidden where id = p_review_id;
  if not found then raise exception 'Review not found'; end if;
  perform public.log_admin_action('review_hide', 'review', p_review_id::text, jsonb_build_object('hidden',p_hidden));
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_suspended(p_user_id uuid, p_suspended boolean, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  perform public.log_admin_action('user_suspend', 'user', p_user_id::text, jsonb_build_object('suspended',p_suspended,'reason',p_reason));
end;
$function$;

-- ცხრილებზე პირდაპირი ადმინის ჩაწერა
create or replace function public.audit_admin_table_write() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then return coalesce(new, old); end if;
  if tg_table_name = 'categories' then
    if tg_op = 'DELETE' then
      perform public.log_admin_action('category_delete', 'category', old.id, jsonb_build_object('name', old.name));
    else
      perform public.log_admin_action('category_' || lower(tg_op), 'category', new.id,
        jsonb_build_object('name', new.name, 'is_active', new.is_active, 'featured', new.featured));
    end if;
    return coalesce(new, old);
  end if;
  -- job_reports / chat_reports: მხოლოდ სტატუსის ცვლილება
  if new.status is distinct from old.status then
    perform public.log_admin_action('report_status', tg_table_name, new.id::text,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;
revoke execute on function public.audit_admin_table_write() from public, anon, authenticated;

drop trigger if exists audit_categories on public.categories;
create trigger audit_categories after insert or update or delete on public.categories
  for each row execute function public.audit_admin_table_write();
drop trigger if exists audit_job_reports on public.job_reports;
create trigger audit_job_reports after update on public.job_reports
  for each row execute function public.audit_admin_table_write();
drop trigger if exists audit_chat_reports on public.chat_reports;
create trigger audit_chat_reports after update on public.chat_reports
  for each row execute function public.audit_admin_table_write();
