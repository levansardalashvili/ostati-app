import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabaseClient';

// In-app crash reporting (0154): JS errors go to `client_errors`, visible in
// the admin panel ("შეცდომები"). Fire-and-forget — reporting must never throw
// or block. Native-only crashes are not captured (would need Sentry).
const appVersion = Constants.expoConfig?.version ?? null;
const platform = `${Platform.OS}${__DEV__ ? '-dev' : ''}`;

export function reportError(error: unknown, opts: { fatal?: boolean; context?: string } = {}): void {
  try {
    const e = error instanceof Error ? error : new Error(String(error));
    supabase
      .rpc('log_client_error', {
        p_message: e.message || e.name || 'Unknown error',
        p_stack: e.stack ?? null,
        p_context: opts.context ?? null,
        p_is_fatal: !!opts.fatal,
        p_app_version: appVersion,
        p_platform: platform,
      })
      .then(
        () => {},
        () => {},
      );
  } catch {
    // never let reporting crash the app
  }
}

let installed = false;

// Wraps React Native's global handler (uncaught JS exceptions, incl. fatal
// ones) — reports first, then lets the default handler do its usual work.
export function installGlobalErrorHandler(): void {
  if (installed) return;
  installed = true;
  const g = globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
      setGlobalHandler: (h: (error: unknown, isFatal?: boolean) => void) => void;
    };
  };
  const eu = g.ErrorUtils;
  if (!eu) return;
  const previous = eu.getGlobalHandler();
  eu.setGlobalHandler((error, isFatal) => {
    reportError(error, { fatal: isFatal, context: 'global' });
    previous(error, isFatal);
  });
}
