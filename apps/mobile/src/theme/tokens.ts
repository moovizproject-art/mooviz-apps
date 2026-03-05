/**
 * Theme Tokens — unified color system for light + dark modes
 */

export interface ThemeColors {
  // Header / brand
  headerBg: string;
  headerBgEnd: string;
  headerText: string;
  headerTextSecondary: string;

  // Primary brand
  primary: string;
  primaryLight: string;
  primaryDark: string;

  // Accent / CTA
  accent: string;
  accentLight: string;
  accentDark: string;

  // Surfaces
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceGlass: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  // Borders
  border: string;
  borderLight: string;
  borderDark: string;

  // Semantic
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  error: string;
  errorBg: string;
  info: string;
  infoBg: string;

  // Overlays
  overlay: string;
  overlayLight: string;

  // Map
  mapRoute: string;
  mapPickup: string;
  mapDestination: string;

  // Rating
  star: string;
  starEmpty: string;

  // Input
  inputBg: string;
  inputBorder: string;
  inputBorderFocused: string;
  inputPlaceholder: string;
}

export const lightColors: ThemeColors = {
  // Header
  headerBg: '#1A73E8',
  headerBgEnd: '#1557B0',
  headerText: '#FFFFFF',
  headerTextSecondary: 'rgba(255, 255, 255, 0.8)',

  // Primary
  primary: '#1A73E8',
  primaryLight: '#4A9AFF',
  primaryDark: '#0D47A1',

  // Accent
  accent: '#FF6B35',
  accentLight: '#FF8F62',
  accentDark: '#E55A2B',

  // Surfaces
  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceGlass: 'rgba(255, 255, 255, 0.85)',

  // Text
  textPrimary: '#1A1A2E',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Borders
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  borderDark: '#D1D5DB',

  // Semantic
  success: '#34A853',
  successBg: '#E6F4EA',
  warning: '#F9AB00',
  warningBg: '#FEF3CD',
  error: '#EA4335',
  errorBg: '#FCE8E6',
  info: '#4285F4',
  infoBg: '#E8F0FE',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.1)',

  // Map
  mapRoute: '#1A73E8',
  mapPickup: '#34A853',
  mapDestination: '#EA4335',

  // Rating
  star: '#FFB800',
  starEmpty: '#D1D5DB',

  // Input
  inputBg: '#FFFFFF',
  inputBorder: '#E5E7EB',
  inputBorderFocused: '#1A73E8',
  inputPlaceholder: '#9CA3AF',
};

export const darkColors: ThemeColors = {
  // Header
  headerBg: '#0D47A1',
  headerBgEnd: '#092D6B',
  headerText: '#FFFFFF',
  headerTextSecondary: 'rgba(255, 255, 255, 0.7)',

  // Primary
  primary: '#4A9AFF',
  primaryLight: '#7AB8FF',
  primaryDark: '#1A73E8',

  // Accent
  accent: '#FF8F62',
  accentLight: '#FFB08E',
  accentDark: '#FF6B35',

  // Surfaces
  background: '#121212',
  surface: '#1E1E1E',
  surfaceElevated: '#2A2A2A',
  surfaceGlass: 'rgba(30, 30, 30, 0.85)',

  // Text
  textPrimary: '#E0E0E0',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',
  textInverse: '#1A1A2E',

  // Borders
  border: '#3A3A3A',
  borderLight: '#2A2A2A',
  borderDark: '#4A4A4A',

  // Semantic
  success: '#4CAF50',
  successBg: '#1B3A1B',
  warning: '#FFB74D',
  warningBg: '#3A2E1B',
  error: '#EF5350',
  errorBg: '#3A1B1B',
  info: '#64B5F6',
  infoBg: '#1B2A3A',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(255, 255, 255, 0.05)',

  // Map
  mapRoute: '#4A9AFF',
  mapPickup: '#4CAF50',
  mapDestination: '#EF5350',

  // Rating
  star: '#FFB800',
  starEmpty: '#4A4A4A',

  // Input
  inputBg: '#2A2A2A',
  inputBorder: '#3A3A3A',
  inputBorderFocused: '#4A9AFF',
  inputPlaceholder: '#6B7280',
};

// Spacing (shared, not theme-dependent)
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const BORDER_RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

export const TYPOGRAPHY = {
  h1: { fontSize: 31, fontWeight: '700' as const, lineHeight: 40 },
  h2: { fontSize: 24, fontWeight: '600' as const, lineHeight: 31 },
  h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  body: { fontSize: 18, fontWeight: '400' as const, lineHeight: 24 },
  bodySmall: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodyBold: { fontSize: 17, fontWeight: '600' as const, lineHeight: 24 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  small: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  button: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
} as const;

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
