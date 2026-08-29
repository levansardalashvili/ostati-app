// send-push-notifications — Supabase Edge Function (Deno runtime).
//
// Triggered by a Database Webhook on `public.notifications` INSERT
// (configured in the Supabase Dashboard — see this folder's README.md;
// that step cannot be done from a SQL migration, so it is documented
// there instead). Receives the standard Supabase webhook payload
// (`{ type, table, schema, record, old_record }`), resolves the
// recipient's active push tokens, applies the two delivery gates the
// task requires (notification_preferences, and — only for
// 'new_jobs_in_area' — provider_profiles.is_available), sanitizes the
// body for chat messages, sends via the Expo Push API, and deactivates
// any token Expo reports as no longer registered.
//
// This function NEVER trusts the recipient from client input — `record`
// is the already-committed row a trusted, server-side Postgres
// trigger/RPC inserted (every notifications-writing function in this
// schema is SECURITY DEFINER with its own auth checks, see
// supabase/migrations/0018 & 0038's header comment); the webhook is the
// only thing that invokes this function, not the mobile app.
//
// Required environment (Edge Function secrets):
//   SUPABASE_URL               — auto-provided by Supabase, no setup needed.
//   SUPABASE_SERVICE_ROLE_KEY  — auto-provided by Supabase, no setup needed.
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
  try {
    const payload = await req.json();
    const record = payload?.record as NotificationRecord | undefined;
    if (!record?.user_id) {
      return new Response(JSON.stringify({ skipped: 'no record' }), { status: 200 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY in function environment');
      return new Response(JSON.stringify({ error: 'server misconfigured' }), { status: 500 });
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Gate 1 — notification_preferences. Missing key = enabled, matching
    // the app's own established rule (notificationService.ts /
    // NotificationSettingsScreen.tsx) — only an EXPLICIT `false` skips
    // sending. A null/unclassified `record.type` (pre-0038 historical
    // row, or a future writer that forgets to set it) is never gated —
    // there is no preference key to check against, so it sends.
    if (record.type) {
      const { data: prefRow } = await supabase
        .from('notification_preferences')
        .select('prefs')
        .eq('user_id', record.user_id)
        .maybeSingle();
      const prefs = (prefRow?.prefs as Record<string, boolean> | undefined) ?? {};
      if (prefs[record.type] === false) {
        return new Response(JSON.stringify({ skipped: 'preference disabled', type: record.type }), { status: 200 });
      }
    }

    // Gate 2 — Provider availability, 'new_jobs_in_area' ONLY (task:
    // availability gates new-job opportunities, not chat/active-job
    // notifications). A missing provider_profiles row (e.g. a Customer
    // recipient — can't happen for this type in practice, but defensive)
    // does not block sending; only an explicit is_available = false does.
    if (record.type === 'new_jobs_in_area') {
      const { data: profile } = await supabase
        .from('provider_profiles')
        .select('is_available')
        .eq('id', record.user_id)
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
    const { data: userRow } = await supabase.from('users').select('role').eq('id', record.user_id).maybeSingle();
    const role = (userRow?.role as string | undefined) ?? 'customer';

    const { data: tokenRows } = await supabase
      .from('push_tokens')
      .select('expo_push_token')
      .eq('user_id', record.user_id)
      .eq('is_active', true);
    const tokens = (tokenRows ?? []) as PushToken[];
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ skipped: 'no active tokens' }), { status: 200 });
    }

    const body = pushBodyFor(record);
    const messages = tokens.map((t) => ({
      to: t.expo_push_token,
      sound: 'default',
      title: record.title,
      body,
      data: { ...(record.target ?? {}), type: record.type, notificationId: record.id, role },
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
