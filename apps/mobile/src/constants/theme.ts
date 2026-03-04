/**
 * Theme System — מערכת עיצוב
 * Typography, spacing, border radii, and shadows.
 * Extends colors.ts for a complete design system.
 * טיפוגרפיה, מרווחים, רדיוסים וצללים
 */
import { TextStyle, ViewStyle } from 'react-native';

// ──────────────────────────────────────────────
// Spacing scale (4-point grid)
// ──────────────────────────────────────────────

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// ──────────────────────────────────────────────
// Border radii
// ──────────────────────────────────────────────

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

// ──────────────────────────────────────────────
// Typography — Hebrew-friendly
// ──────────────────────────────────────────────

export const TYPOGRAPHY: Record<string, TextStyle> = {
  h1: { fontSize: 28, fontWeight: '800', lineHeight: 34 },
  h2: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodyBold: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  captionBold: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  label: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  button: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  small: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
} as const;

// ──────────────────────────────────────────────
// Shadows — platform-specific
// ──────────────────────────────────────────────

export const SHADOW: Record<string, ViewStyle> = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;
