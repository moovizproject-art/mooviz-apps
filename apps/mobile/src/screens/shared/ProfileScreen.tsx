import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { AvatarCircle } from '../../components/AvatarCircle';

// ProfileScreen is used in both Sender and Driver tab navigators.
// No navigation prop needed — auth actions use hooks directly.

/**
 * ProfileScreen — מסך פרופיל
 * View and edit profile info, display ratings.
 * צפייה ועריכת פרטי פרופיל, הצגת דירוגים
 */
export function ProfileScreen(): React.JSX.Element {
  const { currentUser, logout, updateProfile } = useAuth();

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>(currentUser?.displayName || '');
  const [editCity, setEditCity] = useState<string>(currentUser?.city || '');

  const handleSave = async (): Promise<void> => {
    try {
      await updateProfile({
        displayName: editName,
        city: editCity,
      });
      setIsEditing(false);
      Alert.alert('הצלחה', 'הפרופיל עודכן בהצלחה');
      // Success: Profile updated
    } catch (err) {
      Alert.alert('שגיאה', 'לא ניתן לעדכן פרופיל');
      // Error: Cannot update profile
    }
  };

  const handleLogout = (): void => {
    Alert.alert('התנתקות', 'האם אתה בטוח?', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'התנתק', style: 'destructive', onPress: () => logout() },
    ]);
    // Logout — Are you sure? / Cancel / Logout
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Profile header */}
      {/* כותרת פרופיל */}
      <View style={styles.profileHeader}>
        <AvatarCircle
          name={currentUser?.displayName || ''}
          photoUrl={currentUser?.photoUrl}
          size={80}
        />
        <Text style={styles.userName}>{currentUser?.displayName || 'משתמש'}</Text>
        <Text style={styles.userRole}>
          {currentUser?.role === 'driver' ? 'נהג' : currentUser?.role === 'both' ? 'שולח / נהג' : 'שולח'}
        </Text>
      </View>

      {/* Ratings section */}
      {/* סקשן דירוגים */}
      <View style={styles.ratingsSection}>
        <Text style={styles.sectionTitle}>דירוג</Text>
        {/* Rating */}
        <View style={styles.ratingRow}>
          <View style={styles.ratingItem}>
            <Text style={styles.ratingValue}>
              {currentUser?.rating?.toFixed(1) || '—'}
            </Text>
            <Text style={styles.ratingLabel}>ממוצע</Text>
            {/* Average */}
          </View>
          <View style={styles.ratingItem}>
            <Text style={styles.ratingValue}>
              {currentUser?.totalDeliveries || 0}
            </Text>
            <Text style={styles.ratingLabel}>משלוחים</Text>
            {/* Deliveries */}
          </View>
          <View style={styles.ratingItem}>
            <Text style={styles.ratingValue}>
              {currentUser?.totalRatings || 0}
            </Text>
            <Text style={styles.ratingLabel}>דירוגים</Text>
            {/* Ratings */}
          </View>
        </View>
      </View>

      {/* Profile details / edit form */}
      {/* פרטי פרופיל / טופס עריכה */}
      <View style={styles.detailsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>פרטים אישיים</Text>
          {/* Personal details */}
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
            <Text style={styles.editLink}>{isEditing ? 'ביטול' : 'עריכה'}</Text>
            {/* Cancel / Edit */}
          </TouchableOpacity>
        </View>

        {isEditing ? (
          <>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>שם מלא</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                textAlign="right"
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>עיר</Text>
              <TextInput
                style={styles.input}
                value={editCity}
                onChangeText={setEditCity}
                textAlign="right"
              />
            </View>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>שמור שינויים</Text>
              {/* Save changes */}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>שם:</Text>
              <Text style={styles.infoValue}>{currentUser?.displayName || '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>טלפון:</Text>
              <Text style={styles.infoValue}>{currentUser?.phone || '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>אימייל:</Text>
              <Text style={styles.infoValue}>{currentUser?.email || '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>עיר:</Text>
              <Text style={styles.infoValue}>{currentUser?.city || '—'}</Text>
            </View>
          </>
        )}
      </View>

      {/* Logout */}
      {/* התנתקות */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>התנתק</Text>
        {/* Logout */}
      </TouchableOpacity>
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
    paddingTop: 60,
    paddingBottom: 48,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 12,
  },
  userRole: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  ratingsSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'right',
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
    color: COLORS.primary,
  },
  ratingLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  detailsSection: {
    marginBottom: 32,
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
    color: COLORS.primary,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
    textAlign: 'right',
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
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
    justifyContent: 'flex-end',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
    textAlign: 'right',
  },
  logoutButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  logoutButtonText: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: '700',
  },
});
