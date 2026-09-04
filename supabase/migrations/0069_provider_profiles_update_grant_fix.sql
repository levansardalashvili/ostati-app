-- 0069_provider_profiles_update_grant_fix.sql
-- Bug fix (confirmed via Maestro E2E testing, provider_core_journey.yaml):
-- every brand-new Provider registration fails at ProviderSetupScreen with
-- "პროფილის შენახვა ვერ მოხერხდა" — `userService.upsertProviderProfileRecord()`
-- (an `INSERT ... ON CONFLICT (id) DO UPDATE`) errors with:
--   {"code":"42501","message":"permission denied for table provider_profiles",
--    "hint":"Grant the required privileges to the current role with:
--             GRANT UPDATE ON public.provider_profiles TO authenticated;"}
--
-- 0026_fix_recursive_rls_policies.sql already contains the correct fix —
-- `revoke update on public.provider_profiles from authenticated;` followed
-- by a column-scoped `grant update (...)` covering every column the app
-- actually writes. A direct REST test against the live project reproduced
-- the 403 above, while a plain INSERT (no ON CONFLICT) on the same table
-- succeeded — meaning the REVOKE took effect on the live database but the
-- accompanying column-level GRANT apparently did not (the same class of
-- migration-file-vs-live-database drift as 0068's job_posts.provider_name
-- fix — the file is correct, the live project just never fully ran it).
--
-- This migration only re-asserts the grant; it changes nothing else and
-- is safe to run even if 0026 already applied correctly (grant is
-- idempotent — re-granting the same privileges is a no-op).

grant update (
  first_name, last_name, specialty, areas, experience, about, photo_url,
  certificates, portfolio, sqm_prices, is_available
) on public.provider_profiles to authenticated;
