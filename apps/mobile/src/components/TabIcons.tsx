import React from 'react';
import { View, StyleSheet } from 'react-native';

interface TabIconProps {
  color: string;
  size?: number;
}

/** Home — house shape */
export function HomeIcon({ color, size = 24 }: TabIconProps): React.JSX.Element {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Roof triangle */}
      <View style={[styles.roof, {
        borderLeftWidth: size * 0.5,
        borderRightWidth: size * 0.5,
        borderBottomWidth: size * 0.38,
        borderBottomColor: color,
      }]} />
      {/* House body */}
      <View style={[styles.houseBody, {
        width: size * 0.65,
        height: size * 0.42,
        borderColor: color,
        borderWidth: 2,
        borderTopWidth: 0,
      }]}>
        {/* Door */}
        <View style={[styles.door, {
          width: size * 0.22,
          height: size * 0.25,
          backgroundColor: color,
        }]} />
      </View>
    </View>
  );
}

/** Package — box shape */
export function PackageIcon({ color, size = 24 }: TabIconProps): React.JSX.Element {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={[styles.box, {
        width: size * 0.75,
        height: size * 0.55,
        borderColor: color,
        borderWidth: 2,
        borderRadius: 3,
      }]}>
        {/* Horizontal line */}
        <View style={[styles.boxLine, { backgroundColor: color, width: '100%', height: 2 }]} />
        {/* Vertical line */}
        <View style={[styles.boxVertical, { backgroundColor: color, width: 2, height: '100%' }]} />
      </View>
      {/* Top flap */}
      <View style={[styles.boxFlap, {
        width: size * 0.85,
        height: size * 0.2,
        borderColor: color,
        borderWidth: 2,
        borderRadius: 2,
        marginBottom: -1,
      }]} />
    </View>
  );
}

/** Chat — speech bubble */
export function ChatIcon({ color, size = 24 }: TabIconProps): React.JSX.Element {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={[styles.bubble, {
        width: size * 0.8,
        height: size * 0.6,
        borderColor: color,
        borderWidth: 2,
        borderRadius: size * 0.15,
      }]}>
        {/* Three dots */}
        <View style={styles.dotsRow}>
          <View style={[styles.dot, { backgroundColor: color, width: 3, height: 3 }]} />
          <View style={[styles.dot, { backgroundColor: color, width: 3, height: 3 }]} />
          <View style={[styles.dot, { backgroundColor: color, width: 3, height: 3 }]} />
        </View>
      </View>
      {/* Tail */}
      <View style={[styles.bubbleTail, {
        borderLeftWidth: size * 0.12,
        borderTopWidth: size * 0.12,
        borderLeftColor: color,
        borderTopColor: 'transparent',
        marginTop: -2,
        marginLeft: size * 0.15,
      }]} />
    </View>
  );
}

/** Profile — person silhouette */
export function ProfileIcon({ color, size = 24 }: TabIconProps): React.JSX.Element {
  const headSize = size * 0.35;
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Head */}
      <View style={{
        width: headSize,
        height: headSize,
        borderRadius: headSize / 2,
        borderWidth: 2,
        borderColor: color,
        marginBottom: 2,
      }} />
      {/* Shoulders */}
      <View style={{
        width: size * 0.65,
        height: size * 0.3,
        borderTopLeftRadius: size * 0.3,
        borderTopRightRadius: size * 0.3,
        borderWidth: 2,
        borderBottomWidth: 0,
        borderColor: color,
      }} />
    </View>
  );
}

/** Truck — delivery truck */
export function TruckIcon({ color, size = 24 }: TabIconProps): React.JSX.Element {
  return (
    <View style={[styles.container, { width: size, height: size, flexDirection: 'row', alignItems: 'flex-end' }]}>
      {/* Cabin */}
      <View style={{
        width: size * 0.35,
        height: size * 0.45,
        borderWidth: 2,
        borderColor: color,
        borderRadius: 2,
        borderTopLeftRadius: size * 0.08,
      }} />
      {/* Cargo */}
      <View style={{
        width: size * 0.5,
        height: size * 0.55,
        borderWidth: 2,
        borderColor: color,
        borderRadius: 2,
        marginLeft: -2,
      }} />
      {/* Wheels */}
      <View style={[styles.wheelRow, { bottom: -size * 0.12, left: size * 0.08, position: 'absolute' }]}>
        <View style={[styles.wheel, { width: size * 0.15, height: size * 0.15, borderColor: color }]} />
      </View>
      <View style={[styles.wheelRow, { bottom: -size * 0.12, right: size * 0.08, position: 'absolute' }]}>
        <View style={[styles.wheel, { width: size * 0.15, height: size * 0.15, borderColor: color }]} />
      </View>
    </View>
  );
}

