# send-push-notifications

Sends Expo push notifications for newly-created rows in `public.notifications`. See `index.ts` for the full logic/gating (notification preferences, Provider availability, chat body sanitization, invalid-token cleanup).

**Security:** every request must carry a matching `x-webhook-secret` header, and the function only ever reads the row it sends from `public.notifications` directly — it never trusts `title`/`body`/`target`/`type`/`user_id` from the request body, only the notification `id`.

## Deploy

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli), logged in and linked to this project (`supabase link`).

```bash
supabase functions deploy send-push-notifications
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to every deployed Edge Function — no manual secret setup needed for those.

**Required** — generate a random secret and set it (any long random string; e.g. `openssl rand -hex 32`):

```bash
supabase secrets set PUSH_WEBHOOK_SECRET=your-long-random-secret
```

Without this secret set, the function returns `500` for every request (it refuses to run "open" if nobody configured it).

Optional (higher Expo push rate limits — see [Expo's docs](https://docs.expo.dev/push-notifications/sending-notifications/#additional-security-with-access-token-restrictions)):

```bash
supabase secrets set EXPO_ACCESS_TOKEN=your-expo-access-token
```

## Wire it up: Database Webhook (required manual step)

This cannot be done from a SQL migration — it must be configured once in the Supabase Dashboard:

1. Dashboard → **Database** → **Webhooks** → **Create a new hook**.
2. Name: `send-push-notifications` (or anything).
3. Table: `public.notifications`.
4. Events: **Insert** only.
5. Type: **Supabase Edge Functions**.
6. Edge Function: select `send-push-notifications`.
7. HTTP method: `POST`.
8. **HTTP Headers** — add one custom header:
   - Name: `x-webhook-secret`
   - Value: the exact same string you set as `PUSH_WEBHOOK_SECRET` above.
9. Save.

The Dashboard handles the function URL and its own auth automatically — no project ref or service-role key needs to be typed in or committed anywhere. The `x-webhook-secret` header is the only thing you manually copy between the two places.

## Test manually

The endpoint only needs a notification `id` that already exists in `public.notifications` — everything else it sends is read from that row server-side, not from this request:

```bash
curl -i --location --request POST 'https://<project-ref>.supabase.co/functions/v1/send-push-notifications' \
  --header 'Authorization: Bearer <anon-or-service-key>' \
  --header 'x-webhook-secret: <your PUSH_WEBHOOK_SECRET value>' \
  --header 'Content-Type: application/json' \
  --data '{"id":"<a real notifications.id, e.g. from a row belonging to a user with an active push_tokens row>"}'
```

Expected responses:
- `401` — missing/wrong `x-webhook-secret`.
- `500` — `PUSH_WEBHOOK_SECRET` not set on the function, or `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` missing (should never happen for the latter two — they're automatic).
- `200 {"skipped": "..."}` — secret was correct but nothing was sent (no such notification id, preference disabled, Provider unavailable, or no active tokens for that user).
- `200 {"sent": N, "deactivated": M}` — success.
- `502` — Expo's push API itself returned a non-2xx status; check the logged response body via `supabase functions logs send-push-notifications`.
