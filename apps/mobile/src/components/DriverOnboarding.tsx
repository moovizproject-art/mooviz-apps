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
import { SPACING, BORDER_RADIUS } from '../constants/design';

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
    title: 'זמינות',
    description: 'הפעל את מצב הזמינות כדי להתחיל לקבל הזמנות משלוח באזור שלך.',
  },
  {
    icon: '📏',
    title: 'טווח התראות',
    description: 'הגדר את הרדיוס בק"מ כדי לראות משלוחים שמתאימים לאזור שלך.',
  },
  {
    icon: '📡',
    title: 'רדאר',
    description: 'הרדאר סורק משלוחים זמינים בסביבתך בזמן אמת.',
  },
  {
    icon: '💰',
    title: 'הכנסות',
    description: 'עקוב אחרי ההכנסות שלך — לפי שבוע, חודש ושנה.',
  },
  {
    icon: '⚙️',
    title: 'הגדרות מתקדמות',
    description: 'התאם סוג רכב, גדלי משלוחים, כתובות מועדפות וזמני עבודה.',
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
        <View style={[styles.bubble, { backgroundColor: colors.surface }]}>
          {/* Step indicator */}
          <View style={styles.dotsRow}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === step ? colors.primary : colors.border },
                ]}
              />
            ))}
          </View>

          <Text style={styles.icon}>{current.icon}</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{current.title}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{current.description}</Text>

          <View style={styles.actions}>
            {!isLast && (
              <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
                <Text style={[styles.skipText, { color: colors.textTertiary }]}>דלג</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleNext}
              style={[styles.nextBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.nextText}>{isLast ? 'בוא נתחיל' : 'הבא'}</Text>
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
