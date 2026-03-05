/**
 * Color Palette — backwards compatibility re-export from theme system
 */
import { lightColors } from '../theme/tokens';

export const COLORS = {
  primary: lightColors.primary,
  primaryDark: lightColors.primaryDark,
  primaryLight: lightColors.primaryLight,
  accent: lightColors.accent,
  accentDark: lightColors.accentDark,
  accentLight: lightColors.accentLight,
  success: lightColors.success,
  successBg: lightColors.successBg,
  warning: lightColors.warning,
  warningBg: lightColors.warningBg,
  error: lightColors.error,
  errorBg: lightColors.errorBg,
  info: lightColors.info,
  infoBg: lightColors.infoBg,
  text: lightColors.textPrimary,
  textSecondary: lightColors.textSecondary,
  textTertiary: lightColors.textTertiary,
  textInverse: lightColors.textInverse,
  background: lightColors.background,
  surface: lightColors.surface,
  surfaceElevated: lightColors.surfaceElevated,
  border: lightColors.border,
  borderLight: lightColors.borderLight,
  borderDark: lightColors.borderDark,
  overlay: lightColors.overlay,
  overlayLight: lightColors.overlayLight,
  mapRoute: lightColors.mapRoute,
  mapPickup: lightColors.mapPickup,
  mapDestination: lightColors.mapDestination,
  star: lightColors.star,
  starEmpty: lightColors.starEmpty,
} as const;

export type ColorKey = keyof typeof COLORS;
