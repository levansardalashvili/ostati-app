-- მისამართის დამატებითი დეტალები Customer-ისთვის — სადარბაზო/ბინა
-- (registration flow, location-detect feature). Provider-ისთვის ცარიელი
-- რჩება, ზუსტად `defaultAddress`-ის იგივე პრინციპით (#46).
alter table public.users add column entrance text not null default '';
alter table public.users add column apartment text not null default '';
