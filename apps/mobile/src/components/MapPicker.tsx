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
  Platform,
  Alert,
} from 'react-native';
import MapView, { Marker, Region, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';

const MAP_PROVIDER = Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../theme/tokens';
import { GOOGLE_MAPS_API_KEY, DEFAULT_MAP_REGION } from '../constants/config';

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

type PickerMode = 'search' | 'map';

const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';
const GEOCODE_BASE = 'https://maps.googleapis.com/maps/api/geocode';

/**
 * MapPicker — Two-step address picker:
 * 1. Search mode: type address, get autocomplete suggestions
 * 2. Map mode: see selected location on map, drag pin to fine-tune, confirm
 */
export function MapPicker({ onLocationSelect, onCancel, initialLocation }: MapPickerProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();

  const [mode, setMode] = useState<PickerMode>(initialLocation ? 'map' : 'search');
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<GeoPoint | null>(
    initialLocation
      ? { latitude: initialLocation.latitude, longitude: initialLocation.longitude, address: '' }
      : null,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<MapView>(null);

  // ── Search / Autocomplete ──

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
        // silently fail
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
        const point: GeoPoint = {
          latitude: json.result.geometry.location.lat,
          longitude: json.result.geometry.location.lng,
          address: json.result.formatted_address || prediction.description,
        };
        setSelectedPoint(point);
        setQuery(point.address);
        setMode('map');
      } else {
        Alert.alert(t('common.error'), t('map.addressNotFound'));
      }
    } catch {
      Alert.alert(t('common.error'), t('map.mapsError'));
    } finally {
      setLoading(false);
    }
  }, [onLocationSelect]);

  const handleManualSubmit = useCallback(() => {
    if (!query.trim()) return;
    Keyboard.dismiss();
    // If we have a selected point with coords, go to map mode
    if (selectedPoint && selectedPoint.latitude !== 0) {
      setMode('map');
      return;
    }
    // Free text without coords — force user to select from suggestions or tap map
    Alert.alert(t('map.selectAddress'), t('map.selectAddressHint'));
  }, [query, selectedPoint]);

  // ── Map mode handlers ──

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    if (!GOOGLE_MAPS_API_KEY) return '';
    try {
      const url = `${GEOCODE_BASE}/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&language=he`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.results?.[0]?.formatted_address) {
        return json.results[0].formatted_address;
      }
    } catch {
      // ignore
    }
    return '';
  }, []);

  const handleMarkerDragEnd = useCallback(async (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setLoading(true);
    const address = await reverseGeocode(latitude, longitude);
    setSelectedPoint({ latitude, longitude, address: address || query });
    if (address) setQuery(address);
    setLoading(false);
  }, [reverseGeocode, query]);

  const handleMapPress = useCallback(async (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setLoading(true);
    const address = await reverseGeocode(latitude, longitude);
    const point = { latitude, longitude, address: address || query };
    setSelectedPoint(point);
    if (address) setQuery(address);
    setLoading(false);
  }, [reverseGeocode, query]);

  const handleConfirmLocation = useCallback(() => {
    if (selectedPoint) {
      onLocationSelect(selectedPoint);
    }
  }, [selectedPoint, onLocationSelect]);

  const handleBackToSearch = useCallback(() => {
    setMode('search');
    setPredictions([]);
  }, []);

  // ── Map region ──
  const mapRegion: Region = selectedPoint && selectedPoint.latitude !== 0
    ? {
        latitude: selectedPoint.latitude,
        longitude: selectedPoint.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }
    : DEFAULT_MAP_REGION;

  // ── Render ──

  if (mode === 'map' && selectedPoint) {
    return (
      <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
        <View style={[styles.overlay, { backgroundColor: colors.background }]}>
          {/* Map header */}
          <View style={[styles.mapHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={handleBackToSearch} style={styles.backButton}>
              <Text style={[styles.backArrow, { color: colors.primary }]}>{'<'}</Text>
            </TouchableOpacity>
            <View style={styles.mapHeaderCenter}>
              <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                {selectedPoint.address || t('form.selectAddress')}
              </Text>
              {loading && <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 4 }} />}
            </View>
            <View style={styles.backButton} />
          </View>

          {/* Map */}
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              provider={MAP_PROVIDER}
              style={styles.map}
              initialRegion={mapRegion}
              onPress={handleMapPress}
              showsUserLocation
              showsMyLocationButton
            >
              <Marker
                coordinate={{ latitude: selectedPoint.latitude, longitude: selectedPoint.longitude }}
                draggable
                onDragEnd={handleMarkerDragEnd}
              />
            </MapView>

            {/* Hint overlay */}
            <View style={[styles.mapHint, { backgroundColor: colors.surface }]}>
              <Text style={[styles.mapHintText, { color: colors.textSecondary }]}>
                {t('form.dragPinHint')}
              </Text>
            </View>
          </View>

          {/* Confirm button */}
          <View style={[styles.confirmContainer, { backgroundColor: colors.background }]}>
            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: colors.primary }]}
              onPress={handleConfirmLocation}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmButtonText}>{t('form.confirmAddress')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // Search mode
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
          <TouchableOpacity
            onPress={() => {
              if (selectedPoint && selectedPoint.latitude !== 0) {
                setMode('map');
              }
            }}
            style={styles.cancelButton}
          >
            <Text style={[styles.mapToggleText, { color: selectedPoint ? colors.primary : colors.textTertiary }]}>
              {t('form.mapView')}
            </Text>
          </TouchableOpacity>
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
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  mapHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
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
  mapToggleText: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '600',
    textAlign: 'right',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 24,
    fontWeight: '700',
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
  // Map mode
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapHint: {
    position: 'absolute',
    top: SPACING.md,
    alignSelf: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  mapHintText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
  },
  confirmContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    paddingBottom: SPACING.xxl,
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
