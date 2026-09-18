-- ოსტატის სპეციალობა ახლა იგივე 15 კატეგორიიდან ირჩევა, რაც job-ის
-- კატეგორიაა (ძველი 8 პუნქტიანი SPECIALTIES სია ამოღებულია) — ერთი id-სივრცე,
-- ალიასების გარეშე. არსებული provider_profiles-ის ჩანაწერებს ძველი id-ები
-- (plumber/electrician/painter/drywall) ახალზე გადაეწერება; 'custom:*'
-- ("სხვა") ჩანაწერები უცვლელია. sqm_prices-ის გასაღებებიც იგივე წესით.

update public.provider_profiles p
set specialty = coalesce((
  select jsonb_agg(
    case
      when s->>'id' like 'custom:%' then s
      else jsonb_build_object('id', public.specialty_to_category(s->>'id'), 'label', coalesce(l.label, s->>'label'))
    end
  )
  from jsonb_array_elements(p.specialty) s
  left join (values
    ('plumbing', 'სანტექნიკა'), ('electrical', 'ელექტროობა'), ('painting', 'შეღებვა'),
    ('ac', 'კონდიციონერი'), ('heating', 'გათბობა'), ('furniture', 'ავეჯი'),
    ('appliance', 'საყოფაცხოვრებო ტექნიკის შეკეთება'), ('tile', 'კაფელი / მეტლახი'),
    ('flooring', 'ლამინატი / პარკეტი'), ('doors', 'კარ-ფანჯარა'), ('locks', 'საკეტები'),
    ('repair', 'მცირე სარემონტო სამუშაოები'), ('renovation', 'შიდა რემონტი'),
    ('cleaning', 'დასუფთავება'), ('moving', 'გადაზიდვა')
  ) as l(id, label) on l.id = public.specialty_to_category(s->>'id')
), '[]'::jsonb)
where jsonb_array_length(p.specialty) > 0;

update public.provider_profiles
set sqm_prices = (sqm_prices - 'painter' - 'drywall')
  || case when sqm_prices ? 'painter' then jsonb_build_object('painting', sqm_prices->'painter') else '{}'::jsonb end
  || case when sqm_prices ? 'drywall' then jsonb_build_object('renovation', sqm_prices->'drywall') else '{}'::jsonb end
where sqm_prices ? 'painter' or sqm_prices ? 'drywall';
