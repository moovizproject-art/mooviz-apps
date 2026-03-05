/**
 * Design System Constants - קבועי מערכת עיצוב
 * Complete design system: spacing, colors, typography, shadows, border radii.
 * Glass morphism design language with RTL-first Hebrew support.
 * מערכת עיצוב מלאה: מרווחים, צבעים, טיפוגרפיה, צללים, רדיוסים
 */

// ──────────────────────────────────────────────
// Spacing scale (4-point grid)
// סולם מרווחים (רשת 4 נקודות)
// ──────────────────────────────────────────────

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// ──────────────────────────────────────────────
// Border radii
// רדיוסי גבול
// ──────────────────────────────────────────────

export const BORDER_RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

// ──────────────────────────────────────────────
// Brand colors — glass morphism palette
// צבעי מותג — פלטת זכוכית
// ──────────────────────────────────────────────

export const BRAND = {
  primary: '#1A73E8',
  primaryLight: '#4A9AFF',
  primaryDark: '#0D47A1',
  accent: '#FF6B35',
  accentLight: '#FF8F62',
  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceGlass: 'rgba(255, 255, 255, 0.85)',
  textPrimary: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textInverse: '#FFFFFF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  success: '#10B981',
  successBg: '#E6F4EA',
  warning: '#F59E0B',
  warningBg: '#FEF3CD',
  error: '#EF4444',
  errorBg: '#FCE8E6',
  info: '#3B82F6',
  infoBg: '#E8F0FE',
} as const;

// ──────────────────────────────────────────────
// Shadows — platform-specific
// צללים — ספציפיים לפלטפורמה
// ──────────────────────────────────────────────

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;

// ──────────────────────────────────────────────
// Typography — Hebrew-friendly
// טיפוגרפיה — ידידותית לעברית
// ──────────────────────────────────────────────

export const TYPOGRAPHY = {
  h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
  h2: { fontSize: 22, fontWeight: '600' as const, lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodyBold: { fontSize: 15, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  small: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  button: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
} as const;
