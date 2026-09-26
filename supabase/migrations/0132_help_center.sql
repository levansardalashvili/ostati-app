-- 0132: დახმარების ცენტრი — კატეგორიები, სტატიები (ადმინიდან იმართება), საიტიდან შემოსული მიმართვები (support_requests) და
-- ადმინის შემოსული. ძველი ერთგვერდიანი /support (site_pages) იშლება, მისი შინაარსი სტატიებად გადადის. ტექსტები აპის რეალურ
-- ქცევას ეყრდნობა (მარშრუტები/ღილაკების სახელები აპიდანაა). ფორმა ანონიმურია (საიტზე ავტორიზაცია არ არის): ჩაწერა მხოლოდ
-- RPC-ით (honeypot + შეზღუდვა), წაკითხვა/სტატუსი — მხოლოდ ადმინს.

-- 1) კატეგორიები და სტატიები
create table if not exists public.help_categories (
  id text primary key,
  title text not null,
  description text not null default '',
  icon_key text not null default 'FileText',
  sort_order integer not null default 0,
  is_published boolean not null default true,
  constraint help_categories_id_check check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 40 and id <> 'contact'),
  constraint help_categories_title_check check (char_length(btrim(title)) between 1 and 80),
  constraint help_categories_desc_check check (char_length(description) <= 200),
  constraint help_categories_icon_check check (icon_key in (
    'Wrench','Zap','Paintbrush','Snowflake','Flame','Armchair','PlugZap','Grid2X2','PanelsTopLeft','DoorOpen','LockKeyhole','Hammer','House',
    'Sparkles','Package','ShieldCheck','MessageCircle','Tags','ScanSearch','FileText','ThumbsUp','Star','CheckCircle','Users','Clock'))
);

create table if not exists public.help_articles (
  id uuid primary key default gen_random_uuid(),
  category_id text not null references public.help_categories(id) on delete restrict,
  slug text not null,
  title text not null,
  summary text not null default '',
  content text not null default '',
  sort_order integer not null default 0,
  is_published boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (category_id, slug),
  constraint help_articles_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  constraint help_articles_title_check check (char_length(btrim(title)) between 1 and 120),
  constraint help_articles_summary_check check (char_length(summary) <= 200)
);
create index if not exists idx_help_articles_cat on public.help_articles(category_id, sort_order);

drop trigger if exists set_updated_at on public.help_articles;
create trigger set_updated_at before update on public.help_articles for each row execute function public.set_updated_at();

alter table public.help_categories enable row level security;
alter table public.help_articles enable row level security;

-- საჯარო წაკითხვა: მხოლოდ გამოქვეყნებული; ადმინი ყველაფერს წერს/კითხულობს (policy to authenticated — იხ. 0122-ის შენიშვნა)
drop policy if exists "Help categories are publicly readable" on public.help_categories;
create policy "Help categories are publicly readable" on public.help_categories for select to anon, authenticated using (is_published);
drop policy if exists "Help articles are publicly readable" on public.help_articles;
create policy "Help articles are publicly readable" on public.help_articles for select to anon, authenticated using (is_published);
drop policy if exists "Admin can write help categories" on public.help_categories;
create policy "Admin can write help categories" on public.help_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin can write help articles" on public.help_articles;
create policy "Admin can write help articles" on public.help_articles for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.help_categories, public.help_articles to anon, authenticated;
grant insert, update, delete on public.help_categories, public.help_articles to authenticated;

-- 2) მიმართვები
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null,
  topic text not null,
  message text not null,
  status text not null default 'new',
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_requests_status_check check (status in ('new', 'in_progress', 'closed')),
  constraint support_requests_topic_check check (topic in ('account', 'job', 'verification', 'payment', 'safety', 'technical', 'other'))
);
create index if not exists idx_support_requests_status on public.support_requests(status, created_at desc);
drop trigger if exists set_updated_at on public.support_requests;
create trigger set_updated_at before update on public.support_requests for each row execute function public.set_updated_at();

alter table public.support_requests enable row level security;
revoke all on public.support_requests from anon, authenticated;
grant select on public.support_requests to authenticated;
drop policy if exists "Admin can read support requests" on public.support_requests;
create policy "Admin can read support requests" on public.support_requests for select to authenticated using (public.is_admin());

