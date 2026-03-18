import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../theme/tokens';
import { GOOGLE_MAPS_API_KEY } from '../constants/config';

// ── Types ──

export interface GeoAddress {
  address: string;
  lat: number;
  lng: number;
  geohash: string; // 6-char precision
}

interface AddressAutocompleteProps {
  value: GeoAddress | null;
  onSelect: (address: GeoAddress | null) => void;
  placeholder?: string;
  label?: string;
}

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

// ── Constants ──

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const MAX_PREDICTIONS = 5;

// ── Client-side geohash encoder (same algorithm as geohashService.ts) ──

function encodeGeohash(latitude: number, longitude: number, precision = 6): string {
  let latRange = { min: -90, max: 90 };
  let lonRange = { min: -180, max: 180 };
  let hash = '';
  let bit = 0;
  let ch = 0;
  let isEven = true;

  while (hash.length < precision) {
    if (isEven) {
      const mid = (lonRange.min + lonRange.max) / 2;
      if (longitude >= mid) {
        ch |= 1 << (4 - bit);
        lonRange.min = mid;
      } else {
        lonRange.max = mid;
      }
    } else {
      const mid = (latRange.min + latRange.max) / 2;
      if (latitude >= mid) {
        ch |= 1 << (4 - bit);
        latRange.min = mid;
      } else {
        latRange.max = mid;
      }
    }

    isEven = !isEven;
    bit++;

    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

// ── Component ──

export function AddressAutocomplete({
  value,
  onSelect,
  placeholder,
  label,
}: AddressAutocompleteProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();

  const [query, setQuery] = useState(value?.address ?? '');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync query text when value changes externally (e.g. Firestore sync)
  useEffect(() => {
    if (value?.address && query !== value.address) {
      setQuery(value.address);
    }
  }, [value?.address]);

  // ── Autocomplete ──

  const fetchPredictions = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim() || !GOOGLE_MAPS_API_KEY) {
      setPredictions([]);
      setDropdownVisible(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `${PLACES_BASE}/autocomplete/json?input=${encodeURIComponent(text)}&key=${GOOGLE_MAPS_API_KEY}&language=he&components=country:il`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.predictions) {
          setPredictions(json.predictions.slice(0, MAX_PREDICTIONS));
          setDropdownVisible(json.predictions.length > 0);
        }
      } catch {
        // silently fail
      }
    }, 300);
  }, []);

  const handleTextChange = useCallback(
    (text: string) => {
      setQuery(text);
      // If user edits after a resolved value, clear the selection
      if (value) {
        onSelect(null);
      }
      fetchPredictions(text);
    },
    [fetchPredictions, value, onSelect],
  );

  // ── Select prediction → resolve Place Details → compute geohash ──

  const handleSelectPrediction = useCallback(
    async (prediction: Prediction) => {
      setLoading(true);
      setDropdownVisible(false);
      setPredictions([]);
      try {
        const url = `${PLACES_BASE}/details/json?place_id=${prediction.place_id}&fields=geometry,formatted_address&key=${GOOGLE_MAPS_API_KEY}&language=he`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.result?.geometry?.location) {
          const { lat, lng } = json.result.geometry.location;
          const resolvedAddress = json.result.formatted_address || prediction.description;
          const geo: GeoAddress = {
            address: resolvedAddress,
            lat,
            lng,
            geohash: encodeGeohash(lat, lng, 6),
          };
          setQuery(resolvedAddress);
          onSelect(geo);
        } else {
          // No coords — use description as text-only fallback (no geohash)
          setQuery(prediction.description);
          onSelect(null);
        }
      } catch {
        setQuery(prediction.description);
        onSelect(null);
      } finally {
        setLoading(false);
      }
    },
    [onSelect],
  );

  // ── Clear ──

  const handleClear = useCallback(() => {
    setQuery('');
    setPredictions([]);
    setDropdownVisible(false);
    onSelect(null);
  }, [onSelect]);

  // ── Derived state ──

  const isResolved = value !== null;
  const inputBorderColor = isResolved ? colors.success : colors.inputBorder;

  // ── Render ──

  return (
    <View style={styles.wrapper}>
      {/* Optional label */}
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      ) : null}

      {/* Input row */}
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.inputBg,
            borderColor: inputBorderColor,
          },
        ]}
      >
        <TextInput
          style={[styles.textInput, { color: colors.textPrimary }]}
          placeholder={placeholder ?? t('addressAutocomplete.searchPlaceholder')}
          placeholderTextColor={colors.inputPlaceholder}
          value={query}
          onChangeText={handleTextChange}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />

        {/* Right-side indicators */}
        {loading ? (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={styles.indicator}
          />
        ) : isResolved ? (
          <View style={styles.indicators}>
            <Text style={[styles.checkmark, { color: colors.success }]}>✓</Text>
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={t('addressAutocomplete.clearAddress')}
            >
              <Text style={[styles.clearIcon, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* Predictions dropdown — rendered in-flow below the input */}
      {dropdownVisible && predictions.length > 0 && (
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              shadowColor: colors.textPrimary,
            },
          ]}
        >
          {predictions.map((item, index) => (
            <TouchableOpacity
              key={item.place_id}
              style={[
                styles.predictionRow,
                index < predictions.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.borderLight,
                },
              ]}
              onPress={() => handleSelectPrediction(item)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.predictionMain, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {item.structured_formatting?.main_text || item.description}
              </Text>
              {item.structured_formatting?.secondary_text ? (
                <Text
                  style={[styles.predictionSub, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {item.structured_formatting.secondary_text}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* No results hint */}
      {dropdownVisible && predictions.length === 0 && !loading && query.trim().length > 0 && (
        <View style={[styles.noResultsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.noResultsText, { color: colors.textSecondary }]}>
            {t('addressAutocomplete.noResults')}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  wrapper: {},
  label: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  textInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    paddingVertical: 0,
  },
  indicator: {
    marginLeft: SPACING.sm,
  },
  indicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginLeft: SPACING.sm,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: '700',
  },
  clearIcon: {
    fontSize: 14,
    fontWeight: '600',
  },
  dropdown: {
    marginTop: SPACING.xs,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    zIndex: 999,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  predictionRow: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  predictionMain: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '600',
  },
  predictionSub: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  noResultsRow: {
    marginTop: SPACING.xs,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    zIndex: 999,
    elevation: 8,
  },
  noResultsText: {
    ...TYPOGRAPHY.bodySmall,
    textAlign: 'center',
  },
});
