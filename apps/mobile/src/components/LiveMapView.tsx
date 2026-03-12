import React, { useEffect, useState, useRef } from 'react';
import { View, TouchableOpacity, Text, Image, StyleSheet, Linking, Dimensions, I18nManager, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';

const MAP_PROVIDER = Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { RootStackParamList } from '../navigation/RootNavigator';

const carIcon = require('../assets/car.png');

interface LiveMapViewProps {
  pickup: { latitude: number; longitude: number; address?: string };
  destination: { latitude: number; longitude: number; address?: string };
  driverId: string;
  driverPhone?: string;
  chatId?: string;
  recipientName?: string;
  isFullScreen?: boolean;
  hideFabs?: boolean;
  deliveryStatus?: string;
  deliveredAt?: Date | string | null;
  onExpand?: () => void;
  onCollapse?: () => void;
}

interface DriverLocation {
  lat: number;
  lng: number;
}

const DRIVER_HIDE_AFTER_MS = 10 * 60 * 1000; // 10 minutes after delivery

export function LiveMapView({
  pickup, destination, driverId, driverPhone, chatId, recipientName,
  isFullScreen = false, hideFabs = false, deliveryStatus, deliveredAt,
  onExpand, onCollapse,
}: LiveMapViewProps): React.JSX.Element {
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [hideDriver, setHideDriver] = useState(false);
  const mapRef = useRef<MapView>(null);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const { t } = useI18n();

  // Hide driver car 10 min after delivery
  useEffect(() => {
    if (deliveryStatus !== 'delivered' && deliveryStatus !== 'completed_paid') {
      setHideDriver(false);
      return;
    }
    if (!deliveredAt) return;

    const deliveredTime = typeof deliveredAt === 'string' ? new Date(deliveredAt).getTime()
      : deliveredAt instanceof Date ? deliveredAt.getTime()
      : Date.now();
    const elapsed = Date.now() - deliveredTime;

    if (elapsed >= DRIVER_HIDE_AFTER_MS) {
      setHideDriver(true);
      return;
    }

    const timer = setTimeout(() => setHideDriver(true), DRIVER_HIDE_AFTER_MS - elapsed);
    return () => clearTimeout(timer);
  }, [deliveryStatus, deliveredAt]);

  // Listen to driver location in real-time
  useEffect(() => {
    if (!driverId || hideDriver) {
      if (hideDriver) setDriverLocation(null);
      return;
    }
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
  }, [driverId, hideDriver]);

  // Fit map to show all markers on initial load (not on every driver location update)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup, destination]);

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
        provider={MAP_PROVIDER}
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

        {/* Driver marker - car icon */}
        {driverLocation && (
          <Marker
            coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }}
            title={t('map.driver')}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <Image source={carIcon} style={styles.driverMarker} resizeMode="contain" />
          </Marker>
        )}
      </MapView>

      {/* Floating Action Buttons */}
      {!hideFabs && (
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
              style={[styles.fab, { backgroundColor: colors.success || '#4CAF50' }]}
              onPress={handleCall}
            >
              <Text style={styles.fabIcon}>{'\uD83D\uDCDE'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
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
    ...(I18nManager.isRTL ? { left: 12 } : { right: 12 }),
  },
  fabContainerFullScreen: {
    top: 60,
    ...(I18nManager.isRTL ? { left: 16 } : { right: 16 }),
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
  driverMarker: {
    width: 36,
    height: 36,
  },
});
