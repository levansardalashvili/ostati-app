-- უსაფრთხოების თავდასხმის სიმულაცია: ჩვეულებრივი მომხმარებლის და ანონიმის უფლებებით.
-- ყველაფერი rollback-ში სრულდება, ბაზა არ იცვლება. ყველა შედეგი უნდა იყოს "დაბლოკილია" ან "0";
-- "ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!" = ხვრელია. გაშვება (პროექტის საქაღალდიდან):
--   npx supabase@latest db query --linked -f supabase/security-tests/attack.sql
-- საჭიროა ბაზაში მინიმუმ 1 customer, 1 provider და სხვისი განცხადება.
begin;
create temp table res(t text, r text);
grant all on res to authenticated, anon;
create temp table ids as select
 (select id from public.users where role='customer' order by created_at limit 1) cid,
 (select id from public.users where role='provider' order by created_at limit 1) pid,
 (select jp.id from public.job_posts jp where jp.customer_id <> (select id from public.users where role='customer' order by created_at limit 1) limit 1) foreign_job;
grant select on ids to authenticated, anon;
select set_config('request.jwt.claims', json_build_object('sub',(select cid from ids),'role','authenticated')::text, true);
set local role authenticated;
do $$
declare n int; me uuid := (select cid from ids); pv uuid := (select pid from ids); fj uuid := (select foreign_job from ids);
begin
 begin update public.users set role='admin' where id=me; get diagnostics n=row_count; insert into res values('1 ჩემი role-ის შეცვლა admin-ად', case when n=0 then 'დაბლოკილია' else 'ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!' end);
 exception when others then insert into res values('1 ჩემი role-ის შეცვლა admin-ად','დაბლოკილია (უფლება უარყოფილია)'); end;
 begin select count(*) into n from public.users; insert into res values('2 სხვა მომხმარებლების წაკითხვა (users)', 'ვხედავ '||n||' ჩანაწერს (უნდა იყოს 1)'); exception when others then insert into res values('2 users','დაბლოკილია'); end;
 begin update public.provider_profiles set verification_status='verified' where id=pv; get diagnostics n=row_count; insert into res values('3 ოსტატის საკუთარი თავის ვერიფიცირება/სხვისი', case when n=0 then 'დაბლოკილია' else 'ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!' end); exception when others then insert into res values('3 ვერიფიკაციის შეცვლა','დაბლოკილია (უფლება უარყოფილია)'); end;
 begin select count(*) into n from public.job_posts where customer_id<>me and provider_id is distinct from me; insert into res values('4 სხვისი განცხადებების ზუსტი მისამართი', 'ვხედავ '||n||' (უნდა იყოს 0)'); exception when others then insert into res values('4 job_posts','დაბლოკილია'); end;
 begin update public.job_posts set status='completed' where customer_id<>me; get diagnostics n=row_count; insert into res values('5 სხვისი განცხადების სტატუსის შეცვლა', case when n=0 then 'დაბლოკილია' else 'ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!' end); exception when others then insert into res values('5 სტატუსის შეცვლა','დაბლოკილია (უფლება უარყოფილია)'); end;
 begin select count(*) into n from public.notifications where user_id<>me; insert into res values('6 სხვის შეტყობინებებს ვკითხულობ','ვხედავ '||n||' (უნდა იყოს 0)'); exception when others then insert into res values('6 notifications','დაბლოკილია'); end;
 begin select count(*) into n from public.messages where customer_id<>me and provider_id<>me; insert into res values('7 სხვის ჩატებს ვკითხულობ','ვხედავ '||n||' (უნდა იყოს 0)'); exception when others then insert into res values('7 messages','დაბლოკილია'); end;
 begin insert into public.notifications(user_id,title,body,icon_emoji,icon_bg,type) values(pv,'fake','fake','x','x','new_chat_message'); insert into res values('8 სხვისთვის ყალბი შეტყობინების შექმნა','ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!'); exception when others then insert into res values('8 ყალბი შეტყობინება','დაბლოკილია'); end;
 begin perform public.admin_resolve_job_dispute(gen_random_uuid(),'cancel'); insert into res values('9 admin ფუნქციის გამოძახება','ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!'); exception when others then insert into res values('9 admin ფუნქცია (დავის გადაწყვეტა)','დაბლოკილია: '||left(sqlerrm,50)); end;
 begin perform public.admin_review_provider_verification(pv,true,null); insert into res values('10 admin ფუნქცია (ვერიფიკაციის დამტკიცება)','ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!'); exception when others then insert into res values('10 admin ფუნქცია (ვერიფიკაცია)','დაბლოკილია: '||left(sqlerrm,50)); end;
 begin select count(*) into n from public.provider_verification_requests; insert into res values('11 ვერიფიკაციის მოთხოვნები/მიზეზები','ვხედავ '||n||' (უნდა იყოს 0)'); exception when others then insert into res values('11 verification requests','დაბლოკილია'); end;
 begin select count(*) into n from public.push_tokens where user_id<>me; insert into res values('12 სხვის push token-ებს ვკითხულობ','ვხედავ '||n||' (უნდა იყოს 0)'); exception when others then insert into res values('12 push_tokens','დაბლოკილია'); end;
 begin insert into public.reviews(job_id,customer_id,provider_id,stars,review_text) values(fj,me,pv,1,'fake'); insert into res values('13 სხვის განცხადებაზე ყალბი შეფასება','ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!'); exception when others then insert into res values('13 სხვის განცხადებაზე ყალბი შეფასება','დაბლოკილია'); end;
 begin insert into public.job_posts(customer_id,category,description,address,status) values(me,'plumbing','x','x','pending'); insert into res values('14 განცხადების პირდაპირი ჩაწერა (RPC-ს გვერდის ავლით)','ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!'); exception when others then insert into res values('14 პირდაპირი job_posts insert','დაბლოკილია'); end;
end $$;
reset role;
select set_config('request.jwt.claims','',true); -- ანონიმური: მომხმარებლის claims-ის გარეშე
set local role anon;
do $$
declare n int;
begin
 begin select count(*) into n from public.users; insert into res values('15 ანონიმური: users','ვხედავ '||n||' (უნდა იყოს 0)'); exception when others then insert into res values('15 ანონიმური: users','დაბლოკილია'); end;
 begin select count(*) into n from public.job_posts; insert into res values('16 ანონიმური: job_posts','ვხედავ '||n||' (უნდა იყოს 0)'); exception when others then insert into res values('16 ანონიმური: job_posts','დაბლოკილია'); end;
 begin select count(*) into n from public.messages; insert into res values('17 ანონიმური: messages','ვხედავ '||n||' (უნდა იყოს 0)'); exception when others then insert into res values('17 ანონიმური: messages','დაბლოკილია'); end;
 begin perform public.get_provider_stats(); insert into res values('18 ანონიმური: RPC გამოძახება','ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!'); exception when others then insert into res values('18 ანონიმური: RPC გამოძახება','დაბლოკილია'); end;
end $$;
reset role;
select t, r from res order by t;
rollback;
