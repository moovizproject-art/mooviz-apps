import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  Image,
  ViewToken,
  Platform,
  ScrollView,
  I18nManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { useSound } from '../../hooks/useSound';

const logo = require('../../assets/logo.png');
// logo.jpg = old small logo, logo.png = new high-res logo
const carImage = require('../../assets/car.png');
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isRTL = I18nManager.isRTL;

// Onboarding illustrations
const pageImages: Record<string, any> = {
  welcome: require('../../assets/onboarding/welcome.jpg'),
  sender: require('../../assets/onboarding/sender.jpg'),
  driver: require('../../assets/onboarding/driver.jpg'),
  getStarted: require('../../assets/onboarding/getStarted.jpg'),
};

interface OnboardingScreenProps {
  onComplete: () => void;
}

interface PageData {
  key: string;
  titleKey: string;
  subtitleKey?: string;
  bullets?: { textKey: string; icon: string }[];
  isLast?: boolean;
}

const PAGES: PageData[] = [
  {
    key: 'welcome',
    titleKey: 'onboarding.welcome',
    subtitleKey: 'onboarding.welcomeTagline',
    bullets: [
      { textKey: 'onboarding.welcomeBullet1', icon: '\u{1F91D}' },
      { textKey: 'onboarding.welcomeBullet2', icon: '\u{2705}' },
      { textKey: 'onboarding.welcomeBullet3', icon: '\u{1F4F1}' },
    ],
  },
  {
    key: 'sender',
    titleKey: 'onboarding.senderTitle',
    subtitleKey: 'onboarding.senderSubtitle',
    bullets: [
      { textKey: 'onboarding.senderBullet1', icon: '\u{26A1}' },
      { textKey: 'onboarding.senderBullet2', icon: '\u{1F697}' },
      { textKey: 'onboarding.senderBullet3', icon: '\u{1F4CD}' },
    ],
  },
  {
    key: 'driver',
    titleKey: 'onboarding.driverTitle',
    subtitleKey: 'onboarding.driverSubtitle',
    bullets: [
      { textKey: 'onboarding.driverBullet1', icon: '\u{1F50D}' },
      { textKey: 'onboarding.driverBullet2', icon: '\u{23F0}' },
      { textKey: 'onboarding.driverBullet3', icon: '\u{1F4B0}' },
    ],
    isLast: true,
  },
];

const BLUE = '#1565C0';
const BLUE_LIGHT = '#1E88E5';
const HEADER_HEIGHT = SCREEN_HEIGHT * 0.18;