-- ანონიმური გაგზავნა: honeypot (p_website ცარიელი უნდა იყოს), ვალიდაცია, შეზღუდვა — ერთ კონტაქტზე 3/საათში, ჯამში 100/საათში
create or replace function public.submit_support_request(p_name text, p_contact text, p_topic text, p_message text, p_website text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_contact text := btrim(coalesce(p_contact, ''));
  v_message text := btrim(coalesce(p_message, ''));
begin
  if btrim(coalesce(p_website, '')) <> '' then return; end if; -- ბოტი: ჩუმად "წარმატება"
  if char_length(v_name) not between 1 and 80
     or char_length(v_contact) not between 5 and 120
     or not (v_contact ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or v_contact ~ '^\+?[0-9 ()-]{7,20}$')
     or p_topic not in ('account', 'job', 'verification', 'payment', 'safety', 'technical', 'other')
     or char_length(v_message) not between 10 and 2000 then
    raise exception 'INVALID_REQUEST';
  end if;
  if (select count(*) from public.support_requests where lower(contact) = lower(v_contact) and created_at > now() - interval '1 hour') >= 3
     or (select count(*) from public.support_requests where created_at > now() - interval '1 hour') >= 100 then
    raise exception 'RATE_LIMIT';
  end if;
  insert into public.support_requests (name, contact, topic, message) values (v_name, v_contact, p_topic, v_message);
end;
$$;
revoke execute on function public.submit_support_request(text, text, text, text, text) from public;
grant execute on function public.submit_support_request(text, text, text, text, text) to anon, authenticated;

-- ადმინი: სტატუსი და შენიშვნა (ჟურნალში იწერება)
create or replace function public.admin_set_support_request(p_id uuid, p_status text, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('new', 'in_progress', 'closed') then raise exception 'INVALID_STATUS'; end if;
  update public.support_requests set status = p_status, admin_note = left(coalesce(p_note, ''), 1000) where id = p_id;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  perform public.log_admin_action('support_request_update', 'support_request', p_id::text, jsonb_build_object('status', p_status));
end;
$$;
revoke execute on function public.admin_set_support_request(uuid, text, text) from public, anon;
grant execute on function public.admin_set_support_request(uuid, text, text) to authenticated;

-- 3) აუდიტი: კატეგორიები/სტატიები (0126-ის ფუნქცია + help_*)
create or replace function public.audit_site_write() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then return coalesce(new, old); end if;
  if tg_table_name = 'site_pages' then
    perform public.log_admin_action('site_page_' || lower(tg_op), 'site_page', coalesce(new.slug, old.slug),
      jsonb_build_object('title', coalesce(new.title, old.title), 'published', coalesce(new.is_published, old.is_published),
                         'header', coalesce(new.show_in_header, old.show_in_header), 'footer', coalesce(new.show_in_footer, old.show_in_footer)));
  elsif tg_table_name = 'site_settings' then
    perform public.log_admin_action('site_setting_change', 'site_setting', coalesce(new.key, old.key), '{}'::jsonb);
  elsif tg_table_name = 'site_screenshots' then
    perform public.log_admin_action('site_screenshot_' || lower(tg_op), 'site_screenshot', coalesce(new.id, old.id)::text,
      jsonb_build_object('path', coalesce(new.path, old.path)));
  elsif tg_table_name = 'help_articles' then
    perform public.log_admin_action('help_article_' || lower(tg_op), 'help_article', coalesce(new.id, old.id)::text,
      jsonb_build_object('title', coalesce(new.title, old.title), 'published', coalesce(new.is_published, old.is_published)));
  elsif tg_table_name = 'help_categories' then
    perform public.log_admin_action('help_category_' || lower(tg_op), 'help_category', coalesce(new.id, old.id),
      jsonb_build_object('title', coalesce(new.title, old.title)));
  else
    perform public.log_admin_action('site_block_' || lower(tg_op), 'site_block', coalesce(new.id, old.id)::text,
      jsonb_build_object('block_key', coalesce(new.block_key, old.block_key), 'title', coalesce(new.title, old.title)));
  end if;
  return coalesce(new, old);
end;
$$;
revoke execute on function public.audit_site_write() from public, anon, authenticated;

drop trigger if exists audit_help_articles on public.help_articles;
create trigger audit_help_articles after insert or update or delete on public.help_articles for each row execute function public.audit_site_write();
drop trigger if exists audit_help_categories on public.help_categories;
create trigger audit_help_categories after insert or update or delete on public.help_categories for each row execute function public.audit_site_write();

-- 4) /support ახლა კოდის მარშრუტია → ძველი თავისუფალი გვერდი იშლება, slug დაცულია
delete from public.site_pages where slug = 'support' and kind = 'page';
alter table public.site_pages drop constraint if exists site_pages_slug_check;
alter table public.site_pages add constraint site_pages_slug_check check (
  kind = 'system'
  or (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and char_length(slug) <= 60
    and slug not in ('admin', 'api', 'services', 'how-it-works', 'home', 'sitemap', 'robots', 'icon', 'login', 'new', 'legal', 'support', '_next')
  )
);

