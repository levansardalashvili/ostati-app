-- საიტისა და ადმინ-პანელის ბაზის მხარის თავდასხმის სიმულაცია: ანონიმური და ჩვეულებრივი მომხმარებლის უფლებებით.
-- ყველაფერი rollback-შია. ყველა შედეგი უნდა იყოს "დაბლოკილია" ან "0"; "ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!" = ხვრელი.
-- გაშვება: npx supabase@latest db query --linked -f supabase/security-tests/attack-site.sql
-- (აპის თავდასხმის ტესტის — attack.sql-ის — შემავსებელია; ორივე უნდა გაიაროს ყოველი მიგრაციის შემდეგ.)
begin;
create temp table res(t text, r text);
grant all on res to authenticated, anon;
create temp table ids as select
 (select id from public.users where role='customer' order by created_at limit 1) cid,
 (select id from public.users where role='provider' order by created_at limit 1) pid;
grant select on ids to authenticated, anon;

-- [რეჟიმი, სახელი, SQL]. w = ჩაწერა (0 ჩანაწერი ან შეცდომა = კარგი), r = წაკითხვა (უნდა იყოს 0)
create temp table tests(mode text, label text, q text);
insert into tests values
 ('w','site_pages: ჩაწერა',           $q$insert into public.site_pages(slug,title,kind) values('zz-hack','x','page')$q$),
 ('w','site_pages: შეცვლა',           $q$update public.site_pages set title='hacked'$q$),
 ('w','site_pages: წაშლა',            $q$delete from public.site_pages$q$),
 ('r','site_pages: დრაფტების წაკითხვა',$q$select count(*) from public.site_pages where kind='page' and not is_published$q$),
 ('w','site_settings: ჩაწერა',        $q$insert into public.site_settings(key,value) values('zz_evil','x')$q$),
 ('w','site_settings: შეცვლა',        $q$update public.site_settings set value='http://evil.example'$q$),
 ('w','site_settings: წაშლა',         $q$delete from public.site_settings$q$),
 ('w','site_blocks: ჩაწერა',          $q$insert into public.site_blocks(block_key,icon_key,title) values('zz','x','x')$q$),
 ('w','site_blocks: შეცვლა',          $q$update public.site_blocks set title='hacked'$q$),
 ('w','site_blocks: წაშლა',           $q$delete from public.site_blocks$q$),
 ('w','site_screenshots: ჩაწერა',     $q$insert into public.site_screenshots(path) values('screens/x.png')$q$),
 ('w','site_screenshots: წაშლა',      $q$delete from public.site_screenshots$q$),
 ('w','categories: ჩაწერა',           $q$insert into public.categories(id,name,icon_key) values('zz','x','x')$q$),
 ('w','categories: შეცვლა',           $q$update public.categories set name='hacked'$q$),
 ('w','categories: წაშლა',            $q$delete from public.categories$q$),
 ('w','region_districts: ჩაწერა',     $q$insert into public.region_districts(region_id,region_label,region_sort,district,sort_order) values('zz','x',1,'x',1)$q$),
 ('w','region_districts: შეცვლა',     $q$update public.region_districts set district='hacked'$q$),
 ('r','app_settings: ლიმიტების წაკითხვა',$q$select count(*) from public.app_settings$q$),
 ('w','app_settings: შეცვლა',         $q$update public.app_settings set value=1$q$),
 ('r','app_gate: პირდაპირი წაკითხვა', $q$select count(*) from public.app_gate$q$),
 ('w','app_gate: ტექნიკური რეჟიმის ჩართვა',$q$update public.app_gate set maintenance=true$q$),
 ('r','admin_audit_log: ჟურნალის წაკითხვა',$q$select count(*) from public.admin_audit_log$q$),
 ('w','admin_audit_log: ყალბი ჩანაწერი',$q$insert into public.admin_audit_log(action,target_type) values('fake','fake')$q$),
 ('w','admin_audit_log: წაშლა',       $q$delete from public.admin_audit_log$q$),
 ('r','help_articles: დრაფტები',      $q$select count(*) from public.help_articles where not is_published$q$),
 ('r','help_categories: დრაფტები',    $q$select count(*) from public.help_categories where not is_published$q$),
 ('w','help_articles: შეცვლა',        $q$update public.help_articles set title='hacked'$q$),
 ('w','help_articles: წაშლა',         $q$delete from public.help_articles$q$),
 ('w','help_categories: შეცვლა',      $q$update public.help_categories set title='hacked'$q$),
 ('r','admin_broadcasts: წაკითხვა',   $q$select count(*) from public.admin_broadcasts$q$),
 ('w','storage site-media: ატვირთვა', $q$insert into storage.objects(bucket_id,name) values('site-media','screens/hack.png')$q$),
 ('w','storage site-media: წაშლა',    $q$delete from storage.objects where bucket_id='site-media'$q$),
 ('w','storage site-media: შეცვლა',   $q$update storage.objects set name=name||'x' where bucket_id='site-media'$q$),
 ('w','storage user-media: სხვის საქაღალდეში ატვირთვა',$q$insert into storage.objects(bucket_id,name) values('user-media','profile/'||(select pid from ids)||'/hack.png')$q$),
 ('w','storage job-photos: სხვის საქაღალდეში ატვირთვა',$q$insert into storage.objects(bucket_id,name) values('job-photos',(select pid from ids)||'/hack.png')$q$),
 ('w','storage user-media: სხვისი ფაილის წაშლა',$q$delete from storage.objects where bucket_id='user-media' and name like '%'||(select pid from ids)||'%'$q$),
 ('r','storage private-media: სხვის ფაილებს ვხედავ',$q$select count(*) from storage.objects where bucket_id='private-media'$q$),
 ('w','ჩემი role-ის შეცვლა admin-ად (users)',$q$update public.users set role='admin'$q$),
 ('w','ახალი ადმინის შექმნა (users insert)',$q$insert into public.users(id,role,first_name,last_name,email) values(gen_random_uuid(),'admin','x','x','x@y.z')$q$);
