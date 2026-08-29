-- 0018_notifications_lock_down.sql
-- Task 3 — closes the gap flagged (but deliberately left open) in
-- 0009_notifications.sql: "Any authenticated user can insert notifications"
-- let any signed-in client write an arbitrary title/body/target row for
-- ANY user_id — i.e. any mobile client could spam or phish any other
-- user's notification feed.
--
-- Every legitimate notification-creation event in this app (provider
-- interest, new chat message, provider selected, completion requested,
-- job status changes) is now created server-side by a SECURITY DEFINER
-- trigger/RPC (0020-0023) that independently re-validates the event
-- before writing — those functions bypass RLS by virtue of running as
-- the table owner, so they keep working with zero INSERT policy for
-- ordinary clients. This migration simply removes the client's own
-- ability to insert at all; SELECT/UPDATE (both owner-only, from 0009)
-- are untouched.

drop policy if exists "Any authenticated user can insert notifications" on public.notifications;

-- No replacement INSERT policy — RLS is enabled (0009) and with zero
-- INSERT policies, every direct client `.insert()` is denied outright.
-- `src/services/notificationService.ts`'s old client-side `create()`
-- method has been removed to match (it would only ever fail now).
