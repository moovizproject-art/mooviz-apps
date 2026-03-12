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

const ONBOARDING_KEY = '@sender_onboarding_done';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingStep {
  icon: string;
  title: string;
  description: string;
}

const STEPS: OnboardingStep[] = [
  {
    icon: '📦',
    title: strings.senderOnboarding.postDeliveryTitle.he,
    description: strings.senderOnboarding.postDeliveryDesc.he,
  },
  {
    icon: '💰',
    title: strings.senderOnboarding.priceSuggestionTitle.he,
    description: strings.senderOnboarding.priceDesc.he,
  },
  {
    icon: '🚛',
    title: strings.senderOnboarding.chooseDriverTitle.he,
    description: strings.senderOnboarding.approvalDesc.he,
  },
  {
    icon: '💬',
    title: strings.senderOnboarding.chatAndTrackTitle.he,
    description: strings.senderOnboarding.chatTrackDesc.he,
  },
  {
    icon: '💳',
    title: strings.driverOnboarding.directPaymentTitle.he,
    description: strings.driverOnboarding.paymentDesc.he,
  },
  {
    icon: '⭐',
    title: strings.profile.rating.he,
    description: strings.senderOnboarding.ratingDesc.he,
  },
];

interface Props {
  visible: boolean;
  onDone: () => void;
}

export function SenderOnboarding({ visible, onDone }: Props): React.JSX.Element {
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

export async function shouldShowSenderOnboarding(): Promise<boolean> {
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
