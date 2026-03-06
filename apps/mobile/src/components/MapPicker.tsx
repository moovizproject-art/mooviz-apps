import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Keyboard,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../theme/tokens';
import { GOOGLE_MAPS_API_KEY } from '../constants/config';

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

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';

/**
 * MapPicker — Address picker using Google Places HTTP API directly.
 * Avoids react-native-google-places-autocomplete (broken hooks with pnpm).
 * Types address → fetches predictions → user taps → fetches place details → returns lat/lng.
 */
export function MapPicker({ onLocationSelect, onCancel }: MapPickerProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPredictions = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim() || !GOOGLE_MAPS_API_KEY) {
      setPredictions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `${PLACES_BASE}/autocomplete/json?input=${encodeURIComponent(text)}&key=${GOOGLE_MAPS_API_KEY}&language=he&components=country:il`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.predictions) {
          setPredictions(json.predictions);
        }
      } catch {
        // silently fail — user can still submit manually
      }
    }, 300);
  }, []);

  const handleTextChange = useCallback((text: string) => {
    setQuery(text);
    fetchPredictions(text);
  }, [fetchPredictions]);

  const handleSelectPrediction = useCallback(async (prediction: Prediction) => {
    Keyboard.dismiss();
    setLoading(true);
    try {
      const url = `${PLACES_BASE}/details/json?place_id=${prediction.place_id}&fields=geometry,formatted_address&key=${GOOGLE_MAPS_API_KEY}&language=he`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.result?.geometry?.location) {
        onLocationSelect({
          latitude: json.result.geometry.location.lat,
          longitude: json.result.geometry.location.lng,
          address: json.result.formatted_address || prediction.description,
        });
      } else {
        // Fallback: use description without coords
        onLocationSelect({
          latitude: 0,
          longitude: 0,
          address: prediction.description,
        });
      }
    } catch {
      onLocationSelect({
        latitude: 0,
        longitude: 0,
        address: prediction.description,
      });
    } finally {
      setLoading(false);
    }
  }, [onLocationSelect]);

  const handleManualSubmit = useCallback(() => {
    if (!query.trim()) return;
    Keyboard.dismiss();
    onLocationSelect({
      latitude: 0,
      longitude: 0,
      address: query.trim(),
    });
  }, [query, onLocationSelect]);

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

        {/* Search input */}
        <View style={styles.searchContainer}>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.inputBorder,
                color: colors.textPrimary,
              },
            ]}
            placeholder={t('form.addressPlaceholder')}
            placeholderTextColor={colors.inputPlaceholder}
            value={query}
            onChangeText={handleTextChange}
            autoFocus
            writingDirection="rtl"
            returnKeyType="done"
            onSubmitEditing={handleManualSubmit}
          />
        </View>

        {loading && (
          <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
        )}

        {/* Predictions list */}
        <FlatList
          data={predictions}
          keyExtractor={(item) => item.place_id}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
              onPress={() => handleSelectPrediction(item)}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowMain, { color: colors.textPrimary }]}>
                {item.structured_formatting?.main_text || item.description}
              </Text>
              {item.structured_formatting?.secondary_text && (
                <Text style={[styles.rowSecondary, { color: colors.textSecondary }]}>
                  {item.structured_formatting.secondary_text}
                </Text>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            query.trim().length > 0 && predictions.length === 0 && !loading ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {t('form.manualAddressHint')}
                </Text>
                <TouchableOpacity
                  style={[styles.confirmButton, { backgroundColor: query.trim() ? colors.primary : colors.border }]}
                  onPress={handleManualSubmit}
                  disabled={!query.trim()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmButtonText}>{t('form.confirmAddress')}</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
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
  searchContainer: {
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
  loader: {
    marginTop: SPACING.md,
  },
  list: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
  },
  row: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
  },
  rowMain: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '600',
  },
  rowSecondary: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  emptyContainer: {
    paddingTop: SPACING.xl,
    paddingHorizontal: SPACING.md,
    gap: SPACING.md,
  },
  emptyText: {
    ...TYPOGRAPHY.bodySmall,
    textAlign: 'center',
  },
  confirmButton: {
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
