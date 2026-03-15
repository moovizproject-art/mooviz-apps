/**
 * TextInput — שדה קלט טקסט
 * Styled text input with label, error, and helper text.
 * RTL-aware with right-aligned text for Hebrew.
 * שדה קלט מעוצב עם תווית, שגיאה וטקסט עזרה
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  StyleSheet,
  TextInputProps as RNTextInputProps,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';

import { COLORS } from '../constants/colors';
import { SPACING, RADIUS, TYPOGRAPHY } from '../constants/theme';
import { strings } from '../i18n/strings';

interface TextInputProps extends Omit<RNTextInputProps, 'style'> {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: ViewStyle;
  secureEntry?: boolean;
}

export function TextInput({
  label,
  error,
  helperText,
  containerStyle,
  secureEntry = false,
  ...inputProps
}: TextInputProps): React.JSX.Element {
  const [isFocused, setIsFocused] = useState(false);
  const [isSecureVisible, setIsSecureVisible] = useState(!secureEntry);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          error && styles.inputError,
        ]}
      >
        <RNTextInput
          style={styles.input}
          placeholderTextColor={COLORS.textTertiary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={!isSecureVisible}
          textAlign="right"
          {...inputProps}
        />
        {secureEntry && (
          <TouchableOpacity
            onPress={() => setIsSecureVisible(!isSecureVisible)}
            style={styles.toggleButton}
          >
            <Text style={styles.toggleText}>{isSecureVisible ? strings.commonExtra.hide.he : strings.commonExtra.show.he}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
      {!error && helperText && <Text style={styles.helperText}>{helperText}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
  },
  label: {
    ...TYPOGRAPHY.label,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    textAlign: 'right',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  input: {
    flex: 1,
    ...TYPOGRAPHY.body,
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
    paddingEnd: SPACING.lg + 8,
    paddingVertical: SPACING.md,
    minHeight: 48,
    writingDirection: 'rtl',
  },
  toggleButton: {
    paddingHorizontal: SPACING.md,
  },
  toggleText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
  },
  errorText: {
    ...TYPOGRAPHY.small,
    color: COLORS.error,
    marginTop: SPACING.xs,
    textAlign: 'right',
  },
  helperText: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'right',
  },
});
