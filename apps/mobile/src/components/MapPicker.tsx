import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import MapView, { Marker, MapPressEvent, Region } from 'react-native-maps';

import { COLORS } from '../constants/colors';
import { useLocation } from '../hooks/useLocation';

interface GeoPoint {
  latitude: number;
  longitude: number;
  address: string;
}

interface MapPickerProps {
  onLocationSelect: (point: GeoPoint) => void;
  onCancel: () => void;
  initialRegion?: Region;
}

// Default region: Israel center
// אזור ברירת מחדל: מרכז ישראל
const DEFAULT_REGION: Region = {
  latitude: 32.0853,
  longitude: 34.7818,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

/**
 * MapPicker — בוחר מיקום במפה
 * Google Maps with pin placement for address selection.
 * מפת גוגל עם סיכה לבחירת כתובת
 */
export function MapPicker({
  onLocationSelect,
  onCancel,
  initialRegion,
}: MapPickerProps): React.JSX.Element {
  const { location } = useLocation();

  const startRegion: Region = initialRegion || (location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : DEFAULT_REGION);

  const [selectedPoint, setSelectedPoint] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const handleMapPress = useCallback((event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectedPoint({ latitude, longitude });
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selectedPoint) return;

    // TODO: Reverse geocode to get address string
    // TODO: ג׳יאוקודינג הפוך לקבלת כתובת
    onLocationSelect({
      latitude: selectedPoint.latitude,
      longitude: selectedPoint.longitude,
      address: `${selectedPoint.latitude.toFixed(4)}, ${selectedPoint.longitude.toFixed(4)}`,
    });
  }, [selectedPoint, onLocationSelect]);

  return (
    <Modal animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel}>
            <Text style={styles.cancelText}>ביטול</Text>
            {/* Cancel */}
          </TouchableOpacity>
          <Text style={styles.title}>בחר מיקום</Text>
          {/* Select location */}
          <TouchableOpacity onPress={handleConfirm} disabled={!selectedPoint}>
            <Text style={[styles.confirmText, !selectedPoint && styles.confirmTextDisabled]}>
              אישור
            </Text>
            {/* Confirm */}
          </TouchableOpacity>
        </View>

        {/* Map */}
        <MapView
          style={styles.map}
          initialRegion={startRegion}
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton
        >
          {selectedPoint && (
            <Marker
              coordinate={selectedPoint}
              draggable
              onDragEnd={(e) =>
                setSelectedPoint(e.nativeEvent.coordinate)
              }
            />
          )}
        </MapView>

        {/* Instructions */}
        {/* הנחיות */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsText}>
            {selectedPoint
              ? 'לחץ אישור או גרור את הסיכה למיקום המדויק'
              : 'לחץ על המפה לבחירת מיקום'}
            {/* Tap confirm or drag pin / Tap map to select */}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  cancelText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  confirmTextDisabled: {
    opacity: 0.4,
  },
  map: {
    flex: 1,
  },
  instructions: {
    padding: 16,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  instructionsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
