/**
 * Modal — חלון מודאלי
 * Bottom sheet style modal with backdrop and close button.
 * מודאל בסגנון גיליון תחתון עם רקע כהה וכפתור סגירה
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal as RNModal,
  StyleSheet,
  Pressable,
} from 'react-native';

import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, TYPOGRAPHY } from '../constants/theme';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Modal({
  visible,
  onClose,
  title,
  children,
}: ModalProps): React.JSX.Element {
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.content} onPress={() => {}}>
          <View style={styles.handle} />
          {title && (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          {children}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xxxl,
    paddingTop: SPACING.md,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.borderDark,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.text,
    flex: 1,
    textAlign: 'right',
  },
  closeButton: {
    padding: SPACING.sm,
  },
  closeText: {
    fontSize: 18,
    color: COLORS.textSecondary,
  },
});
