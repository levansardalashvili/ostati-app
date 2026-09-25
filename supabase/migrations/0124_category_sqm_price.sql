-- 0124: "ფასი კვ.მ-ზე" ველი ოსტატის პროფილში ჩანს მხოლოდ იმ კატეგორიებზე, სადაც სამუშაო კვადრატულობით ფასდება.
-- ადრე ეს სია კოდში იყო (isSqmPriced) — ახლა კატეგორიის თვისებაა, ადმინიდან იცვლება.
alter table public.categories add column if not exists price_per_sqm boolean not null default false;
update public.categories set price_per_sqm = true where id in ('painting', 'tile', 'flooring', 'renovation');

-- ჟურნალში კატეგორიის ცვლილებაში ახალი ველიც ჩანს
create or replace function public.audit_admin_table_write() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then return coalesce(new, old); end if;
  if tg_table_name = 'categories' then
    if tg_op = 'DELETE' then
      perform public.log_admin_action('category_delete', 'category', old.id, jsonb_build_object('name', old.name));
    else
      perform public.log_admin_action('category_' || lower(tg_op), 'category', new.id,
        jsonb_build_object('name', new.name, 'is_active', new.is_active, 'featured', new.featured, 'price_per_sqm', new.price_per_sqm));
    end if;
    return coalesce(new, old);
  end if;
  if new.status is distinct from old.status then
    perform public.log_admin_action('report_status', tg_table_name, new.id::text,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;
revoke execute on function public.audit_admin_table_write() from public, anon, authenticated;
