import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  StatusBar,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary, launchCamera, ImagePickerResponse } from 'react-native-image-picker';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { uploadImage } from '../../services/storage';
import { useAuth } from '../../hooks/useAuth';
import { requestCameraPermission } from '../../utils/permissions';
import { SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../../theme/tokens';
import { CarAlert, useCarAlert } from '../../components/CarAlert';
import { IMAGE_MAX_SIZE } from '../../constants/config';
import type { KycStatus } from '../../types';

const logo = require('../../assets/logo.png');

export function DriverKYCScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { currentUser } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const carAlert = useCarAlert();
  const uid = currentUser?.uid || '';

  const [licenseUri, setLicenseUri] = useState<string | null>(null);
  const [idUri, setIdUri] = useState<string | null>(null);
  const [remoteLicenseUrl, setRemoteLicenseUrl] = useState<string | null>(null);
  const [remoteIdUrl, setRemoteIdUrl] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(currentUser?.kycStatus === 'pending');
  const [isUploading, setIsUploading] = useState(false);
  const [kycStatus, setKycStatus] = useState<KycStatus>(currentUser?.kycStatus || 'pending');

  // Load previously uploaded KYC images from Storage
  useEffect(() => {
    if (!uid) return;
    const loadExisting = async () => {
      try {
        const licUrl = await storage().ref(`kyc/${uid}/license.jpg`).getDownloadURL();
        setRemoteLicenseUrl(licUrl);
      } catch {
        // No license uploaded yet
      }
      try {
        const idUrl = await storage().ref(`kyc/${uid}/id.jpg`).getDownloadURL();
        setRemoteIdUrl(idUrl);
      } catch {
        // No ID uploaded yet
      }
    };
    loadExisting();
  }, [uid]);

  const pickImage = (setter: (uri: string | null) => void): void => {
    const imageOpts = { mediaType: 'photo' as const, quality: 0.8 as const, maxWidth: 1920, maxHeight: 1920 };

    const handleResult = (result: ImagePickerResponse): void => {
      if (result.didCancel) return;
      if (result.errorCode) {
        const msg = result.errorCode === 'camera_unavailable'
          ? t('kyc.errorCameraUnavailable')
          : result.errorCode === 'permission'
            ? t('kyc.errorCameraPermission')
            : result.errorMessage || t('kyc.errorImagePicker');
        carAlert.show('error', t('common.error'), msg);
        return;
      }
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      // Client-side size check before attempting upload
      if (asset.fileSize && asset.fileSize > IMAGE_MAX_SIZE) {
        carAlert.show('error', t('common.error'), t('kyc.errorFileTooLarge'));
        return;
      }
      setter(asset.uri);
    };

    Alert.alert(t('common.selectImageSource'), '', [
      {
        text: t('common.takePhoto'),
        onPress: async () => {
          const hasPermission = await requestCameraPermission();
          if (!hasPermission) {
            carAlert.show('error', t('common.error'), t('kyc.errorCameraPermission'));
            return;
          }
          try {
            const result: ImagePickerResponse = await launchCamera(imageOpts);
            handleResult(result);
          } catch (err: any) {
            carAlert.show('error', t('common.error'), err.message || t('kyc.errorImagePicker'));
          }
        },
      },
      {
        text: t('common.chooseFromGallery'),
        onPress: async () => {
          try {
            const result: ImagePickerResponse = await launchImageLibrary(imageOpts);
            handleResult(result);
          } catch (err: any) {
            carAlert.show('error', t('common.error'), err.message || t('kyc.errorImagePicker'));
          }
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const handleSubmit = async (): Promise<void> => {
    const hasLicense = licenseUri || remoteLicenseUrl;
    const hasId = idUri || remoteIdUrl;

    if (!hasLicense) {
      carAlert.show('error', t('common.error'), t('kyc.errorLicense'));
      return;
    }
    if (!hasId) {
      carAlert.show('error', t('common.error'), t('kyc.errorId'));
      return;
    }
    if (!acceptedTerms) {
      carAlert.show('error', t('common.error'), t('kyc.errorTerms'));
      return;
    }
    if (!uid) {
      carAlert.show('error', t('common.error'), t('common.error'));
      return;
    }

    try {
      setIsUploading(true);
      // Only upload new images if user picked new ones
      const uploads: Promise<string>[] = [];
      if (licenseUri) uploads.push(uploadImage(licenseUri, `kyc/${uid}/license.jpg`));
      if (idUri) uploads.push(uploadImage(idUri, `kyc/${uid}/id.jpg`));

      const results = await Promise.all(uploads);
      // Determine final URLs: use newly uploaded or keep existing remote URLs
      let resultIdx = 0;
      const licenseUrl = licenseUri ? results[resultIdx++] : remoteLicenseUrl;
      const idUrl = idUri ? results[resultIdx++] : remoteIdUrl;

      await firestore().collection('users').doc(uid).update({
        kycDocumentURL: licenseUrl,
        kycIdURL: idUrl,
        kycStatus: 'pending',
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

      setKycStatus('pending');
      // Update remote URLs with newly uploaded ones
      if (licenseUri) setRemoteLicenseUrl(results[0]);
      if (idUri) setRemoteIdUrl(licenseUri ? results[1] : results[0]);
      setLicenseUri(null);
      setIdUri(null);
      carAlert.show('success', t('common.success'), t('kyc.uploadSuccess'));
    } catch (error: any) {
      console.error('[DriverKYCScreen] Upload error:', error);
      // Show specific error based on Firebase Storage error codes
      let msg = t('kyc.uploadError');
      const code = error?.code || '';
      if (code === 'storage/unauthorized' || code === 'storage/unauthenticated') {
        msg = t('kyc.errorPermissionDenied');
      } else if (code === 'storage/retry-limit-exceeded' || code === 'storage/canceled') {
        msg = t('kyc.errorNetworkUpload');
      } else if (code === 'storage/quota-exceeded') {
        msg = t('kyc.errorStorageFull');
      } else if (error?.message) {
        msg = error.message;
      }
      carAlert.show('error', t('common.error'), msg);
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusDisplay = (): { text: string; color: string } => {
    switch (kycStatus) {
      case 'approved':
        return { text: t('kyc.approved'), color: colors.success };
      case 'rejected':
        return { text: t('kyc.rejected'), color: colors.error };
      case 'pending':
      default:
        return { text: t('kyc.pending'), color: colors.warning };
    }
  };

  const statusDisplay = getStatusDisplay();
  const hasExistingDocs = !!(remoteLicenseUrl || remoteIdUrl);
  const isPendingWithDocs = kycStatus === 'pending' && hasExistingDocs;
  const isFormLocked = !!(isPendingWithDocs && !licenseUri && !idUri); // Lock when pending, unless user picked new images

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        {/* ── Blue Header ── */}
        <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
          <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />

          <View style={styles.headerTopRow}>
            <View style={styles.logoCircle}>
              <Image source={logo} style={[styles.logoImage, { tintColor: '#FFFFFF' }]} resizeMode="contain" />
            </View>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <View style={styles.backChevron} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.headerTitle, { color: colors.headerText }]}>
            {t('kyc.title')}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.headerTextSecondary }]}>
            {t('kyc.subtitle')}
          </Text>
        </View>

        {/* Status */}
        <View style={[styles.statusSection, { backgroundColor: colors.surface, borderColor: colors.border, marginHorizontal: SPACING.xxl, marginTop: 20 }]}>
          <Text style={[styles.statusLabel, { color: colors.textPrimary }]}>
            {t('kyc.status')}:
          </Text>
          <Text style={[styles.statusValue, { color: statusDisplay.color }]}>
            {statusDisplay.text}
          </Text>
        </View>

        {kycStatus !== 'approved' && (
          <View style={styles.formSection}>
            {/* License */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>
                  {t('kyc.license')}
                </Text>
                <Text style={[styles.required, { color: colors.textSecondary }]}>
                  {t('form.required')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.uploadButton, { borderColor: colors.border, backgroundColor: colors.inputBg }, isFormLocked && { opacity: 0.7 }]}
                onPress={() => pickImage(setLicenseUri)}
                disabled={isUploading || isFormLocked}
              >
                {licenseUri || remoteLicenseUrl ? (
                  <Image
                    source={{ uri: licenseUri || remoteLicenseUrl! }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={{ fontSize: 28, marginBottom: SPACING.sm }}>📄</Text>
                )}
                <Text style={[
                  styles.uploadText,
                  { color: (licenseUri || remoteLicenseUrl) ? colors.success : colors.primary },
                ]}>
                  {(licenseUri || remoteLicenseUrl) ? t('kyc.licenseSelected') : t('kyc.selectLicense')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ID */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>
                  {t('kyc.idCard')}
                </Text>
                <Text style={[styles.required, { color: colors.textSecondary }]}>
                  {t('form.required')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.uploadButton, { borderColor: colors.border, backgroundColor: colors.inputBg }, isFormLocked && { opacity: 0.7 }]}
                onPress={() => pickImage(setIdUri)}
                disabled={isUploading || isFormLocked}
              >
                {idUri || remoteIdUrl ? (
                  <Image
                    source={{ uri: idUri || remoteIdUrl! }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={{ fontSize: 28, marginBottom: SPACING.sm }}>🪪</Text>
                )}
                <Text style={[
                  styles.uploadText,
                  { color: (idUri || remoteIdUrl) ? colors.success : colors.primary },
                ]}>
                  {(idUri || remoteIdUrl) ? t('kyc.idSelected') : t('kyc.selectId')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Terms */}
            <TouchableOpacity
              style={[styles.termsRow, isFormLocked && { opacity: 0.6 }]}
              onPress={() => !isFormLocked && setAcceptedTerms(!acceptedTerms)}
              disabled={isUploading || isFormLocked}
            >
              <View style={[
                styles.checkbox,
                { borderColor: colors.border, backgroundColor: colors.inputBg },
                acceptedTerms && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}>
                {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.termsText, { color: colors.textPrimary }]}>
                {t('auth.acceptTerms')}{' '}
                <Text
                  style={{ color: colors.primary, fontWeight: '700' }}
                  onPress={() => Linking.openURL('https://mooviz-app-9b766.web.app/terms')}
                >
                  {t('terms.termsOfService')}
                </Text>
                {' '}{t('common.and')}{' '}
                <Text
                  style={{ color: colors.primary, fontWeight: '700' }}
                  onPress={() => Linking.openURL('https://mooviz-app-9b766.web.app/privacy')}
                >
                  {t('terms.privacyPolicy')}
                </Text>
              </Text>
            </TouchableOpacity>

            {/* Submit / Update */}
            {(licenseUri || idUri || !hasExistingDocs) && (
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: colors.primary },
                  (isUploading || !acceptedTerms) && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={isUploading || !acceptedTerms}
              >
                {isUploading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.submitButtonText, { color: colors.textInverse }]}>
                    {hasExistingDocs ? t('kyc.updateDocuments') : t('kyc.submitForApproval')}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {kycStatus === 'approved' && (
          <View style={[styles.approvedSection, { backgroundColor: colors.successBg }]}>
            <Text style={[styles.approvedText, { color: colors.success }]}>
              {t('kyc.approvedMessage')}
            </Text>
          </View>
        )}
      </ScrollView>
      <CarAlert visible={carAlert.visible} type={carAlert.type} title={carAlert.title} message={carAlert.message} buttons={carAlert.buttons} onDismiss={carAlert.dismiss} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 48,
  },
  // ── Blue Header ──
  header: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
    borderBottomLeftRadius: BORDER_RADIUS.xxl,
    borderBottomRightRadius: BORDER_RADIUS.xxl,
    alignItems: 'center',
    ...SHADOWS.lg,
  },
  headerTopRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  logoCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 160,
    height: 70,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: {
    width: 11,
    height: 11,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '-45deg' }],
    marginRight: -3,
  },
  headerTitle: {
    fontSize: 25,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  headerSubtitle: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  formSection: {
    paddingHorizontal: SPACING.xxl,
  },
  statusSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xxl,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    ...SHADOWS.sm,
  },
  statusLabel: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '600',
  },
  statusValue: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '700',
  },
  fieldGroup: {
    marginBottom: SPACING.lg,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  label: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 15,
    fontWeight: '700',
  },
  required: {
    ...TYPOGRAPHY.caption,
  },
  uploadButton: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    borderStyle: 'dashed',
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '600',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
    ...TYPOGRAPHY.bodySmall,
    lineHeight: 20,
  },
  submitButton: {
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.xxl,
    ...SHADOWS.md,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...TYPOGRAPHY.button,
    fontWeight: '700',
  },
  approvedSection: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.lg,
  },
  approvedText: {
    ...TYPOGRAPHY.bodySmall,
    textAlign: 'center',
    fontWeight: '600',
  },
});
