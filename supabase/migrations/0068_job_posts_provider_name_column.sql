-- 0068_job_posts_provider_name_column.sql
-- Bug fix: `provider_name` was folded directly into `job_posts`' base
-- `create table if not exists` (0004) at some point, instead of being
-- added via its own `alter table ... add column`. That's a no-op on any
-- database where `job_posts` already existed before that edit — the
-- table already existed, so `if not exists` skipped the whole statement
-- and the column was never actually added. `get_open_provider_feed()`/
-- `get_feed_job_by_id()` (0052) both select `jp.provider_name` directly,
-- so on an affected database the Provider job feed fails outright with
-- "column jp.provider_name does not exist". Idempotent — safe to run
-- whether or not the column is already present.

alter table public.job_posts add column if not exists provider_name text;
