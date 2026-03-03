/**
 * Color Palette — פלטת צבעים
 * MOOVIZ app color constants.
 * קבועי צבעים של אפליקציית MOOVIZ
 */

export const COLORS = {
  // Primary brand colors
  // צבעי מותג ראשיים
  primary: '#1A73E8',
  primaryDark: '#1557B0',
  primaryLight: '#4A90E2',

  // Accent / CTA
  accent: '#FF6B35',
  accentDark: '#E55A2B',
  accentLight: '#FF8F66',

  // Semantic colors
  // צבעים סמנטיים
  success: '#34A853',
  successBg: '#E6F4EA',
  warning: '#F9AB00',
  warningBg: '#FEF3CD',
  error: '#EA4335',
  errorBg: '#FCE8E6',
  info: '#4285F4',
  infoBg: '#E8F0FE',

  // Text
  // טקסט
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Backgrounds
  // רקעים
  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',

  // Borders
  // גבולות
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  borderDark: '#D1D5DB',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.1)',

  // Map
  mapRoute: '#1A73E8',
  mapPickup: '#34A853',
  mapDestination: '#EA4335',

  // Rating stars
  star: '#FFB800',
  starEmpty: '#D1D5DB',
} as const;

export type ColorKey = keyof typeof COLORS;
