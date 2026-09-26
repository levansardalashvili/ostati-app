// სასურველი დროის შუალედები (job_posts.time_slot, migration 0138). კოდი = 'HH-HH' (საქართველოს დრო, დასაწყისი-დასასრული),
// ან 'flexible'. ძველი განცხადებების 3-საათიანი შუალედები ('09-12'...) იგივე ფორმატია და იკითხება timeSlotLabel()-ით.
const pad = (n: number) => String(n).padStart(2, '0');

export const FLEXIBLE_SLOT = { code: 'flexible', label: 'ნებისმიერ დროს' } as const;

// 07:00–08:00 ... 21:00–22:00 — ერთსაათიანი შუალედები
export const FIRST_HOUR = 7;
export const LAST_HOUR = 21;
export const HOUR_SLOTS: { code: string; label: string }[] = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => {
  const h = FIRST_HOUR + i;
  return { code: `${pad(h)}-${pad(h + 1)}`, label: `${pad(h)}:00–${pad(h + 1)}:00` };
});

// ბორბლის სია: მხოლოდ საათები; „ნებისმიერ დროს“ ცალკე ღილაკია ბორბლის ქვეშ (TimePickerField)
export const TIME_SLOT_OPTIONS: { code: string; label: string }[] = HOUR_SLOTS;
export const DEFAULT_TIME_SLOT = '09-10';

export function timeSlotLabel(code: string | null | undefined): string {
  if (!code) return '';
  if (code === FLEXIBLE_SLOT.code) return FLEXIBLE_SLOT.label;
  const m = code.match(/^(\d{2})-(\d{2})$/);
  return m ? `${m[1]}:00–${m[2]}:00` : '';
}
