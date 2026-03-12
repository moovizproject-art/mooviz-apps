import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import { BORDER_RADIUS } from '../constants/design';
import { strings } from '../i18n/strings';

const ONBOARDING_KEY = '@driver_onboarding_done';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingStep {
  icon: string;
  title: string;
  description: string;
}

const STEPS: OnboardingStep[] = [
  {
    icon: '🟢',
    title: strings.driverOnboarding.availabilityTitle.he,
    description: strings.driverOnboarding.availabilityDesc.he,
  },
  {
    icon: '📏',
    title: strings.driver.notificationRange.he,
    description: strings.driverOnboarding.radiusDesc.he,
  },
  {
    icon: '📡',
    title: strings.driverOnboarding.radarTitle.he,
    description: strings.driverOnboarding.radarDesc.he,
  },
  {
    icon: '💰',
    title: strings.driverOnboarding.earningsTitle.he,
    description: strings.driverOnboarding.paymentDesc.he,
  },
  {
    icon: '💳',
    title: strings.driverOnboarding.directPaymentTitle.he,
    description: strings.driverOnboarding.paymentDesc.he,
  },
  {
    icon: '⚙️',
    title: strings.driverOnboarding.advancedSettingsTitle.he,
    description: strings.driverOnboarding.preferencesDesc.he,
  },
];

interface Props {
  visible: boolean;
  onDone: () => void;
}

export function DriverOnboarding({ visible, onDone }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const [step, setStep] = useState(0);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleNext = useCallback(() => {
    if (isLast) {
      AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      onDone();
    } else {
      setStep((s) => s + 1);
    }
  }, [isLast, onDone]);

  const handleSkip = useCallback(() => {
    AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    onDone();
  }, [onDone]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.bubble, { backgroundColor: 'rgba(0,0,0,0.75)' }]}>
          {/* Step indicator */}
          <View style={styles.dotsRow}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === step ? '#FFFFFF' : 'rgba(255,255,255,0.3)' },
                ]}
              />
            ))}
          </View>

          <Text style={styles.icon}>{current.icon}</Text>
          <Text style={[styles.title, { color: '#FFFFFF' }]}>{current.title}</Text>
          <Text style={[styles.description, { color: '#FFFFFF' }]}>{current.description}</Text>

          <View style={styles.actions}>
            {!isLast && (
              <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
                <Text style={[styles.skipText, { color: 'rgba(255,255,255,0.6)' }]}>{strings.onboarding.skip.he}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleNext}
              style={[styles.nextBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.nextText}>{isLast ? strings.onboarding.getStarted.he : strings.onboarding.next.he}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export async function shouldShowOnboarding(): Promise<boolean> {
  const done = await AsyncStorage.getItem(ONBOARDING_KEY);
  return done !== 'true';
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  bubble: {
    width: SCREEN_WIDTH - 56,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  nextBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  nextText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
