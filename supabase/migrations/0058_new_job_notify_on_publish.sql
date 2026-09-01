-- 0058_new_job_notify_on_publish.sql
-- Fourth hardening pass, item 1. Regression introduced by 0053 (the
-- draft/publish split): `on_job_post_insert_notify` (0039) only fires
-- `AFTER INSERT ON job_posts`, and `create_job()` now always inserts with
-- status='draft' — so `handle_new_job_notify()`'s own `if new.status <>
-- 'pending' then return new;` guard silently no-ops on every single job
-- creation since 0053 shipped. A job later becoming visible via
-- `finalize_job_publish()` (a plain UPDATE, not an INSERT) never fires
-- this trigger at all. Net effect: since 0053, no Provider has received a
-- new_jobs_in_area notification for any newly published job.
--
-- Fix: move the trigger from `AFTER INSERT` to
-- `AFTER UPDATE OF status ... WHEN (OLD.status = 'draft' AND NEW.status =
-- 'pending')` — a DB-level lifecycle condition, not an application-level
-- flag. This exactly matches the ONLY way a job can ever become 'pending'
-- today: `finalize_job_publish()` is the sole writer of that transition
-- (job_posts' own UPDATE grants are otherwise fully revoked, 0013/0050/
-- 0053), and it always moves FROM 'draft' — there is no other status a
-- job can be finalized from (a plain client `.update()` cannot reach
-- status='pending' at all, RPC-only).
--
-- Exactly-once, retry-safe by construction: `finalize_job_publish()` (see
-- its body, 0053) reads the row `for update` and raises an exception
-- immediately if `status <> 'draft'` — it never issues the actual
-- `UPDATE ... SET status = 'pending'` a second time for the same job, so
-- a client retry after a lost response (the exact scenario the WITH
-- CHECK/idempotency work in the third hardening pass was built to
-- survive, see PostJobScreen.tsx) hits that guard and raises before the
-- row-level UPDATE (and therefore this trigger) ever runs again. The
-- trigger's own WHEN clause is a second, independent line of defense on
-- top of that: even in a hypothetical future direct UPDATE path, a
-- retried "flip to pending" would find OLD.status already 'pending', not
-- 'draft', and the WHEN condition would simply not match.
--
-- No draft-creation notification is possible any more — the trigger no
-- longer fires on INSERT at all, for any status.

drop trigger if exists on_job_post_insert_notify on public.job_posts;

drop trigger if exists on_job_post_publish_notify on public.job_posts;
create trigger on_job_post_publish_notify
  after update of status on public.job_posts
  for each row
  when (old.status = 'draft' and new.status = 'pending')
  execute function public.handle_new_job_notify();

-- handle_new_job_notify() itself (specialty/category targeting, work-area
-- targeting, is_available gate, type=new_jobs_in_area, the in-app row that
-- feeds the existing push pipeline) is UNCHANGED — CREATE OR REPLACE is
-- not even needed here, since 0039's function body already only cares
-- about `new.status`/`new.category`/`new.address`/`new.id`, all of which
-- are equally present on an UPDATE's NEW row as they were on an INSERT's.
-- Its own `if new.status <> 'pending' then return new; end if;` guard is
-- now redundant with the trigger's WHEN clause, but is left in place
-- unchanged as defense-in-depth (and because touching an already-shipped
-- function body when the fix does not require it would be scope creep).
