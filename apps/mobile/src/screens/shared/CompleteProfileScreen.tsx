import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { COLORS } from '../../constants/colors';

/**
 * CompleteProfileScreen — מסך השלמת פרופיל
 * Shown to authenticated users who don't have a Firestore profile yet.
 * Placeholder — will be implemented in the screens branch.
 */
export function CompleteProfileScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>השלמת פרופיל</Text>
      <Text style={styles.subtitle}>בקרוב...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});
