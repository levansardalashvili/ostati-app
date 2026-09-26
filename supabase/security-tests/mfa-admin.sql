-- is_admin() ქცევა MFA-ს გარეშე/მასთან (0137) — ყველაფერი rollback-შია. მოსალოდნელი: 1 true, 2 false, 3 true, 4 false, 5 true
begin;
create temp table res(t text, r text);
grant all on res to authenticated;
create temp table ids as select (select id from public.users where role='admin' limit 1) aid, (select id from public.users where role='customer' limit 1) cid;
grant select on ids to authenticated;

create or replace function pg_temp.chk(label text, who uuid, aal text) returns void language plpgsql as $$
declare v boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated', 'aal', aal)::text, true);
  execute 'set local role authenticated';
  select public.is_admin() into v;
  execute 'reset role';
  insert into res values(label, v::text);
end $$;

select pg_temp.chk('1 ადმინი, ფაქტორი არ აქვს, aal1 (გარდამავალი რეჟიმი) — უნდა: true', (select aid from ids), 'aal1');
insert into auth.mfa_factors(id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
  values (gen_random_uuid(), (select aid from ids), 'test', 'totp', 'verified', now(), now(), 'x');
select pg_temp.chk('2 ადმინი, ფაქტორი აქვს, aal1 (მხოლოდ პაროლი) — უნდა: false', (select aid from ids), 'aal1');
select pg_temp.chk('3 ადმინი, ფაქტორი აქვს, aal2 (პაროლი+კოდი) — უნდა: true', (select aid from ids), 'aal2');
select pg_temp.chk('4 ჩვეულებრივი მომხმარებელი, aal2 — უნდა: false', (select cid from ids), 'aal2');
delete from auth.mfa_factors where friendly_name = 'test';
insert into auth.mfa_factors(id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
  values (gen_random_uuid(), (select aid from ids), 'test', 'totp', 'unverified', now(), now(), 'x');
select pg_temp.chk('5 ადმინი, ფაქტორი დაუდასტურებელია, aal1 — უნდა: true (ჯერ არ არის ჩართული)', (select aid from ids), 'aal1');
select t, r from res order by t;
rollback;
