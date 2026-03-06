import React, { useRef, useState, useCallback, useEffect } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../theme/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';

const logo = require('../../assets/logo.png');
const carImage = require('../../assets/car.png');
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
    bullets: [
      { textKey: 'onboarding.senderBullet1', icon: '\u{26A1}' },
      { textKey: 'onboarding.senderBullet2', icon: '\u{1F697}' },
      { textKey: 'onboarding.senderBullet3', icon: '\u{1F4CD}' },
    ],
  },
  {
    key: 'driver',
    titleKey: 'onboarding.driverTitle',
    bullets: [
      { textKey: 'onboarding.driverBullet1', icon: '\u{1F50D}' },
      { textKey: 'onboarding.driverBullet2', icon: '\u{23F0}' },
      { textKey: 'onboarding.driverBullet3', icon: '\u{1F4B0}' },
    ],
  },
  {
    key: 'getStarted',
    titleKey: 'onboarding.getStarted',
    subtitleKey: 'onboarding.getStartedSubtitle',
    isLast: true,
  },
];

const BLUE = '#1565C0';
const BLUE_LIGHT = '#1E88E5';
const HEADER_HEIGHT = SCREEN_HEIGHT * 0.22;

export function OnboardingScreen({ onComplete }: OnboardingScreenProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const carX = useRef(new Animated.Value(-80)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
    try {
      await AsyncStorage.setItem('@onboarding_complete', 'true');
    } catch {
      // proceed anyway
    }
    onComplete();
  }, [onComplete]);

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
            <Image source={logo} style={styles.logoInCircle} resizeMode="contain" />
          </View>
          {/* Decorative wave bottom */}
          <View style={styles.waveCurve} />
        </View>

        {/* Content card */}
        <Animated.View style={[
          styles.contentSection,
          {
            opacity: fadeAnim,
            transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
          },
        ]}>
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
                <View key={i} style={[styles.bulletRow, { backgroundColor: '#F0F7FF' }]}>
                  <View style={styles.bulletIconBg}>
                    <Text style={styles.bulletIcon}>{bullet.icon}</Text>
                  </View>
                  <Text style={[styles.bulletText, { color: colors.textPrimary }]}>{t(bullet.textKey)}</Text>
                </View>
              ))}
            </View>
          )}

          {item.isLast && (
            <View style={styles.lastPageExtra}>
              <Image source={logo} style={styles.footerLogo} resizeMode="contain" />
            </View>
          )}
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
            <TouchableOpacity
              style={[styles.nextButton, { backgroundColor: BLUE }]}
              onPress={handleNext}
              activeOpacity={0.8}
            >
              <Text style={styles.nextButtonText}>{t('onboarding.next')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleComplete} style={styles.skipButton}>
              <Text style={[styles.skipText, { color: colors.textSecondary }]}>{t('onboarding.skip')}</Text>
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
    paddingTop: 52,
    position: 'relative',
    overflow: 'hidden',
  },
  logoCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  logoInCircle: {
    width: 72,
    height: 72,
  },
  illustrationArea: {
    alignItems: 'center',
    marginTop: 14,
  },
  illustration: {
    width: SCREEN_WIDTH * 0.75,
    height: SCREEN_WIDTH * 0.42,
    borderRadius: 16,
  },
  waveCurve: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: '#FAFBFC',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  // ── Content section ──
  contentSection: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 20,
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
    marginTop: 12,
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  bulletIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletIcon: {
    fontSize: 20,
  },
  bulletText: {
    fontSize: 16,
    lineHeight: 22,
    flex: 1,
    fontWeight: '500',
  },
  lastPageExtra: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
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
    flexDirection: 'row-reverse',
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
