-- 0134: ადმინის მიერ ანგარიშის წაშლა (მაგ. ვებიდან მოსული წაშლის მოთხოვნისას, 0133). წაშლის ლოგიკა (წესები, რა იშლება/ანონიმიზდება)
-- ერთი და იგივეა, რაც მომხმარებლის საკუთარ წაშლაზე (0095/0102) — გატანილია შიდა ფუნქციებში, რომლებსაც ორივე იძახებს.
-- კლიენტისთვის შიდა ფუნქციებზე EXECUTE არ არის. ფაილების წაშლა (private-media — Edge Function, საჯარო bucket-ები — პანელის
-- server action) ხდება RPC-მდე, ამიტომ ჯერ `admin_precheck_delete_user` ამოწმებს, რომ წაშლა დაშვებულია.
-- დამატებით: help_categories-ის დაცული id `search` (/support/search კოდის მარშრუტია).

-- 1) შიდა ფუნქციები
create or replace function public._can_delete_account(p_uid uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text;
begin
  if p_uid is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.users where id = p_uid;
  if v_role is null then raise exception 'Account not found'; end if;
  if v_role = 'admin' then raise exception 'Admin accounts cannot be deleted from the app'; end if;
  if exists (
    select 1 from public.job_posts jp
    where (jp.customer_id = p_uid or jp.provider_id = p_uid)
      and jp.status in ('active', 'awaiting_customer_confirmation', 'confirmed_awaiting_rating', 'disputed')
  ) then
    raise exception 'ACCOUNT_HAS_ACTIVE_JOBS: finish or cancel your active jobs before deleting the account';
  end if;
end;
$$;

create or replace function public._delete_account_core(p_uid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.job_posts
     set status = 'cancelled', cancelled_at = now(), cancellation_actor = 'provider',
         cancellation_reason = 'ოსტატმა ანგარიში წაშალა'
   where invited_provider_id = p_uid and status in ('draft', 'pending');

  update public.job_posts set provider_name = 'წაშლილი ოსტატი' where provider_id = p_uid;

  update public.reviews set photos = '[]'::jsonb, review_text = '' where customer_id = p_uid;
  update public.job_posts
     set customer_id = null, customer_name = '', address = '', area_label = null, description = '—', photos = '{}'
   where customer_id = p_uid and status = 'completed';

  delete from auth.users where id = p_uid;
end;
$$;

revoke execute on function public._can_delete_account(uuid) from public, anon, authenticated;
revoke execute on function public._delete_account_core(uuid) from public, anon, authenticated;

-- 2) მომხმარებლის საკუთარი ფუნქციები იგივე ქცევით (grant-ები CREATE OR REPLACE-ით ინახება)
create or replace function public.can_delete_my_account()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._can_delete_account(auth.uid());
end;
$$;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._can_delete_account(auth.uid());
  perform public._delete_account_core(auth.uid());
end;
$$;

-- 3) ადმინი
create or replace function public.admin_precheck_delete_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  perform public._can_delete_account(p_user_id);
end;
$$;

create or replace function public.admin_delete_user(p_user_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  perform public._can_delete_account(p_user_id);
  select role into v_role from public.users where id = p_user_id;
  perform public._delete_account_core(p_user_id);
  -- ჟურნალში პირადი მონაცემი (ელფოსტა/სახელი) არ იწერება — მხოლოდ id, როლი და მიზეზი
  perform public.log_admin_action('user_delete', 'user', p_user_id::text,
    jsonb_build_object('role', v_role, 'reason', nullif(btrim(coalesce(p_reason, '')), '')));
end;
$$;

revoke execute on function public.admin_precheck_delete_user(uuid) from public, anon;
revoke execute on function public.admin_delete_user(uuid, text) from public, anon;
grant execute on function public.admin_precheck_delete_user(uuid) to authenticated;
grant execute on function public.admin_delete_user(uuid, text) to authenticated;

-- 4) /support/search კოდის მარშრუტია → კატეგორიის id ვერ იქნება
alter table public.help_categories drop constraint if exists help_categories_id_check;
alter table public.help_categories add constraint help_categories_id_check
  check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 40 and id not in ('contact', 'search'));
