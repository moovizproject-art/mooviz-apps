import { normalizePhoneNumber, mapFirebaseAuthError } from '../../services/auth';

describe('Auth Service', () => {
  describe('normalizePhoneNumber', () => {
    it('should convert Israeli 0-prefix to +972', () => {
      expect(normalizePhoneNumber('0501234567')).toBe('+972501234567');
    });

    it('should keep existing +972 prefix', () => {
      expect(normalizePhoneNumber('+972501234567')).toBe('+972501234567');
    });

    it('should strip whitespace and dashes', () => {
      expect(normalizePhoneNumber('050-123-4567')).toBe('+972501234567');
    });

    it('should add +972 to bare numbers', () => {
      expect(normalizePhoneNumber('501234567')).toBe('+972501234567');
    });

    it('should strip parentheses', () => {
      expect(normalizePhoneNumber('(050) 123-4567')).toBe('+972501234567');
    });
  });

  describe('mapFirebaseAuthError', () => {
    it('should return Hebrew message for known errors', () => {
      expect(mapFirebaseAuthError('auth/email-already-in-use')).toContain('אימייל');
    });

    it('should return Hebrew message for wrong password', () => {
      expect(mapFirebaseAuthError('auth/wrong-password')).toContain('סיסמה');
    });

    it('should return default message for unknown errors', () => {
      expect(mapFirebaseAuthError('auth/unknown')).toContain('שגיאה');
    });

    it('should handle network error', () => {
      expect(mapFirebaseAuthError('auth/network-request-failed')).toContain('רשת');
    });
  });
});
