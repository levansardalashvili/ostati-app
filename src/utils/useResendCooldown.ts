import { useEffect, useState } from 'react';

// Countdown for the "resend code" button.
export function useResendCooldown(seconds: number) {
  const [secondsLeft, setSecondsLeft] = useState(seconds);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  return {
    secondsLeft,
    canResend: secondsLeft <= 0,
    restart: () => setSecondsLeft(seconds),
  };
}