grant select on tests to authenticated, anon;

-- ================= ანონიმური =================
select set_config('request.jwt.claims','',true);
set local role anon;
do $$
declare r record; n int;
begin
 for r in select * from tests order by mode, label loop
  begin
   if r.mode='w' then
     execute r.q; get diagnostics n = row_count;
     insert into res values('ანონიმური | '||r.label, case when n=0 then 'დაბლოკილია (0 ჩანაწერი)' else 'ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ! ('||n||')' end);
   else
     execute r.q into n;
     insert into res values('ანონიმური | '||r.label, case when n=0 then 'დაბლოკილია (0)' else 'ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ! ვხედავ '||n end);
   end if;
  exception when others then
   insert into res values('ანონიმური | '||r.label, 'დაბლოკილია (უფლება)');
  end;
 end loop;
end $$;

-- მიმართვის ფორმის (ღია RPC) ბოროტად გამოყენება
do $$
declare n0 int; n1 int; ok boolean;
begin
 begin perform public.submit_support_request('a','a@b.co','other',repeat('x',5000),''); insert into res values('ფორმა | 5000-სიმბოლოიანი ტექსტი','ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!'); exception when others then insert into res values('ფორმა | 5000-სიმბოლოიანი ტექსტი','დაბლოკილია'); end;
 begin perform public.submit_support_request(repeat('n',5000),'a@b.co','other','ნორმალური ტექსტი აქ','' ); insert into res values('ფორმა | 5000-სიმბოლოიანი სახელი','ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!'); exception when others then insert into res values('ფორმა | 5000-სიმბოლოიანი სახელი','დაბლოკილია'); end;
 begin perform public.submit_support_request('a','a@b.co','hack','ნორმალური ტექსტი აქ',''); insert into res values('ფორმა | უცნობი თემა','ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!'); exception when others then insert into res values('ფორმა | უცნობი თემა','დაბლოკილია'); end;
 begin perform public.submit_support_request('a','არა-ელფოსტა','other','ნორმალური ტექსტი აქ',''); insert into res values('ფორმა | არასწორი კონტაქტი','ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!'); exception when others then insert into res values('ფორმა | არასწორი კონტაქტი','დაბლოკილია'); end;
 begin perform public.submit_support_request(null,null,null,null,null); insert into res values('ფორმა | null ველები','ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!'); exception when others then insert into res values('ფორმა | null ველები','დაბლოკილია'); end;
 -- SQL-injection სტრიქონი უნდა ჩაიწეროს უვნებლად, როგორც ჩვეულებრივი ტექსტი (ცხრილი არსად უნდა წაიშალოს)
 begin perform public.submit_support_request($s$x'); drop table public.users; --$s$,'inj@b.co','other',$s$'; delete from public.users; -- ტექსტი$s$,''); insert into res values('ფორმა | SQL-injection ტექსტი','უვნებლად დამუშავდა (users ცხრილი სადაა ქვემოთ)'); exception when others then insert into res values('ფორმა | SQL-injection ტექსტი','უარყოფილია'); end;
 -- ლიმიტი: ერთ კონტაქტზე >3 მიმართვა საათში
 ok := true;
 begin
  perform public.submit_support_request('r','rate@b.co','other','ტესტი ერთი ორი სამი','');
  perform public.submit_support_request('r','rate@b.co','other','ტესტი ერთი ორი სამი','');
  perform public.submit_support_request('r','rate@b.co','other','ტესტი ერთი ორი სამი','');
  perform public.submit_support_request('r','rate@b.co','other','ტესტი ერთი ორი სამი','');
  perform public.submit_support_request('r','rate@b.co','other','ტესტი ერთი ორი სამი','');
  insert into res values('ფორმა | 5 მიმართვა ერთი კონტაქტიდან','ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ! (ლიმიტი არ მუშაობს)');
 exception when others then insert into res values('ფორმა | 5 მიმართვა ერთი კონტაქტიდან','დაბლოკილია: '||left(sqlerrm,30)); end;
