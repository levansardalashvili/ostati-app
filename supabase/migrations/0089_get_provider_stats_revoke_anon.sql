-- Security Advisor: get_provider_stats() (zero-argument overload, called by
-- userService.listRealProviders() with no params) was executable by PUBLIC/anon —
-- 0044 only revoked the (uuid) overload. Client access stays with `authenticated`.
revoke execute on function public.get_provider_stats() from public, anon;
grant execute on function public.get_provider_stats() to authenticated;