-- 5) საწყისი შინაარსი
insert into public.help_categories (id, title, description, icon_key, sort_order) values
  ('getting-started', 'დაწყება და ანგარიში', 'რეგისტრაცია, შესვლა, პროფილი, ანგარიშის წაშლა', 'Users', 0),
  ('customers', 'მომხმარებლებისთვის', 'განცხადება, შეთავაზებები, არჩევა, დასრულება და შეფასება', 'House', 1),
  ('providers', 'ოსტატებისთვის', 'პროფილი, ვერიფიკაცია, განცხადებები, ფასის შეთავაზება', 'Hammer', 2),
  ('pricing-payments', 'ფასი და ანგარიშსწორება', 'როგორ განისაზღვრება ფასი და როგორ ხდება გადახდა', 'Tags', 3),
  ('safety-reports', 'უსაფრთხოება და რეპორტები', 'მისამართის დაცვა, დაბლოკვა, დარეპორტება', 'ShieldCheck', 4),
  ('notifications-tech', 'შეტყობინებები და ტექნიკური საკითხები', 'შეტყობინებები, განახლება, შესვლის პრობლემები', 'MessageCircle', 5)
on conflict (id) do nothing;

insert into public.help_articles (category_id, slug, title, summary, content, sort_order) values

-- დაწყება და ანგარიში
('getting-started', 'create-account', 'როგორ დავრეგისტრირდე', 'რეგისტრაცია ელფოსტით, Google-ით ან Apple-ით.', $c$
1. გახსენით Ostati და დააჭირეთ **„დაწყება“**.
2. აირჩიეთ როლი: **მომხმარებელი** (სერვისი მჭირდება) ან **ოსტატი** (სერვისს ვთავაზობ).
3. შეავსეთ სახელი, გვარი, ელფოსტა და პაროლი — ან გამოიყენეთ **Google**/**Apple** (Apple — iPhone-ზე).
4. მომხმარებელი მიუთითებს მისამართს, ოსტატი — სპეციალობას და სამუშაო არეალს.

რეგისტრაციის შემდეგ პროფილს ნებისმიერ დროს შეცვლით: **პროფილი → პროფილის რედაქტირება**.
$c$, 0),
('getting-started', 'sign-in', 'შესვლა და პაროლის აღდგენა', 'თუ პაროლი დაგავიწყდათ, აღადგინეთ ელფოსტით.', $c$
შესასვლელად გამოიყენეთ იგივე მეთოდი, რომლითაც დარეგისტრირდით (ელფოსტა და პაროლი, Google ან Apple).

**დაგავიწყდათ პაროლი?** შესვლის ეკრანზე დააჭირეთ **„დაგავიწყდათ პაროლი?“**, მიუთითეთ ელფოსტა და მიყევით წერილში მოსულ ბმულს. თუ წერილი არ მოვიდა, შეამოწმეთ „სპამის“ საქაღალდე.

პაროლის შეცვლა შესულ ანგარიშზე: **პროფილი → ანგარიშის პარამეტრები**.

ვერ შედიხართ? იხილეთ [ვერ შევდივარ ანგარიშში](/support/notifications-tech/cant-sign-in).
$c$, 1),
('getting-started', 'one-role', 'ერთი ანგარიში — ერთი როლი', 'ანგარიში არის ან მომხმარებლის, ან ოსტატის.', $c$
თითო ანგარიშს ერთი როლი აქვს — **მომხმარებელი** ან **ოსტატი**, და როლის შეცვლა შეუძლებელია.

თუ ორივე როლი გჭირდებათ, დარეგისტრირდით მეორე ანგარიშით სხვა ელფოსტაზე.
$c$, 2),
('getting-started', 'edit-profile', 'პროფილის რედაქტირება', 'სახელი, ფოტო, მისამართი, სპეციალობა და სხვა.', $c$
გახსენით **პროფილი → პროფილის რედაქტირება**.

- **მომხმარებელი:** სახელი, გვარი, სახლის მისამართი.
- **ოსტატი:** სახელი, გვარი, სპეციალობები, სამუშაო არეალი, გამოცდილება, აღწერა, პროფილის ფოტო, სერთიფიკატები და ნამუშევრების ფოტოები, ფასი კვ.მ-ზე (იმ სპეციალობებზე, სადაც ეს გამოიყენება).

ოსტატისთვის სრულად შევსებული პროფილი ნდობას ზრდის და აუცილებელია [ვერიფიკაციისთვის](/support/providers/verification).
$c$, 3),
('getting-started', 'delete-account', 'როგორ წავშალო ანგარიში', 'ანგარიშის სამუდამოდ წაშლა აპიდან.', $c$
გახსენით **პროფილი → ანგარიშის წაშლა** და დაადასტურეთ.

- წაშლა **შეუძლებელია**, სანამ გაქვთ მიმდინარე (არჩეული, დაუსრულებელი) სამუშაო — ჯერ დაასრულეთ ან გააუქმეთ.
- წაშლისას იშლება თქვენი პროფილი, ფოტოები, ჩატები და აქტიური განცხადებები. დასრულებული სამუშაოები და მათზე დაწერილი შეფასებები ანონიმიზებული სახით რჩება, რომ ოსტატის რეიტინგი არ დაზიანდეს.

სრული დეტალები: [ანგარიშის წაშლა](/delete-account) და [კონფიდენციალურობის პოლიტიკა](/privacy).
$c$, 4),

-- მომხმარებლებისთვის
('customers', 'post-job', 'როგორ გამოვაქვეყნო განცხადება', 'კატეგორია, აღწერა, ფოტოები, რაიონი და დრო.', $c$
1. გახსენით ჩანართი **განცხადებები** და დააჭირეთ **+**.
2. აირჩიეთ **კატეგორია** და დეტალურად აღწერეთ პრობლემა (რაც უფრო ზუსტია, მით უკეთესი შეთავაზებები მოგივათ).
3. დაამატეთ **1–3 ფოტო** (არასავალდებულოა, მაგრამ ეხმარება ოსტატს ფასის დასახელებაში).
4. აირჩიეთ **რაიონი** და მიუთითეთ **მისამართი** (ზუსტი მისამართი სხვა ოსტატებს არ ჩანს).
5. არჩიეთ სასურველი თარიღი და დრო (არასავალდებულოა).
6. დააჭირეთ **„გამოქვეყნება“**.

**ფასს თქვენ არ წერთ** — ოსტატები თქვენი აღწერისა და ფოტოების ნახვის შემდეგ გიგზავნიან კონკრეტულ ფასს.
$c$, 0),
('customers', 'edit-cancel-job', 'განცხადების რედაქტირება, გაუქმება და ვადა', 'რას შეცვლით და როდის იწურება განცხადება.', $c$
გახსენით განცხადება და დააჭირეთ **⋮**.

- **რედაქტირება** — შეგიძლიათ მხოლოდ სანამ ოსტატი არჩეული არ არის („მომლოდინე“).
- **გაუქმება** — მოლოდინის ეტაპზე მიზეზი არ სჭირდება; ოსტატის არჩევის შემდეგ მიზეზის მითითებაა საჭირო.
- **ვადა** — მოლოდინის ეტაპზე მყოფი განცხადება განსაზღვრული ვადის შემდეგ (ამჟამად 30 დღე) ავტომატურად უქმდება. ვადის ამოწურვამდე მოგივათ შეხსენება და განცხადებაზე გამოჩნდება **„განახლება“** ღილაკი.
- ერთდროულად გამოქვეყნებული განცხადებების რაოდენობა შეზღუდულია; ლიმიტის ამოწურვისას ძველი განცხადება დაასრულეთ ან გააუქმეთ.
$c$, 1),
('customers', 'offers-choose', 'შეთავაზებები და ოსტატის არჩევა', 'როგორ შევადაროთ ოსტატები და აირჩიოთ.', $c$
განცხადებაზე ოსტატები გიგზავნიან **კონკრეტულ ფასს**. განცხადების გვერდზე ხედავთ ყველა შეთავაზებას და შეგიძლიათ დაალაგოთ **ფასით, რეიტინგით ან გამოცდილებით**.

- გახსენით ოსტატის პროფილი — ნახეთ შეფასებები, ნამუშევრები, სპეციალობა და **ვერიფიცირებულის** ნიშანი.
- დეტალები დააზუსტეთ **ჩატში**. თუ ფასი იცვლება, ოსტატი გამოგიგზავნით ფასის ბარათს — თქვენ ეთანხმებით ან უარყოფთ.
- დააჭირეთ **არჩევას** — შეთანხმებული ფასი ფიქსირდება, არჩეულ ოსტატს ეცნობება და ეძლევა თქვენი ზუსტი მისამართი. დანარჩენ ოსტატებს ეცნობებათ, რომ განცხადება სხვას გადაეცა.
$c$, 2),
('customers', 'message-provider', 'პირდაპირ ოსტატისთვის მიწერა', 'კონკრეტული ოსტატის პროფილიდან.', $c$
თუ კონკრეტული ოსტატი გაინტერესებთ, გახსენით მისი პროფილი ან სია და დააჭირეთ **„მიწერა“**.

პირველად მიწერისას იქმნება **პირადი განცხადება** (მოკლე აღწერა, რაიონი, მისამართი) — მას ხედავს მხოლოდ ეს ოსტატი და პირველი შეტყობინება ავტომატურად იგზავნება. სანამ ოსტატი პასუხს არ გასცემს, ახალ შეტყობინებებს ვერ გაგზავნით.

თუ ამ ოსტატთან საუბარი უკვე გაქვთ, „მიწერა“ პირდაპირ ჩატს გახსნის.
$c$, 3),
('customers', 'confirm-rate', 'სამუშაოს დასრულება და შეფასება', 'დასრულების დადასტურება და ოსტატის შეფასება.', $c$
როცა ოსტატი სამუშაოს დაასრულებს და აპში „დავასრულე“-ს მონიშნავს, მიიღებთ შეტყობინებას და ჩატში **დასრულების ბარათს**.

1. თუ ყველაფერი რიგზეა, დააჭირეთ **„დადასტურება“**.
2. **შეაფასეთ ოსტატი** ვარსკვლავებით (1–5); ტექსტი და ფოტოები არასავალდებულოა. შეფასება სავალდებულო ეტაპია და **ანონიმურია** — ოსტატს არ ეცნობება, ვინ დაწერა.

თუ განსაზღვრულ ვადაში (ამჟამად 72 საათი) არ უპასუხებთ, დასრულება ავტომატურად დადასტურდება.
$c$, 4),
('customers', 'problem-dispute', 'სამუშაო არ არის შესრულებული — რა ვქნა', 'პრობლემის დაფიქსირება და დავა.', $c$
თუ ოსტატმა „დავასრულე“ მონიშნა, მაგრამ სამუშაო არ არის შესრულებული, **ნუ დაადასტურებთ**. დააჭირეთ **„პრობლემა მაქვს“** და აირჩიეთ მიზეზი.

განცხადება „დავაზე“ გადადის და მას ჩვენი გუნდი განიხილავს. შედეგად განცხადება შეიძლება ხელახლა დაგიბრუნდეთ დასადასტურებლად ან გაუქმდეს. ერთ განცხადებაზე დავის დაფიქსირება შეზღუდულია (ამჟამად ორჯერ).

ცალკე შეგიძლიათ მიაწოდოთ შეტყობინება გამოუცხადებლობის ან უხამსი ქცევის შესახებ — იხილეთ [პრობლემის შეტყობინება](/support/safety-reports/report-job).
$c$, 5),
('customers', 'reopen-job', 'ოსტატმა გააუქმა — განცხადების ხელახლა გახსნა', 'განცხადება დანარჩენი ოსტატებისთვის.', $c$
თუ არჩეულმა ოსტატმა სამუშაო გააუქმა, გაუქმებული განცხადების გვერდზე გამოჩნდება **„გახსენი ხელახლა“**.

- განცხადება ისევ „მომლოდინე“ ხდება და დანარჩენ დაინტერესებულ ოსტატებს ეცნობებათ.
- გაუქმებულ ოსტატს განცხადება აღარ ჩანს.
- ღილაკი ჩანს მხოლოდ ოსტატის გაუქმების შემდეგ და განსაზღვრული ვადის განმავლობაში.
$c$, 6),

-- ოსტატებისთვის
('providers', 'setup-profile', 'პროფილის შევსება', 'რა არის სავალდებულო და რა ზრდის ნდობას.', $c$
პროფილის შექმნისას **სავალდებულოა** სპეციალობა (შეიძლება რამდენიმე) და სამუშაო არეალი.

ნდობისა და შეთავაზებების გასაზრდელად დაამატეთ:
- **პროფილის ფოტო** (ვერიფიკაციისთვისაც საჭიროა);
- **აღწერა** (მინიმუმ 20 სიმბოლო) — რას აკეთებთ, რა გამოცდილება გაქვთ;
- **ნამუშევრების ფოტოები** და **სერთიფიკატი** (არასავალდებულოა).

პროფილის გვერდზე ხედავთ შევსების პროცენტს და იმას, რაც აკლია. ცვლილება: **პროფილი → პროფილის რედაქტირება**; სამუშაო არეალი ცალკეა: **სამუშაო არეალი**.
$c$, 0),
('providers', 'verification', 'ვერიფიკაცია', 'სელფი, გადამოწმება და რას გაძლევთ.', $c$
**ფასის შესათავაზებლად ოსტატი ვერიფიცირებული უნდა იყოს.**

პირობა: პროფილში შევსებული უნდა იყოს სახელი, სპეციალობა, სამუშაო არეალი და პროფილის ფოტო.

1. **პროფილი** ჩანართზე იპოვეთ ვერიფიკაციის ბარათი და დააჭირეთ **„ვერიფიკაციის მოთხოვნა“**.
2. გადაიღეთ **სელფი** წინა კამერით და გააგზავნეთ.
3. ჩვენი გუნდი ადარებს სელფის პროფილის ფოტოს. შედეგზე შეტყობინებას მიიღებთ; უარყოფის შემთხვევაში იხილავთ მიზეზს და შეგიძლიათ თავიდან სცადოთ.

სელფი **კერძოა** — მას მხოლოდ თქვენ და ჩვენი ადმინისტრაცია ხედავს, პროფილის ფოტოდ არ იქცევა და არ ქვეყნდება. ვერიფიკაცია ვინაობის დადასტურებაა და არა კვალიფიკაციის შემოწმება. იხილეთ [უსაფრთხოება და ნდობა](/safety).
$c$, 1),
('providers', 'job-feed', 'განცხადებების ლენტა', 'რომელ განცხადებებს ხედავთ.', $c$
მთავარ ეკრანზე ჩანს ბოლო განცხადებები, ხოლო **„ყველას ნახვა“** სრულ ლენტას გახსნის.

- ნაგულისხმევად ჩანს განცხადებები **თქვენი სპეციალობის** კატეგორიებში (და თქვენი სამუშაო არეალის მიხედვით). სრულ ლენტაზე გადამრთველით შეგიძლიათ **ყველა განცხადების** ნახვაც.
- **პირადი განცხადება** (როცა მომხმარებელმა მხოლოდ თქვენ მოგწერათ) ჩანს მხოლოდ თქვენთვის.
- **ზუსტი მისამართი** არ ჩანს — ჩანს რაიონი. ის გახსნება მხოლოდ მას შემდეგ, რაც მომხმარებელი თქვენ აგირჩევთ.
$c$, 2),
('providers', 'submit-price', 'ფასის შეთავაზება', 'როგორ გავაგზავნო შეთავაზება და როგორ გავაუქმო.', $c$
1. გახსენით განცხადება და გაეცანით აღწერას/ფოტოებს.
2. დააჭირეთ **„ფასის შეთავაზება“** და მიუთითეთ **კონკრეტული ფასი**. (ვერიფიცირებამდე ეს ღილაკი გთხოვთ, ჯერ გაიაროთ [ვერიფიკაცია](/support/providers/verification).)
3. დაინტერესების შემდეგ შეგიძლიათ მომხმარებელს ჩატში მისწეროთ, დეტალები დააზუსტოთ და საჭიროებისას ახალი ფასი შესთავაზოთ.

სანამ მომხმარებელი არჩევანს არ გააკეთებს, შეგიძლიათ დაინტერესება **გააუქმოთ**. თუ თქვენ აგირჩიეს, მიიღებთ შეტყობინებას და ზუსტ მისამართს; თუ სხვა აირჩიეს, ესეც შეგატყობინებთ.
$c$, 3),
('providers', 'complete-cancel', 'სამუშაოს დასრულება და გაუქმება', 'დასრულების მონიშვნა და გაუქმება მიზეზით.', $c$
**დასრულება.** სამუშაოს შესრულების შემდეგ განცხადებაში დააჭირეთ **„სამუშაო დავასრულე“**. დაგეგმილ თარიღამდე/დრომდე ეს შეუძლებელია. მომხმარებელს გაეგზავნება დასრულების ბარათი; ის ადასტურებს და გაფასებთ.

**გაუქმება.** თუ არჩეულ სამუშაოს ვეღარ ასრულებთ, განცხადებაში **⋮ → სამუშაოს გაუქმება**, აირჩიეთ მიზეზი და დააზუსტეთ, საჭიროებისას. მომხმარებელს ეცნობება და შეძლებს განცხადება დანარჩენებისთვის ხელახლა გახსნას. გამოუცხადებლობა და უსაფუძვლო გაუქმებები მოქმედებს თქვენს რეპუტაციაზე — იხ. [საზოგადოების წესები](/community-guidelines).
$c$, 4),
('providers', 'reviews-rating', 'შეფასებები და რეიტინგი', 'როგორ იქმნება რეიტინგი და როგორ ვუპასუხო.', $c$
დასრულებული სამუშაოს შემდეგ მომხმარებელი გიტოვებთ **ანონიმურ** შეფასებას. პროფილზე ჩანს თქვენი რეიტინგი, შეფასებების რაოდენობა და დასრულებული სამუშაოები.

- **პასუხი:** შეფასებას ერთხელ შეგიძლიათ უპასუხოთ (პროფილი → ჩემი შეფასებები). პასუხში ავტორის პირადი ინფორმაციის გამჟღავნება აკრძალულია.
- **რეიტინგი:** „ტოპ ოსტატების“ სიაში ქულა არა მხოლოდ საშუალო ვარსკვლავებით ითვლება — ერთი ხუთვარსკვლავიანი შეფასება ვერ გადაფარავს ბევრი შეფასების მქონე ოსტატს. ახალი ოსტატი პროფილზე „ახალი ოსტატის“ ნიშნით ჩანს და შეფასებების დაგროვებისას თანდათან იმატებს.
- შეურაცხმყოფელ ან ყალბ შეფასებას ადმინისტრაცია მალავს — დააფიქსირეთ [მიმართვით](/support/contact).
$c$, 5),

-- ფასი და ანგარიშსწორება
('pricing-payments', 'how-pricing-works', 'როგორ განისაზღვრება ფასი', 'ფასს ოსტატი ადგენს, არა მომხმარებელი.', $c$
- მომხმარებელი განცხადებაში **ფასს არ წერს**.
- ოსტატი, განცხადების ნახვის შემდეგ, სთავაზობს **კონკრეტულ ფასს**.
- მომხმარებელი ირჩევს ოსტატს და **შეთანხმებული ფასი ფიქსირდება** განცხადებაში.
- თუ მოგვიანებით ფასი იცვლება, ოსტატი ჩატში აგზავნის **ფასის ბარათს**, ხოლო მომხმარებელი ეთანხმება ან უარყოფს. ბარათს ვადა აქვს (ამჟამად 7 დღე). ახალი შეთავაზების გაგზავნისას წინა, უპასუხო შეთავაზება „მოძველებულად“ მოინიშნება.
$c$, 0),
('pricing-payments', 'how-to-pay', 'ანგარიშსწორება', 'გადახდა ამჟამად აპის გარეთ ხდება.', $c$
Ostati ამჟამად **არ ამუშავებს გადახდებს** და არ იღებს კომისიას. აპში ნაჩვენები ფასი არის მხარეთა შეთანხმება, ხოლო ანგარიშსწორება ხდება მომხმარებელსა და ოსტატს შორის, აპის გარეთ — იმ გზით, რაზეც ჩატში შეთანხმდით.

რეგისტრაცია და განცხადებებში მონაწილეობა ამჟამად უფასოა. თუ მომავალში გადახდას ან საკომისიოს დავამატებთ, წინასწარ გაცნობებთ.
$c$, 1),
('pricing-payments', 'payment-safety', 'გადახდის უსაფრთხოება', 'როგორ ავიცილოთ თაღლითობა.', $c$
- **არასდროს** გადასცეთ საბანკო ბარათის მონაცემები, CVV ან ერთჯერადი SMS კოდები — Ostati-ის გუნდი მათ არასდროს გთხოვთ.
- ფასზე შეთანხმდით **ჩატის ბარათში** და არა აპის გარეთ, რომ დავის შემთხვევაში ჩანაწერი გქონდეთ.
- დაადასტურეთ დასრულება მხოლოდ მაშინ, როცა შედეგით კმაყოფილი ხართ.
- თუ გთხოვენ წინასწარ თანხის გადარიცხვას ან აპის გვერდის ავლას, **დააფიქსირეთ** — იხილეთ [დაბლოკვა და დარეპორტება](/support/safety-reports/block-report).
$c$, 2),

-- უსაფრთხოება და რეპორტები
('safety-reports', 'address-privacy', 'ვის ჩანს ჩემი მისამართი და ფოტოები', 'რა ჩანს, ვის და როდის.', $c$
- **ზუსტი მისამართი** ჩანს მხოლოდ თქვენ მიერ არჩეული ოსტატისთვის. სხვა ოსტატები მხოლოდ **რაიონს** ხედავენ.
- **განცხადების ფოტოებს** ხედავენ ის ოსტატები, რომლებსაც განცხადება ლენტაში აქვთ; არჩევის შემდეგ — არჩეული ოსტატი.
- **ჩატის შეტყობინებები და ფოტოები** ჩანს მხოლოდ საუბრის ორ მონაწილეს.
- **შეფასების ავტორი** არავის ჩანს.
- **ვერიფიკაციის სელფი** ჩანს მხოლოდ ოსტატს და ჩვენს ადმინისტრაციას.

სრული ცხრილი: [კონფიდენციალურობის პოლიტიკა](/privacy).
$c$, 0),
('safety-reports', 'block-report', 'დაბლოკვა და დარეპორტება', 'როგორ დავბლოკო ან დავარეპორტო მომხმარებელი.', $c$
გახსენით ჩატი და დააჭირეთ **⋮**:

- **დაბლოკვა** — დაბლოკილ მომხმარებელთან მიწერა და არჩევა შეუძლებელია, ჩატში კომპოზერი იკეტება. დაბლოკვის მოხსნა შეგიძლიათ ნებისმიერ დროს.
- **დარეპორტება** — აირჩიეთ მიზეზი და დააზუსტეთ. რეპორტს ჩვენი გუნდი განიხილავს; დარეპორტებულ პირს თქვენი ვინაობა არ ეჩვენება.

გადაუდებელი საფრთხის შემთხვევაში დაუკავშირდით პოლიციას ან სასწრაფო დახმარებას.
$c$, 1),
('safety-reports', 'report-job', 'პრობლემის შეტყობინება განცხადებიდან', 'გამოუცხადებლობა, უხამსი ქცევა და სხვა.', $c$
არჩეული სამუშაოს გვერდზე დააჭირეთ **⋮ → პრობლემის შეტყობინება** და აირჩიეთ მიზეზი (მაგ. გამოუცხადებლობა, სამუშაო არ არის შესრულებული, უხამსი ქცევა, არასწორი ინფორმაცია); თუ „სხვა“-ს აირჩევთ, აღწერა სავალდებულოა.

ეს **არ ცვლის** სამუშაოს სტატუსს — ეს არის რეპორტი ჩვენი გუნდისთვის. სამუშაოს დასრულების სადავოდ გახდომისთვის გამოიყენეთ [„პრობლემა მაქვს“](/support/customers/problem-dispute).
$c$, 2),
('safety-reports', 'suspended', 'ჩემი ანგარიში შეჩერებულია', 'რას ნიშნავს და რა ვქნა.', $c$
თუ ანგარიში შეჩერებულია, შესვლა ვერ ხერხდება და აპი გაჩვენებთ შეტყობინებას (საჭიროებისას მიზეზით). შეჩერება ხდება წესების დარღვევის, რეპორტების ან უსაფრთხოების მიზეზით — იხ. [საზოგადოების წესები](/community-guidelines).

თუ ფიქრობთ, რომ გადაწყვეტილება არასწორია, გამოგვიგზავნეთ [მიმართვა](/support/contact) თემით „ანგარიში“ და მიუთითეთ ელფოსტა, რომლითაც დარეგისტრირდით. განვიხილავთ.
$c$, 3),

-- შეტყობინებები და ტექნიკური
('notifications-tech', 'notification-settings', 'შეტყობინებების მართვა', 'რომელი შეტყობინებები მოდის.', $c$
შეტყობინებების ეკრანიდან გახსენით **პარამეტრები** და ჩართეთ/გამორთეთ თითოეული ტიპი (ახალი შეტყობინება ჩატში, სამუშაოს სტატუსი და სხვა).

**ოსტატებისთვის:** მთავარ ეკრანზე გადამრთველი „ხელმისაწვდომი“ განსაზღვრავს, მიიღებთ თუ არა შეტყობინებას **ახალ განცხადებებზე** თქვენს სპეციალობასა და არეალში. გამორთვისას განცხადებებს კვლავ ხედავთ, უბრალოდ შეტყობინებას აღარ მიიღებთ. ჩატისა და სამუშაოს სტატუსის შეტყობინებები ამაზე არ არის დამოკიდებული.
$c$, 0),
('notifications-tech', 'no-notifications', 'შეტყობინებები არ მომდის', 'რა შევამოწმოთ.', $c$
1. **ტელეფონის პარამეტრები:** დარწმუნდით, რომ Ostati-ს შეტყობინებების ნებართვა აქვს და „არ შემაწუხოთ“ რეჟიმი გამორთულია.
2. **აპის პარამეტრები:** შეამოწმეთ შეტყობინებების პარამეტრები — შესაბამისი ტიპი ჩართული უნდა იყოს ([იხ.](/support/notifications-tech/notification-settings)).
3. **ოსტატებისთვის:** ახალი განცხადებების შეტყობინებისთვის „ხელმისაწვდომი“ ჩართული უნდა იყოს და სპეციალობა/არეალი შევსებული.
4. გამოდით და ხელახლა შედით ანგარიშში, რომ მოწყობილობა თავიდან დარეგისტრირდეს.
5. ფიზიკური მოწყობილობა გჭირდებათ — ემულატორზე შეტყობინებები არ მოდის.

თუ არაფერი შველის, გამოგვიგზავნეთ [მიმართვა](/support/contact) თემით „ტექნიკური“.
$c$, 1),
('notifications-tech', 'app-update', 'აპი მოითხოვს განახლებას ან ტექნიკური სამუშაოებია', 'რას ნიშნავს ეს ეკრანები.', $c$
- **„საჭიროა განახლება“** — თქვენი ვერსია ძველია. დააჭირეთ **განახლებას** (ან გახსენით Google Play/App Store) და დააყენეთ უახლესი ვერსია.
- **„ტექნიკური სამუშაოები“** — სერვისი დროებით შეჩერებულია გაუმჯობესებისთვის. დაელოდეთ და დააჭირეთ **„ხელახლა შემოწმებას“**; თქვენი მონაცემები უსაფრთხოა.
$c$, 2),
('notifications-tech', 'cant-sign-in', 'ვერ შევდივარ ანგარიშში', 'ხშირი მიზეზები და გადაწყვეტა.', $c$
- **არასწორი პაროლი ან ელფოსტა** — შეამოწმეთ და საჭიროებისას [აღადგინეთ პაროლი](/support/getting-started/sign-in).
- **სხვა მეთოდით რეგისტრაცია** — თუ Google-ით ან Apple-ით დარეგისტრირდით, იგივე მეთოდით შედით.
- **ინტერნეტი** — შეამოწმეთ კავშირი და სცადეთ ხელახლა.
- **ანგარიში შეჩერებულია** — იხ. [ჩემი ანგარიში შეჩერებულია](/support/safety-reports/suspended).
- **ძველი ვერსია / ტექნიკური სამუშაოები** — იხ. [აპი მოითხოვს განახლებას](/support/notifications-tech/app-update).

თუ პრობლემა რჩება, გამოგვიგზავნეთ [მიმართვა](/support/contact).
$c$, 3)
on conflict (category_id, slug) do nothing;
