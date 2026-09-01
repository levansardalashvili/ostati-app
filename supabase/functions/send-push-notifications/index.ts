// send-push-notifications — Supabase Edge Function (Deno runtime).
//
// Triggered by a Database Webhook on `public.notifications` INSERT
// (configured in the Supabase Dashboard — see this folder's README.md;
// that step cannot be done from a SQL migration, so it is documented
// there instead).
//
// Security model (audit fix): the incoming HTTP request is NEVER
// trusted for `user_id`/`title`/`body`/`target`/`type` — even though a
// genuine Supabase Database Webhook payload's `record` already contains
// the full, real row, a request to this endpoint could originate from
// anywhere that knows the URL. Two independent protections:
//   1. `x-webhook-secret` header must match the `PUSH_WEBHOOK_SECRET`
//      Edge Function secret (401 if missing/wrong, 500 if the secret
//      itself isn't configured — never silently "open" if someone forgot
//      to set it).
//   2. Only the notification's `id` is read from the request body — every
//      other field (title/body/target/type/user_id) is then RE-READ from
//      `public.notifications` via the service-role client, never taken
//      from what the caller claims. A forged payload with a real id but
//      fabricated title/body/target changes nothing; only the DB row's
//      actual content is ever sent.
//
// Required environment (Edge Function secrets):
//   SUPABASE_URL               — auto-provided by Supabase, no setup needed.
//   SUPABASE_SERVICE_ROLE_KEY  — auto-provided by Supabase, no setup needed.
//   PUSH_WEBHOOK_SECRET        — REQUIRED. Shared secret between the
//                                 Database Webhook config and this
//                                 function. Set via:
//                                 `supabase secrets set PUSH_WEBHOOK_SECRET=...`
//                                 and add the same value as an
//                                 `x-webhook-secret` header on the
//                                 Database Webhook (see README.md).
//   EXPO_ACCESS_TOKEN          — OPTIONAL. If set, sent as a Bearer token
//                                 to Expo's push API (higher rate limits /
//                                 better abuse protection per Expo's own
//                                 docs). Set via:
//                                 `supabase secrets set EXPO_ACCESS_TOKEN=...`
//                                 Never required for basic delivery.
//
// This file never imports or references any service-role/secret value
// from the mobile app — those only exist in this server-side runtime.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type NotificationRecord = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  target: Record<string, unknown> | null;
  type: string | null;
};

type PushToken = { expo_push_token: string };

