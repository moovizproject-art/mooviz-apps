/**
 * AppAlert — התראה מותאמת אישית עם אייקון
 * Custom modal alert with icon, title, message, and action buttons.
 * Replaces native Alert.alert for branded UX.
 */
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { BORDER_RADIUS } from '../constants/design';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface AppAlertProps {
  visible: boolean;
  icon?: string;
  title: string;
  message: string;
  buttons?: AlertButton[];
  onDismiss: () => void;
}

export function AppAlert({
  visible,
  icon = '🚛',
  title,
  message,
  buttons = [{ text: 'אישור', style: 'default' }],
  onDismiss,
}: AppAlertProps): React.JSX.Element {
  const { colors } = useTheme();

  const getButtonStyle = (style?: string) => {
    switch (style) {
      case 'destructive': return { backgroundColor: '#E53935' };
      case 'cancel': return { backgroundColor: colors.border };
      default: return { backgroundColor: colors.primary };
    }
  };

  const getButtonTextColor = (style?: string) => {
    switch (style) {
      case 'cancel': return colors.textPrimary;
      default: return '#FFFFFF';
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={styles.icon}>{icon}</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>

          <View style={styles.actions}>
            {buttons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.button,
                  getButtonStyle(btn.style),
                  buttons.length > 1 && { flex: 1 },
                ]}
                onPress={() => {
                  onDismiss();
                  btn.onPress?.();
                }}
              >
                <Text style={[styles.buttonText, { color: getButtonTextColor(btn.style) }]}>
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: SCREEN_WIDTH - 64,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  button: {
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    minWidth: 100,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
