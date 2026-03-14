import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  expiresAt: Date | string;
  label: string;
  onExpired?: () => void;
}

export function SelectionCountdown({ expiresAt, label, onExpired }: Props): React.JSX.Element | null {
  const [remaining, setRemaining] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const target = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
    if (!(target instanceof Date) || isNaN(target.getTime())) return;

    const tick = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('00:00');
        setExpired(true);
        onExpired?.();
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  if (expired) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.timer}>⏱ {remaining}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  label: { fontSize: 13, fontWeight: '600', color: '#92400E' },
  timer: { fontSize: 16, fontWeight: '800', color: '#92400E' },
});
