-- (A) A provider who blocked the customer (or was blocked by them) can no longer be selected: chat between them
--     is blocked, so an active job with a blocked chat would be a dead end. One choke point — every selection
--     path (select_provider, chat-offer auto-select) goes through assign_job_provider.
create or replace function public.assign_job_provider(p_job_id uuid, p_provider_id uuid, p_provider_name text, p_agreed_price numeric, p_category text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_customer uuid;
begin
  select customer_id into v_customer from public.job_posts where id = p_job_id;
  if v_customer is not null and public.is_blocked_pair(v_customer, p_provider_id) then
    raise exception 'PROVIDER_BLOCKED: this provider cannot be selected';
  end if;

  update public.job_posts
  set
    provider_id = p_provider_id,
    provider_name = p_provider_name,
    agreed_price = p_agreed_price,
    status = 'active'
  where id = p_job_id;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (
    p_provider_id,
    'შენ აგირჩიეს სამუშაოსთვის',
    public.job_category_label(p_category),
    '🏆',
    '#059669',
    jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'selected'),
    'job_selected'
  );

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  select
    jr.provider_id,
    'სამუშაო სხვა ოსტატს გადაეცა',
    public.job_category_label(p_category),
    'ℹ️',
    '#64748B',
    null,
    'job_status_change'
  from public.job_responses jr
  where jr.job_id = p_job_id
    and jr.provider_id <> p_provider_id;
end;
$$;
revoke all on function public.assign_job_provider(uuid, uuid, text, numeric, text) from public, anon, authenticated;

-- (B) A deleted customer must not erase the provider's reputation: completed jobs and their reviews are kept,
--     anonymized (no name, address, description, photos). Everything else about the customer still cascades.
alter table public.job_posts alter column customer_id drop not null;
alter table public.job_posts drop constraint job_posts_customer_id_fkey;
alter table public.job_posts add constraint job_posts_customer_id_fkey
  foreign key (customer_id) references auth.users(id) on delete cascade;   -- non-completed jobs still cascade
alter table public.reviews alter column customer_id drop not null;
alter table public.reviews drop constraint reviews_customer_id_fkey;
alter table public.reviews add constraint reviews_customer_id_fkey
  foreign key (customer_id) references auth.users(id) on delete set null;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.users where id = auth.uid();
  if v_role is null then raise exception 'Account not found'; end if;
  if v_role = 'admin' then raise exception 'Admin accounts cannot be deleted from the app'; end if;

  if exists (
    select 1 from public.job_posts jp
    where (jp.customer_id = auth.uid() or jp.provider_id = auth.uid())
      and jp.status in ('active', 'awaiting_customer_confirmation', 'confirmed_awaiting_rating', 'disputed')
  ) then
    raise exception 'ACCOUNT_HAS_ACTIVE_JOBS: finish or cancel your active jobs before deleting the account';
  end if;

  update public.job_posts
     set status = 'cancelled', cancelled_at = now(), cancellation_actor = 'provider',
         cancellation_reason = 'ოსტატმა ანგარიში წაშალა'
   where invited_provider_id = auth.uid() and status in ('draft', 'pending');

  update public.job_posts set provider_name = 'წაშლილი ოსტატი' where provider_id = auth.uid();

  -- completed jobs + their reviews stay (the provider's rating and job count), stripped of personal data
  update public.reviews set photos = '[]'::jsonb where customer_id = auth.uid();
  update public.job_posts
     set customer_id = null, customer_name = '', address = '', area_label = null, description = '—', photos = '{}'
   where customer_id = auth.uid() and status = 'completed';

  delete from auth.users where id = auth.uid();
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
