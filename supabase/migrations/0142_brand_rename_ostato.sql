-- Brand rename: "Ostati" -> "Ostato" (Latin brand string only — the Georgian
-- word "ოსტატი" meaning "craftsman/provider" is a separate, unrelated noun
-- and is intentionally left untouched everywhere it appears as a role word).
-- Domain "ostati.ge" -> "ostato.app" (the user's actual owned domain).
--
-- This updates the live content rows that earlier migrations (0071-0132)
-- seeded into site_pages/site_blocks/site_settings/help_categories/
-- help_articles — those migration files themselves are historical record
-- and are NOT edited; only the current DB rows are corrected here, the same
-- way any other content fix would go through a new migration rather than
-- rewriting history.

update public.site_pages
set title = replace(title, 'Ostati', 'Ostato'),
    content = replace(replace(content, 'Ostati', 'Ostato'), 'ostati.ge', 'ostato.app'),
    meta_description = replace(meta_description, 'Ostati', 'Ostato'),
    nav_label = replace(nav_label, 'Ostati', 'Ostato')
where title like '%Ostati%'
   or content like '%Ostati%' or content like '%ostati.ge%'
   or meta_description like '%Ostati%'
   or nav_label like '%Ostati%';

update public.site_settings
set value = replace(replace(value, 'Ostati', 'Ostato'), 'ostati.ge', 'ostato.app')
where value like '%Ostati%' or value like '%ostati.ge%';

update public.site_blocks
set title = replace(title, 'Ostati', 'Ostato'),
    description = replace(description, 'Ostati', 'Ostato')
where title like '%Ostati%' or description like '%Ostati%';

update public.help_categories
set title = replace(title, 'Ostati', 'Ostato'),
    description = replace(description, 'Ostati', 'Ostato')
where title like '%Ostati%' or description like '%Ostati%';

update public.help_articles
set title = replace(title, 'Ostati', 'Ostato'),
    summary = replace(summary, 'Ostati', 'Ostato'),
    content = replace(replace(content, 'Ostati', 'Ostato'), 'ostati.ge', 'ostato.app')
where title like '%Ostati%'
   or summary like '%Ostati%'
   or content like '%Ostati%' or content like '%ostati.ge%';
