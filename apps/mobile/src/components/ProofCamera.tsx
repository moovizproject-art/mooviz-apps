/**
 * ProofCamera — מצלמת הוכחה
 * Camera component for pickup/delivery proof photos.
 * Uses react-native-vision-camera for bare RN compatibility.
 * רכיב מצלמה לצילום הוכחת איסוף/מסירה
 */
import React, { useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Modal } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  PhotoFile,
} from 'react-native-vision-camera';

import { COLORS } from '../constants/colors';

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
  const cameraRef = useRef<Camera>(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);

  /** Take a photo and store the URI for preview */
  const handleCapture = useCallback(async (): Promise<void> => {
    if (!cameraRef.current) return;

    const photo: PhotoFile = await cameraRef.current.takePhoto({
      qualityPrioritization: 'balanced',
    });

    setCapturedUri(`file://${photo.path}`);
  }, []);

  /** Confirm the captured photo and pass URI to parent */
  const handleConfirm = useCallback((): void => {
    if (capturedUri) {
      onCapture(capturedUri);
      setCapturedUri(null);
    }
  }, [capturedUri, onCapture]);

  /** Discard current photo and return to camera view */
  const handleRetake = useCallback((): void => {
    setCapturedUri(null);
  }, []);

  if (!visible) return <></>;

  // Permission not granted — show request screen
  if (!hasPermission) {
    return (
      <Modal animationType="slide" visible={visible}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>נדרשת הרשאת מצלמה</Text>
          <Text style={styles.permissionMessage}>
            יש לאשר גישה למצלמה לצורך צילום הוכחה
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>אשר גישה</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>ביטול</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  // No camera device available
  if (!device) {
    return (
      <Modal animationType="slide" visible={visible}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>מצלמה לא זמינה</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>סגור</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal animationType="slide" visible={visible}>
      <View style={styles.container}>
        {label && (
          <View style={styles.labelOverlay}>
            <Text style={styles.labelText}>{label}</Text>
          </View>
        )}

        {capturedUri ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: capturedUri }} style={styles.preview} />
            <View style={styles.previewActions}>
              <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
                <Text style={styles.retakeButtonText}>צלם שוב</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                <Text style={styles.confirmButtonText}>אשר</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <Camera
              ref={cameraRef}
              style={styles.camera}
              device={device}
              isActive={visible}
              photo={true}
            />
            <View style={styles.cameraActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>ביטול</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
              <View style={styles.spacer} />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  labelOverlay: {
    position: 'absolute', top: 60, left: 0, right: 0, zIndex: 10, alignItems: 'center',
  },
  labelText: {
    fontSize: 16, fontWeight: '700', color: '#FFF',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  cameraActions: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 32, paddingVertical: 24, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  captureButton: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
  },
  captureButtonInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFF' },
  cancelButton: { paddingVertical: 8, paddingHorizontal: 16 },
  cancelButtonText: { fontSize: 16, color: '#FFF', fontWeight: '600' },
  spacer: { width: 60 },
  previewContainer: { flex: 1 },
  preview: { flex: 1, resizeMode: 'contain' },
  previewActions: {
    flexDirection: 'row', justifyContent: 'center', gap: 16,
    paddingVertical: 24, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  retakeButton: {
    backgroundColor: COLORS.surface, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24,
  },
  retakeButtonText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  confirmButton: {
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24,
  },
  confirmButtonText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  permissionContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background, paddingHorizontal: 32,
  },
  permissionTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
  permissionMessage: {
    fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 12,
  },
  permissionButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  closeButton: { paddingVertical: 12 },
  closeButtonText: { fontSize: 15, color: COLORS.textSecondary },
});
