import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import firestore from '@react-native-firebase/firestore';

import { COLORS } from '../../constants/colors';
import { uploadImage } from '../../services/storage';
import { useAuth } from '../../hooks/useAuth';
import type { KycStatus } from '../../types';

/**
 * DriverKYCScreen -- upload driver license and ID for KYC verification
 */
export function DriverKYCScreen(): React.JSX.Element {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid || '';

  const [licenseUri, setLicenseUri] = useState<string | null>(null);
  const [idUri, setIdUri] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [kycStatus, setKycStatus] = useState<KycStatus>(currentUser?.kycStatus || 'pending');

  const pickImage = async (setter: (uri: string | null) => void): Promise<void> => {
    const result: ImagePickerResponse = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1920,
      maxHeight: 1920,
    });

    if (!result.didCancel && result.assets && result.assets[0]?.uri) {
      setter(result.assets[0].uri);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!licenseUri) {
      Alert.alert('שגיאה', 'יש להעלות תמונת רישיון נהיגה');
      return;
    }
    if (!idUri) {
      Alert.alert('שגיאה', 'יש להעלות תמונת תעודת זהות');
      return;
    }
    if (!acceptedTerms) {
      Alert.alert('שגיאה', 'יש לאשר את תנאי השימוש לנהגים');
      return;
    }
    if (!uid) {
      Alert.alert('שגיאה', 'לא מחובר. נא להתחבר מחדש.');
      return;
    }

    try {
      setIsUploading(true);

      // Upload license and ID photos
      const licensePath = `kyc/${uid}/license.jpg`;
      const idPath = `kyc/${uid}/id.jpg`;

      const [licenseUrl, idUrl] = await Promise.all([
        uploadImage(licenseUri, licensePath),
        uploadImage(idUri, idPath),
      ]);

      // Update Firestore user document
      await firestore().collection('users').doc(uid).update({
        kycDocumentURL: licenseUrl,
        kycStatus: 'pending',
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

      setKycStatus('pending');
      Alert.alert('הצלחה', 'המסמכים הועלו בהצלחה. הבקשה בבדיקה.');
    } catch (error) {
      console.error('[DriverKYCScreen] Upload error:', error);
      Alert.alert('שגיאה', 'שגיאה בהעלאת המסמכים. נסה שוב.');
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusDisplay = (): { text: string; color: string } => {
    switch (kycStatus) {
      case 'approved':
        return { text: 'מאושר', color: COLORS.success };
      case 'rejected':
        return { text: 'נדחה - יש להעלות מסמכים חדשים', color: COLORS.error };
      case 'pending':
      default:
        return { text: 'ממתין לאישור', color: COLORS.warning };
    }
  };

  const statusDisplay = getStatusDisplay();
  const canSubmit = kycStatus === 'pending' || kycStatus === 'rejected';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>אימות נהג (KYC)</Text>
      <Text style={styles.subtitle}>
        העלה את המסמכים הנדרשים לאישור כנהג במערכת
      </Text>

      {/* Current status */}
      <View style={styles.statusSection}>
        <Text style={styles.statusLabel}>סטטוס:</Text>
        <Text style={[styles.statusValue, { color: statusDisplay.color }]}>
          {statusDisplay.text}
        </Text>
      </View>

      {canSubmit && (
        <>
          {/* Driver license upload */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>רישיון נהיגה</Text>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => pickImage(setLicenseUri)}
              disabled={isUploading}
            >
              <Text style={licenseUri ? styles.uploadButtonTextDone : styles.uploadButtonText}>
                {licenseUri ? 'רישיון נהיגה נבחר' : 'בחר תמונת רישיון נהיגה'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ID document upload */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>תעודת זהות</Text>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => pickImage(setIdUri)}
              disabled={isUploading}
            >
              <Text style={idUri ? styles.uploadButtonTextDone : styles.uploadButtonText}>
                {idUri ? 'תעודת זהות נבחרה' : 'בחר תמונת תעודת זהות'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Terms checkbox */}
          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => setAcceptedTerms(!acceptedTerms)}
            disabled={isUploading}
          >
            <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
              {acceptedTerms && <Text style={styles.checkmark}>V</Text>}
            </View>
            <Text style={styles.termsText}>
              אני מאשר/ת את תנאי השימוש לנהגים ומתחייב/ת לעמוד בדרישות הבטיחות
            </Text>
          </TouchableOpacity>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, isUploading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>שלח לאישור</Text>
            )}
          </TouchableOpacity>
        </>
      )}

      {kycStatus === 'approved' && (
        <View style={styles.approvedSection}>
          <Text style={styles.approvedText}>
            החשבון שלך אושר כנהג. אתה יכול להתחיל לקבל משלוחים!
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 24,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  statusSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'right',
  },
  uploadButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    borderStyle: 'dashed',
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  uploadButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  uploadButtonTextDone: {
    fontSize: 14,
    color: COLORS.success,
    fontWeight: '600',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'right',
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  approvedSection: {
    padding: 16,
    backgroundColor: COLORS.successBg,
    borderRadius: 12,
    marginTop: 16,
  },
  approvedText: {
    fontSize: 15,
    color: COLORS.success,
    textAlign: 'center',
    fontWeight: '600',
  },
});
