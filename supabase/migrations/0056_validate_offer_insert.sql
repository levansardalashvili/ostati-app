-- 0056_validate_offer_insert.sql
-- Third hardening pass, PRIORITY 7. respond_to_chat_offer() (0049) already
-- validates a job-scoped offer thoroughly, but only at ACCEPT time — a
-- malformed offer message (job_id pointing at a job that isn't the named
-- customer_id's, a job_id the sending Provider has no job_response for, a
-- job that's already left 'pending', a non-positive amount, or job_id
-- simply omitted despite the CHECK constraint... the CHECK only requires
-- NON-NULL, not that it's valid) could still be INSERTed and would just
-- sit there — visible in the chat, confusing, and only rejected later if/
-- when the Customer tries to accept it. This closes the gap at INSERT
-- time: a malformed job-scoped offer is now rejected immediately, before
-- it is ever written.
--
-- Full rewrite of "Participant can send messages as self" (0046) — a
-- second, separate INSERT policy is NOT used here, because multiple
-- permissive RLS policies for the same command combine with OR (any one
-- passing is enough to allow the row) — that would make a second policy
-- an alternate bypass, not an added restriction. The existing
-- relationship/role checks (0046) are carried over unchanged; only the
-- offer-specific branch is new.

-- Defensive — same reasoning as 0052/0053: this policy references
-- messages.job_id (0049) by name, which would fail to even CREATE if
-- 0049 was somehow skipped on this database. Re-running 0049's own guard
-- here is a safe no-op wherever 0049 already succeeded.
alter table public.messages add column if not exists job_id uuid references public.job_posts(id) on delete set null;

drop policy if exists "Participant can send messages as self" on public.messages;
create policy "Participant can send messages as self"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and (type <> 'offer' or auth.uid() = provider_id)
    and exists (select 1 from public.users cu where cu.id = customer_id and cu.role = 'customer')
    and exists (select 1 from public.users pu where pu.id = provider_id and pu.role = 'provider')
    and (
      -- Customer -> Provider: unrestricted by product design (unchanged).
      auth.uid() = customer_id
      or (
        -- Provider -> Customer: real relationship required (unchanged).
        auth.uid() = provider_id
        and (
          exists (
            select 1 from public.job_responses jr
            join public.job_posts jp on jp.id = jr.job_id
            where jr.provider_id = messages.provider_id
              and jp.customer_id = messages.customer_id
          )
          or exists (
            select 1 from public.job_posts jp
            where jp.customer_id = messages.customer_id
              and jp.provider_id = messages.provider_id
          )
        )
      )
    )
    -- NEW — a structured price offer must reference a real, matching,
    -- still-open job the sending Provider has actually responded to, with
    -- a positive amount. type<>'offer' short-circuits this for plain
    -- text/image messages, which are unaffected.
    and (
      type <> 'offer'
      or (
        job_id is not null
        and amount is not null
        and amount > 0
        and exists (
          select 1 from public.job_posts jp
          where jp.id = messages.job_id
            and jp.customer_id = messages.customer_id
            and jp.status = 'pending'
        )
        and exists (
          select 1 from public.job_responses jr
          where jr.job_id = messages.job_id
            and jr.provider_id = messages.provider_id
        )
      )
    )
  );

comment on policy "Participant can send messages as self" on public.messages is
  'Sender must be a named participant with the right role. Provider->Customer requires a real job_responses/assignment relationship (0046). A type=offer message additionally requires: job_id set, job_id''s job belongs to this exact customer_id and is still pending, the sending provider_id has a job_responses row for that exact job_id, and amount > 0 — rejected at INSERT, not only later at respond_to_chat_offer() accept time (0049).';
