import React, { useEffect } from 'react';
import { View, Text, StyleSheet, I18nManager } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export function OfflineBanner(): React.JSX.Element | null {
  const { isConnected } = useNetworkStatus();
  const translateY = useSharedValue(-60);

  useEffect(() => {
    translateY.value = withTiming(isConnected ? -60 : 0, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [isConnected, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.banner}>
        <Text style={styles.text}>
          {I18nManager.isRTL ? '\u05D0\u05D9\u05DF \u05D7\u05D9\u05D1\u05D5\u05E8 \u05DC\u05D0\u05D9\u05E0\u05D8\u05E8\u05E0\u05D8' : 'No internet connection'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  banner: {
    backgroundColor: '#E53935',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
