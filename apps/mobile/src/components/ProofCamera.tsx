/**
 * ProofCamera — Camera component for pickup/delivery proof photos.
 * Uses react-native-image-picker (no vision-camera dependency).
 */
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Modal } from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';

interface ProofCameraProps {
  visible: boolean;
  onCapture: (photoUri: string) => void;
  onClose: () => void;
  label?: string;
}

export function ProofCamera({
  visible,
  onCapture,
  onClose,
  label,
}: ProofCameraProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [capturedUri, setCapturedUri] = useState<string | null>(null);

  const handleLaunchCamera = useCallback(async (): Promise<void> => {
    const result = await launchCamera({
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1024,
      maxHeight: 1024,
      saveToPhotos: false,
    });

    if (result.didCancel || !result.assets?.[0]?.uri) {
      if (!capturedUri) onClose();
      return;
    }
    setCapturedUri(result.assets[0].uri);
  }, [capturedUri, onClose]);

  const handleConfirm = useCallback((): void => {
    if (capturedUri) {
      onCapture(capturedUri);
      setCapturedUri(null);
    }
  }, [capturedUri, onCapture]);

  const handleRetake = useCallback((): void => {
    setCapturedUri(null);
    handleLaunchCamera();
  }, [handleLaunchCamera]);

  // Auto-launch camera when modal opens
  React.useEffect(() => {
    if (visible && !capturedUri) {
      handleLaunchCamera();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return <></>;

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {label && (
          <View style={styles.labelOverlay}>
            <Text style={[styles.labelText, { color: colors.textPrimary }]}>{label}</Text>
          </View>
        )}

        {capturedUri ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: capturedUri }} style={styles.preview} />
            <View style={[styles.previewActions, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.surface }]}
                onPress={handleRetake}
              >
                <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>
                  {t('common.retake')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={handleConfirm}
              >
                <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
                  {t('common.confirm')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={handleLaunchCamera}
            >
              <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
                {t('common.takePhoto')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelLink} onPress={onClose}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  labelOverlay: {
    paddingTop: 60, paddingBottom: 16, alignItems: 'center',
  },
  labelText: {
    fontSize: 16, fontWeight: '700',
  },
  previewContainer: { flex: 1 },
  preview: { flex: 1, resizeMode: 'contain' },
  previewActions: {
    flexDirection: 'row', justifyContent: 'center', gap: 16,
    paddingVertical: 24,
  },
  actionButton: {
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24,
  },
  actionButtonText: { fontSize: 16, fontWeight: '700' },
  emptyState: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16,
  },
  cancelLink: { paddingVertical: 12 },
  cancelText: { fontSize: 15 },
});
