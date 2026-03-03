import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

interface AvatarCircleProps {
  name: string;
  photoUrl?: string | null;
  size?: number;
}

/**
 * AvatarCircle — אווטאר עגול
 * User avatar with initials fallback when no photo is available.
 * אווטאר משתמש עם אותיות ראשונות כגיבוי כשאין תמונה
 */
export function AvatarCircle({
  name,
  photoUrl,
  size = 40,
}: AvatarCircleProps): React.JSX.Element {
  const initials = getInitials(name);
  const fontSize = size * 0.4;

  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={[
          styles.image,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: getColorForName(name),
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

/** Extract up to 2 initials from a name */
function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/** Deterministic color based on name string */
function getColorForName(name: string): string {
  const avatarColors = [
    '#1A73E8', '#E91E63', '#9C27B0', '#673AB7',
    '#3F51B5', '#009688', '#4CAF50', '#FF5722',
    '#795548', '#607D8B',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
  },
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
