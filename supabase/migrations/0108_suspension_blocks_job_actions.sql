-- 0108: შეჩერებული ანგარიში (0106) ვეღარ ქმნის განცხადებას, ვერ ინტერესდება და ვერ ინიშნება/ირჩევს ოსტატს,
-- თუნდაც სესია ჯერ ცოცხალი იყოს. ტრიგერები ფარავს ყველა RPC-ს ერთად (create_job, express_interest,
-- select_provider / ჩატის შეთავაზების ავტო-არჩევა), ფუნქციების ხელახლა დაწერის გარეშე.
create or replace function public.block_suspended_job_actor()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'job_posts' and tg_op = 'INSERT' then
    if public.is_suspended(new.customer_id) then raise exception 'ACCOUNT_SUSPENDED'; end if;
  elsif tg_table_name = 'job_responses' then
    if public.is_suspended(new.provider_id) then raise exception 'ACCOUNT_SUSPENDED'; end if;
  elsif tg_table_name = 'job_posts' and tg_op = 'UPDATE' then
    if new.provider_id is not null and new.provider_id is distinct from old.provider_id
       and (public.is_suspended(new.customer_id) or public.is_suspended(new.provider_id)) then
      raise exception 'ACCOUNT_SUSPENDED';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.block_suspended_job_actor() from public, anon, authenticated;

drop trigger if exists block_suspended_job_insert on public.job_posts;
create trigger block_suspended_job_insert before insert on public.job_posts
  for each row execute function public.block_suspended_job_actor();

drop trigger if exists block_suspended_job_assign on public.job_posts;
create trigger block_suspended_job_assign before update of provider_id on public.job_posts
  for each row execute function public.block_suspended_job_actor();

drop trigger if exists block_suspended_response on public.job_responses;
create trigger block_suspended_response before insert on public.job_responses
  for each row execute function public.block_suspended_job_actor();
