-- 0046_chat_role_and_relationship.sql
-- Second hardening pass, item 2. Two independent gaps in `messages`'
-- INSERT policy (0028, then 0042's offer-type restriction):
--
-- 1. The Provider -> Customer branch's condition (c) — "this customer
--    has any open (pending) job" — let a Provider message a Customer
--    they have NO relationship with at all, as long as that customer
--    happened to have some unrelated pending job somewhere. This was
--    originally justified (0028) as mirroring ProviderJobDetailScreen's
--    "browse" mode chat button, reachable before expressing interest —
--    but the task now explicitly asks to remove it: Provider -> Customer
--    must require a real job_responses row (expressed interest) or an
--    actual assignment (job_posts.provider_id). Condition (c) is
--    dropped; (a) and (b) are kept.
-- 2. Neither branch ever verified that customer_id/provider_id actually
--    belong to accounts with those roles in `users` — a Provider account
--    could name themselves as `customer_id` (or vice versa) on a new
--    conversation, since the policy only checked "is the sender one of
--    the two named parties", never "does the named party's role match
--    the column it's named in".
--
-- can_access_private_chat_media() (0040) mirrored the OLD three-branch
-- rule for storage-media authorization — it gets the identical fix here
-- so a chat's text messages and its images are governed by the exact
-- same relationship rule, never a looser one for media.

-- ============================================================
-- messages INSERT — drop the "any pending job" exception; add role checks
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
      -- Customer -> Provider: unrestricted by product design (directory
      -- browsing, SavedProvidersScreen/ViewProviderProfileScreen) —
      -- unchanged from 0028.
      auth.uid() = customer_id
      or (
        -- Provider -> Customer: now requires a REAL relationship —
        -- either this Provider has responded to one of this Customer's
        -- jobs, or is already assigned to one. The old "any open job"
        -- branch (c) is gone.
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
  );

-- ============================================================
-- can_access_private_chat_media() — identical relationship rule as the
-- messages INSERT policy above, plus the same role verification.
-- CREATE OR REPLACE; storage policies referencing it (0040) are
-- unaffected — they call this function by name, not a frozen copy.
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

  -- Customer side: unchanged — a Customer may access media for any
  -- conversation with a real Provider (directory browsing is allowed).
  if v_uid = p_customer_id then
    return exists (
      select 1
      from public.provider_profiles pp
      where pp.id = p_provider_id
    );
  end if;

  -- Provider side: same real-relationship rule as messages' own INSERT
  -- policy — job_responses OR assignment. The old "customer has any
  -- open pending job" branch is removed.
  if v_uid = p_provider_id then
    return (
      exists (
        select 1
        from public.job_responses jr
        join public.job_posts jp
          on jp.id = jr.job_id
        where jr.provider_id = p_provider_id
          and jp.customer_id = p_customer_id
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
  'Storage RLS helper for private-media/chat/... — mirrors messages'' own INSERT relationship rule exactly (job_responses OR assignment; the old "any open pending job" exception is removed) plus explicit role verification on both named parties.';

revoke execute on function public.can_access_private_chat_media(uuid, uuid) from public, anon;
grant execute on function public.can_access_private_chat_media(uuid, uuid) to authenticated;
