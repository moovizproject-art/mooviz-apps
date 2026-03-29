/**
 * ReportModal — דיווח על משתמש
 * Modal for reporting a user (sender or driver) with category selection and free text.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { useAuth } from '../hooks/useAuth';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../theme/tokens';

type ReportCategory = 'harassment' | 'fraud' | 'damage' | 'no_show' | 'other';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  reportedUserId: string;
  reportedUserName: string;
  deliveryId: string;
  /** 'sender' or 'driver' — who is being reported */
  reportedRole: 'sender' | 'driver';
}

const CATEGORIES: { key: ReportCategory; icon: string }[] = [
  { key: 'harassment', icon: '🚫' },
  { key: 'fraud', icon: '💰' },
  { key: 'damage', icon: '📦' },
  { key: 'no_show', icon: '👻' },
  { key: 'other', icon: '❓' },
];

export function ReportModal({
  visible,
  onClose,
  reportedUserId,
  reportedUserName,
  deliveryId,
  reportedRole,
}: ReportModalProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { currentUser } = useAuth();

  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!category) {
      Alert.alert(t('report.title'), t('report.selectCategory'));
      return;
    }
    if (!currentUser?.uid) return;

    setSubmitting(true);
    try {
      await firestore().collection('reports').add({
        reporterId: currentUser.uid,
        reporterName: currentUser.fullName || '',
        reporterPhone: currentUser.phone || '',
        reportedUserId,
        reportedUserName,
        reportedRole,
        deliveryId,
        category,
        description: description.trim(),
        status: 'open',
        moderationAction: null,
        moderatorNote: null,
        resolvedBy: null,
        createdAt: firestore.FieldValue.serverTimestamp(),
        resolvedAt: null,
      });
      Alert.alert(t('report.submitted'), t('report.submittedMessage'));
      setCategory(null);
      setDescription('');
      onClose();
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('report.submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.headerBtn, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {t('report.title')}
            </Text>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {/* Who is being reported */}
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('report.reporting')} {reportedUserName}
            </Text>

            {/* Category chips */}
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>
              {t('report.issueType')}
            </Text>
            {CATEGORIES.map((cat) => {
              const selected = category === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[
                    styles.categoryRow,
                    { backgroundColor: colors.surface, borderColor: selected ? colors.primary : colors.border },
                    selected && { borderWidth: 2 },
                  ]}
                  onPress={() => setCategory(cat.key)}
                >
                  <Text style={styles.categoryIcon}>{cat.icon}</Text>
                  <View style={styles.categoryTextCol}>
                    <Text style={[styles.categoryTitle, { color: colors.textPrimary }]}>
                      {t(`report.cat_${cat.key}`)}
                    </Text>
                    <Text style={[styles.categoryDesc, { color: colors.textSecondary }]}>
                      {t(`report.cat_${cat.key}_desc`)}
                    </Text>
                  </View>
                  {selected && <Text style={{ color: colors.primary, fontSize: 18 }}>✓</Text>}
                </TouchableOpacity>
              );
            })}

            {/* Free text */}
            <Text style={[styles.sectionLabel, { color: colors.textPrimary, marginTop: SPACING.lg }]}>
              {t('report.details')}
            </Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.textPrimary }]}
              placeholder={t('report.detailsPlaceholder')}
              placeholderTextColor={colors.inputPlaceholder}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: '#E53935' }, (!category || submitting) && { opacity: 0.5 }]}
              onPress={handleSubmit}
              disabled={!category || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>{t('report.submit')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', minHeight: '60%' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1,
  },
  headerBtn: { fontSize: 15 },
  headerTitle: { ...TYPOGRAPHY.h3, fontSize: 17 },
  body: { flex: 1 },
  bodyContent: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  subtitle: { ...TYPOGRAPHY.bodySmall, marginBottom: SPACING.lg, textAlign: 'center' },
  sectionLabel: { ...TYPOGRAPHY.bodyBold, fontSize: 15, marginBottom: SPACING.sm },
  categoryRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, marginBottom: SPACING.sm,
  },
  categoryIcon: { fontSize: 24 },
  categoryTextCol: { flex: 1 },
  categoryTitle: { ...TYPOGRAPHY.bodySmall, fontWeight: '700' },
  categoryDesc: { ...TYPOGRAPHY.caption, marginTop: 2 },
  textArea: {
    borderWidth: 1, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md, minHeight: 100, ...TYPOGRAPHY.body,
  },
  submitBtn: {
    borderRadius: BORDER_RADIUS.lg, paddingVertical: 14, alignItems: 'center', marginTop: SPACING.lg,
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