// Chat message bodies (in `notifications.body`, set by
// supabase/migrations/0020's trigger) contain the actual message text —
// correct for the in-app list (owner-only RLS), but not something a push
// payload should carry per the task's "safe preview" requirement. Every
// other notification type's body is already generic (category label /
// static Georgian text, no user-authored content), so only this one
// type needs overriding.
function pushBodyFor(record: NotificationRecord): string {
  if (record.type === 'new_chat_message') {
    return 'ახალი შეტყობინება მიიღეთ — გახსენით სანახავად.';
  }
  return record.body;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405 });
  }

  // Secret check happens before anything else touches the request body
  // or Supabase — a missing server-side secret is a deploy/config bug
  // (500), a missing/wrong header is an unauthorized caller (401). Order
  // matters: if the secret was never configured, no header value —
  // correct or not — should be treated as "authorized".
  const configuredSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!configuredSecret) {
    console.error('PUSH_WEBHOOK_SECRET is not configured for this function');
    return new Response(JSON.stringify({ error: 'server misconfigured' }), { status: 500 });
  }
  const providedSecret = req.headers.get('x-webhook-secret');
  if (!providedSecret || providedSecret !== configuredSecret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  try {
    const payload = await req.json().catch(() => null);
    // The ONLY thing trusted from the request body. Supabase's own
    // Database Webhook payload nests it at `record.id`; the manual-test
    // curl in README.md may send a bare `{"id": "..."}` instead — both
    // accepted, nothing else from either shape is ever read.
    const notificationId: string | undefined = payload?.record?.id ?? payload?.id;
    if (!notificationId) {
      return new Response(JSON.stringify({ skipped: 'no notification id' }), { status: 200 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY in function environment');
      return new Response(JSON.stringify({ error: 'server misconfigured' }), { status: 500 });
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Canonical row — re-read from the DB, not the request body. This is
    // what actually gets sent; the webhook payload's own title/body/
    // target/type/user_id (if it even included them) are discarded.
    const { data: record, error: recordError } = await supabase
      .from('notifications')
      .select('id, user_id, title, body, target, type')
      .eq('id', notificationId)
      .maybeSingle();
    if (recordError) {
      console.error('Failed to load notification row', recordError);
      return new Response(JSON.stringify({ error: 'failed to load notification' }), { status: 500 });
    }
    if (!record) {
      return new Response(JSON.stringify({ skipped: 'notification not found' }), { status: 200 });
    }
    const typedRecord = record as NotificationRecord;

    // Gate 1 — notification_preferences. Missing key = enabled, matching
    // the app's own established rule (notificationService.ts /
    // NotificationSettingsScreen.tsx) — only an EXPLICIT `false` skips
    // sending. A null/unclassified `type` (pre-0038 historical row, or a
    // future writer that forgets to set it) is never gated — there is no
    // preference key to check against, so it sends.
    if (typedRecord.type) {
      const { data: prefRow } = await supabase
        .from('notification_preferences')
        .select('prefs')
        .eq('user_id', typedRecord.user_id)
        .maybeSingle();
      const prefs = (prefRow?.prefs as Record<string, boolean> | undefined) ?? {};
      if (prefs[typedRecord.type] === false) {
        return new Response(JSON.stringify({ skipped: 'preference disabled', type: typedRecord.type }), { status: 200 });
      }
    }

    // Gate 2 — Provider availability, 'new_jobs_in_area' ONLY (task:
    // availability gates new-job opportunities, not chat/active-job
    // notifications). A missing provider_profiles row (e.g. a Customer
    // recipient — can't happen for this type in practice, but defensive)
    // does not block sending; only an explicit is_available = false does.
    if (typedRecord.type === 'new_jobs_in_area') {
      const { data: profile } = await supabase
        .from('provider_profiles')
        .select('is_available')
        .eq('id', typedRecord.user_id)
        .maybeSingle();
      if (profile?.is_available === false) {
        return new Response(JSON.stringify({ skipped: 'provider unavailable' }), { status: 200 });
      }
    }

    // Recipient's role — embedded in the push `data` payload so the
    // client's tap-navigation helper (src/utils/notificationNavigation.ts,
    // shared with the in-app notification list) can build a
    // `ChatConversation` route without needing the app to already have
    // hydrated the signed-in user's role at cold-start-tap time.
    const { data: userRow } = await supabase.from('users').select('role').eq('id', typedRecord.user_id).maybeSingle();
    const role = (userRow?.role as string | undefined) ?? 'customer';

    const { data: tokenRows } = await supabase
      .from('push_tokens')
      .select('expo_push_token')
      .eq('user_id', typedRecord.user_id)
      .eq('is_active', true);
    const tokens = (tokenRows ?? []) as PushToken[];
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ skipped: 'no active tokens' }), { status: 200 });
    }

    const body = pushBodyFor(typedRecord);
    const messages = tokens.map((t) => ({
      to: t.expo_push_token,
      sound: 'default',
      title: typedRecord.title,
      body,
      data: { ...(typedRecord.target ?? {}), type: typedRecord.type, notificationId: typedRecord.id, role },
    }));

    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    const expoRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...(expoAccessToken ? { authorization: `Bearer ${expoAccessToken}` } : {}),
      },
      body: JSON.stringify(messages),
    });
    const expoJson = await expoRes.json().catch(() => null);

    if (!expoRes.ok) {
      console.error('Expo push API returned an error status', expoRes.status, expoJson);
      return new Response(JSON.stringify({ error: 'expo api error', status: expoRes.status, body: expoJson }), { status: 502 });
    }

    // Token cleanup (task: "if Expo returns DeviceNotRegistered ... mark
    // token inactive, do not keep retrying forever"). Expo's response
    // `data` array is positional, same order as the request array, so
    // index i's ticket corresponds to tokens[i].
    type ExpoTicket = { status: 'ok' | 'error'; details?: { error?: string } };
    const tickets: ExpoTicket[] = Array.isArray(expoJson?.data) ? expoJson.data : [];
    const toDeactivate = tickets
      .map((ticket, i) => (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' ? tokens[i]?.expo_push_token : null))
      .filter((t): t is string => !!t);
    if (toDeactivate.length > 0) {
      await supabase.from('push_tokens').update({ is_active: false, updated_at: new Date().toISOString() }).in('expo_push_token', toDeactivate);
    }

    return new Response(JSON.stringify({ sent: messages.length, deactivated: toDeactivate.length }), { status: 200 });
  } catch (err) {
    console.error('send-push-notifications error', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
