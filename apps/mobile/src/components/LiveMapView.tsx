import React, { useEffect, useState, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Linking, Dimensions } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { RootStackParamList } from '../navigation/RootNavigator';

interface LiveMapViewProps {
  pickup: { latitude: number; longitude: number; address?: string };
  destination: { latitude: number; longitude: number; address?: string };
  driverId: string;
  driverPhone?: string;
  chatId?: string;
  recipientName?: string;
  isFullScreen?: boolean;
  onExpand?: () => void;
  onCollapse?: () => void;
}

interface DriverLocation {
  lat: number;
  lng: number;
}

export function LiveMapView({
  pickup, destination, driverId, driverPhone, chatId, recipientName,
  isFullScreen = false, onExpand, onCollapse,
}: LiveMapViewProps): React.JSX.Element {
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const mapRef = useRef<MapView>(null);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const { t } = useI18n();

  // Listen to driver location in real-time
  useEffect(() => {
    if (!driverId) return;
    const unsubscribe = firestore()
      .collection('users')
      .doc(driverId)
      .onSnapshot((snap) => {
        const data = snap.data();
        if (data?.location?.lat && data?.location?.lng) {
          setDriverLocation({ lat: data.location.lat, lng: data.location.lng });
        }
      });
    return unsubscribe;
  }, [driverId]);

  // Fit map to show all markers
  useEffect(() => {
    if (!mapRef.current) return;
    const coords = [
      { latitude: pickup.latitude, longitude: pickup.longitude },
      { latitude: destination.latitude, longitude: destination.longitude },
    ];
    if (driverLocation) {
      coords.push({ latitude: driverLocation.lat, longitude: driverLocation.lng });
    }
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }, 500);
  }, [pickup, destination, driverLocation]);

  const handleMessage = () => {
    if (chatId && recipientName) {
      navigation.navigate('ChatRoom', { chatId, recipientName });
    }
  };

  const handleCall = () => {
    if (driverPhone) {
      Linking.openURL(`tel:${driverPhone}`);
    }
  };

  const mapHeight = isFullScreen ? Dimensions.get('window').height : 250;

  return (
    <View style={[styles.container, { height: mapHeight }]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {/* Pickup marker - green */}
        <Marker
          coordinate={{ latitude: pickup.latitude, longitude: pickup.longitude }}
          title={t('map.pickup')}
          description={pickup.address}
          pinColor="green"
        />

        {/* Destination marker - red */}
        <Marker
          coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
          title={t('map.destination')}
          description={destination.address}
          pinColor="red"
        />

        {/* Driver marker - blue */}
        {driverLocation && (
          <Marker
            coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }}
            title={t('map.driver')}
            pinColor="#2196F3"
          />
        )}
      </MapView>

      {/* Floating Action Buttons */}
      <View style={[styles.fabContainer, isFullScreen ? styles.fabContainerFullScreen : styles.fabContainerInline]}>
        {/* Expand / Collapse */}
        {!isFullScreen && onExpand && (
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.primary }]}
            onPress={onExpand}
          >
            <Text style={styles.fabIcon}>{'\u2197'}</Text>
          </TouchableOpacity>
        )}
        {isFullScreen && onCollapse && (
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.surface }]}
            onPress={onCollapse}
          >
            <Text style={[styles.fabIcon, { color: colors.textPrimary }]}>{'\u2715'}</Text>
          </TouchableOpacity>
        )}

        {/* Message button */}
        {chatId && (
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.primary }]}
            onPress={handleMessage}
          >
            <Text style={styles.fabIcon}>{'\uD83D\uDCAC'}</Text>
          </TouchableOpacity>
        )}

        {/* Call button */}
        {driverPhone && (
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: '#4CAF50' }]}
            onPress={handleCall}
          >
            <Text style={styles.fabIcon}>{'\uD83D\uDCDE'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  fabContainer: {
    position: 'absolute',
    gap: 8,
  },
  fabContainerInline: {
    bottom: 12,
    right: 12,
  },
  fabContainerFullScreen: {
    top: 60,
    right: 16,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabIcon: {
    fontSize: 20,
    color: '#fff',
  },
});