/** Clipboard — task list */
export function ClipboardIcon({ color, size = 24 }: TabIconProps): React.JSX.Element {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Clip */}
      <View style={{
        width: size * 0.35,
        height: size * 0.15,
        borderWidth: 2,
        borderColor: color,
        borderRadius: 3,
        marginBottom: -2,
        zIndex: 1,
      }} />
      {/* Board */}
      <View style={{
        width: size * 0.65,
        height: size * 0.7,
        borderWidth: 2,
        borderColor: color,
        borderRadius: 3,
        justifyContent: 'center',
        paddingHorizontal: size * 0.1,
        gap: 3,
      }}>
        <View style={{ width: '100%', height: 2, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: '70%', height: 2, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: '85%', height: 2, backgroundColor: color, borderRadius: 1 }} />
      </View>
    </View>
  );
}

/** Car — simple car silhouette */
export function CarIcon({ color, size = 24 }: TabIconProps): React.JSX.Element {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Roof / cabin */}
      <View style={{
        width: size * 0.45,
        height: size * 0.28,
        borderWidth: 2,
        borderColor: color,
        borderTopLeftRadius: size * 0.12,
        borderTopRightRadius: size * 0.12,
        borderBottomWidth: 0,
        marginBottom: -1,
      }} />
      {/* Body */}
      <View style={{
        width: size * 0.8,
        height: size * 0.3,
        borderWidth: 2,
        borderColor: color,
        borderRadius: size * 0.06,
      }} />
      {/* Wheels */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: size * 0.7,
        marginTop: -3,
      }}>
        <View style={{ width: size * 0.14, height: size * 0.14, borderRadius: size * 0.07, borderWidth: 2, borderColor: color }} />
        <View style={{ width: size * 0.14, height: size * 0.14, borderRadius: size * 0.07, borderWidth: 2, borderColor: color }} />
      </View>
    </View>
  );
}

/** Flag — flag on a pole */
export function FlagIcon({ color, size = 24 }: TabIconProps): React.JSX.Element {
  return (
    <View style={[styles.container, { width: size, height: size, alignItems: 'flex-start' }]}>
      {/* Pole */}
      <View style={{ position: 'absolute', left: size * 0.2, top: size * 0.08, width: 2, height: size * 0.84, backgroundColor: color, borderRadius: 1 }} />
      {/* Flag body */}
      <View style={{
        marginLeft: size * 0.2 + 2,
        marginTop: size * 0.08,
        width: size * 0.55,
        height: size * 0.4,
        borderWidth: 2,
        borderColor: color,
        borderRadius: 2,
      }} />
    </View>
  );
}

/** Sun — circle with rays */
export function SunIcon({ color, size = 24 }: TabIconProps): React.JSX.Element {
  const r = size * 0.18;
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Center circle */}
      <View style={{
        width: r * 2,
        height: r * 2,
        borderRadius: r,
        borderWidth: 2,
        borderColor: color,
      }} />
      {/* Rays — 4 lines (top, bottom, left, right) */}
      <View style={{ position: 'absolute', top: size * 0.06, width: 2, height: size * 0.14, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: 'absolute', bottom: size * 0.06, width: 2, height: size * 0.14, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: 'absolute', left: size * 0.06, width: size * 0.14, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ position: 'absolute', right: size * 0.06, width: size * 0.14, height: 2, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

/** Moon — crescent moon */
export function MoonIcon({ color, size = 24 }: TabIconProps): React.JSX.Element {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={{
        width: size * 0.55,
        height: size * 0.55,
        borderRadius: size * 0.275,
        borderWidth: 2,
        borderColor: color,
        borderRightColor: 'transparent',
        borderBottomColor: 'transparent',
        transform: [{ rotate: '-45deg' }],
      }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Home
  roof: {
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderStyle: 'solid',
    marginBottom: -1,
  },
  houseBody: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  door: {
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  // Package
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  boxLine: {
    position: 'absolute',
  },
  boxVertical: {
    position: 'absolute',
  },
  boxFlap: {
    position: 'absolute',
    top: 0,
  },
  // Chat
  bubble: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    borderRadius: 2,
  },
  bubbleTail: {
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    alignSelf: 'flex-start',
  },
  // Truck
  wheelRow: {},
  wheel: {
    borderRadius: 100,
    borderWidth: 2,
  },
});
