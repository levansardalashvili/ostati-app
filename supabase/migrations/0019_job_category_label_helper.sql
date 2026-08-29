-- 0019_job_category_label_helper.sql
-- Small helper used by the job-workflow notification triggers/RPCs
-- (0022, 0023) to produce a human-readable Georgian body string
-- server-side, instead of trusting a client-supplied "job title" for
-- notification content. Mirrors src/data/categories.ts's CATEGORIES
-- list (id -> label) — that file is the single source of truth for the
-- UI; this is a deliberately small, rarely-changing duplicate purely for
-- notification body text (CLAUDE.md already denormalizes small display
-- fields like this elsewhere, e.g. job_posts.customer_name).

create or replace function public.job_category_label(p_category text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_category
    when 'plumbing' then 'სანტექნიკა'
    when 'electrical' then 'ელექტროობა'
    when 'painting' then 'შეღებვა'
    when 'ac' then 'კონდიციონერი'
    when 'heating' then 'გათბობა'
    when 'furniture' then 'ავეჯი'
    when 'appliance' then 'საყოფაცხოვრებო ტექნიკის შეკეთება'
    when 'tile' then 'კაფელი / მეტლახი'
    when 'flooring' then 'ლამინატი / პარკეტი'
    when 'doors' then 'კარ-ფანჯარა'
    when 'locks' then 'საკეტები'
    when 'repair' then 'მცირე სარემონტო სამუშაოები'
    when 'renovation' then 'შიდა რემონტი'
    when 'cleaning' then 'დასუფთავება'
    when 'moving' then 'გადაზიდვა'
    else coalesce(p_category, 'მოთხოვნა')
  end;
$$;

comment on function public.job_category_label(text) is
  'category id -> Georgian display label, mirrors src/data/categories.ts CATEGORIES. Used only for server-generated notification body text.';
