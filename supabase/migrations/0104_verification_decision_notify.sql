-- Known gap since #89/#111: a provider never learned when admin approved/rejected their
-- verification request — they only found out by reopening the profile tab. Notify them
-- (in-app + push, since push reads the same notifications row) on both outcomes.
-- target: null — the result is shown on the Profile tab (nested inside a Bottom Tab
-- Navigator), which nothing else in this app deep-links into either (same precedent as
-- the "job went to another provider" notification, 0081).

create or replace function public.admin_review_provider_verification(
  p_provider_id uuid,
  p_approve boolean,
  p_rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider public.provider_profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_provider from public.provider_profiles where id = p_provider_id for update;
  if v_provider.id is null then
    raise exception 'Provider profile not found';
  end if;

  if v_provider.verification_status <> 'pending' then
    raise exception 'Verification request is not pending (current status: %)', v_provider.verification_status;
  end if;

  if p_approve then
    update public.provider_profiles set verification_status = 'verified' where id = p_provider_id;
    update public.provider_verification_requests
      set rejection_reason = null
      where provider_id = p_provider_id;

    insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
    values (p_provider_id, 'ვერიფიკაცია დადასტურდა', 'თქვენი პროფილი ვერიფიცირებულია', '✅', '#059669', null, 'verification_status_change');
  else
    update public.provider_profiles set verification_status = 'rejected' where id = p_provider_id;
    update public.provider_verification_requests
      set rejection_reason = nullif(btrim(coalesce(p_rejection_reason, '')), '')
      where provider_id = p_provider_id;

    insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
    values (
      p_provider_id, 'ვერიფიკაცია უარყოფილია',
      coalesce(nullif(btrim(coalesce(p_rejection_reason, '')), ''), 'გაიარეთ ხელახლა პროფილის შევსების შემდეგ'),
      '⚠️', '#DC2626', null, 'verification_status_change'
    );
  end if;
end;
$$;

revoke execute on function public.admin_review_provider_verification(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_provider_verification(uuid, boolean, text) to authenticated;
