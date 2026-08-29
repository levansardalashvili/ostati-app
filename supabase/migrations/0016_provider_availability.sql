-- 0016_provider_availability.sql
-- Task 2 — Provider Home's availability toggle (ProviderHomeScreen.tsx),
-- previously local `useState` only (lost on every app restart). Adds a
-- persisted `is_available` column on `provider_profiles`, owned entirely
-- by the provider themselves.
--
-- Product rules from the task:
--   - Provider updates only their own value.
--   - Value is restored after app restart (client reads it on Home mount).
--   - OFF must NOT hide the job feed — `getOpenProviderFeedPosts()` reads
--     `job_posts`, not `provider_profiles`, and is completely untouched by
--     this column. No app query filters on `is_available` anywhere yet.
--   - Existing chats/jobs must keep working — this is a pure additive
--     column with a NOT NULL DEFAULT, so every existing row backfills to
--     `true` (available) with no data loss and no behavior change until
--     the client explicitly starts writing to it.
--   - Will later gate push notifications — no push implementation here
--     (explicitly out of scope), just the durable flag for it to read.

alter table public.provider_profiles add column if not exists is_available boolean not null default true;

-- No RLS change needed: the existing "Provider can update own profile
-- except verified" policy (0003) already allows the owner to update any
-- column on their own row except `verified` — `is_available` is covered
-- by that policy as-is.
