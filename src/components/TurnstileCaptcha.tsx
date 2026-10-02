import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors, radius } from '../theme';

// Cloudflare Turnstile-ის PUBLIC site key — ანალოგიურად GOOGLE_WEB_CLIENT_ID-ის
// (authService.ts), ეს არ არის საიდუმლო, უსაფრთხოდ შეიძლება კოდში იყოს.
// რეალური დაცვა (SECRET key) მხოლოდ Supabase Dashboard-შია, server-side.
export const TURNSTILE_SITE_KEY = '0x4AAAAAAFLz1Gh7oOJLh6OW';

export type TurnstileCaptchaHandle = {
  reset: () => void;
};

type Props = {
  onVerify: (token: string) => void;
  onExpire?: () => void;
};

// Turnstile-ის ოფიციალური ვიჯეტი ვებისთვისაა (DOM-ზე აგებული) — React
// Native-ში მისი ჩასართავად WebView-ში იტვირთება მინიმალური HTML გვერდი,
// Turnstile-ის token კი `window.ReactNativeWebView.postMessage(...)`-ით
// ბრუნდება. მასშტაბირებული, გამჭვირვალე ფონით, რომ ეკრანზე მშობელი
// ფორმის ნაწილივით გამოიყურებოდეს.
const HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <style>
    html, body { margin: 0; padding: 0; background: transparent; display: flex; justify-content: center; }
  </style>
</head>
<body>
  <div id="widget"></div>
  <script>
    window.onTurnstileSuccess = function (token) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'verify', token }));
    };
    window.onTurnstileExpired = function () {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'expire' }));
    };
    window.renderTurnstile = function () {
      if (window.turnstile) {
        turnstile.render('#widget', {
          sitekey: '${TURNSTILE_SITE_KEY}',
          callback: onTurnstileSuccess,
          'expired-callback': onTurnstileExpired,
          theme: 'light',
        });
      } else {
        setTimeout(window.renderTurnstile, 100);
      }
    };
    window.renderTurnstile();
  </script>
</body>
</html>`;

export const TurnstileCaptcha = forwardRef<TurnstileCaptchaHandle, Props>(function TurnstileCaptcha(
  { onVerify, onExpire },
  ref,
) {
  const webviewRef = useRef<WebView>(null);

  useImperativeHandle(ref, () => ({
    reset: () => webviewRef.current?.reload(),
  }));

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type: string; token?: string };
      if (data.type === 'verify' && data.token) onVerify(data.token);
      else if (data.type === 'expire') onExpire?.();
    } catch {
      // უგულებელყოფილი — HTML გვერდიდან მხოლოდ ჩვენი საკუთარი JSON მესიჯები მოდის
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webviewRef}
        // Cloudflare-ში რეგისტრირებული hostname (ostato.app) ემთხვევა,
        // თორემ Turnstile-ის hostname-ვერიფიკაცია ვერ ცნობს WebView-ის
        // ინლაინ (baseUrl-ის გარეშე `about:blank`-ის მსგავსი) origin-ს.
        source={{ html: HTML, baseUrl: 'https://ostato.app' }}
        onMessage={handleMessage}
        style={styles.webview}
        scrollEnabled={false}
        javaScriptEnabled
        originWhitelist={['*']}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    height: 72,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