export function OnboardingScreen({ onComplete }: OnboardingScreenProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { play } = useSound();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const carX = useRef(new Animated.Value(-80)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ⚠️ RTL: Force FlatList to start at index 0 on mount. In RTL the initial
  // scroll position can land on the wrong end. Do NOT use inverted/scaleX/
  // direction/'ltr'/reversed arrays — all tested and broken on physical device.
  useEffect(() => {
    if (isRTL) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: 0, animated: false });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    fadeAnim.setValue(0);
    carX.setValue(SCREEN_WIDTH + 40);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(carX, {
        toValue: -(SCREEN_WIDTH + 40),
        duration: 2500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentIndex, carX, fadeAnim]);

  const handleComplete = useCallback(async () => {
    play('success');
    try {
      await AsyncStorage.setItem('@onboarding_complete', 'true');
    } catch {
      // proceed anyway
    }
    onComplete();
  }, [onComplete, play]);

  const handleNext = useCallback(() => {
    if (currentIndex < PAGES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      handleComplete();
    }
  }, [currentIndex, handleComplete]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderPage = ({ item }: { item: PageData }) => {
    const hasImage = pageImages[item.key];

    return (
      <View style={[styles.page, { width: SCREEN_WIDTH }]}>
        {/* Blue header area with logo only */}
        <View style={styles.headerSection}>
          <View style={styles.logoCircle}>
            <Image source={logo} style={[styles.logoInCircle, { tintColor: '#FFFFFF' }]} resizeMode="contain" />
          </View>
          <View style={[styles.waveCurve, { backgroundColor: colors.background }]} />
        </View>

        {/* Content card */}
        <Animated.View style={[
          styles.contentSection,
          {
            backgroundColor: colors.background,
            opacity: fadeAnim,
            transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          },
        ]}>
          <View style={styles.contentInner}>
            <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>{t(item.titleKey)}</Text>

            {item.subtitleKey && (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t(item.subtitleKey)}</Text>
            )}

            {/* Illustration below title/subtitle */}
            {hasImage && (
              <View style={styles.illustrationArea}>
                <Image source={pageImages[item.key]} style={styles.illustration} resizeMode="cover" />
              </View>
            )}

            {item.bullets && (
              <View style={styles.bulletList}>
                {item.bullets.map((bullet, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <View style={styles.bulletIconBg}>
                      <Text style={styles.bulletIcon}>{bullet.icon}</Text>
                    </View>
                    <Text style={[styles.bulletText, { color: colors.textPrimary }]}>{t(bullet.textKey)}</Text>
                  </View>
                ))}
              </View>
            )}

          </View>
        </Animated.View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        ref={flatListRef}
        data={PAGES}
        keyExtractor={(item) => item.key}
        renderItem={renderPage}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
        style={styles.flatList}
      />

      {/* Car animation strip */}
      <View style={styles.carStrip}>
        <View style={[styles.road, { backgroundColor: colors.border }]} />
        <Animated.View style={{ transform: [{ translateX: carX }] }}>
          <Image source={carImage} style={styles.carImage} resizeMode="contain" />
        </Animated.View>
      </View>

      {/* Dot indicators */}
      <View style={styles.dotsRow}>
        {PAGES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: i === currentIndex ? BLUE : colors.border },
              i === currentIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* Buttons */}
      <View style={styles.buttonsRow}>
        {currentIndex < PAGES.length - 1 ? (
          <>
            <TouchableOpacity onPress={handleComplete} style={styles.skipButton}>
              <Text style={[styles.skipText, { color: colors.textSecondary }]}>{t('onboarding.skip')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nextButton, { backgroundColor: BLUE }]}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <Text style={styles.nextButtonText}>{t('onboarding.next')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: BLUE }]}
            onPress={handleComplete}
            activeOpacity={0.8}
          >
            <Text style={styles.ctaButtonText}>{t('onboarding.getStarted')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flatList: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  // ── Blue header section ──
  headerSection: {
    height: HEADER_HEIGHT,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 0,
    position: 'relative',
    overflow: 'hidden',
    zIndex: 1,
  },
  logoCircle: {
    width: 180,
    height: 180,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
  },
  logoInCircle: {
    width: 180,
    height: 180,
  },
  illustrationArea: {
    alignItems: 'center',
    marginTop: 24,
  },
  illustration: {
    width: SCREEN_WIDTH * 0.75,
    height: SCREEN_WIDTH * 0.44,
    borderRadius: 16,
  },
  waveCurve: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 30,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  // ── Content section ──
  contentSection: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  contentInner: {
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 4,
    paddingHorizontal: 8,
  },
  bulletList: {
    marginTop: 24,
    gap: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: { elevation: 1 },
    }),
  },
  bulletIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletIcon: {
    fontSize: 20,
  },
  bulletText: {
    fontSize: 17,
    lineHeight: 24,
    flex: 1,
    fontWeight: '700',
  },
  lastPageExtra: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
    marginTop: 24,
  },
  footerLogo: {
    width: 220,
    height: 70,
  },
  // ── Bottom controls ──
  carStrip: {
    height: 34,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 2,
  },
  road: {
    position: 'absolute',
    bottom: 5,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },
  carImage: {
    width: 30,
    height: 30,
    transform: [{ scaleX: -1 }],
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    borderRadius: 4,
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  nextButton: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  ctaButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
});
