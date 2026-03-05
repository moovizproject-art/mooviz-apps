import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import storage from '@react-native-firebase/storage';
import { requestMediaLibraryPermission } from '../../utils/permissions';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { useAuth } from '../../hooks/useAuth';
import { AvatarCircle } from '../../components/AvatarCircle';
import { TabHeader } from '../../components/TabHeader';
import { SettingsDrawer, useSettingsDrawer } from '../../components/SettingsDrawer';
import { CarAlert, useCarAlert } from '../../components/CarAlert';

/**
 * ProfileScreen — מסך פרופיל
 * View and edit profile info, display ratings.
 */
export function ProfileScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { currentUser, logout, updateProfile } = useAuth();
  const drawer = useSettingsDrawer();
  const carAlert = useCarAlert();

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>(currentUser?.fullName || '');
  const [editCity, setEditCity] = useState<string>(currentUser?.city || '');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [ownPhotoUri, setOwnPhotoUri] = useState<string | null>(null);

  // Load own profile photo on mount
  React.useEffect(() => {
    if (currentUser?.uid) {
      storage().ref(`users/${currentUser.uid}/profile.jpg`).getDownloadURL()
        .then(setOwnPhotoUri)
        .catch(() => {}); // no photo yet
    }
  }, [currentUser?.uid]);

  const handleSave = async (): Promise<void> => {
    try {
      await updateProfile({
        fullName: editName,
        city: editCity,
      });
      setIsEditing(false);
      carAlert.show('success', t('common.success'), t('profile.profileUpdated'));
    } catch (err) {
      carAlert.show('error', t('common.error'), t('profile.profileUpdateError'));
    }
  };

  const handleChangePhoto = useCallback(async (): Promise<void> => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return;

    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.7,
      maxWidth: 512,
      maxHeight: 512,
    });

    if (result.didCancel || !result.assets?.[0]?.uri) return;
    if (!currentUser) return;

    setUploadingPhoto(true);
    try {
      const uri = result.assets[0].uri;
      const ref = storage().ref(`users/${currentUser.uid}/profile.jpg`);
      await ref.putFile(uri, { contentType: 'image/jpeg' });
      const downloadUrl = await ref.getDownloadURL();
      setOwnPhotoUri(downloadUrl);
      carAlert.show('success', t('common.success'), t('profile.photoUpdated'));
    } catch (err) {
      console.error('[ProfileScreen] Photo upload error:', err);
      carAlert.show('error', t('common.error'), t('profile.photoError'));
    } finally {
      setUploadingPhoto(false);
    }
  }, [currentUser, t, carAlert]);

  const handleLogout = (): void => {
    carAlert.show('info', t('profile.logoutTitle'), t('profile.logoutConfirm'), [
      { text: t('profile.cancelEdit'), style: 'cancel' },
      { text: t('profile.logout'), style: 'destructive', onPress: () => logout() },
    ]);
  };

  const ratingData = currentUser?.ratingAsSender ?? { average: 0, count: 0 };

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

        {/* Ratings section */}
        <View style={[styles.ratingsSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('profile.rating')}</Text>
          <View style={styles.ratingRow}>
            <View style={styles.ratingItem}>
              <Text style={[styles.ratingValue, { color: colors.primary }]}>
                {ratingData.average > 0 ? ratingData.average.toFixed(1) : '—'}
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
                {ratingData.count || 0}
              </Text>
              <Text style={[styles.ratingLabel, { color: colors.textSecondary }]}>{t('profile.ratingsCount')}</Text>
            </View>
          </View>
        </View>

        {/* Profile details / edit form */}
        <View style={styles.detailsSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t('profile.personalDetails')}</Text>
            <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
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
                  textAlign="right"
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('profile.cityField')}</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.textPrimary }]}
                  value={editCity}
                  onChangeText={setEditCity}
                  textAlign="right"
                />
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
            </>
          )}
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.surface, borderColor: colors.error }]}
          onPress={handleLogout}
        >
          <Text style={[styles.logoutButtonText, { color: colors.error }]}>{t('profile.logout')}</Text>
        </TouchableOpacity>
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
    </View>
  );
}

/** Info row — in RTL, row auto-flips so label (1st child) goes right, value (2nd) goes left */
function InfoRow({ label, value, colors }: { label: string; value: string; colors: Record<string, string> }): React.JSX.Element {
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{value}</Text>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    flex: 1,
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
});
