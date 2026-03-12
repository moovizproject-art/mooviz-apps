import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Image,
  Dimensions,
} from 'react-native';
import { strings } from '../i18n/strings';

const carImage = require('../assets/car.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackColors?: {
    background: string;
    textPrimary: string;
    textSecondary: string;
    primary: string;
    border: string;
    error: string;
  };
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private carX = new Animated.Value(SCREEN_WIDTH * 0.7);
  private carRotate = new Animated.Value(0);
  private shakeAnim = new Animated.Value(0);

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  componentDidUpdate(_prevProps: ErrorBoundaryProps, prevState: ErrorBoundaryState): void {
    if (this.state.hasError && !prevState.hasError) {
      this.runCrashAnimation();
    }
  }

  private runCrashAnimation(): void {
    this.carX.setValue(SCREEN_WIDTH * 0.7);
    this.carRotate.setValue(0);
    this.shakeAnim.setValue(0);

    Animated.sequence([
      // Car drives in
      Animated.timing(this.carX, {
        toValue: SCREEN_WIDTH * 0.3,
        duration: 1000,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      // Crash!
      Animated.parallel([
        Animated.timing(this.carRotate, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(this.shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
          Animated.timing(this.shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
          Animated.timing(this.shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
          Animated.timing(this.shakeAnim, { toValue: -4, duration: 50, useNativeDriver: true }),
          Animated.timing(this.shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]),
      ]),
      // Settle
      Animated.timing(this.carRotate, {
        toValue: 0.5,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }

  private handleRetry = (): void => {
    this.carX.setValue(SCREEN_WIDTH * 0.7);
    this.carRotate.setValue(0);
    this.shakeAnim.setValue(0);
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const c = this.props.fallbackColors || {
      background: '#FFFFFF',
      textPrimary: '#1A1A2E',
      textSecondary: '#6B7280',
      primary: '#1A73E8',
      border: '#E5E7EB',
      error: '#EA4335',
    };

    const carRotateInterpolate = this.carRotate.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: ['0deg', '15deg', '-12deg'],
    });

    return (
      <Animated.View style={[styles.container, { backgroundColor: c.background, transform: [{ translateX: this.shakeAnim }] }]}>
        {/* Car crash scene */}
        <View style={styles.carScene}>
          <View style={[styles.road, { backgroundColor: c.border }]} />
          {/* Crash barrier */}
          <View style={[styles.barrier, { backgroundColor: c.error }]}>
            <Text style={styles.barrierText}>!</Text>
          </View>
          <Animated.View
            style={[
              styles.carWrap,
              { transform: [{ translateX: this.carX }, { rotate: carRotateInterpolate }] },
            ]}
          >
            <Image source={carImage} style={styles.carImage} resizeMode="contain" />
          </Animated.View>
        </View>

        <Text style={[styles.title, { color: c.textPrimary }]}>
          {strings.errorBoundary.title.he}
        </Text>
        <Text style={[styles.message, { color: c.textSecondary }]}>
          {strings.errorBoundary.message.he}
        </Text>

        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: c.primary }]}
          onPress={this.handleRetry}
        >
          <Text style={styles.retryButtonText}>{strings.errorBoundary.retry.he}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  carScene: {
    width: '100%',
    height: 100,
    marginBottom: 32,
    position: 'relative',
    overflow: 'hidden',
  },
  road: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },
  barrier: {
    position: 'absolute',
    bottom: 10,
    left: '30%',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barrierText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  carWrap: {
    position: 'absolute',
    bottom: 14,
  },
  carImage: {
    width: 50,
    height: 50,
    transform: [{ scaleX: -1 }],
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  retryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
