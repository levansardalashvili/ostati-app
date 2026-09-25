-- 0114: ადმინის განცხადება ყველა (ან ერთი როლის) მომხმარებლისთვის. თითო მიმღებზე ჩვეულებრივი in-app შეტყობინება
-- (type='announcement') იწერება — push-ის არსებული webhook/Edge Function მას ისევ ისე გადაუგზავნის; preference-გასაღები
-- არ არსებობს, ამიტომ "missing = enabled" წესით ყოველთვის იგზავნება. შეჩერებული ანგარიშები და ადმინები გამოტოვებულია.
create table if not exists public.admin_broadcasts (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  title text not null,
  body text not null,
  audience text not null check (audience in ('all', 'customer', 'provider')),
  recipient_count integer not null,
  created_at timestamptz not null default now()
);
alter table public.admin_broadcasts enable row level security;
revoke all on public.admin_broadcasts from anon, authenticated;
grant select on public.admin_broadcasts to authenticated;
drop policy if exists "Admin can read broadcasts" on public.admin_broadcasts;
create policy "Admin can read broadcasts" on public.admin_broadcasts for select to authenticated using (public.is_admin());

create or replace function public.admin_send_broadcast(p_title text, p_body text, p_audience text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_count integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_audience not in ('all', 'customer', 'provider') then raise exception 'Invalid audience'; end if;
  if char_length(v_title) not between 1 and 80 then raise exception 'Title must be 1-80 characters'; end if;
  if char_length(v_body) not between 1 and 300 then raise exception 'Body must be 1-300 characters'; end if;
  -- ორმაგი დაჭერის/განმეორების დაცვა
  if exists (select 1 from public.admin_broadcasts b
              where b.title = v_title and b.body = v_body and b.audience = p_audience
                and b.created_at > now() - interval '10 minutes') then
    raise exception 'DUPLICATE_BROADCAST';
  end if;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  select u.id, v_title, v_body, '📢', '#2563EB', null, 'announcement'
    from public.users u
   where u.role in ('customer', 'provider')
     and (p_audience = 'all' or u.role = p_audience)
     and u.suspended_at is null;
  get diagnostics v_count = row_count;

  insert into public.admin_broadcasts (admin_id, title, body, audience, recipient_count)
  values (auth.uid(), v_title, v_body, p_audience, v_count);
  return v_count;
end;
$$;
revoke execute on function public.admin_send_broadcast(text, text, text) from public, anon;
grant execute on function public.admin_send_broadcast(text, text, text) to authenticated;
