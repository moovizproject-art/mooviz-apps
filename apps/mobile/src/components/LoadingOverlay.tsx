/**
 * LoadingOverlay — Full-screen branded overlay for async operations.
 * Shows an animated car emoji, multi-step progress dots, and a 60s timeout.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';
import { BORDER_RADIUS, SPACING, TYPOGRAPHY } from '../theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface LoadingOverlayProps {
  visible: boolean;
  steps: string[];       // keys matching loading.* i18n section
  currentStep: number;   // index into steps array
  timeout?: number;      // ms, default 60000
  onTimeout?: () => void;
  onCancel?: () => void;
}

export function LoadingOverlay({
  visible,
  steps,
  currentStep,
  timeout = 60000,
  onTimeout,
  onCancel,
}: LoadingOverlayProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();

  const [timedOut, setTimedOut] = useState(false);

  // Car translate animation
  const carAnim = useRef(new Animated.Value(-120)).current;
  const carLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Pulse animation for current step dot
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  // Timeout timer ref
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Timeout management ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      setTimedOut(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    setTimedOut(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setTimedOut(true);
      onTimeout?.();
    }, timeout);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [visible, timeout, onTimeout]);

  // ── Car animation ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || timedOut) {
      carLoopRef.current?.stop();
      carAnim.setValue(-120);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(carAnim, {
          toValue: 120,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(carAnim, {
          toValue: -120,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    carLoopRef.current = loop;
    loop.start();

    return () => {
      loop.stop();
    };
  }, [visible, timedOut, carAnim]);

  // ── Pulse animation ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || timedOut) {
      pulseLoopRef.current?.stop();
      pulseAnim.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoopRef.current = loop;
    loop.start();

    return () => {
      loop.stop();
    };
  }, [visible, timedOut, pulseAnim]);

  // ── Android back button block ────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [visible]);

  // ── Render ───────────────────────────────────────────────────────────────────
  const safeCurrent = Math.min(Math.max(currentStep, 0), steps.length - 1);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {timedOut ? (
            // ── Timeout state ─────────────────────────────────────────────────
            <>
              <Text style={styles.mainEmoji}>⚠️</Text>
              <Text style={[styles.timeoutTitle, { color: colors.textPrimary }]}>
                {t('loading.timeout')}
              </Text>
              <Text style={[styles.timeoutMessage, { color: colors.textSecondary }]}>
                {t('loading.timeoutMessage')}
              </Text>
              {onCancel ? (
                <TouchableOpacity
                  style={[styles.retryButton, { backgroundColor: colors.primary }]}
                  onPress={onCancel}
                  activeOpacity={0.8}
                >
                  <Text style={styles.retryText}>{t('loading.timeoutRetry')}</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            // ── Loading state ─────────────────────────────────────────────────
            <>
              {/* Car animation track */}
              <View style={styles.carTrack}>
                <Animated.Text
                  style={[styles.carEmoji, { transform: [{ translateX: carAnim }] }]}
                >
                  🚗
                </Animated.Text>
              </View>

              {/* Current step label */}
              <Text style={[styles.stepLabel, { color: colors.textPrimary }]}>
                {steps.length > 0 ? t(`loading.${steps[safeCurrent]}`) : t('common.loading')}
              </Text>

              {/* Progress dots */}
              {steps.length > 1 ? (
                <View style={styles.dotsRow}>
                  {steps.map((_, idx) => {
                    if (idx < safeCurrent) {
                      // Done — filled green
                      return (
                        <View
                          key={idx}
                          style={[styles.dot, { backgroundColor: colors.success }]}
                        />
                      );
                    }
                    if (idx === safeCurrent) {
                      // Current — pulsing primary
                      return (
                        <Animated.View
                          key={idx}
                          style={[
                            styles.dot,
                            styles.dotCurrent,
                            {
                              backgroundColor: colors.primary,
                              transform: [{ scale: pulseAnim }],
                            },
                          ]}
                        />
                      );
                    }
                    // Upcoming — gray
                    return (
                      <View
                        key={idx}
                        style={[styles.dot, { backgroundColor: colors.borderDark }]}
                      />
                    );
                  })}
                </View>
              ) : null}

              {/* Subtle subtext */}
              <Text style={[styles.subtext, { color: colors.textTertiary }]}>
                {t('common.loading')}
              </Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxxl,
  },
  card: {
    width: SCREEN_WIDTH - SPACING.xxxl * 2,
    borderRadius: BORDER_RADIUS.xl,
    paddingVertical: SPACING.xxxl,
    paddingHorizontal: SPACING.xxl,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: { elevation: 14 },
    }),
  },

  // ── Loading state ────────────────────────────────────────────────────────────
  carTrack: {
    width: '100%',
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  carEmoji: {
    fontSize: 36,
  },
  stepLabel: {
    ...TYPOGRAPHY.bodyBold,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: BORDER_RADIUS.full,
  },
  dotCurrent: {
    width: 12,
    height: 12,
  },
  subtext: {
    ...TYPOGRAPHY.caption,
    textAlign: 'center',
  },

  // ── Timeout state ─────────────────────────────────────────────────────────────
  mainEmoji: {
    fontSize: 48,
    marginBottom: SPACING.lg,
  },
  timeoutTitle: {
    ...TYPOGRAPHY.h3,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  timeoutMessage: {
    ...TYPOGRAPHY.bodySmall,
    textAlign: 'center',
    marginBottom: SPACING.xxl,
  },
  retryButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xxxl,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  retryText: {
    ...TYPOGRAPHY.button,
    color: '#FFFFFF',
  },
});
