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
import { BlurView } from '@react-native-community/blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  text: string;
  icon: string;
}

interface PageData {
  key: string;
  title: string;
  subtitle: string;
  bullets?: BulletItem[];
  isLast?: boolean;
}

const PAGES: PageData[] = [
  {
    key: 'getStarted',
    title: 'בואו נתחיל!',
    subtitle: 'הצטרפו לקהילת MOOVIZ עוד היום',
  },
  {
    key: 'driver',
    title: 'הרוויחו בדרך שלך',
    subtitle: 'מצאו משלוחים קרובים, עבדו לפי הלו"ז שלכם',
    bullets: [
      { text: 'מצא משלוחים בקרבתך', icon: '🔍' },
      { text: 'עבוד לפי הזמנים שלך', icon: '🕐' },
      { text: 'קבל תשלום ישיר ומהיר', icon: '💳' },
    ],
  },
  {
    key: 'sender',
    title: 'שלח חבילה בקלות',
    subtitle: 'פרסמו משלוח בשניות, נהגים מהאזור יציעו מחיר',
    bullets: [
      { text: 'פרסם משלוח תוך שניות', icon: '⚡' },
      { text: 'נהגים מהאזור יציעו מחיר', icon: '📢' },
      { text: 'עקוב אחרי המשלוח בזמן אמת', icon: '📍' },
    ],
  },
  {
    key: 'community',
    title: 'ברוכים הבאים לקהילה',
    subtitle: 'הקהילה שמחברת בין שולחים לנהגים',
    bullets: [
      { text: 'שכנים עוזרים לשכנים', icon: '🤝' },
      { text: 'מהיר, בטוח ובמחיר הוגן', icon: '🛡️' },
      { text: 'זמין בכל רגע, בכל מקום', icon: '🌐' },
    ],
    isLast: true,
  },
];

const BLUE = '#3366FF';

export function OnboardingScreen({ onComplete }: OnboardingScreenProps): React.JSX.Element {
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

        {/* Top bar: logo right, skip left */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleComplete} style={styles.skipBtn}>
            <Text style={styles.skipText}>דלג</Text>
          </TouchableOpacity>
          <View style={styles.logoRow}>
            <Text style={styles.logoText}>mooviz</Text>
            <View style={styles.logoIconBg}>
              <Image source={logo} style={styles.logoIcon} resizeMode="contain" />
            </View>
          </View>
        </View>

        {/* Content area — title, subtitle, glass cards */}
        <Animated.View style={[
          styles.contentArea,
          {
            opacity: fadeAnim,
            transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
          },
        ]}>
          <Text style={styles.pageTitle}>{item.title}</Text>
          <Text style={styles.pageSubtitle}>{item.subtitle}</Text>

          {item.bullets && (
            <View style={styles.bulletList}>
              {item.bullets.map((bullet, i) => (
                <GlassCard key={i} icon={bullet.icon} text={bullet.text} />
              ))}
            </View>
          )}
        </Animated.View>

        {/* Bottom bar: button left, dots right */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.nextButtonText}>
              {item.isLast ? 'בואו נתחיל!' : 'הבא'}
            </Text>
            <Text style={styles.nextButtonArrow}>←</Text>
          </TouchableOpacity>
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

/** Glassmorphism feature card */
function GlassCard({ icon, text }: { icon: string; text: string }): React.JSX.Element {
  return (
    <View style={styles.glassCardOuter}>
      {Platform.OS === 'ios' ? (
        <BlurView
          style={styles.glassBlur}
          blurType="dark"
          blurAmount={20}
          reducedTransparencyFallbackColor="rgba(255,255,255,0.1)"
        />
      ) : null}
      <View style={[
        styles.glassCardInner,
        Platform.OS === 'android' && { backgroundColor: 'rgba(255,255,255,0.12)' },
      ]}>
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
    gap: 8,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },
  logoIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {
    width: 20,
    height: 20,
    tintColor: '#FFFFFF',
  },

  // ── Content area ──
  contentArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    zIndex: 5,
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'right',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  pageSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'right',
    lineHeight: 22,
    marginBottom: 20,
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
    borderColor: 'rgba(255,255,255,0.15)',
  },
  glassBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  glassCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  glassText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  glassIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(51,102,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
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
