import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Keyboard,
} from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import Config from 'react-native-config';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../theme/tokens';

interface GeoPoint {
  latitude: number;
  longitude: number;
  address: string;
}

interface MapPickerProps {
  onLocationSelect: (point: GeoPoint) => void;
  onCancel: () => void;
  initialLocation?: { latitude: number; longitude: number };
}

/**
 * MapPicker — Google Places autocomplete address picker
 * Uses react-native-google-places-autocomplete for street/city search.
 * Returns lat/lng + formatted address.
 */
export function MapPicker({ onLocationSelect, onCancel }: MapPickerProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  const ref = useRef<any>(null);

  useEffect(() => {
    // Auto-focus the input
    setTimeout(() => ref.current?.focus(), 300);
  }, []);

  const handleSelect = (data: any, details: any) => {
    Keyboard.dismiss();
    if (details?.geometry?.location) {
      onLocationSelect({
        latitude: details.geometry.location.lat,
        longitude: details.geometry.location.lng,
        address: data.description || data.structured_formatting?.main_text || '',
      });
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <View style={[styles.overlay, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
              {t('common.cancel')}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t('form.selectAddress')}
          </Text>
          <View style={styles.cancelButton} />
        </View>

        {/* Autocomplete */}
        <GooglePlacesAutocomplete
          ref={ref}
          placeholder={t('form.addressPlaceholder')}
          onPress={handleSelect}
          fetchDetails
          query={{
            key: Config.GOOGLE_MAPS_API_KEY || '',
            language: 'he',
            components: 'country:il',
          }}
          styles={{
            container: styles.autocompleteContainer,
            textInput: [
              styles.textInput,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.inputBorder,
                color: colors.textPrimary,
              },
            ],
            listView: [styles.listView, { backgroundColor: colors.background }],
            row: [styles.row, { backgroundColor: colors.surface }],
            description: { color: colors.textPrimary },
            separator: { backgroundColor: colors.border },
            poweredContainer: { display: 'none' },
          }}
          textInputProps={{
            placeholderTextColor: colors.inputPlaceholder,
            writingDirection: 'rtl',
          }}
          enablePoweredByContainer={false}
          nearbyPlacesAPI="GooglePlacesSearch"
          debounce={300}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  title: {
    ...TYPOGRAPHY.h3,
    textAlign: 'center',
  },
  cancelButton: {
    width: 60,
  },
  cancelText: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
  },
  autocompleteContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    ...TYPOGRAPHY.body,
    height: 48,
  },
  listView: {
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.sm,
    overflow: 'hidden',
  },
  row: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
});
