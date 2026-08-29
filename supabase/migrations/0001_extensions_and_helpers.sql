-- 0001_extensions_and_helpers.sql
-- Shared prerequisites for every later migration in this set: the
-- extension that provides gen_random_uuid() (Supabase usually has this
-- enabled by default, but we don't assume it), and a single reusable
-- trigger function that stamps `updated_at` on any table that has that
-- column. Idempotent — safe to re-run against a database that already
-- has these.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Shared BEFORE UPDATE trigger function — sets updated_at = now() on any row update. Attached per-table in each table''s own migration.';
