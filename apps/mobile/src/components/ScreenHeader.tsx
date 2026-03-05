import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '../theme/tokens';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
}

export function ScreenHeader({ title, onBack, rightElement }: ScreenHeaderProps): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.headerBg}
        translucent={false}
      />
      <View style={[styles.container, { backgroundColor: colors.headerBg, paddingTop: insets.top + SPACING.sm }]}>
        <View style={styles.row}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <View style={styles.backChevron} />
            </TouchableOpacity>
          ) : (
            <View style={styles.backButton} />
          )}
          <Text style={[styles.title, { color: colors.headerText }]} numberOfLines={1}>
            {title}
          </Text>
          {rightElement || <View style={styles.backButton} />}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    borderBottomLeftRadius: BORDER_RADIUS.xxl,
    borderBottomRightRadius: BORDER_RADIUS.xxl,
    ...SHADOWS.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: {
    width: 11,
    height: 11,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '-45deg' }],
    marginRight: -3,
  },
  title: {
    fontSize: 20,
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
  },
});
