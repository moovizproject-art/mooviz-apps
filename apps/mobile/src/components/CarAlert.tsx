import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Easing,
  Image,
  Dimensions,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';

const carImage = require('../assets/car.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type CarAlertType = 'success' | 'error' | 'info';

interface CarAlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface CarAlertProps {
  visible: boolean;
  type: CarAlertType;
  title: string;
  message: string;
  buttons?: CarAlertButton[];
  onDismiss: () => void;
}

/**
 * CarAlert — themed modal alert with car animation.
 * Success: car drives across happily.
 * Error: car hits a stop sign and bounces back.
 * Info: car idles with gentle bounce.
 */
export function CarAlert({ visible, type, title, message, buttons, onDismiss }: CarAlertProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const carX = useRef(new Animated.Value(40)).current; // start just off right edge
  const carBounce = useRef(new Animated.Value(0)).current;
  const carRotate = useRef(new Animated.Value(0)).current;
  const stopSignScale = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const resetAnimations = useCallback(() => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.8);
    carX.setValue(40);
    carBounce.setValue(0);
    carRotate.setValue(0);
    stopSignScale.setValue(0);
    shakeAnim.setValue(0);
  }, [fadeAnim, scaleAnim, carX, carBounce, carRotate, stopSignScale, shakeAnim]);

  useEffect(() => {
    if (!visible) {
      resetAnimations();
      return;
    }

    // Modal entrance
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }),
    ]).start();

    // Car animation based on type
    if (type === 'success') {
      // Car drives right-to-left across the scene
      Animated.sequence([
        Animated.delay(300),
        Animated.parallel([
          Animated.timing(carX, {
            toValue: -(SCREEN_WIDTH * 0.85),
            duration: 2500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          // Happy bounce while driving
          Animated.loop(
            Animated.sequence([
              Animated.timing(carBounce, { toValue: -4, duration: 150, useNativeDriver: true }),
              Animated.timing(carBounce, { toValue: 0, duration: 150, useNativeDriver: true }),
            ]),
            { iterations: 8 },
          ),
        ]),
      ]).start();
    } else if (type === 'error') {
      // Car drives then hits stop sign
      Animated.sequence([
        Animated.delay(300),
        // Drive forward (right to left)
        Animated.timing(carX, {
          toValue: -(SCREEN_WIDTH * 0.45),
          duration: 1200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        // Stop sign appears
        Animated.spring(stopSignScale, {
          toValue: 1,
          friction: 4,
          tension: 200,
          useNativeDriver: true,
        }),
        // Car bounces back + shakes
        Animated.parallel([
          Animated.timing(carX, {
            toValue: -(SCREEN_WIDTH * 0.35),
            duration: 200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(carRotate, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          // Shake the whole card
          Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -5, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 4, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -3, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
          ]),
        ]),
        // Car settles
        Animated.timing(carRotate, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Info: gentle idle — drive right-to-left to center then bounce
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(carX, {
          toValue: -(SCREEN_WIDTH * 0.45),
          duration: 1800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(carBounce, { toValue: -3, duration: 400, useNativeDriver: true }),
          Animated.timing(carBounce, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      ).start();
    }
  }, [visible, type, fadeAnim, scaleAnim, carX, carBounce, carRotate, stopSignScale, shakeAnim, resetAnimations]);

  const defaultButtons: CarAlertButton[] = buttons || [
    { text: t('common.confirm'), onPress: onDismiss },
  ];

  const accentColor = type === 'success' ? '#34A853' : type === 'error' ? '#EA4335' : colors.primary;
  const iconEmoji = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';

  const carRotateInterpolate = carRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-8deg'],
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.background,
              transform: [
                { scale: scaleAnim },
                { translateX: shakeAnim },
              ],
            },
          ]}
        >
          {/* Colored top strip */}
          <View style={[styles.topStrip, { backgroundColor: accentColor }]}>
            {/* Icon circle */}
            <View style={[styles.iconCircle, { backgroundColor: '#FFFFFF' }]}>
              <Text style={[styles.iconText, { color: accentColor }]}>{iconEmoji}</Text>
            </View>
          </View>

          {/* Car animation scene */}
          <View style={styles.carScene}>
            {/* Road line */}
            <View style={[styles.road, { backgroundColor: colors.border }]} />

            {/* Stop sign (error only) */}
            {type === 'error' && (
              <Animated.View
                style={[
                  styles.stopSign,
                  { transform: [{ scale: stopSignScale }] },
                ]}
              >
                <View style={styles.stopSignPost} />
                <View style={styles.stopSignHead}>
                  <Text style={styles.stopSignText}>{'🛑'}</Text>
                </View>
              </Animated.View>
            )}

            {/* Car */}
            <Animated.View
              style={[
                styles.carWrap,
                {
                  transform: [
                    { translateX: carX },
                    { translateY: carBounce },
                    { rotate: carRotateInterpolate },
                  ],
                },
              ]}
            >
              <Image source={carImage} style={styles.carImage} resizeMode="contain" />
            </Animated.View>

            {/* Success dust trail */}
            {type === 'success' && (
              <Animated.View style={[styles.dustTrail, { opacity: fadeAnim }]}>
                <Text style={styles.dustText}>{'💨'}</Text>
              </Animated.View>
            )}
          </View>

          {/* Text content */}
          <View style={styles.textSection}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            {defaultButtons.map((btn, i) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.button,
                    isCancel
                      ? { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }
                      : { backgroundColor: isDestructive ? colors.error : accentColor },
                    defaultButtons.length === 1 && { flex: 1 },
                  ]}
                  onPress={() => {
                    btn.onPress?.();
                    onDismiss();
                  }}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isCancel ? { color: colors.textSecondary } : { color: '#FFFFFF' },
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Hook for easy usage ──

interface CarAlertState {
  visible: boolean;
  type: CarAlertType;
  title: string;
  message: string;
  buttons?: CarAlertButton[];
}

export function useCarAlert() {
  const [state, setState] = React.useState<CarAlertState>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const show = useCallback(
    (type: CarAlertType, title: string, message: string, buttons?: CarAlertButton[]) => {
      setState({ visible: true, type, title, message, buttons });
    },
    [],
  );

  const dismiss = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  return { ...state, show, dismiss };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  topStrip: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 0,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: -26,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  iconText: {
    fontSize: 24,
    fontWeight: '900',
  },
  carScene: {
    height: 60,
    marginTop: 32,
    marginHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  road: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },
  carWrap: {
    position: 'absolute',
    bottom: 10,
  },
  carImage: {
    width: 40,
    height: 40,
    transform: [{ scaleX: -1 }],
  },
  stopSign: {
    position: 'absolute',
    bottom: 6,
    right: '35%',
    alignItems: 'center',
  },
  stopSignPost: {
    width: 3,
    height: 14,
    backgroundColor: '#666',
    borderRadius: 1,
  },
  stopSignHead: {
    position: 'absolute',
    top: -18,
  },
  stopSignText: {
    fontSize: 22,
  },
  dustTrail: {
    position: 'absolute',
    bottom: 12,
    left: 4,
  },
  dustText: {
    fontSize: 16,
    transform: [{ scaleX: -1 }],
  },
  textSection: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
