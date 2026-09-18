-- 0084_provider_verification_gate.sql
-- Product decision (explicit user request): an unverified Provider must
-- not be able to express interest in a job — verification (0025/0087's
-- request_provider_verification() request flow + ostati-admin's
-- admin_review_provider_verification() approval, 0072) becomes a real
-- gate on this one action, not just a cosmetic "verified" badge.
--
-- There are exactly TWO server-side entry points that can create a
-- job_responses row / let a Provider originate a price, both hardened
-- here so the gate can't be bypassed by going around the obvious one:
--   1. express_interest() (0064/0066) — the normal Job Feed -> Job Detail
--      "დაინტერესება" flow. This is the literal action the user asked to
--      gate.
--   2. The `messages` INSERT policy's `type='offer'` branch (0056/0066/
--      0077) — a Provider can also originate a price entirely through
--      chat, on a "cold DM" job the Customer messaged them about directly
--      (0077), with NO job_responses row required to exist first. Without
--      gating this too, an unverified Provider could still fully work a
--      job by going straight to chat instead of tapping "დაინტერესება" —
--      that would make the gate on (1) alone cosmetic, not a real one.
-- Both now require the acting Provider's own provider_profiles.
-- verification_status = 'verified'. Selecting a Provider
-- (select_provider()) and accepting a chat offer (respond_to_chat_offer())
-- need no change — both only ever act on a job_responses row that, after
-- this migration, could only have been created by a verified Provider in
-- the first place.
--
-- Customer-side behavior is completely unaffected: Customer -> any
-- Provider messaging (directory browsing, cold-DM) stays unrestricted,
-- since the Customer isn't the one being gated.

create or replace function public.express_interest(p_job_id uuid, p_offered_price numeric)
returns public.job_responses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
  v_profile public.provider_profiles%rowtype;
  v_provider_name text;
  v_initials text;
  v_response public.job_responses%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider') then
    raise exception 'Only a Provider account can express interest';
  end if;

  if not public.is_valid_job_price(p_offered_price) then
    raise exception 'A valid, positive offered price is required';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.status <> 'pending' then
    raise exception 'Job is not open for interest (status=%)', v_job.status;
  end if;
  if v_job.customer_id = auth.uid() then
    raise exception 'A customer cannot express interest in their own job';
  end if;

  select * into v_profile from public.provider_profiles where id = auth.uid();
  if v_profile.id is null then
    raise exception 'A provider profile is required before expressing interest';
  end if;

  -- NEW (0084) — verification gate.
  if v_profile.verification_status <> 'verified' then
    raise exception 'PROVIDER_NOT_VERIFIED: complete verification before expressing interest in a job';
  end if;

  v_provider_name := nullif(btrim(coalesce(v_profile.first_name, '') || ' ' || coalesce(v_profile.last_name, '')), '');
  v_provider_name := coalesce(v_provider_name, 'ოსტატი');
  v_initials := upper(
    coalesce(nullif(left(btrim(coalesce(v_profile.first_name, '')), 1), ''), '')
    || coalesce(nullif(left(btrim(coalesce(v_profile.last_name, '')), 1), ''), '')
  );
  if v_initials = '' then
    v_initials := 'O';
  end if;

  insert into public.job_responses (job_id, provider_id, provider_name, provider_initials, provider_color, offered_price)
  values (p_job_id, auth.uid(), v_provider_name, v_initials, '#2563EB', p_offered_price)
  returning * into v_response;

  return v_response;
end;
$$;

comment on function public.express_interest(uuid, numeric) is
  'The only way to create a job_responses row. Locks the target job_posts row (for update) BEFORE validating status=pending (0066). provider_id/provider_name/provider_initials/provider_color are always derived server-side. offered_price is validated by is_valid_job_price() (0065). Requires the caller''s own provider_profiles.verification_status = ''verified'' (0084) — raises PROVIDER_NOT_VERIFIED otherwise.';

revoke execute on function public.express_interest(uuid, numeric) from public, anon;
grant execute on function public.express_interest(uuid, numeric) to authenticated;

-- ============================================================
-- messages INSERT policy — the offer-amount branch now also requires
-- the sending Provider to be verified, closing the chat/cold-DM bypass
-- described above. Every other condition is carried over unchanged from
-- 0077 (relationship rule, role checks, price validation).
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
          exists (
            select 1 from public.job_responses jr
            join public.job_posts jp on jp.id = jr.job_id
            where jr.provider_id = messages.provider_id
              and jp.customer_id = messages.customer_id
              and jp.status = 'pending'
          )
          or exists (
            select 1 from public.job_posts jp
            where jp.customer_id = messages.customer_id
              and jp.provider_id = messages.provider_id
          )
          or exists (
            select 1 from public.messages m2
            where m2.customer_id = messages.customer_id
              and m2.provider_id = messages.provider_id
              and m2.sender_id = messages.customer_id
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
        -- NEW (0084) — the sending Provider must be verified to originate
        -- a price offer, exactly like express_interest() above.
        and exists (
          select 1 from public.provider_profiles pp
          where pp.id = messages.provider_id
            and pp.verification_status = 'verified'
        )
      )
    )
  );

comment on policy "Participant can send messages as self" on public.messages is
  'Sender must be a named participant with the right role. Provider->Customer requires a still-pending job_responses row, current assignment, or the Customer having already messaged this Provider directly (0077). Customer->Provider is unrestricted (directory browsing). type=offer additionally requires job_id/amount/job-still-pending validation and the sending Provider to be verification_status=''verified'' (0084) — an unverified Provider cannot originate a price offer even via the cold-DM chat path.';
