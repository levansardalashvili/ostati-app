-- 0123: მენიუს მოკლე სახელი — გვერდის სრული სათაური (მაგ. "კონფიდენციალურობის პოლიტიკა") ჰედერში აღარ ეტევა;
-- ცარიელი = სრული სათაური.
alter table public.site_pages add column if not exists nav_label text not null default '';
alter table public.site_pages drop constraint if exists site_pages_nav_label_len_check;
alter table public.site_pages add constraint site_pages_nav_label_len_check check (char_length(nav_label) <= 30);

update public.site_pages set nav_label = 'კონფიდენციალურობა' where slug = 'privacy' and kind = 'page' and nav_label = '';
update public.site_pages set nav_label = 'პირობები', show_in_header = true where slug = 'terms' and kind = 'page';
