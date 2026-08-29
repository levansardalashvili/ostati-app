-- 0039_new_job_provider_notify.sql
-- New-job push targeting (Task section 10). AFTER INSERT ON job_posts —
-- every job is created with status='pending' (jobService.createCustomerJob
-- never inserts any other status), so this fires exactly once per
-- published job. Inserts one notification (type='new_jobs_in_area') per
-- matching Provider — no existing trigger covered this event at all
-- before this migration (in-app or push).
--
-- Matching uses the two structured signals the schema actually has, and
-- nothing invented beyond them:
--   1. specialty/category — provider_profiles.specialty is a jsonb array
--      of {id,label} drawn from src/data/specialties.ts (8 fixed ids,
--      plus free-text "other" entries a Provider can add — see #8/#39 in
--      CLAUDE.md). job_posts.category is drawn from the SEPARATE
--      src/data/categories.ts id-space (15 ids) — CLAUDE.md #39 already
--      documents these two id-spaces don't match 1:1 (e.g. specialty
--      'plumber' vs category 'plumbing'). specialty_to_category() below
--      is the exact server-side mirror of the client's own
--      SPECIALTY_ID_ALIASES table (src/components/CategoryIcon.tsx) —
--      not a new mapping invented for this migration. A Provider's
--      free-text "other" specialty (not one of the 8 fixed ids) has no
--      category equivalent and simply never matches — a known,
--      documented limitation, not a bug.
--   2. work area — job_posts.address is free text (from
--      AddressAutocompleteField/Nominatim, CLAUDE.md #38), NOT a
--      district id; provider_profiles.areas is an array of district
--      name strings. There is no structured geo join possible with the
--      current schema, so this reuses the SAME best-effort substring
--      heuristic CustomerHomeScreen's own district filter already uses
--      client-side (CLAUDE.md #20: "address ფორმატი აპში
--      არაერთგვაროვანია ... substring-ით ორივეს იჭერს") — `address ILIKE
--      '%'||area||'%'` for each of the Provider's own area names. This
--      is a real, documented limitation: it can miss a match (address
--      phrased unusually) or, less likely, false-positive (an area name
--      that happens to be a substring of unrelated address text) — safer
--      than notifying every Provider globally, but not exact geo
--      matching, which this schema cannot do today.
--   3. is_available — gates this specific notification type only (task
--      requirement: unavailable Providers keep full app access, job
--      feed included, but stop receiving new-job pushes). This is an
--      in-app-notification-row-level gate here (not just a push-send
--      gate) — deliberately: an unavailable Provider was never going to
--      act on a "new job in your area" prompt, so there is no reason to
--      even create the in-app row for them; this differs from
--      notification_preferences, which gates PUSH SENDING ONLY (see
--      0038's header comment / the Edge Function) and never blocks
--      in-app row creation, per the task's explicit "keep the existing
--      in-app notification intact" instruction — availability is a
--      different, product-level rule (CLAUDE.md's long-standing
--      "ხელმისაწვდომობა მთავარად გეითავს ახალ შესაძლებლობებს" principle,
--      #27/#73), not a delivery preference.

create or replace function public.specialty_to_category(p_specialty_id text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_specialty_id
    when 'plumber' then 'plumbing'
    when 'electrician' then 'electrical'
    when 'painter' then 'painting'
    when 'drywall' then 'renovation'
    else p_specialty_id
  end;
$$;

comment on function public.specialty_to_category(text) is
  'Maps a provider_profiles.specialty entry id to its job_posts.category id, mirroring src/components/CategoryIcon.tsx''s SPECIALTY_ID_ALIASES exactly. Ids already shared between both spaces (tile/flooring/ac/furniture) pass through unchanged via the else branch.';

-- Cheap, matches this trigger's leading filter condition.
create index if not exists idx_provider_profiles_is_available on public.provider_profiles(is_available) where is_available;

create or replace function public.handle_new_job_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'pending' then
    return new;
  end if;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  select
    p.id,
    'ახალი მოთხოვნა შენს არეალში',
    public.job_category_label(new.category),
    '🆕',
    '#2563EB',
    jsonb_build_object('screen', 'ProviderJobDetail', 'id', new.id, 'mode', 'browse'),
    'new_jobs_in_area'
  from public.provider_profiles p
  where p.is_available = true
    and exists (
      select 1 from jsonb_array_elements(p.specialty) s
      where public.specialty_to_category(s->>'id') = new.category
    )
    and exists (
      select 1 from unnest(p.areas) as area
      where new.address ilike '%' || area || '%'
    );

  return new;
end;
$$;

comment on function public.handle_new_job_notify() is
  'AFTER INSERT ON job_posts: notifies (type=new_jobs_in_area) every available Provider whose specialty matches the job''s category (via specialty_to_category) and whose work area name appears in the job''s address text. Best-effort — see this file''s header comment for the specialty-id-space and address-substring limitations.';

drop trigger if exists on_job_post_insert_notify on public.job_posts;
create trigger on_job_post_insert_notify
  after insert on public.job_posts
  for each row
  execute function public.handle_new_job_notify();
