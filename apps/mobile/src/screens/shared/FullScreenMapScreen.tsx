import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';

const MAP_PROVIDER = Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;
import { LiveMapView } from '../../components/LiveMapView';
import { useTheme } from '../../theme/ThemeContext';

interface FullScreenMapParams {
  pickup: { latitude: number; longitude: number; address?: string };
  destination: { latitude: number; longitude: number; address?: string };
  driverId?: string;
  driverPhone?: string;
  chatId?: string;
  recipientName?: string;
}

export function FullScreenMapScreen(): React.JSX.Element {
  const route = useRoute();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const params = route.params as FullScreenMapParams;
  const hasDriver = !!params.driverId;

  return (
    <View style={styles.container}>
      {hasDriver ? (
        <LiveMapView
          pickup={params.pickup}
          destination={params.destination}
          driverId={params.driverId!}
          driverPhone={params.driverPhone}
          chatId={params.chatId}
          recipientName={params.recipientName}
          isFullScreen
          onCollapse={() => navigation.goBack()}
        />
      ) : (
        <>
          <MapView
            provider={MAP_PROVIDER}
            style={StyleSheet.absoluteFillObject}
            initialRegion={{
              latitude: (params.pickup.latitude + params.destination.latitude) / 2,
              longitude: (params.pickup.longitude + params.destination.longitude) / 2,
              latitudeDelta: Math.abs(params.pickup.latitude - params.destination.latitude) * 1.6 + 0.01,
              longitudeDelta: Math.abs(params.pickup.longitude - params.destination.longitude) * 1.6 + 0.01,
            }}
          >
            <Marker coordinate={params.pickup} pinColor="green" title={params.pickup.address} />
            <Marker coordinate={params.destination} pinColor="red" title={params.destination.address} />
          </MapView>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.surface }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.closeIcon, { color: colors.textPrimary }]}>✕</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 16,
    end: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: { elevation: 6 },
    }),
  },
  closeIcon: {
    fontSize: 18,
    fontWeight: '700',
  },
});
