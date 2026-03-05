import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, StyleSheet, Text, Easing } from 'react-native';
import { COLORS } from '../constants/colors';

const carImage = require('../assets/car.png');

interface LoadingTruckProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

export function LoadingTruck({
  message = 'טוען...',
  size = 'medium',
}: LoadingTruckProps): React.JSX.Element {
  const translateX = useRef(new Animated.Value(-80)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const dotOpacity1 = useRef(new Animated.Value(0.3)).current;
  const dotOpacity2 = useRef(new Animated.Value(0.3)).current;
  const dotOpacity3 = useRef(new Animated.Value(0.3)).current;

  const imageSize = size === 'small' ? 40 : size === 'large' ? 80 : 60;

  useEffect(() => {
    // Truck drives across
    const driveAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 80,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -80,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    // Subtle bounce while driving
    const bounceAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: -4,
          duration: 150,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 150,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    // Loading dots animation
    const dotAnimation = Animated.loop(
      Animated.stagger(300, [
        Animated.sequence([
          Animated.timing(dotOpacity1, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dotOpacity1, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(dotOpacity2, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dotOpacity2, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(dotOpacity3, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dotOpacity3, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ]),
      ]),
    );

    driveAnimation.start();
    bounceAnimation.start();
    dotAnimation.start();

    return () => {
      driveAnimation.stop();
      bounceAnimation.stop();
      dotAnimation.stop();
    };
  }, [translateX, bounce, dotOpacity1, dotOpacity2, dotOpacity3]);

  return (
    <View style={styles.container}>
      <View style={styles.truckTrack}>
        <Animated.View
          style={{
            transform: [{ translateX }, { translateY: bounce }],
          }}
        >
          <Image
            source={carImage}
            style={{ width: imageSize, height: imageSize }}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {message && (
        <View style={styles.messageRow}>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.dots}>
            <Animated.Text style={[styles.dot, { opacity: dotOpacity1 }]}>●</Animated.Text>
            <Animated.Text style={[styles.dot, { opacity: dotOpacity2 }]}>●</Animated.Text>
            <Animated.Text style={[styles.dot, { opacity: dotOpacity3 }]}>●</Animated.Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  truckTrack: {
    width: 200,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 4,
  },
  message: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  dots: {
    flexDirection: 'row',
    gap: 2,
  },
  dot: {
    fontSize: 8,
    color: COLORS.primary,
  },
});
