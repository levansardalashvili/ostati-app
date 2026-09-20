# send-sms-hook

Supabase Auth "Send SMS Hook" — OTP-ს Vonage-ის SMS API-ით აგზავნის.

## Deploy (ხელით ნაბიჯები)

1. Vonage API Dashboard-იდან აიღეთ API key და API secret. Trial ანგარიში SMS-ს
   მხოლოდ დადასტურებულ (Test numbers) ნომრებზე აგზავნის — რეალურ ნომრებზე
   ბალანსის შევსებაა საჭირო.
2. Deploy: `npx supabase functions deploy send-sms-hook --no-verify-jwt`
   (`--no-verify-jwt` აუცილებელია — Auth ხელმოწერით ავთენტიფიცირდება, არა JWT-ით).
3. Secrets:
   ```
   supabase secrets set VONAGE_API_KEY=... VONAGE_API_SECRET=...
   ```
4. Dashboard → Authentication → Hooks → **Send SMS** → HTTPS →
   URL `https://<project>.supabase.co/functions/v1/send-sms-hook` →
   "Generate secret" → მიღებული `v1,whsec_...` მნიშვნელობა:
   ```
   supabase secrets set SEND_SMS_HOOK_SECRET='v1,whsec_...'
   ```
5. Dashboard → Authentication → Providers → **Phone** ჩართული უნდა იყოს
   (provider-ის არჩევა აღარ სჭირდება — hook ცვლის მას).