end $$;
reset role;
-- honeypot: სავსე ფარული ველი ბაზაში არაფერს არ წერს
do $$
declare n0 int; n1 int;
begin
 select count(*) into n0 from public.support_requests;
 set local role anon;
 perform public.submit_support_request('bot','bot@b.co','other','ბოტის ტექსტი ბევრი','http://spam.example');
 reset role;
 select count(*) into n1 from public.support_requests;
 insert into res values('ფორმა | honeypot (ბოტი)', case when n1=n0 then 'დაბლოკილია (არ ჩაიწერა)' else 'ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ! ჩაიწერა' end);
exception when others then reset role; insert into res values('ფორმა | honeypot (ბოტი)','უარყოფილია');
end $$;
insert into res select 'users ცხრილი ცოცხალია (injection-ის შემდეგ)', case when to_regclass('public.users') is not null then 'დიახ' else 'ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ! წაიშალა' end;

-- ================= ჩვეულებრივი (არაადმინი) მომხმარებელი =================
select set_config('request.jwt.claims', json_build_object('sub',(select cid from ids),'role','authenticated')::text, true);
set local role authenticated;
do $$
declare r record; n int;
begin
 for r in select * from tests order by mode, label loop
  begin
   if r.mode='w' then
     execute r.q; get diagnostics n = row_count;
     insert into res values('მომხმარებელი | '||r.label, case when n=0 then 'დაბლოკილია (0 ჩანაწერი)' else 'ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ! ('||n||')' end);
   else
     execute r.q into n;
     insert into res values('მომხმარებელი | '||r.label, case when n=0 then 'დაბლოკილია (0)' else 'ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ! ვხედავ '||n end);
   end if;
  exception when others then
   insert into res values('მომხმარებელი | '||r.label, 'დაბლოკილია (უფლება)');
  end;
 end loop;
 -- ყველა admin_* ფუნქცია, რომელიც ჩვეულებრივ მომხმარებელს შეუძლია გამოიძახოს, უნდა წყდებოდეს ადმინის შემოწმებაზე
 begin perform public.admin_set_user_suspended((select pid from ids), true, 'x'); insert into res values('მომხმარებელი | ოსტატის შეჩერება','ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!'); exception when others then insert into res values('მომხმარებელი | ოსტატის შეჩერება','დაბლოკილია'); end;
 begin perform public.admin_send_broadcast('x','y','all'); insert into res values('მომხმარებელი | ყველასთვის შეტყობინების გაგზავნა','ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!'); exception when others then insert into res values('მომხმარებელი | ყველასთვის შეტყობინების გაგზავნა','დაბლოკილია'); end;
 begin perform public.admin_set_app_gate('9.9.9', true, 'x', ''); insert into res values('მომხმარებელი | აპის ჩაკეტვა (ტექ. რეჟიმი)','ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!'); exception when others then insert into res values('მომხმარებელი | აპის ჩაკეტვა (ტექ. რეჟიმი)','დაბლოკილია'); end;
 begin perform public.admin_set_app_setting('max_open_jobs', 999); insert into res values('მომხმარებელი | ლიმიტის შეცვლა','ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!'); exception when others then insert into res values('მომხმარებელი | ლიმიტის შეცვლა','დაბლოკილია'); end;
