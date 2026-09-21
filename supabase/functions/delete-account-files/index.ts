// delete-account-files — Edge Function (Deno). Called by the app right BEFORE `delete_my_account()`.
// Removes the caller's private-media files (chat / job / completion photos) with the service role,
// because storage objects cannot be deleted with plain SQL. The caller is identified ONLY by their
// own JWT — a user can never trigger deletion of somebody else's files.
//
// Env (auto-provided by Supabase): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  const url = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return new Response('Unauthorized', { status: 401, headers: CORS });
  const uid = userData.user.id;

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: paths, error } = await admin.rpc('private_media_paths_for_user', { p_uid: uid });
  if (error) return new Response(error.message, { status: 500, headers: CORS });

  const names = (paths ?? []) as string[];
  let removed = 0;
  for (let i = 0; i < names.length; i += 100) {
    const chunk = names.slice(i, i + 100);
    const { error: rmError } = await admin.storage.from('private-media').remove(chunk);
    if (rmError) return new Response(rmError.message, { status: 500, headers: CORS });
    removed += chunk.length;
  }

  return new Response(JSON.stringify({ removed }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
