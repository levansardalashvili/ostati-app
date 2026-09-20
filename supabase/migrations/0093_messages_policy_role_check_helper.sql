-- 0091 removed the stale weak "Participant can send messages" policy, which had been
-- masking a latent bug in the hardened policy: its `users cu/pu` role checks run under
-- the caller's RLS, and `users` only exposes the caller's own row — so the OTHER party's
-- role was never visible and every message INSERT failed. Do the role lookup in a
-- SECURITY DEFINER helper instead (returns only a boolean).

create or replace function public.user_has_role(p_id uuid, p_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.users u where u.id = p_id and u.role = p_role);
$$;
revoke execute on function public.user_has_role(uuid, text) from public, anon;
grant execute on function public.user_has_role(uuid, text) to authenticated;

drop policy if exists "Participant can send messages as self" on public.messages;
create policy "Participant can send messages as self"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and (type <> 'offer' or auth.uid() = provider_id)
    and public.user_has_role(messages.customer_id, 'customer')
    and public.user_has_role(messages.provider_id, 'provider')
    and (
      auth.uid() = customer_id
      or (
        auth.uid() = provider_id
        and (
          public.provider_has_job_link(messages.customer_id, messages.provider_id)
          or exists (select 1 from public.messages m2
                     where m2.customer_id = messages.customer_id and m2.provider_id = messages.provider_id
                       and m2.sender_id = messages.customer_id)
        )
      )
    )
    and (
      type <> 'offer'
      or (
        job_id is not null
        and public.is_valid_job_price(amount)
        and public.customer_pending_job(messages.job_id, messages.customer_id)
        and exists (select 1 from public.provider_profiles pp
                    where pp.id = messages.provider_id and pp.verification_status = 'verified')
      )
    )
  );
