/**
 * Design System Constants — backwards compatibility re-export from theme system
 */
export { SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../theme/tokens';
import { lightColors } from '../theme/tokens';

export const BRAND = {
  primary: lightColors.primary,
  primaryLight: lightColors.primaryLight,
  primaryDark: lightColors.primaryDark,
  accent: lightColors.accent,
  accentLight: lightColors.accentLight,
  background: lightColors.background,
  surface: lightColors.surface,
  surfaceGlass: lightColors.surfaceGlass,
  textPrimary: lightColors.textPrimary,
  textSecondary: lightColors.textSecondary,
  textMuted: lightColors.textTertiary,
  textInverse: lightColors.textInverse,
  border: lightColors.border,
  borderLight: lightColors.borderLight,
  success: lightColors.success,
  successBg: lightColors.successBg,
  warning: lightColors.warning,
  warningBg: lightColors.warningBg,
  error: lightColors.error,
  errorBg: lightColors.errorBg,
  info: lightColors.info,
  infoBg: lightColors.infoBg,
} as const;
