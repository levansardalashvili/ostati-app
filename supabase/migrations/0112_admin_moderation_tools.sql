-- 0112: ადმინის მოდერაციის ინსტრუმენტები — ყველა is_admin()-გეითით, RPC-ით (service_role-ის გარეშე):
--   admin_cancel_job          — შეუსაბამო/საეჭვო განცხადების გაუქმება (მონაწილეებს ეცნობებათ)
--   admin_revoke_verification — ვერიფიცირებული ოსტატის სტატუსის მოხსნა (ოსტატს ეცნობება)
--   admin_report_conversation — ჩატის რეპორტის კონტექსტი: რეპორტში მონაწილე ორი მხარის ბოლო შეტყობინებები

create or replace function public.admin_cancel_job(p_job_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
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
end;
$$;
revoke execute on function public.admin_cancel_job(uuid, text) from public, anon;
grant execute on function public.admin_cancel_job(uuid, text) to authenticated;

create or replace function public.admin_revoke_verification(p_provider_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
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
end;
$$;
revoke execute on function public.admin_revoke_verification(uuid, text) from public, anon;
grant execute on function public.admin_revoke_verification(uuid, text) to authenticated;

-- მხოლოდ არსებულ ჩატის რეპორტზე და მხოლოდ იმ ორ მხარეს შორის; ფოტოს მისამართი არ ბრუნდება
create or replace function public.admin_report_conversation(p_report_id uuid)
returns table(id uuid, sender_id uuid, type text, body text, amount numeric, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_rep public.chat_reports%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select * into v_rep from public.chat_reports where chat_reports.id = p_report_id;
  if v_rep.id is null or v_rep.reported_user_id is null then return; end if;
  return query
  select m.id, m.sender_id, m.type, coalesce(m.text, case when m.image_url is not null then '[ფოტო]' end), m.amount, m.created_at
    from (select * from public.messages mm
           where (mm.customer_id = v_rep.reporter_id and mm.provider_id = v_rep.reported_user_id)
              or (mm.provider_id = v_rep.reporter_id and mm.customer_id = v_rep.reported_user_id)
           order by mm.created_at desc limit 40) m
   order by m.created_at asc;
end;
$$;
revoke execute on function public.admin_report_conversation(uuid) from public, anon;
grant execute on function public.admin_report_conversation(uuid) to authenticated;
