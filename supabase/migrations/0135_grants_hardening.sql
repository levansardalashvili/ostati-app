-- 0135: ზედმეტი უფლებების მოხსნა (defense in depth) — საიტისა და აპის უსაფრთხოების აუდიტის შედეგი.
--
-- პრობლემა: Supabase ყოველ ახალ ცხრილზე ავტომატურად ანიჭებს anon/authenticated როლებს ყველა უფლებას
-- (INSERT/UPDATE/DELETE/TRUNCATE/...). დღეს ერთადერთი დამცავია RLS. თუ ოდესმე ერთი policy შეცდომით გაფართოვდა
-- ან ახალ ცხრილს RLS დაავიწყდა, ანონიმს დაუყოვნებლივ მთელი ჩაწერის უფლება ექნებოდა. ახლა უფლებაც შეზღუდულია (მეორე ფენა).
--
--  1) anon: ყველა უფლება იხსნება; უბრუნდება მხოლოდ SELECT იმ 7 საჯარო ცხრილზე, რასაც საიტი/აპი შესვლამდე კითხულობს
--  2) authenticated: TRUNCATE/REFERENCES/TRIGGER — არასდროს არავის სჭირდება API-დან
--  3) ახალ ცხრილებზე anon-ს default უფლებები აღარ ეძლევა
--  4) public bucket-ებს (job-photos, user-media) ზომის ლიმიტი 15 მბ. (ტიპის შეზღუდვა 0136-ში უკან დაბრუნდა — გატეხა ატვირთვა)
--  5) trigger-only ფუნქცია protect_site_pages() ანონიმისთვის ღია იყო

-- 1) anon
revoke all on all tables in schema public from anon;
grant select on
  public.site_pages, public.site_blocks, public.site_settings, public.site_screenshots,
  public.categories, public.help_articles, public.help_categories
to anon;

-- 2) authenticated
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- 3) ახალი ცხრილები
alter default privileges in schema public revoke all on tables from anon;

-- 4) bucket-ები (აპი ტვირთავს მხოლოდ სურათებს; contentType = blob.type || 'image/jpeg')
update storage.buckets
   set file_size_limit = 15 * 1024 * 1024
 where id in ('job-photos', 'user-media');

-- 5) trigger-only ფუნქცია
revoke execute on function public.protect_site_pages() from public, anon, authenticated;
