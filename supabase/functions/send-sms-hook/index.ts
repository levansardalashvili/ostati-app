// send-sms-hook — Supabase Auth "Send SMS Hook" (Deno runtime).
//
// Auth თავად კი არ აგზავნის SMS-ს — ეს ფუნქცია იძახება ყოველ OTP-ზე და Vonage-ის SMS API-ს
// პირდაპირ უკავშირდება. პროვაიდერის შეცვლა მხოლოდ `sendSms()`-ის
// ჩანაცვლებას საჭიროებს.
//
// უსაფრთხოება: მოთხოვნა Standard Webhooks ხელმოწერით მოწმდება
// (`SEND_SMS_HOOK_SECRET`) — ხელმოწერის გარეშე/არასწორით 401, ამიტომ URL-ის
// ცოდნით ვერავინ გააგზავნინებს SMS-ს (და ვერ დახარჯავს ბალანსს).
//
// Secrets და deploy: README.md.

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

type HookPayload = {
  user: { phone?: string };
  sms: { otp: string };
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function sendSms(phone: string, text: string): Promise<void> {
  const apiKey = Deno.env.get('VONAGE_API_KEY');
  const apiSecret = Deno.env.get('VONAGE_API_SECRET');
  if (!apiKey || !apiSecret) throw new Error('Vonage is not configured');

  // Vonage SMS API — `to` ციფრებით, + გარეშე.
  const res = await fetch('https://rest.nexmo.com/sms/json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret, from: 'Ostati', to: phone.replace(/^\+/, ''), text }),
  });
  const data = await res.json().catch(() => null);
  // Vonage 200-ს აბრუნებს შეცდომაზეც — სტატუსი შეტყობინების შიგნითაა ("0" = წარმატება).
  const msg = data?.messages?.[0];
  if (!res.ok || !msg || msg.status !== '0') {
    throw new Error(`Vonage ${res.status}: ${msg?.['error-text'] ?? JSON.stringify(data)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const secret = Deno.env.get('SEND_SMS_HOOK_SECRET');
  if (!secret) return json(500, { error: 'Hook secret is not configured' });

  const raw = await req.text();
  let payload: HookPayload;
  try {
    payload = new Webhook(secret.replace('v1,whsec_', '')).verify(raw, Object.fromEntries(req.headers)) as HookPayload;
  } catch {
    return json(401, { error: 'Invalid signature' });
  }

  const phone = payload.user?.phone;
  const otp = payload.sms?.otp;
  if (!phone || !otp) return json(400, { error: 'Missing phone or otp' });

  try {
    // ნომერი + ით ან მის გარეშე შეიძლება მოვიდეს — sendSms() ორივეს ამუშავებს.
    await sendSms(phone, `Ostati: თქვენი დადასტურების კოდია ${otp}`);
    return json(200, {});
  } catch (err) {
    console.error('send-sms-hook failed:', (err as Error).message);
    // Supabase Auth-ს ამ ფორმატით აბრუნებს შეცდომას კლიენტამდე.
    return json(500, { error: { http_code: 500, message: 'SMS delivery failed' } });
  }
});