end $$;
reset role;

-- ================= ოსტატი და მომხმარებელი ერთმანეთის მონაცემებს ვერ ხედავს =================
-- (r-ტესტები: "მე" გამოკლებულია; უნდა იყოს 0)
create temp table peers(who text, label text, q text);
insert into peers values
 ('p','სხვა მომხმარებლების პირადი მონაცემები (email/ტელეფონი)', $q$select count(*) from public.users where id<>(select pid from ids)$q$),
 ('p','კონკურენტების ფასის შეთავაზებები',                    $q$select count(*) from public.job_responses where provider_id<>(select pid from ids)$q$),
 ('p','სხვისი განცხადებები (ზუსტი მისამართი)',                $q$select count(*) from public.job_posts where customer_id<>(select pid from ids) and provider_id is distinct from (select pid from ids)$q$),
 ('p','სხვის საუბრებს ვხედავ',                                $q$select count(*) from public.conversations where customer_id<>(select pid from ids) and provider_id<>(select pid from ids)$q$),
 ('p','სხვის შეტყობინებებს ვხედავ (messages)',                $q$select count(*) from public.messages where customer_id<>(select pid from ids) and provider_id<>(select pid from ids)$q$),
 ('p','სხვის შეტყობინებების პარამეტრებს ვხედავ',              $q$select count(*) from public.notification_preferences where user_id<>(select pid from ids)$q$),
 ('p','სხვის სელფებს/ვერიფიკაციის მოთხოვნებს ვხედავ',        $q$select count(*) from public.provider_verification_requests where provider_id<>(select pid from ids)$q$),
 ('p','სხვის რეპორტებს ვხედავ',                               $q$select count(*) from public.job_reports where reporter_id<>(select pid from ids)$q$),
 ('p','ჩატის რეპორტებს ვხედავ',                               $q$select count(*) from public.chat_reports where reporter_id<>(select pid from ids)$q$),
 ('p','სხვის ბლოკებს ვხედავ',                                 $q$select count(*) from public.user_blocks where blocker_id<>(select pid from ids)$q$),
 ('p','სხვის push token-ებს ვხედავ',                          $q$select count(*) from public.push_tokens where user_id<>(select pid from ids)$q$),
 ('p','შეფასების ავტორის id (ანონიმურობა)',                   $q$select count(customer_id) from public.reviews$q$),
 ('c','სხვა მომხმარებლების პირადი მონაცემები (email/ტელეფონი)', $q$select count(*) from public.users where id<>(select cid from ids)$q$),
 ('c','სხვისი შეფასების ავტორის id (ანონიმურობა)',             $q$select count(customer_id) from public.reviews where customer_id is distinct from (select cid from ids)$q$),
 ('c','სხვის საუბრებს ვხედავ',                                $q$select count(*) from public.conversations where customer_id<>(select cid from ids) and provider_id<>(select cid from ids)$q$),
 ('c','სხვის ვერიფიკაციის მოთხოვნებს/სელფებს ვხედავ',        $q$select count(*) from public.provider_verification_requests$q$),
 ('c','სხვის ფასის შეთავაზებებს ვხედავ (სხვისი განცხადება)', $q$select count(*) from public.job_responses jr where not exists (select 1 from public.job_posts jp where jp.id=jr.job_id and jp.customer_id=(select cid from ids))$q$);
