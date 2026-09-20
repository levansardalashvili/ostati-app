-- Security audit: "Providers can read open jobs" let ANY provider SELECT job_posts rows
-- (incl. exact `address`) directly through PostgREST, bypassing the masked feed RPCs
-- (get_open_provider_feed / get_feed_job_by_id). The only in-DB dependency on that
-- visibility was the messages INSERT policy's job_posts subqueries, which run under the
-- caller's RLS. Move those checks into SECURITY DEFINER helpers, then drop the policy.

create or replace function public.provider_has_job_link(p_customer uuid, p_provider uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from public.job_responses jr join public.job_posts jp on jp.id = jr.job_id
      where jr.provider_id = p_provider and jp.customer_id = p_customer and jp.status = 'pending')
    or exists (
      select 1 from public.job_posts jp where jp.customer_id = p_customer and jp.provider_id = p_provider);
$$;

create or replace function public.customer_pending_job(p_job uuid, p_customer uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.job_posts jp
    where jp.id = p_job and jp.customer_id = p_customer and jp.status = 'pending');
$$;

revoke execute on function public.provider_has_job_link(uuid, uuid), public.customer_pending_job(uuid, uuid) from public, anon;
grant execute on function public.provider_has_job_link(uuid, uuid), public.customer_pending_job(uuid, uuid) to authenticated;

drop policy if exists "Participant can send messages as self" on public.messages;
create policy "Participant can send messages as self"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and (type <> 'offer' or auth.uid() = provider_id)
    and exists (select 1 from public.users cu where cu.id = messages.customer_id and cu.role = 'customer')
    and exists (select 1 from public.users pu where pu.id = messages.provider_id and pu.role = 'provider')
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

drop policy if exists "Providers can read open jobs" on public.job_posts;
