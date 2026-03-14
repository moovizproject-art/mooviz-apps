import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { SelectionCountdown } from './SelectionCountdown';

interface Props {
  deliveryId: string;
  expiresAt: Date | string;
  onConfirm: () => void;
  onDecline: () => void;
  isLoading?: boolean;
}

export function DriverConfirmBanner({ expiresAt, onConfirm, onDecline, isLoading }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const [expired, setExpired] = useState(false);

  if (expired) {
    return (
      <View style={[styles.container, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]}>
        <Text style={styles.expiredText}>⏱ פג תוקף הבחירה</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
      <Text style={styles.title}>🔔 השולח בחר בך!</Text>
      <SelectionCountdown expiresAt={expiresAt} label="אשר את המשלוח תוך" onExpired={() => setExpired(true)} />
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.confirmBtn, isLoading && styles.btnDisabled]}
          onPress={onConfirm}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.confirmBtnText}>✓ אשר</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.declineBtn, isLoading && styles.btnDisabled]}
          onPress={onDecline}
          disabled={isLoading}
        >
          <Text style={styles.declineBtnText}>✗ דחה</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 12, padding: 16, borderWidth: 1.5, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', color: '#92400E', marginBottom: 8, textAlign: 'center' },
  expiredText: { fontSize: 14, fontWeight: '600', color: '#991B1B', textAlign: 'center' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  confirmBtn: {
    flex: 1, backgroundColor: '#22c55e', borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  declineBtn: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 10, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#EF4444',
  },
  btnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  declineBtnText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
});
