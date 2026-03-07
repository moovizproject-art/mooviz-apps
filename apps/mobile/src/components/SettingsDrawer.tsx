import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  Linking,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { useAuth } from '../hooks/useAuth';
import { useSound } from '../hooks/useSound';
import { ProfileIcon } from './TabIcons';
import { SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../theme/tokens';

const carImage = require('../assets/car.png');
const socialFacebook = require('../assets/social/facebook.png');
const socialInstagram = require('../assets/social/instagram.png');
const socialTiktok = require('../assets/social/tiktok.png');

const DRAWER_WIDTH = 280;
const SCREEN_WIDTH = Dimensions.get('window').width;

interface SettingsDrawerProps {
  visible: boolean;
  onClose: () => void;
  animValue: Animated.Value;
}

export function SettingsDrawer({ visible, onClose, animValue }: SettingsDrawerProps): React.JSX.Element | null {
  const { colors, isDark, setMode: setThemeMode } = useTheme();
  const { t, locale, setLocale } = useI18n();
  const { currentUser, updateProfile } = useAuth();
  const { soundEnabled, setSoundEnabled } = useSound();
  const navigation = useNavigation<any>();
  const driverUnlocked = currentUser?.driverUnlocked ?? false;
  const activeMode = currentUser?.activeMode ?? 'sender';
  const isDriverMode = activeMode === 'driver';

  const handleModeSwitch = useCallback(async () => {
    onClose();
    if (isDriverMode) {
      // Already driver — switch back to sender
      await updateProfile({ activeMode: 'sender' });
    } else if (driverUnlocked) {
      // KYC approved — switch to driver mode
      await updateProfile({ activeMode: 'driver' });
    } else {
      // KYC not done — go to KYC screen
      navigation.navigate('DriverKYC');
    }
  }, [navigation, onClose, driverUnlocked, isDriverMode, updateProfile]);

  const handleGoToProfile = useCallback(() => {
    onClose();
    navigation.navigate('Profile' as never);
  }, [navigation, onClose]);

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { direction: 'ltr' }]}>
      <Pressable style={styles.drawerScrim} onPress={onClose}>
        <Animated.View style={[styles.drawerScrimBg, { opacity: animValue }]} />
      </Pressable>

      <Animated.View
        style={[
          styles.drawerPanel,
          {
            backgroundColor: colors.surface,
            width: DRAWER_WIDTH,
            left: animValue.interpolate({
              inputRange: [0, 1],
              outputRange: [SCREEN_WIDTH, SCREEN_WIDTH - DRAWER_WIDTH],
            }),
          },
        ]}
      >
        <View style={{ flex: 1, direction: 'rtl' }}>
          <View style={[styles.drawerHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.drawerTitle, { color: colors.textPrimary }]}>
              {t('home.settings')}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.drawerClose, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.menuItem} onPress={handleModeSwitch}>
            <View style={[styles.menuIconBg, { backgroundColor: isDriverMode ? '#FFF3E0' : '#E8F0FE' }]}>
              {isDriverMode ? (
                <Text style={styles.flagEmoji}>{'\u{1F4E6}'}</Text>
              ) : (
                <>
                  <Image source={carImage} style={styles.carIcon} resizeMode="contain" />
                  {!driverUnlocked && (
                    <View style={styles.lockBadge}>
                      <Text style={styles.lockIcon}>{'\u{1F512}'}</Text>
                    </View>
                  )}
                </>
              )}
            </View>
            <Text style={[styles.menuText, { color: colors.textPrimary }]}>
              {isDriverMode
                ? t('home.switchToSender')
                : driverUnlocked
                  ? t('home.switchToDriver')
                  : t('home.connectAsDriver')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleGoToProfile}>
            <View style={[styles.menuIconBg, { backgroundColor: '#E8F5E9' }]}>
              <ProfileIcon color="#2E7D32" size={20} />
            </View>
            <Text style={[styles.menuText, { color: colors.textPrimary }]}>
              {t('tabs.profile')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setLocale(locale === 'he' ? 'en' : 'he')}
          >
            <View style={[styles.menuIconBg, { backgroundColor: '#FFF3E0' }]}>
              <Text style={styles.flagEmoji}>{locale === 'he' ? '🇺🇸' : '🇮🇱'}</Text>
            </View>
            <Text style={[styles.menuText, { color: colors.textPrimary }]}>
              {locale === 'he' ? 'English' : 'עברית'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setThemeMode(isDark ? 'light' : 'dark')}
          >
            <View style={[styles.menuIconBg, { backgroundColor: isDark ? '#FFF8E1' : '#EDE7F6' }]}>
              <Text style={[styles.themeIcon, { color: isDark ? '#F9A825' : '#5E35B1' }]}>{isDark ? '◐' : '◑'}</Text>
            </View>
            <Text style={[styles.menuText, { color: colors.textPrimary }]}>
              {isDark ? t('home.lightMode') : t('home.darkMode')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setSoundEnabled(!soundEnabled)}
          >
            <View style={[styles.menuIconBg, { backgroundColor: soundEnabled ? '#E8F5E9' : '#FFEBEE' }]}>
              <Text style={styles.flagEmoji}>{soundEnabled ? '\u{1F50A}' : '\u{1F507}'}</Text>
            </View>
            <Text style={[styles.menuText, { color: colors.textPrimary }]}>
              {soundEnabled ? t('home.soundOn') : t('home.soundOff')}
            </Text>
          </TouchableOpacity>

          <View style={[styles.socialSection, { borderTopColor: colors.border }]}>
            <Text style={[styles.socialTitle, { color: colors.textSecondary }]}>
              {t('home.findUsOn')}
            </Text>
            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => Linking.openURL('https://facebook.com/mooviz')}
              >
                <Image source={socialFacebook} style={styles.socialImage} resizeMode="contain" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => Linking.openURL('https://instagram.com/mooviz')}
              >
                <Image source={socialInstagram} style={styles.socialImage} resizeMode="contain" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => Linking.openURL('https://tiktok.com/@mooviz')}
              >
                <Image source={socialTiktok} style={styles.socialImage} resizeMode="contain" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

export function useSettingsDrawer() {
  const drawerAnim = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = React.useState(false);

  const open = useCallback(() => {
    setVisible(true);
    Animated.timing(drawerAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [drawerAnim]);

  const close = useCallback(() => {
    Animated.timing(drawerAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start(() => setVisible(false));
  }, [drawerAnim]);

  return { visible, animValue: drawerAnim, open, close };
}

const styles = StyleSheet.create({
  drawerScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  drawerScrimBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  drawerPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    ...SHADOWS.lg,
    paddingTop: 60,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
    marginBottom: SPACING.sm,
    borderBottomWidth: 1,
  },
  drawerTitle: {
    ...TYPOGRAPHY.h3,
    fontWeight: '700',
  },
  drawerClose: {
    fontSize: 20,
    fontWeight: '600',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  menuIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carIcon: {
    width: 24,
    height: 24,
  },
  menuText: {
    ...TYPOGRAPHY.body,
    fontWeight: '500',
  },
  lockBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
  lockIcon: {
    fontSize: 10,
  },
  flagEmoji: {
    fontSize: 22,
  },
  themeIcon: {
    fontSize: 22,
    width: 22,
    textAlign: 'center',
  },
  socialSection: {
    borderTopWidth: 1,
    marginTop: 'auto' as unknown as number,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  socialTitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: SPACING.md,
  },
  socialRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  socialButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  socialImage: {
    width: 40,
    height: 40,
  },
});