grant select on peers to authenticated;
select set_config('request.jwt.claims', json_build_object('sub',(select pid from ids),'role','authenticated')::text, true);
set local role authenticated;
do $$
declare r record; n int;
begin
 for r in select * from peers where who='p' loop
  begin execute r.q into n; insert into res values('ოსტატი | '||r.label, case when n=0 then 'დაბლოკილია (0)' else 'ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ! ვხედავ '||n end);
  exception when others then insert into res values('ოსტატი | '||r.label,'დაბლოკილია (უფლება)'); end;
 end loop;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub',(select cid from ids),'role','authenticated')::text, true);
set local role authenticated;
do $$
declare r record; n int;
begin
 for r in select * from peers where who='c' loop
  begin execute r.q into n; insert into res values('მომხმარებელი | '||r.label, case when n=0 then 'დაბლოკილია (0)' else 'ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ! ვხედავ '||n end);
  exception when others then insert into res values('მომხმარებელი | '||r.label,'დაბლოკილია (უფლება)'); end;
 end loop;
end $$;
reset role;

-- ================= კატალოგის შემოწმება (სტრუქტურული) =================
insert into res select 'კატალოგი | ცხრილი RLS-ის გარეშე: '||c.relname, 'ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!'
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;
insert into res select 'კატალოგი | admin ფუნქცია ადმინის შემოწმების გარეშე: '||p.proname, 'ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!'
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'admin\_%' and p.prosrc not like '%is_admin()%';
insert into res select 'კატალოგი | admin ფუნქცია ღიაა ანონიმისთვის: '||p.proname, 'ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!'
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'admin\_%' and has_function_privilege('anon', p.oid, 'EXECUTE');
insert into res select 'კატალოგი | anon-ს ჩაწერის/TRUNCATE უფლება აქვს ცხრილზე: '||table_name, 'გაფრთხილება (RLS იცავს, მაგრამ უფლება ზედმეტია)'
 from information_schema.role_table_grants where grantee='anon' and table_schema='public' and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE') group by table_name;
insert into res select 'კატალოგი | authenticated-ს TRUNCATE უფლება აქვს: '||table_name, 'გაფრთხილება'
 from information_schema.role_table_grants where grantee='authenticated' and table_schema='public' and privilege_type='TRUNCATE' group by table_name;
insert into res select 'კატალოგი | ღია bucket ლიმიტის/ტიპის გარეშე: '||id, 'გაფრთხილება (public bucket-ში ნებისმიერი ტიპისა და ზომის ფაილი)'
 from storage.buckets where public and (file_size_limit is null or allowed_mime_types is null) and id <> 'private-media';

select t, r from res order by (r like 'ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ%') desc, (r like 'გაფრთხილება%') desc, t;
rollback;
