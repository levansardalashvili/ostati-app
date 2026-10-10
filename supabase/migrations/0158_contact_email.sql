-- 0158: Contact email contact@ostato.app — site footer, {{contact_email}} placeholders
-- (delete-account, safety), and the contact sections of terms and privacy.

insert into public.site_settings (key, value)
values ('contact_email', 'contact@ostato.app')
on conflict (key) do update set value = excluded.value;

update public.site_pages
set content = replace(content,
  'კითხვების, საჩივრებისა და მოთხოვნებისთვის მოგვწერეთ [დახმარების გვერდიდან](/support).',
  'კითხვების, საჩივრებისა და მოთხოვნებისთვის მოგვწერეთ [დახმარების გვერდიდან](/support) ან ელფოსტაზე {{contact_email}}.')
where slug = 'terms';

update public.site_pages
set content = replace(content,
  'კითხვებისთვის დაგვიკავშირდით გვერდზე [დახმარება](/support).',
  'კითხვებისთვის დაგვიკავშირდით გვერდზე [დახმარება](/support) ან ელფოსტაზე {{contact_email}}.')
where slug = 'privacy';
