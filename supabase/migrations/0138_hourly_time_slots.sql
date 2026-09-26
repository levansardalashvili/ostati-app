-- 0138: სასურველი დრო — 1-საათიანი შუალედები (მაგ. '09-10' = 09:00–10:00, საქართველოს დრო).
--
-- მანამდე time_slot მხოლოდ 5 ფიქსირებული მნიშვნელობა იყო ('09-12','12-15','15-18','18-21','flexible').
-- ახლა დასაშვებია ნებისმიერი 'HH-HH' (დაწყება < დასრულება, 00–24) და 'flexible'. ძველი მნიშვნელობები ამ ფორმატს
-- ემთხვევა, ამიტომ არსებული განცხადებები უცვლელი რჩება; ძველი აპის ვერსიები ძველ მნიშვნელობებს აგზავნიან — ისინიც მუშაობს.
--
-- job_scheduled_start() (ოსტატის ნაადრევი "სამუშაო დავასრულე"-ს ბლოკი) ახლა შუალედის დაწყების საათს
-- ფორმატიდან კითხულობს (ადრე ჩამოთვლილი 4 მნიშვნელობა); 'flexible'/ცარიელი — როგორც ადრე, დღის დასაწყისი.
alter table public.job_posts drop constraint if exists job_posts_time_slot_check;
alter table public.job_posts add constraint job_posts_time_slot_check check (
  time_slot is null
  or time_slot = 'flexible'
  or (
    time_slot ~ '^(0[0-9]|1[0-9]|2[0-3])-(0[1-9]|1[0-9]|2[0-4])$'
    and split_part(time_slot, '-', 1)::int < split_part(time_slot, '-', 2)::int
  )
);

create or replace function public.job_scheduled_start(p_preferred_date date, p_time_slot text)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when p_preferred_date is null then null
    -- კონკრეტული შუალედის დაწყების საათი (საქართველოს დრო). 'flexible'/ცარიელი/უცნობი — იმ დღის დასაწყისი.
    when p_time_slot ~ '^[0-2][0-9]-[0-2][0-9]$' then make_timestamptz(
      extract(year from p_preferred_date)::int, extract(month from p_preferred_date)::int, extract(day from p_preferred_date)::int,
      split_part(p_time_slot, '-', 1)::int, 0, 0, 'Asia/Tbilisi')
    else make_timestamptz(
      extract(year from p_preferred_date)::int, extract(month from p_preferred_date)::int, extract(day from p_preferred_date)::int,
      0, 0, 0, 'Asia/Tbilisi')
  end;
$$;

-- create_job / update_pending_job / update_job_draft ადრე time_slot-ს 5 ჩამოთვლილ მნიშვნელობას ადარებდა. ახლა იგივე შემოწმება
-- ფორმატია ('HH-HH', დაწყება < დასრულება) ან 'flexible'. ფუნქციები ცოცხალი განმარტებებიდანაა გენერირებული (მხოლოდ ეს პირობა იცვლება,
-- დანარჩენი ლოგიკა უცვლელია); ხელახლა გაშვება უვნებელია (მეორედ ჩანაცვლების ობიექტი აღარ არსებობს).
do $$
declare
  r record;
  def text;
  old_cond constant text := $c$p_time_slot not in ('09-12', '12-15', '15-18', '18-21', 'flexible')$c$;
  new_cond constant text := $c$(case
      when p_time_slot = 'flexible' then false
      when p_time_slot !~ '^(0[0-9]|1[0-9]|2[0-3])-(0[1-9]|1[0-9]|2[0-4])$' then true
      else split_part(p_time_slot, '-', 1)::int >= split_part(p_time_slot, '-', 2)::int
    end)$c$;
begin
  for r in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('create_job', 'update_pending_job', 'update_job_draft')
  loop
    def := pg_get_functiondef(r.oid);
    if position(old_cond in def) > 0 then
      execute replace(def, old_cond, new_cond);
      raise notice 'updated %', r.proname;
    end if;
  end loop;
end $$;
