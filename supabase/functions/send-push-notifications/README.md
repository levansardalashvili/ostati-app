# send-push-notifications

Sends Expo push notifications for newly-created rows in `public.notifications`. See `index.ts` for the full logic/gating (notification preferences, Provider availability, chat body sanitization, invalid-token cleanup).

## Deploy

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli), logged in and linked to this project (`supabase link`).

```bash
supabase functions deploy send-push-notifications
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to every deployed Edge Function — no manual secret setup needed for those.

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
7. HTTP method: `POST`. Timeout: default is fine.
8. Save.

The Dashboard handles the function URL and auth header automatically — no project ref or key needs to be typed in or committed anywhere.

## Test manually

```bash
curl -i --location --request POST 'https://<project-ref>.supabase.co/functions/v1/send-push-notifications' \
  --header 'Authorization: Bearer <anon-or-service-key>' \
  --header 'Content-Type: application/json' \
  --data '{"record":{"id":"00000000-0000-0000-0000-000000000000","user_id":"<a real auth.users id with an active push_tokens row>","title":"ტესტი","body":"ტესტური შეტყობინება","target":null,"type":null}}'
```
