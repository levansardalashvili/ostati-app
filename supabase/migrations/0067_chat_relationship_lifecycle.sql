-- 0067_chat_relationship_lifecycle.sql
-- Focused access-control pass, item 2. CONFIRMED gap: the Provider ->
-- Customer branch of both the `messages` INSERT policy (0046, carried
-- unchanged through 0056/0066) and `can_access_private_chat_media()`
-- (0046) grant messaging/media access on EITHER of two conditions:
--   (a) `job_responses` has a row for (this provider, one of this
--       customer's jobs) — with NO check on that job's CURRENT status, or
--   (b) the Provider is currently assigned to one of this customer's jobs
--       (`job_posts.provider_id = provider`).
-- Condition (a) is too broad: once a Provider has ever responded to any
-- job for a given Customer, they kept a PERMANENT messaging relationship
-- with that Customer forever — even long after that specific job was
-- decided (another Provider selected), completed, or cancelled, and even
-- if this Provider was never the one chosen.
--
-- Fix: condition (a) now also requires that specific job to still be
-- `status = 'pending'` — a not-yet-decided job. Condition (b) is
-- UNCHANGED: `job_posts.provider_id` is only ever set once, by
-- select_provider(), and is never cleared afterward regardless of the
-- job's later status (active/awaiting_confirmation/completed/disputed/
-- cancelled) — so an actually-assigned Provider correctly keeps access
-- for that relationship's entire lifetime, matching "after selection: A
-- -> Customer remains allowed because A is assigned" exactly.
--
-- Worked example (matches the task's own scenario):
--   Customer posts a job (pending). Provider A responds, Provider B
--   responds — both now satisfy (a) (job is pending) -> both can chat.
--   Customer selects A -> job_posts.provider_id = A, status = 'active'.
--   A: now satisfies (b) (assigned) -> chat still allowed.
--   B: (a) no longer holds (job is not pending); (b) never held (not
--      assigned) -> B can no longer send NEW messages to this Customer
--      through this relationship.
-- No historical job_responses rows are deleted or modified — only the
-- authorization PREDICATE changes; a Provider's past responses/messages
-- remain in the database exactly as before, this only governs whether a
-- NEW message may be inserted or NEW private media accessed going
-- forward.
--
-- Customer -> Provider messaging (directory browsing, unconditional) is
-- entirely untouched by this migration — only the Provider -> Customer
-- branch changes, in both places, identically.

-- ============================================================
-- messages INSERT policy
-- ============================================================
drop policy if exists "Participant can send messages as self" on public.messages;
create policy "Participant can send messages as self"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and (type <> 'offer' or auth.uid() = provider_id)
    and exists (select 1 from public.users cu where cu.id = customer_id and cu.role = 'customer')
    and exists (select 1 from public.users pu where pu.id = provider_id and pu.role = 'provider')
    and (
      auth.uid() = customer_id
      or (
        auth.uid() = provider_id
        and (
          -- (a) NEW — a response only counts while that job is still
          -- pending (undecided), not permanently.
          exists (
            select 1 from public.job_responses jr
            join public.job_posts jp on jp.id = jr.job_id
            where jr.provider_id = messages.provider_id
              and jp.customer_id = messages.customer_id
              and jp.status = 'pending'
          )
          -- (b) unchanged — currently assigned, any status.
          or exists (
            select 1 from public.job_posts jp
            where jp.customer_id = messages.customer_id
              and jp.provider_id = messages.provider_id
          )
        )
      )
    )
    and (
      type <> 'offer'
      or (
        job_id is not null
        and public.is_valid_job_price(amount)
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
  'Sender must be a named participant with the right role. Provider->Customer requires EITHER a job_responses row on one of this customer''s jobs that is STILL PENDING (0067 — not any historical response, regardless of that job''s later outcome) OR current assignment (job_posts.provider_id, any status, unchanged). Customer->Provider is unrestricted (directory browsing). type=offer additionally requires job_id/amount/job-still-pending/job_responses validation (0066).';

-- ============================================================
-- can_access_private_chat_media() — identical predicate change.
-- ============================================================
create or replace function public.can_access_private_chat_media(
  p_customer_id uuid,
  p_provider_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return false;
  end if;

  if not exists (select 1 from public.users cu where cu.id = p_customer_id and cu.role = 'customer') then
    return false;
  end if;
  if not exists (select 1 from public.users pu where pu.id = p_provider_id and pu.role = 'provider') then
    return false;
  end if;

  -- Customer side: unchanged — directory browsing is allowed.
  if v_uid = p_customer_id then
    return exists (
      select 1
      from public.provider_profiles pp
      where pp.id = p_provider_id
    );
  end if;

  -- Provider side: same lifecycle rule as the messages INSERT policy
  -- above — a response only counts while that job is still pending; an
  -- actual assignment counts regardless of status.
  if v_uid = p_provider_id then
    return (
      exists (
        select 1
        from public.job_responses jr
        join public.job_posts jp
          on jp.id = jr.job_id
        where jr.provider_id = p_provider_id
          and jp.customer_id = p_customer_id
          and jp.status = 'pending'
      )
      or exists (
        select 1
        from public.job_posts jp
        where jp.customer_id = p_customer_id
          and jp.provider_id = p_provider_id
      )
    );
  end if;

  return false;
end;
$$;

comment on function public.can_access_private_chat_media(uuid, uuid) is
  'Storage RLS helper for private-media/chat/... — mirrors messages'' own INSERT relationship rule exactly (0067): a job_responses row only counts while that specific job is still pending, not permanently; current assignment (job_posts.provider_id) counts regardless of status. Historical responses on a decided/completed/cancelled job no longer grant access by themselves.';

revoke execute on function public.can_access_private_chat_media(uuid, uuid) from public, anon;
grant execute on function public.can_access_private_chat_media(uuid, uuid) to authenticated;

-- ============================================================
-- Item 3 (structured offer race) — reviewed, NOT changed. The offer-
-- branch INSERT check (above, unchanged from 0066) reads job_posts.status
-- via a plain unlocked RLS-policy read, not a `for update` lock (RLS
-- policies cannot take row locks) — so a Provider's structured offer
-- COULD theoretically be inserted in the narrow window between
-- select_provider() locking+committing (job -> active) and this policy's
-- own read landing on stale data. This is accepted as a low residual
-- risk for beta, not fixed here: respond_to_chat_offer() (0049/0066)
-- re-reads job_posts `for update` and re-checks status='pending' at
-- ACCEPTANCE time, before ever touching job_responses.offered_price or
-- job_posts.agreed_price — so canonical price data can never actually be
-- corrupted by this race, only an inert offer MESSAGE row could exist
-- momentarily for a job that already moved on, which the Customer simply
-- cannot successfully accept (respond_to_chat_offer raises). Converting
-- offer-sending from a direct client INSERT into a locking RPC would
-- close this fully, but is a larger architectural change than this
-- specific, already-mitigated risk justifies right now.
