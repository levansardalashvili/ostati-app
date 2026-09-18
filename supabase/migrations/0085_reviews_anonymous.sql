-- 0085 — შეფასებები ანონიმურია: Provider-ს (და სხვა Customer-ებს) აღარ
-- შეუძლიათ იცოდნენ ვინ დაწერა. ცხრილის პირდაპირი SELECT მხოლოდ თავად
-- ავტორს რჩება; საჯარო სია ხდება RPC-ით, რომელიც მხოლოდ
-- stars/text/date-ს აბრუნებს (არც customer_id, არც job_id, არც სახელი).
drop policy if exists "Anyone authenticated can read reviews" on public.reviews;
drop policy if exists "Reviews are publicly readable" on public.reviews;
create policy "Customer can read own reviews"
  on public.reviews for select
  to authenticated
  using (customer_id = auth.uid());

update public.reviews set customer_name = '' where customer_name <> '';

create or replace function public.get_provider_reviews(p_provider_id uuid)
returns table (stars int, review_text text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.stars, r.review_text, r.created_at
  from public.reviews r
  where r.provider_id = p_provider_id
  order by r.created_at desc;
$$;

revoke all on function public.get_provider_reviews(uuid) from public, anon;
grant execute on function public.get_provider_reviews(uuid) to authenticated;
