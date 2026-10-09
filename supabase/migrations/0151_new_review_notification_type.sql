-- The Provider's notification on a new review was typed 'job_status_change'
-- ("სამუშაო დასრულებულად დადასტურდა"), so the existing "ახალი შეფასება"
-- (`new_review`) toggle in NotificationSettingsScreen controlled nothing (#138)
-- and the stars were never shown. Same trigger (live definition), only the
-- notification row changed: type 'new_review', stars in the title.

create or replace function public.handle_review_completion()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_status text;
  v_category text;
begin
  select status, category into v_status, v_category from public.job_posts where id = new.job_id for update;
  if v_status is null then
    raise exception 'Review references a job that does not exist';
  end if;
  if v_status <> 'confirmed_awaiting_rating' then
    raise exception 'Job must be confirmed by the customer before it can be reviewed (current status=%)', v_status;
  end if;

  update public.job_posts set status = 'completed' where id = new.job_id;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (
    new.provider_id,
    'ახალი შეფასება: ' || repeat('★', greatest(least(new.stars, 5), 1)),
    'სამუშაო დასრულდა — ' || public.job_category_label(v_category),
    '⭐',
    '#D97706',
    jsonb_build_object('screen', 'ProviderJobDetail', 'id', new.job_id, 'mode', 'completed'),
    'new_review'
  );

  return new;
end;
$function$;
