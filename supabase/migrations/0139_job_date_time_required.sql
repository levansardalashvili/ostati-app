-- 0139: განცხადებაში სასურველი თარიღი და დრო სერვერზეც სავალდებულოა (0138-ის შემდეგ აპის UI უკვე მოითხოვს ორივეს).
--
-- create_job / update_job_draft / update_pending_job: preferred_date და time_slot ორივე უნდა იყოს მითითებული
-- (time_slot შეიძლება იყოს 'flexible' — ესეც არჩევანია). ძველი განცხადებები (თარიღის გარეშე) უცვლელი რჩება;
-- შეზღუდვა მხოლოდ ახალ შექმნასა და რედაქტირებას ეხება. ფუნქციები ცოცხალი განმარტებებიდანაა გენერირებული
-- (მხოლოდ ერთი შემოწმება ემატება); ხელახლა გაშვება უვნებელია.
do $$
declare
  r record;
  def text;
  marker constant text := 'if p_preferred_date is null and p_time_slot is not null then';
  added constant text :=
    E'if p_preferred_date is null or p_time_slot is null then\n    raise exception ''DATE_TIME_REQUIRED: preferred date and time are required'';\n  end if;\n  ';
begin
  for r in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('create_job', 'update_pending_job', 'update_job_draft')
  loop
    def := pg_get_functiondef(r.oid);
    if position('DATE_TIME_REQUIRED' in def) = 0 and position(marker in def) > 0 then
      execute replace(def, marker, added || marker);
      raise notice 'updated %', r.proname;
    end if;
  end loop;
end $$;
