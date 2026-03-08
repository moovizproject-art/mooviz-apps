import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { LiveMapView } from '../../components/LiveMapView';

interface FullScreenMapParams {
  pickup: { latitude: number; longitude: number; address?: string };
  destination: { latitude: number; longitude: number; address?: string };
  driverId: string;
  driverPhone?: string;
  chatId?: string;
  recipientName?: string;
}

export function FullScreenMapScreen(): React.JSX.Element {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params as FullScreenMapParams;

  return (
    <View style={styles.container}>
      <LiveMapView
        pickup={params.pickup}
        destination={params.destination}
        driverId={params.driverId}
        driverPhone={params.driverPhone}
        chatId={params.chatId}
        recipientName={params.recipientName}
        isFullScreen
        onCollapse={() => navigation.goBack()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
