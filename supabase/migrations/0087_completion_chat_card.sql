-- Provider-ის "სამუშაო დავასრულე" ავტომატურად ჩნდება ჩატშიც, ბარათის
-- სახით (ფასის შეთავაზების ბარათის მსგავსად), რომ Customer-მა ადვილად
-- იპოვოს. შეტყობინებას სერვერი წერს (job_posts-ის ტრიგერი) — client
-- ვერასდროს გააყალბებს: 'completion' ტიპის INSERT client-ისთვის დაბლოკილია.

alter table public.messages drop constraint if exists messages_type_check;
alter table public.messages
  add constraint messages_type_check check (type in ('text', 'offer', 'image', 'completion'));

-- client-ის მხრიდან type='completion'-ის INSERT დაუშვებელია (SECURITY DEFINER
-- ტრიგერი RLS-ს აუვლის გვერდს). restrictive policy არსებულ INSERT
-- policy-ებს ხელუხლებლად ტოვებს და მათ დამატებით წესს უმატებს.
drop policy if exists "No client completion messages" on public.messages;
create policy "No client completion messages"
  on public.messages
  as restrictive
  for insert
  to authenticated
  with check (type <> 'completion');

-- ჩატის შეჯამება/შეტყობინება: completion-ზე ცალკე push არ იგზავნება
-- (completion_reminder უკვე იგზავნება provider_request_completion-ში).
create or replace function public.handle_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_name text;
  v_customer_initials text;
  v_provider_name text;
  v_provider_initials text;
  v_body text;
  v_recipient uuid;
  v_sender_name text;
  v_sender_initials text;
  v_inc_customer int;
  v_inc_provider int;
begin
  select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'მომხმარებელი'),
         upper(left(coalesce(first_name, ''), 1) || left(coalesce(last_name, ''), 1))
    into v_customer_name, v_customer_initials
    from public.users where id = new.customer_id;

  select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'ოსტატი'),
         upper(left(coalesce(first_name, ''), 1) || left(coalesce(last_name, ''), 1))
    into v_provider_name, v_provider_initials
    from public.provider_profiles where id = new.provider_id;

  v_body := case new.type
    when 'offer' then 'შეთავაზებული ფასი: ' || trim(to_char(coalesce(new.amount, 0), 'FM999999990')) || ' ₾'
    when 'image' then '📷 ფოტო'
    when 'completion' then '✅ სამუშაო დასრულებულია'
    else new.text
  end;

  v_inc_customer := case when new.sender_id = new.customer_id then 0 else 1 end;
  v_inc_provider := case when new.sender_id = new.customer_id then 1 else 0 end;

  insert into public.conversations (
    customer_id, provider_id, customer_name, customer_initials, customer_color,
    provider_name, provider_initials, provider_color, last_message, last_message_at,
    customer_unread, provider_unread
  ) values (
    new.customer_id, new.provider_id,
    coalesce(v_customer_name, ''), coalesce(v_customer_initials, ''), '#2563EB',
    coalesce(v_provider_name, ''), coalesce(v_provider_initials, ''), '#2563EB',
    v_body, new.created_at, v_inc_customer, v_inc_provider
  )
  on conflict (customer_id, provider_id) do update set
    customer_name = excluded.customer_name,
    customer_initials = excluded.customer_initials,
    provider_name = excluded.provider_name,
    provider_initials = excluded.provider_initials,
    last_message = excluded.last_message,
    last_message_at = excluded.last_message_at,
    customer_unread = public.conversations.customer_unread + v_inc_customer,
    provider_unread = public.conversations.provider_unread + v_inc_provider;

  if new.type = 'completion' then
    return new;
  end if;

  v_recipient := case when new.sender_id = new.customer_id then new.provider_id else new.customer_id end;
  v_sender_name := case when new.sender_id = new.customer_id then v_customer_name else v_provider_name end;
  v_sender_initials := case when new.sender_id = new.customer_id then v_customer_initials else v_provider_initials end;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (
    v_recipient,
    'ახალი შეტყობინება',
    v_body,
    '💬',
    '#2563EB',
    jsonb_build_object(
      'screen', 'ChatConversation',
      'chatId', new.sender_id,
      'name', coalesce(v_sender_name, ''),
      'initials', coalesce(v_sender_initials, ''),
      'color', '#2563EB'
    ),
    'new_chat_message'
  );

  return new;
end;
$$;

revoke execute on function public.handle_new_message() from public, anon, authenticated;

-- job_posts → awaiting_customer_confirmation-ზე გადასვლისას ჩატში ბარათი.
create or replace function public.handle_job_completion_chat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'awaiting_customer_confirmation'
     and old.status is distinct from new.status
     and new.provider_id is not null then
    insert into public.messages (customer_id, provider_id, sender_id, type, text, job_id)
    values (new.customer_id, new.provider_id, new.provider_id, 'completion', '', new.id);
  end if;
  return new;
end;
$$;

revoke execute on function public.handle_job_completion_chat() from public, anon, authenticated;

drop trigger if exists on_job_completion_chat on public.job_posts;
create trigger on_job_completion_chat
  after update of status on public.job_posts
  for each row execute function public.handle_job_completion_chat();
