-- 0110: დროზე დამოკიდებული წესები აღარ ელოდება, სანამ ვინმე აპს გახსნის — pg_cron ყოველ 15 წუთში ასრულებს იმავე
-- (უკვე გატესტილ) RPC-ებს: 72სთ ავტო-დადასტურება (0079), განცხადების ვადის შეხსენება/გაუქმება (0099/0105),
-- "არავინ დაინტერესდა" შეხსენება (0082). ლოგიკა არ დუბლირდება: ეს ფუნქციები auth.uid()-ს ითხოვენ, ამიტომ
-- თითო ჩანაწერზე ტრანზაქციის ლოკალური JWT claim ისმება მფლობელის სახელით. კლიენტის ზარმაცი გამოძახებები
-- ინარჩუნებს (ყველა იდემპოტენტურია).
create extension if not exists pg_cron;

create or replace function public.run_time_rules()
returns void language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  for r in
    select id, customer_id from public.job_posts
     where status = 'awaiting_customer_confirmation' and customer_id is not null
       and updated_at < now() - interval '72 hours'
  loop
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', r.customer_id, 'role', 'authenticated')::text, true);
      perform public.expire_stale_job_confirmation(r.id);
    exception when others then null;
    end;
  end loop;

  for r in
    select distinct customer_id from public.job_posts
     where status = 'pending' and customer_id is not null and created_at < now() - interval '27 days'
  loop
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', r.customer_id, 'role', 'authenticated')::text, true);
      perform public.expire_my_stale_jobs();
    exception when others then null;
    end;
  end loop;

  for r in
    select jp.id, jp.customer_id from public.job_posts jp
     where jp.status = 'pending' and jp.customer_id is not null
       and jp.created_at < now() - interval '48 hours'
       and jp.stale_interest_reminder_sent_at is null
       and not exists (select 1 from public.job_responses jr where jr.job_id = jp.id)
  loop
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', r.customer_id, 'role', 'authenticated')::text, true);
      perform public.check_stale_job_interest(r.id);
    exception when others then null;
    end;
  end loop;

  perform set_config('request.jwt.claims', '', true);
end;
$$;
revoke execute on function public.run_time_rules() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'ostati-time-rules';
select cron.schedule('ostati-time-rules', '*/15 * * * *', 'select public.run_time_rules()');
