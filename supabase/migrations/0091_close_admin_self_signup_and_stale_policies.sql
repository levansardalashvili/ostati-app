-- Security audit fix.
-- 1) users INSERT allowed any signed-in user to create their own row with role='admin'
--    (policy only checked auth.uid() = id; users.role is INSERT-granted) → is_admin() true.
--    Admin rows must be created with service_role only.
-- 2) Drop stale permissive policies that OR-bypass the hardened ones (0046 / 0027).

drop policy if exists "Users can insert own profile" on public.users;
drop policy if exists "Users can insert own row" on public.users;
create policy "Users can insert own row"
  on public.users for insert
  with check (auth.uid() = id and role in ('customer', 'provider'));

-- Weak duplicate: no role / relationship / offer checks. "as self" policy is the real one.
drop policy if exists "Participant can send messages" on public.messages;

-- Redundant: set_review_identity trigger + "own completed job" policy already enforce this.
drop policy if exists "Customer can insert own review" on public.reviews;
