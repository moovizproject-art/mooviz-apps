/**
 * OnboardingScreen — מסך פתיחה
 * Full-screen background photos with glassmorphism feature cards.
 * 4 swipeable slides matching the client's design spec.
 */
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
  ImageBackground,
  ViewToken,
  Platform,
  I18nManager,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useI18n } from '../../i18n/I18nContext';
import { useSound } from '../../hooks/useSound';

const logo = require('../../assets/logo.png');
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isRTL = I18nManager.isRTL;

// Full-screen background images for each slide
const bgImages: Record<string, any> = {
  getStarted: require('../../assets/onboarding/welcome.jpg'),
  driver: require('../../assets/onboarding/driver.jpg'),
  sender: require('../../assets/onboarding/sender.jpg'),
  community: require('../../assets/onboarding/getStarted.jpg'),
};

interface OnboardingScreenProps {
  onComplete: () => void;
}

interface BulletItem {
  textKey: string;
  icon: string;
}

interface PageData {
  key: string;
  titleKey: string;
  subtitleKey: string;
  bullets?: BulletItem[];
  isLast?: boolean;
}

const PAGES: PageData[] = [
  {
    key: 'getStarted',
    titleKey: 'onboarding.welcome',
    subtitleKey: 'onboarding.welcomeTagline',
  },
  {
    key: 'driver',
    titleKey: 'onboarding.driverTitle',
    subtitleKey: 'onboarding.driverSubtitle',
    bullets: [
      { textKey: 'onboarding.driverBullet1', icon: '🔍' },
      { textKey: 'onboarding.driverBullet2', icon: '🕐' },
      { textKey: 'onboarding.driverBullet3', icon: '💳' },
    ],
  },
  {
    key: 'sender',
    titleKey: 'onboarding.senderTitle',
    subtitleKey: 'onboarding.senderSubtitle',
    bullets: [
      { textKey: 'onboarding.senderBullet1', icon: '⚡' },
      { textKey: 'onboarding.senderBullet2', icon: '📢' },
      { textKey: 'onboarding.senderBullet3', icon: '📍' },
    ],
  },
  {
    key: 'community',
    titleKey: 'onboarding.communityTitle',
    subtitleKey: 'onboarding.communitySubtitle',
    bullets: [
      { textKey: 'onboarding.welcomeBullet1', icon: '🤝' },
      { textKey: 'onboarding.welcomeBullet2', icon: '🛡️' },
      { textKey: 'onboarding.welcomeBullet3', icon: '🌐' },
    ],
    isLast: true,
  },
];

const BLUE = '#3366FF';

export function OnboardingScreen({ onComplete }: OnboardingScreenProps): React.JSX.Element {
  const { t } = useI18n();
  const { play } = useSound();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // RTL: Force FlatList to start at index 0
  useEffect(() => {
    if (isRTL) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: 0, animated: false });
      }, 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [currentIndex, fadeAnim]);

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

  const isLastSlide = currentIndex === PAGES.length - 1;

  const renderPage = ({ item }: { item: PageData }) => (
    <View style={[styles.page, { width: SCREEN_WIDTH }]}>
      <ImageBackground
        source={bgImages[item.key]}
        style={styles.bgImage}
        resizeMode="cover"
      >
        {/* Dark gradient overlay */}
        <View style={styles.darkOverlay} />

        {/* Top bar: logo RIGHT, skip LEFT (explicit for RTL) */}
        <View style={styles.topBar}>
          <View style={styles.logoRow}>
            <Image source={logo} style={styles.realLogo} resizeMode="contain" />
          </View>
          {!item.isLast ? (
            <TouchableOpacity onPress={handleComplete} style={styles.skipBtn}>
              <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 50 }} />}
        </View>

        {/* Content area — title, subtitle, glass cards */}
        <Animated.View style={[
          styles.contentArea,
          {
            opacity: fadeAnim,
            transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          },
        ]}>
          <View style={styles.textBlock}>
            <Text style={styles.pageTitle}>{t(item.titleKey)}</Text>
            <Text style={styles.pageSubtitle}>{t(item.subtitleKey)}</Text>
          </View>

          {item.bullets && (
            <View style={styles.bulletList}>
              {item.bullets.map((bullet, i) => (
                <GlassCard key={i} icon={bullet.icon} text={t(bullet.textKey)} />
              ))}
            </View>
          )}
        </Animated.View>

        {/* Bottom bar: dots RIGHT, button LEFT (visual RTL) */}
        <View style={styles.bottomBar}>
          <View style={styles.dotsRow}>
            {PAGES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === currentIndex && styles.dotActive,
                ]}
              />
            ))}
          </View>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.nextButtonArrow}>←</Text>
            <Text style={styles.nextButtonText}>
              {item.isLast ? t('onboarding.getStarted') : t('onboarding.next')}
            </Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
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
      />
    </View>
  );
}

/** Glassmorphism feature card — pure RN, no native blur dependency */
function GlassCard({ icon, text }: { icon: string; text: string }): React.JSX.Element {
  return (
    <View style={styles.glassCardOuter}>
      <View style={styles.glassCardInner}>
        <Text style={styles.glassText}>{text}</Text>
        <View style={styles.glassIconBg}>
          <Text style={styles.glassIcon}>{icon}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  page: {
    flex: 1,
  },
  bgImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  // ── Top bar ──
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    zIndex: 10,
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '500',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  realLogo: {
    width: 140,
    height: 45,
    tintColor: '#FFFFFF',
  },

  // ── Content area ──
  contentArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    zIndex: 5,
    direction: 'rtl',
  },
  textBlock: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    marginBottom: 8,
  },
  pageSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // ── Glass cards ──
  bulletList: {
    gap: 10,
  },
  glassCardOuter: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  glassCardInner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 12,
  },
  glassText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  glassIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(51,102,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassIcon: {
    fontSize: 18,
  },

  // ── Bottom bar ──
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    zIndex: 10,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BLUE,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 8,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  nextButtonArrow: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    width: 24,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
});
