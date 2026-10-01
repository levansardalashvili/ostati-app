-- "კერძო სახლი" toggle (შესასვლელი/ბინა არასავალდებულო ხდება) + კარის
-- კოდი (ინტერკომის/ჭიშკრის კოდი) — #173-ის entrance/apartment-ის პირდაპირი
-- გაგრძელება (0140).
alter table public.users add column door_code text not null default '';
alter table public.users add column is_private_house boolean not null default false;
