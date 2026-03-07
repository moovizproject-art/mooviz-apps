import React, { useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';

const carImage = require('../assets/car.png');

interface Step {
  label: string;
  done: boolean;
  active: boolean;
}

interface Props {
  currentStep: number; // 0 = email, 1 = phone, 2 = done
}

/**
 * VerificationStepper -- shows a progress bar with car icon moving between steps.
 * Steps: Email -> Phone -> Done
 */
export function VerificationStepper({ currentStep }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  const carX = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;

  const steps: Step[] = [
    { label: t('auth.email'), done: currentStep > 0, active: currentStep === 0 },
    { label: t('auth.phone'), done: currentStep > 1, active: currentStep === 1 },
    { label: t('common.done'), done: currentStep > 2, active: currentStep === 2 },
  ];

  // Animate car position based on step
  useEffect(() => {
    // Car moves from 0% to 50% to 100% of the track
    const targetPercent = currentStep >= 2 ? 1 : currentStep * 0.5;
    Animated.timing(carX, {
      toValue: targetPercent,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [currentStep, carX]);

  // Bounce animation
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -2, duration: 200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(bounce, { toValue: 0, duration: 200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [bounce]);

  return (
    <View style={styles.container}>
      {/* Step dots + labels */}
      <View style={styles.stepsRow}>
        {steps.map((step, i) => (
          <View key={i} style={styles.stepItem}>
            <View
              style={[
                styles.dot,
                { borderColor: colors.primary },
                (step.done || step.active) && { backgroundColor: colors.primary },
              ]}
            >
              {step.done && <Text style={styles.checkmark}>{'✓'}</Text>}
              {!step.done && <Text style={[styles.dotNumber, (step.active) && { color: '#FFF' }]}>{i + 1}</Text>}
            </View>
            <Text style={[styles.stepLabel, { color: step.active ? colors.primary : colors.textSecondary }]}>
              {step.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Track with car */}
      <View style={styles.trackContainer}>
        <View style={[styles.track, { backgroundColor: colors.border }]}>
          <Animated.View
            style={[
              styles.trackFill,
              {
                backgroundColor: colors.primary,
                width: carX.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Animated.View
          style={[
            styles.carWrap,
            {
              left: carX.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '85%'],
              }),
              top: bounce,
            },
          ]}
        >
          <Image source={carImage} style={styles.carImage} resizeMode="contain" />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dotNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A73E8',
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  trackContainer: {
    height: 32,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 2,
  },
  carWrap: {
    position: 'absolute',
    top: 0,
  },
  carImage: {
    width: 30,
    height: 30,
    transform: [{ scaleX: -1 }],
  },
});
