-- 0137: ადმინის ორფაქტორიანი დადასტურება (TOTP, Supabase MFA) — ბაზის დონეზე დაცვა.
--
-- სიტყვა "ადმინი" ყველა ადმინ-ფუნქციასა და policy-ში (`admin_*` RPC, საიტის ცხრილები, storage, ჟურნალი...)
-- ერთადერთი წყაროდან — is_admin()-იდან — მოდის. ამიტომ MFA-ს აქ ვამოწმებთ და არა ცალკეულ ადგილას.
--
-- წესი: მომხმარებელი ადმინია, თუ users.role='admin' და
--   (ა) სესია aal2-ია (პაროლი + TOTP კოდი გავლილია), ან
--   (ბ) მას ჯერ არცერთი დადასტურებული TOTP ფაქტორი არ აქვს (გარდამავალი რეჟიმი: ჯერ ვერ დაბლოკავს თავს).
-- როგორც კი ადმინი ფაქტორს დაარეგისტრირებს (/admin/mfa/setup), მხოლოდ-პაროლიანი სესია (aal1) ადმინის უფლებებს
-- ბაზაში ვეღარ იღებს — თუნდაც პაროლი მოიპარონ და REST API-ს პირდაპირ დაუკავშირდნენ.
--
-- ჩაკეტვის შემთხვევაში (დაკარგული ტელეფონი) აღდგენა: `delete from auth.mfa_factors where user_id = '<admin uuid>';`
-- (Supabase CLI/SQL Editor) — ადმინი ისევ გადავა გარდამავალ რეჟიმში და ხელახლა დაარეგისტრირებს.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
     and (
       coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
       or not exists (
         select 1 from auth.mfa_factors f
          where f.user_id = auth.uid() and f.status = 'verified'
       )
     );
$$;
