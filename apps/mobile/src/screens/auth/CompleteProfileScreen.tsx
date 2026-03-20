import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { ISRAEL_CITIES } from '../../constants/cities';
import firestore from '@react-native-firebase/firestore';

import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { validatePhone, validateRequired } from '../../utils/validators';
import { CarAlert, useCarAlert } from '../../components/CarAlert';

const logo = require('../../assets/logo.png');

/**
 * CompleteProfileScreen — gate screen for auth-only users missing fullName/phone.
 * Shown between phone verification and the main app in RootNavigator.
 */
export function CompleteProfileScreen(): React.JSX.Element {
  const { currentUser, refreshUserDoc } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const carAlert = useCarAlert();

  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [city, setCity] = useState(currentUser?.city || '');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ fullName?: string; phone?: string }>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

  const handleCityChange = (text: string) => {
    setCity(text);
    if (text.trim().length > 0) {
      const filtered = ISRAEL_CITIES.filter(c => c.includes(text.trim()));
      setCitySuggestions(filtered.slice(0, 5));
      setShowCitySuggestions(filtered.length > 0);
    } else {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
    }
  };

  const selectCity = (selectedCity: string) => {
    setCity(selectedCity);
    setShowCitySuggestions(false);
  };

  const phoneRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);

  const validate = (): boolean => {
    const newErrors: { fullName?: string; phone?: string } = {};
    if (!validateRequired(fullName.trim())) {
      newErrors.fullName = t('completeProfile.fullNameRequired');
    }
    if (!validatePhone(phone.trim())) {
      newErrors.phone = phone.trim()
        ? t('completeProfile.invalidPhone')
        : t('completeProfile.phoneRequired');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (): Promise<void> => {
    if (!validate() || !currentUser) return;

    try {
      setIsLoading(true);
      // Normalize phone to E.164 (+972...) — users type 050... without country code
      const { normalizePhoneNumber } = require('../../services/auth');
      await firestore().collection('users').doc(currentUser.uid).update({
        fullName: fullName.trim(),
        phone: normalizePhoneNumber(phone.trim()),
        ...(city.trim() ? { city: city.trim() } : {}),
        autoCreated: firestore.FieldValue.delete(), // Clear the auto-created flag
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      await refreshUserDoc();
      // RootNavigator will automatically redirect once isProfileComplete becomes true
    } catch (err: any) {
      console.error('[CompleteProfileScreen] Save error:', err);
      const message = err?.message?.includes('PERMISSION_DENIED')
        ? 'אין הרשאה לעדכן פרופיל. נסה להתנתק ולהתחבר מחדש.'
        : err?.message?.includes('NOT_FOUND')
        ? 'המשתמש לא נמצא. נסה להתנתק ולהירשם מחדש.'
        : 'שגיאה בשמירת הפרטים. נסה שוב.';
      carAlert.show('error', 'שגיאה', message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderInput = (
    field: string,
    value: string,
    onChangeText: (v: string) => void,
    placeholder: string,
    options?: {
      keyboardType?: 'phone-pad' | 'default';
      ref?: React.RefObject<TextInput>;
      nextRef?: React.RefObject<TextInput>;
      returnKeyType?: 'next' | 'done';
      onSubmitEditing?: () => void;
    },
  ) => (
    <View
      style={[
        styles.inputWrapper,
        { borderColor: colors.border, backgroundColor: colors.inputBg },
        focusedField === field && {
          borderColor: colors.primary,
          borderWidth: 1.5,
          shadowColor: colors.primary,
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 4,
        },
      ]}
    >
      <TextInput
        ref={options?.ref}
        style={[styles.input, { color: colors.textPrimary }]}
        value={value}
        onChangeText={(v) => {
          onChangeText(v);
          if (field === 'fullName' || field === 'phone') {
            setErrors((prev) => ({ ...prev, [field]: undefined }));
          }
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={options?.keyboardType || 'default'}
        textAlign="right"
        editable={!isLoading}
        onFocus={() => setFocusedField(field)}
        onBlur={() => setFocusedField(null)}
        returnKeyType={options?.returnKeyType || 'next'}
        onSubmitEditing={options?.onSubmitEditing || (() => options?.nextRef?.current?.focus())}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('completeProfile.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('completeProfile.subtitle')}
          </Text>
        </View>

        {/* Full Name */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>{t('auth.fullName')}</Text>
          {renderInput('fullName', fullName, setFullName, 'ישראל ישראלי', {
            nextRef: phoneRef,
          })}
          {errors.fullName && (
            <Text style={[styles.errorText, { color: colors.error }]}>{errors.fullName}</Text>
          )}
        </View>

        {/* Phone */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>{t('auth.phone')}</Text>
          {renderInput('phone', phone, setPhone, '050-1234567', {
            keyboardType: 'phone-pad',
            ref: phoneRef,
            nextRef: cityRef,
          })}
          {errors.phone && (
            <Text style={[styles.errorText, { color: colors.error }]}>{errors.phone}</Text>
          )}
        </View>

        {/* City (optional with autocomplete) */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('profile.city')}
          </Text>
          {renderInput('city', city, handleCityChange, t('forms.cityPlaceholder'), {
            ref: cityRef,
            returnKeyType: 'done',
            onSubmitEditing: handleSave,
          })}
          {showCitySuggestions && (
            <View style={[styles.suggestionsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {citySuggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                  onPress={() => selectCity(suggestion)}
                >
                  <Text style={[styles.suggestionText, { color: colors.textPrimary }]}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: colors.primary, shadowColor: colors.primary },
            isLoading && styles.submitButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>{t('completeProfile.save')}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.keyboardSpacer} />
      </ScrollView>
      <CarAlert
        visible={carAlert.visible}
        type={carAlert.type}
        title={carAlert.title}
        message={carAlert.message}
        buttons={carAlert.buttons}
        onDismiss={carAlert.dismiss}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 28,
    paddingBottom: 48,
  },
  headerSection: {
    alignItems: 'center',
    paddingTop: 60,
    marginBottom: 36,
  },
  logo: {
    width: 200,
    height: 70,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    borderWidth: 1,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    writingDirection: 'rtl',
  },
  errorText: {
    fontSize: 13,
    marginTop: 4,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  suggestionsContainer: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  suggestionText: {
    fontSize: 15,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  keyboardSpacer: {
    height: 120,
  },
});
