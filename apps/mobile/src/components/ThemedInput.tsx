import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '../theme/tokens';

interface ThemedInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  required?: boolean;
  onPress?: () => void;
  displayValue?: string;
  icon?: string;
}

export function ThemedInput({
  label,
  required,
  onPress,
  displayValue,
  icon,
  ...inputProps
}: ThemedInputProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [focused, setFocused] = useState(false);

  const borderColor = focused ? colors.inputBorderFocused : colors.inputBorder;
  const focusedShadow = focused
    ? {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
      }
    : {};

  const renderInput = () => {
    if (onPress) {
      return (
        <TouchableOpacity
          style={[
            styles.inputContainer,
            { backgroundColor: colors.inputBg, borderColor },
            focusedShadow,
          ]}
          onPress={onPress}
          activeOpacity={0.7}
        >
          {icon && <Text style={styles.icon}>{icon}</Text>}
          <Text
            style={[
              styles.inputText,
              {
                color: displayValue ? colors.textPrimary : colors.inputPlaceholder,
              },
            ]}
          >
            {displayValue || inputProps.placeholder || ''}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <View
        style={[
          styles.inputContainer,
          { backgroundColor: colors.inputBg, borderColor },
          focusedShadow,
        ]}
      >
        {icon && <Text style={styles.icon}>{icon}</Text>}
        <TextInput
          style={[styles.input, { color: colors.textPrimary }]}
          placeholderTextColor={colors.inputPlaceholder}
          writingDirection="rtl"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...inputProps}
        />
      </View>
    );
  };

  return (
    <View style={styles.fieldGroup}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
        {required && (
          <Text style={[styles.required, { color: colors.textSecondary }]}>
            {t('form.required')}
          </Text>
        )}
      </View>
      {renderInput()}
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 2,
    ...SHADOWS.sm,
  },
  icon: {
    fontSize: 18,
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    ...TYPOGRAPHY.body,
    paddingVertical: 0,
  },
  inputText: {
    flex: 1,
    ...TYPOGRAPHY.body,
  },
});
