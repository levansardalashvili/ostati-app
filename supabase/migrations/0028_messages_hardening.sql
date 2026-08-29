-- 0028_messages_hardening.sql
-- Security audit — messages. Two separate gaps:
--
-- 1) INSERT never validated that (customer_id, provider_id) is a real
--    relationship — only that the sender is one of the two named
--    parties. Any authenticated user could message any other arbitrary
--    user by just naming them as the counterparty, with no job/interest
--    connecting them at all.
--
--    The fix is deliberately ASYMMETRIC by role, because the app's own
--    chat entry points are asymmetric (checked against every current
--    `navigate('ChatConversation', ...)` call site before writing this,
--    so nothing legitimate breaks):
--      - Customer -> Provider is unrestricted today by product design —
--        SavedProvidersScreen and ViewProviderProfileScreen both let a
--        Customer message ANY Provider straight from the public
--        directory, with no job posted or interest expressed at all.
--        There is no "Customer can only message providers they have a
--        job with" feature anywhere in the app, so restricting this
--        side would break real, working functionality, not close a hole.
--      - Provider -> Customer has NO equivalent "browse and message any
--        Customer" feature anywhere — every Provider-side chat button is
--        reached from a specific job (Job Feed / job detail / "already
--        interested" / already assigned), so a Provider messaging an
--        arbitrary customer_id with zero job relationship is exactly the
--        gap this closes. Three cases cover every real Provider-side
--        entry point:
--      a) the provider has already expressed interest in one of that
--         customer's jobs (job_responses);
--      b) the provider is already assigned to one of that customer's
--         jobs (job_posts.provider_id);
--      c) the customer has an open (status = 'pending') job — covers
--         ProviderJobDetailScreen's "browse" mode chat button, reachable
--         before formally expressing interest (the same open jobs any
--         Provider can already read via job_posts' own "Provider can
--         read open jobs" policy).
--
-- 2) UPDATE ("Participant can update messages", 0006) let either
--    participant overwrite the ENTIRE row — text, amount, sender_id,
--    image_url, everything — the RLS only checked "are you a
--    participant", not "did you only touch offer_status", and had no
--    concept of "you can't respond to your own offer". The app's own
--    client code (chatService.respondToRealOffer) only ever sent
--    `{ offer_status }`, but RLS is the actual security boundary, not
--    what the current app happens to send.
--
-- Fixed the same way as 0026: column-level privilege for "which field
-- is even allowed in the SET list" (no self-referencing subquery needed
-- for that part), plus a narrow, non-recursive RLS policy for the
-- remaining row-level rules (only a pending offer, only the side that
-- did NOT send it, only into accepted/declined). None of this
-- references `messages` from within its own policy via a subquery — the
-- policy only reads columns of the row already being evaluated (normal,
-- non-recursive RLS) plus other tables (job_responses/job_posts).

-- ============================================================
-- INSERT — require a real Customer/Provider relationship
-- ============================================================
drop policy if exists "Participant can send messages as self" on public.messages;
create policy "Participant can send messages as self"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and (
      -- Customer messaging a Provider: unrestricted (directory browsing
      -- is a real, intended feature — see header comment).
      auth.uid() = customer_id
      -- Provider messaging a Customer: only with a real job relationship.
      or (
        auth.uid() = provider_id
        and (
          -- (a) provider has responded to one of this customer's jobs
          exists (
            select 1 from public.job_responses jr
            join public.job_posts jp on jp.id = jr.job_id
            where jr.provider_id = messages.provider_id
              and jp.customer_id = messages.customer_id
          )
          -- (b) provider is assigned to one of this customer's jobs
          or exists (
            select 1 from public.job_posts jp
            where jp.customer_id = messages.customer_id
              and jp.provider_id = messages.provider_id
          )
          -- (c) this customer has at least one still-open job any
          -- Provider could already legitimately be viewing/messaging about
          or exists (
            select 1 from public.job_posts jp
            where jp.customer_id = messages.customer_id
              and jp.status = 'pending'
          )
        )
      )
    )
  );

-- ============================================================
-- UPDATE — column-locked to offer_status, row-locked to "the other
-- side responding to a still-pending offer"
-- ============================================================
revoke update on public.messages from authenticated;
grant update (offer_status) on public.messages to authenticated;

drop policy if exists "Participant can update messages" on public.messages;
create policy "Participant can respond to a pending offer they did not send"
  on public.messages for update
  using (
    type = 'offer'
    and offer_status = 'pending'
    and sender_id <> auth.uid()
    and (auth.uid() = customer_id or auth.uid() = provider_id)
  )
  with check (
    type = 'offer'
    and sender_id <> auth.uid()
    and offer_status in ('accepted', 'declined')
    and (auth.uid() = customer_id or auth.uid() = provider_id)
  );
