import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

import { COLORS } from '../constants/colors';

interface LoadingScreenProps {
  message?: string;
}

/**
 * LoadingScreen — מסך טעינה
 * Full-screen spinner with optional message.
 * ספינר מסך מלא עם הודעה אופציונלית
 */
export function LoadingScreen({ message }: LoadingScreenProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    gap: 16,
  },
  message: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
