import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { RatingsHistoryModal } from '../../components/RatingsHistoryModal';
import { ImageGalleryModal } from '../../components/ImageGalleryModal';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import storage from '@react-native-firebase/storage';
import firestore from '@react-native-firebase/firestore';
import { requestMediaLibraryPermission, requestCameraPermission } from '../../utils/permissions';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../hooks/useAuth';
import { sendPasswordReset } from '../../services/auth';
import { AvatarCircle } from '../../components/AvatarCircle';
import { TabHeader } from '../../components/TabHeader';
import { SettingsDrawer, useSettingsDrawer } from '../../components/SettingsDrawer';
import { CarAlert, useCarAlert } from '../../components/CarAlert';
import { APP_VERSION } from '../../constants/config';

/**
 * ProfileScreen — מסך פרופיל
 * View and edit profile info, display ratings.
 */
export function ProfileScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { currentUser, logout, updateProfile, refreshUserDoc } = useAuth();
  const drawer = useSettingsDrawer();
  const carAlert = useCarAlert();

  // No explicit refresh — useAuth provides currentUser from initial auth load.
  // Previous useFocusEffect/useEffect refresh caused re-render loops + scroll jumps.

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>(currentUser?.fullName || '');
  const [editNickname, setEditNickname] = useState<string>((currentUser as any)?.nickname || '');
  const [editCity, setEditCity] = useState<string>(currentUser?.city || '');
  const [editGender, setEditGender] = useState<'male' | 'female' | ''>(currentUser?.gender || '');
  const [editAgeRange, setEditAgeRange] = useState<string>(currentUser?.ageRange || '');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [ownPhotoUri, setOwnPhotoUri] = useState<string | null>(null);
  const [ratingsModalVisible, setRatingsModalVisible] = useState(false);
  const [ratingsModalMode, setRatingsModalMode] = useState<'sender' | 'driver'>('sender');
  const [kycGalleryVisible, setKycGalleryVisible] = useState(false);
  const [kycGalleryIndex, setKycGalleryIndex] = useState(0);
  const [kycLicenseUrl, setKycLicenseUrl] = useState<string | null>(null);
  const [kycIdUrl, setKycIdUrl] = useState<string | null>(null);

  // Load KYC document URLs from Storage (read-only viewing)
  React.useEffect(() => {
    if (!currentUser?.uid) return;
    const uid = currentUser.uid;
    storage().ref(`kyc/${uid}/license.jpg`).getDownloadURL()
      .then(setKycLicenseUrl).catch(() => {});
    storage().ref(`kyc/${uid}/id.jpg`).getDownloadURL()
      .then(setKycIdUrl).catch(() => {});
  }, [currentUser?.uid]);

  // Load own profile photo — once on mount, not on every currentUser change
  const photoLoaded = React.useRef(false);
  React.useEffect(() => {
    if (photoLoaded.current) return;
    if (currentUser?.profilePhotoURL) {
      setOwnPhotoUri(currentUser.profilePhotoURL);
      photoLoaded.current = true;
    }
    if (currentUser?.uid) {
      storage().ref(`users/${currentUser.uid}/profile.jpg`).getDownloadURL()
        .then((url) => { setOwnPhotoUri(url); photoLoaded.current = true; })
        .catch(() => {}); // no photo in Storage — keep Firestore URL if available
    }
  }, [currentUser?.uid, currentUser?.profilePhotoURL]);

  const handleSave = async (): Promise<void> => {
    try {
      await updateProfile({
        fullName: editName,
        nickname: editNickname,
        city: editCity,
        gender: editGender || '',
        ageRange: editAgeRange || '',
      });
      setIsEditing(false);
      carAlert.show('success', t('common.success'), t('profile.profileUpdated'));
    } catch (err) {
      carAlert.show('error', t('common.error'), t('profile.profileUpdateError'));
    }
  };

  const uploadProfilePhoto = useCallback(async (uri: string): Promise<void> => {
    if (!currentUser) return;
    setUploadingPhoto(true);
    try {
      const ref = storage().ref(`users/${currentUser.uid}/profile.jpg`);
      await ref.putFile(uri, { contentType: 'image/jpeg' });
      const downloadUrl = await ref.getDownloadURL();
      await firestore().collection('users').doc(currentUser.uid).update({
        profilePhotoURL: downloadUrl,
      });
      setOwnPhotoUri(downloadUrl);
      carAlert.show('success', t('common.success'), t('profile.photoUpdated'));
    } catch (err) {
      console.error('[ProfileScreen] Photo upload error:', err);
      carAlert.show('error', t('common.error'), t('profile.photoError'));
    } finally {
      setUploadingPhoto(false);
    }
  }, [currentUser, t, carAlert]);

  const handleChangePhoto = useCallback((): void => {
    const imageOpts = { mediaType: 'photo' as const, quality: 0.7 as const, maxWidth: 512, maxHeight: 512 };

    Alert.alert(t('profile.changePhoto'), '', [
      {
        text: t('common.takePhoto'),
        onPress: async () => {
          const hasPerm = await requestCameraPermission();
          if (!hasPerm) return;
          const result = await launchCamera(imageOpts);
          if (!result.didCancel && result.assets?.[0]?.uri) {
            await uploadProfilePhoto(result.assets[0].uri);
          }
        },
      },
      {
        text: t('common.chooseFromGallery'),
        onPress: async () => {
          const hasPerm = await requestMediaLibraryPermission();
          if (!hasPerm) return;
          const result = await launchImageLibrary(imageOpts);
          if (!result.didCancel && result.assets?.[0]?.uri) {
            await uploadProfilePhoto(result.assets[0].uri);
          }
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  }, [t, uploadProfilePhoto]);

  const handleChangePassword = async (): Promise<void> => {
    const email = currentUser?.email;
    if (!email) return;
    try {
      await sendPasswordReset(email);
      carAlert.show('success', t('common.success'), t('auth.passwordResetSent'));
    } catch {
      carAlert.show('error', t('common.error'), t('auth.resetPassword'));
    }
  };

  const handleLogout = (): void => {
    carAlert.show('info', t('profile.logoutTitle'), t('profile.logoutConfirm'), [
      { text: t('profile.cancelEdit'), style: 'cancel' },
      { text: t('profile.logout'), style: 'destructive', onPress: () => logout() },
    ]);
  };

  const senderRating = currentUser?.ratingAsSender ?? { average: 0, count: 0 };
  const driverRating = (currentUser as any)?.ratingAsDriver ?? { average: 0, count: 0 };
  const hasDriverRating = currentUser?.role === 'driver' || currentUser?.driverUnlocked || driverRating.count > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <TabHeader title={t('tabs.profile')} onSettingsPress={drawer.open} />

        {/* Avatar + name */}
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={handleChangePhoto} disabled={uploadingPhoto}>
            <AvatarCircle
              name={currentUser?.fullName || ''}
              photoUrl={ownPhotoUri}
              size={80}
            />
            <View style={styles.photoBadge}>
              <Text style={styles.photoBadgeIcon}>📷</Text>
            </View>
          </TouchableOpacity>
          <Text style={[styles.userName, { color: colors.textPrimary }]}>
            {currentUser?.fullName || t('profile.user')}
          </Text>
          <Text style={[styles.userRole, { color: colors.textSecondary }]}>
            {currentUser?.role === 'driver'
              ? t('profile.driver')
              : currentUser?.driverUnlocked
                ? t('profile.senderDriver')
                : t('profile.sender')}
          </Text>
{uploadingPhoto && (
            <Text style={[styles.uploadingText, { color: colors.textSecondary }]}>
              {t('common.loading')}
            </Text>
          )}
        </View>

        {/* Sender Ratings */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => { setRatingsModalMode('sender'); setRatingsModalVisible(true); }}
        >
          <View style={[styles.ratingsSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>📦 {t('profile.senderRating')}</Text>
            <View style={styles.ratingRow}>
              <View style={styles.ratingItem}>
                <Text style={[styles.ratingValue, { color: colors.primary }]}>
                  {senderRating.average > 0 ? senderRating.average.toFixed(1) : '—'}
                </Text>
                <Text style={[styles.ratingLabel, { color: colors.textSecondary }]}>{t('profile.average')}</Text>
              </View>
              <View style={styles.ratingItem}>
                <Text style={[styles.ratingValue, { color: colors.primary }]}>
                  {currentUser?.completedDeliveries || 0}
                </Text>
                <Text style={[styles.ratingLabel, { color: colors.textSecondary }]}>{t('profile.deliveryCount')}</Text>
              </View>
              <View style={styles.ratingItem}>
                <Text style={[styles.ratingValue, { color: colors.primary }]}>
                  {senderRating.count || 0}
                </Text>
                <Text style={[styles.ratingLabel, { color: colors.textSecondary }]}>{t('profile.ratingsCount')}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Driver Ratings — only if applicable */}
        {hasDriverRating && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => { setRatingsModalMode('driver'); setRatingsModalVisible(true); }}
          >
            <View style={[styles.ratingsSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🚗 {t('profile.driverRating')}</Text>
              <View style={styles.ratingRow}>
                <View style={styles.ratingItem}>
                  <Text style={[styles.ratingValue, { color: colors.primary }]}>
                    {driverRating.average > 0 ? driverRating.average.toFixed(1) : '—'}
                  </Text>
                  <Text style={[styles.ratingLabel, { color: colors.textSecondary }]}>{t('profile.average')}</Text>
                </View>
                <View style={styles.ratingItem}>
                  <Text style={[styles.ratingValue, { color: colors.primary }]}>
                    {driverRating.count || 0}
                  </Text>
                  <Text style={[styles.ratingLabel, { color: colors.textSecondary }]}>{t('profile.ratingsCount')}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Profile details / edit form */}
        <View style={styles.detailsSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('profile.personalDetails')}</Text>
            <TouchableOpacity
              onPress={() => setIsEditing(!isEditing)}
              activeOpacity={0.6}
              hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
            >
              <Text style={[styles.editLink, { color: colors.primary }]}>
                {isEditing ? t('profile.cancelEdit') : t('profile.editProfile')}
              </Text>
            </TouchableOpacity>
          </View>

          {isEditing ? (
            <>
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('profile.fullName')}</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
                  value={editName}
                  onChangeText={setEditName}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('profile.nicknameLabel')}</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
                  value={editNickname}
                  onChangeText={setEditNickname}
                  placeholder={t('profile.nicknamePlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('profile.cityField')}</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
                  value={editCity}
                  onChangeText={setEditCity}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('auth.gender')}</Text>
                <View style={styles.chipRow}>
                  {(['male', 'female'] as const).map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[
                        styles.chip,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        editGender === g && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => setEditGender(editGender === g ? '' : g)}
                    >
                      <Text style={[styles.chipText, { color: colors.textPrimary }, editGender === g && { color: '#FFFFFF' }]}>
                        {t(`auth.${g}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('auth.ageRange')}</Text>
                <View style={styles.chipRow}>
                  {['18-24', '25-34', '35-44', '45-54', '55+'].map((range) => (
                    <TouchableOpacity
                      key={range}
                      style={[
                        styles.chip,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        editAgeRange === range && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => setEditAgeRange(editAgeRange === range ? '' : range)}
                    >
                      <Text style={[styles.chipText, { color: colors.textPrimary }, editAgeRange === range && { color: '#FFFFFF' }]}>
                        {range}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleSave}>
                <Text style={styles.saveButtonText}>{t('profile.saveChanges')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <InfoRow label={t('profile.name')} value={currentUser?.fullName || '—'} colors={colors} />
              <InfoRow label={t('profile.phone')} value={currentUser?.phone || '—'} colors={colors} />
              <InfoRow label={t('profile.email')} value={currentUser?.email || '—'} colors={colors} />
              <InfoRow label={t('profile.city')} value={currentUser?.city || '—'} colors={colors} />
              {currentUser?.gender ? (
                <InfoRow label={t('auth.gender')} value={t(`auth.${currentUser.gender}`)} colors={colors} />
              ) : null}
              {currentUser?.ageRange ? (
                <InfoRow label={t('auth.ageRange')} value={currentUser.ageRange} colors={colors} />
              ) : null}
            </>
          )}
        </View>

        {/* KYC Documents (read-only) */}
        {(kycLicenseUrl || kycIdUrl) && (
          <View style={[styles.kycSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {t('kyc.title')}
              </Text>
              <View style={[styles.kycStatusBadge, {
                backgroundColor: currentUser?.kycStatus === 'approved' ? colors.success + '20' : colors.warning + '20',
              }]}>
                <Text style={[styles.kycStatusText, {
                  color: currentUser?.kycStatus === 'approved' ? colors.success : colors.warning,
                }]}>
                  {currentUser?.kycStatus === 'approved' ? t('kyc.approved') : t('kyc.pending')}
                </Text>
              </View>
            </View>
            <View style={styles.kycDocsRow}>
              {kycLicenseUrl && (
                <TouchableOpacity
                  style={[styles.kycThumb, { borderColor: colors.border }]}
                  onPress={() => { setKycGalleryIndex(0); setKycGalleryVisible(true); }}
                >
                  <Image source={{ uri: kycLicenseUrl }} style={styles.kycThumbImage} resizeMode="cover" />
                  <Text style={[styles.kycThumbLabel, { color: colors.textSecondary }]}>
                    {t('kyc.license')}
                  </Text>
                </TouchableOpacity>
              )}
              {kycIdUrl && (
                <TouchableOpacity
                  style={[styles.kycThumb, { borderColor: colors.border }]}
                  onPress={() => { setKycGalleryIndex(kycLicenseUrl ? 1 : 0); setKycGalleryVisible(true); }}
                >
                  <Image source={{ uri: kycIdUrl }} style={styles.kycThumbImage} resizeMode="cover" />
                  <Text style={[styles.kycThumbLabel, { color: colors.textSecondary }]}>
                    {t('kyc.idCard')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Change password */}
        <TouchableOpacity
          style={[styles.changePasswordButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleChangePassword}
        >
          <Text style={[styles.changePasswordText, { color: colors.primary }]}>{t('auth.changePassword')}</Text>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: colors.error }]}
          onPress={handleLogout}
        >
          <Text style={[styles.logoutButtonText, { color: colors.error }]}>{t('profile.logout')}</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={[styles.versionText, { color: colors.textTertiary }]}>v{APP_VERSION}</Text>
      </ScrollView>

      <SettingsDrawer visible={drawer.visible} onClose={drawer.close} animValue={drawer.animValue} />
      <CarAlert
        visible={carAlert.visible}
        type={carAlert.type}
        title={carAlert.title}
        message={carAlert.message}
        buttons={carAlert.buttons}
        onDismiss={carAlert.dismiss}
      />
      {currentUser?.uid && (
        <RatingsHistoryModal
          visible={ratingsModalVisible}
          onClose={() => setRatingsModalVisible(false)}
          userId={currentUser.uid}
          mode={ratingsModalMode}
        />
      )}
      <ImageGalleryModal
        visible={kycGalleryVisible}
        images={[kycLicenseUrl, kycIdUrl].filter(Boolean) as string[]}
        initialIndex={kycGalleryIndex}
        onClose={() => setKycGalleryVisible(false)}
      />
    </View>
  );
}

/** Info row — label pinned to start (right in RTL), value pinned to end (left in RTL) */
function InfoRow({ label, value, colors }: { label: string; value: string; colors: any }): React.JSX.Element {
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.textPrimary }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 48,
  },
  profileHeader: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 12,
  },
  userRole: {
    fontSize: 14,
    marginTop: 4,
  },
  photoBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1A73E8',
  },
  photoBadgeIcon: {
    fontSize: 14,
  },
  uploadingText: {
    fontSize: 12,
    marginTop: 6,
  },
  ratingsSection: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ratingItem: {
    alignItems: 'center',
  },
  ratingValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  ratingLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  detailsSection: {
    marginBottom: 32,
    paddingHorizontal: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  saveButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  infoLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  infoValue: {
    fontSize: 15,
    textAlign: 'left',
  },
  changePasswordButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    marginHorizontal: 24,
    marginBottom: 12,
  },
  changePasswordText: {
    fontSize: 16,
    fontWeight: '700',
  },
  logoutButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    marginHorizontal: 24,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  versionText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  kycSection: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginHorizontal: 24,
    marginBottom: 24,
  },
  kycStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  kycStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  kycDocsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  kycThumb: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
  },
  kycThumbImage: {
    width: '100%',
    height: 100,
  },
  kycThumbLabel: {
    fontSize: 12,
    fontWeight: '600',
    paddingVertical: 6,
  },
});
