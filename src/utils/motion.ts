import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing } from 'react-native';

// ერთიანი „მოძრაობის ენა“ — ყველა ანიმაცია ერთი და იგივე დროებითა და მრუდით, რომ აპი ერთგვაროვნად „ცოცხალი“ იყოს.
export const motion = {
  // ელემენტის გამოჩენა (ჩამოსვლა/აწევა): ნელი დასასრული, ბუნებრივი
  easeOut: Easing.bezier(0.22, 1, 0.36, 1),
  // ორმხრივი მოძრაობა (ფერი, გადადგილება)
  easeInOut: Easing.bezier(0.4, 0, 0.2, 1),
  duration: { fast: 160, base: 320, slow: 480 },
  // ჩამონათვალში თითო ელემენტის დაგვიანება; მაქს. რამდენიმე ელემენტამდე, რომ ბოლო ბარათს დიდხანს არ ველოდოთ
  staggerStep: 55,
  staggerMax: 7,
} as const;

export function staggerDelay(index: number, base = 0): number {
  return base + Math.min(index, motion.staggerMax) * motion.staggerStep;
}

// მოძრაობის შემცირების სისტემური პარამეტრი (Accessibility → Reduce motion): როცა ჩართულია, ანიმაციები გამოტოვება
let reduce = false;
let subscribed = false;
const listeners = new Set<(v: boolean) => void>();
function ensureSubscribed() {
  if (subscribed) return;
  subscribed = true;
  AccessibilityInfo.isReduceMotionEnabled()
    .then((v) => {
      reduce = v;
      listeners.forEach((l) => l(v));
    })
    .catch(() => {});
  AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
    reduce = v;
    listeners.forEach((l) => l(v));
  });
}

export function useReduceMotion(): boolean {
  ensureSubscribed();
  const [value, setValue] = useState(reduce);
  useEffect(() => {
    listeners.add(setValue);
    setValue(reduce);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}
