-- 0133: ანგარიშის წაშლის მოთხოვნა ვებიდან (Google Play მოითხოვს, რომ მომხმარებელს აპის გარეშეც შეეძლოს წაშლის მოთხოვნა).
-- მიმართვის ფორმას ემატება თემა `deletion`; /delete-account გვერდსა და დახმარების სტატიაზე — ბმული წინასწარშევსებულ ფორმაზე.
-- წაშლას ადმინი ხელით ასრულებს ვინაობის დადასტურების შემდეგ (ადმინ-პანელიდან ანგარიშის წაშლა ჯერ არ არსებობს).

alter table public.support_requests drop constraint if exists support_requests_topic_check;
alter table public.support_requests add constraint support_requests_topic_check
  check (topic in ('account', 'job', 'verification', 'payment', 'safety', 'technical', 'deletion', 'other'));

create or replace function public.submit_support_request(p_name text, p_contact text, p_topic text, p_message text, p_website text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_contact text := btrim(coalesce(p_contact, ''));
  v_message text := btrim(coalesce(p_message, ''));
begin
  if btrim(coalesce(p_website, '')) <> '' then return; end if; -- ბოტი: ჩუმად "წარმატება"
  if char_length(v_name) not between 1 and 80
     or char_length(v_contact) not between 5 and 120
     or not (v_contact ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or v_contact ~ '^\+?[0-9 ()-]{7,20}$')
     or p_topic not in ('account', 'job', 'verification', 'payment', 'safety', 'technical', 'deletion', 'other')
     or char_length(v_message) not between 10 and 2000 then
    raise exception 'INVALID_REQUEST';
  end if;
  if (select count(*) from public.support_requests where lower(contact) = lower(v_contact) and created_at > now() - interval '1 hour') >= 3
     or (select count(*) from public.support_requests where created_at > now() - interval '1 hour') >= 100 then
    raise exception 'RATE_LIMIT';
  end if;
  insert into public.support_requests (name, contact, topic, message) values (v_name, v_contact, p_topic, v_message);
end;
$$;
revoke execute on function public.submit_support_request(text, text, text, text, text) from public;
grant execute on function public.submit_support_request(text, text, text, text, text) to anon, authenticated;

-- ბმული წაშლის გვერდზე და დახმარების სტატიაზე
update public.site_pages
set content = content || E'\n\n## თუ აპზე წვდომა აღარ გაქვთ\n\nშეგიძლიათ ანგარიშის წაშლა ვებიდანაც მოითხოვოთ: [გამოგვიგზავნეთ მოთხოვნა](/support/contact?topic=deletion). მიუთითეთ ელფოსტა ან ტელეფონი, რომლითაც დარეგისტრირდით. ვინაობის დასადასტურებლად შეიძლება დაგიკავშირდეთ, ხოლო წაშლას ვასრულებთ გონივრულ ვადაში. ამ გზით წაშლაზეც იგივე წესები ვრცელდება (რა იშლება და რა ანონიმიზდება — იხ. ზემოთ).'
where slug = 'delete-account' and kind = 'page' and content not like '%support/contact?topic=deletion%';

update public.help_articles
set content = content || E'\n\nაპზე წვდომა აღარ გაქვთ? მოითხოვეთ წაშლა [ვებიდან](/support/contact?topic=deletion).'
where category_id = 'getting-started' and slug = 'delete-account' and content not like '%support/contact?topic=deletion%';
