-- 0064_express_interest_rpc.sql
-- CONFIRMED integrity gaps in the direct client INSERT path for
-- `job_responses` (quoteService.expressInterest(), 0045's "Provider can
-- express interest as self" policy):
--   A) nothing required `offered_price` to be a positive number — a
--      Provider could INSERT with offered_price = NULL (or <= 0), despite
--      the product rule (CLAUDE.md #72: "Provider ყოველთვის კონკრეტულ,
--      რიცხვით ფასს წარადგენს") that expressing interest always includes
--      a concrete positive price. select_provider() (0045) DOES reject a
--      null/non-positive offered_price at selection time, so this could
--      never actually result in a Provider being selected with a bad
--      price — but a malformed job_responses row would sit there,
--      visible to the Customer (listResponsesForJob), until that point.
--   B) provider_name/provider_initials/provider_color were accepted
--      verbatim from the client — a Provider could insert a
--      job_responses row claiming to be displayed as anyone/anything.
--      select_provider() later copies job_responses.provider_name
--      straight into job_posts.provider_name (shown to the Customer for
--      the rest of that job's lifecycle) — so a spoofed name here could
--      persist well beyond the job_responses row itself.
--
-- Fix: express_interest(p_job_id, p_offered_price) — provider_id is never
-- a parameter at all (always auth.uid()); display fields are always
-- derived from the caller's own provider_profiles row, never accepted
-- from the client. Direct client INSERT on job_responses is revoked
-- entirely afterward — this RPC is the only way to create a row.
--
-- No `for update` lock on job_posts here (unlike the job-workflow RPCs,
-- 0014/0045): expressing interest is a comparatively frequent, low-stakes
-- operation (many Providers may call this concurrently on the same
-- popular job), and a benign TOCTOU race against a concurrent status
-- change (the job becomes non-pending a moment after this function's own
-- read) already existed under the previous RLS-only check and causes no
-- integrity problem — select_provider() re-validates the job's status
-- and the response's price independently before ever assigning a
-- provider, so a response inserted in that narrow window is simply never
-- selectable, not a security hole. job_responses' own
-- `job_responses_one_per_provider unique (job_id, provider_id)`
-- constraint (0005) continues to guarantee one response per provider per
-- job regardless of insert path — nothing new needed for that.

create or replace function public.express_interest(p_job_id uuid, p_offered_price numeric)
returns public.job_responses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
  v_profile public.provider_profiles%rowtype;
  v_provider_name text;
  v_initials text;
  v_response public.job_responses%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider') then
    raise exception 'Only a Provider account can express interest';
  end if;

  if p_offered_price is null or p_offered_price <= 0 then
    raise exception 'A positive offered price is required';
  end if;

  select * into v_job from public.job_posts where id = p_job_id;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.status <> 'pending' then
    raise exception 'Job is not open for interest (status=%)', v_job.status;
  end if;
  if v_job.customer_id = auth.uid() then
    raise exception 'A customer cannot express interest in their own job';
  end if;

  select * into v_profile from public.provider_profiles where id = auth.uid();
  if v_profile.id is null then
    raise exception 'A provider profile is required before expressing interest';
  end if;

  -- Never trust anything the client sent for these three — always
  -- derived from provider_profiles, with safe, generic, server-controlled
  -- fallbacks (never an empty string, never client-suppliable).
  v_provider_name := nullif(btrim(coalesce(v_profile.first_name, '') || ' ' || coalesce(v_profile.last_name, '')), '');
  v_provider_name := coalesce(v_provider_name, 'ოსტატი');
  v_initials := upper(
    coalesce(nullif(left(btrim(coalesce(v_profile.first_name, '')), 1), ''), '')
    || coalesce(nullif(left(btrim(coalesce(v_profile.last_name, '')), 1), ''), '')
  );
  if v_initials = '' then
    v_initials := 'O';
  end if;

  insert into public.job_responses (job_id, provider_id, provider_name, provider_initials, provider_color, offered_price)
  values (p_job_id, auth.uid(), v_provider_name, v_initials, '#2563EB', p_offered_price)
  returning * into v_response;

  return v_response;
end;
$$;

comment on function public.express_interest(uuid, numeric) is
  'The only way to create a job_responses row (direct client INSERT is revoked below). provider_id is always auth.uid(); provider_name/provider_initials/provider_color are always derived from the caller''s own provider_profiles row (never client-supplied); requires role=provider, a real provider_profiles row, the job to exist and be pending, the caller not to be the job''s own customer, and offered_price > 0. on_job_response_insert_notify (0021) fires unchanged on the resulting INSERT.';

revoke execute on function public.express_interest(uuid, numeric) from public, anon;
grant execute on function public.express_interest(uuid, numeric) to authenticated;

-- Direct client INSERT is no longer needed or trusted — matches this
-- project's established "RPC-only writes" pattern (job_posts, reviews).
-- The now-unreachable INSERT policy is dropped alongside the grant so
-- nothing is left implying a client-side insert path still works.
revoke insert on public.job_responses from authenticated;
drop policy if exists "Provider can express interest as self" on public.job_responses;

-- Legacy job_responses rows (inserted before this migration, including
-- any with offered_price null from before 0012's numeric conversion) are
-- completely untouched — this migration adds no constraint on the table
-- itself, only removes the client's ability to INSERT a new one outside
-- express_interest(). Existing rows keep reading/updating exactly as
-- before.
