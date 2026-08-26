// მიღებულია დიზაინის რეფერენსიდან (docs/design-reference/theme-reference.css).
// ერთი აქცენტის ფერი მთელ აპში + სემანტიკური ფერები სტატუსებისთვის.

export const colors = {
  background: '#F8FAFC',
  foreground: '#0F172A',

  card: '#FFFFFF',
  cardForeground: '#0F172A',

  primary: '#2563EB',
  primaryForeground: '#FFFFFF',

  secondary: '#EFF6FF',
  secondaryForeground: '#1D4ED8',

  muted: '#F1F5F9',
  mutedForeground: '#64748B',

  accent: '#DBEAFE',
  accentForeground: '#1E40AF',

  destructive: '#DC2626',
  destructiveForeground: '#FFFFFF',

  border: 'rgba(0, 0, 0, 0.07)',
  inputBackground: '#F1F5F9',

  // სემანტიკური სტატუსების ფერები (Job / Provider სტატუსებისთვის)
  success: '#16A34A',
  successBackground: '#F0FDF4',
  warning: '#D97706',
  warningBackground: '#FFFBEB',
  danger: '#DC2626',
  dangerBackground: '#FEF2F2',
} as const;

export type ColorToken = keyof typeof colors;
