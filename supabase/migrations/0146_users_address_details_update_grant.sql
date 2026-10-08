-- Real bug found via E2E testing: 0140/0141 added entrance/apartment/
-- door_code/is_private_house with plain `alter table add column`, which
-- only inherits the table's default INSERT+SELECT grant — UPDATE on `users`
-- is granted per-column (to lock `role` etc, see #77), so these four never
-- got it. Every CustomerEditProfileScreen save silently failed the whole
-- `.update()` statement (Postgres rejects it if ANY referenced column lacks
-- UPDATE), swallowed by the screen's catch{} — entrance/apartment/door
-- code/private-house edits never actually persisted for any customer.
grant update (entrance, apartment, door_code, is_private_house) on public.users to authenticated;
