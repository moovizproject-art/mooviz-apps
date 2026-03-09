/**
 * ImageGalleryModal — גלריית תמונות במסך מלא
 * Fullscreen image viewer with swipe left/right navigation.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Image,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

export function ImageGalleryModal({ visible, images, initialIndex = 0, onClose }: Props): React.JSX.Element {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (idx >= 0 && idx < images.length) {
      setCurrentIndex(idx);
    }
  }, [images.length]);

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= images.length) return;
    flatListRef.current?.scrollToIndex({ index: idx, animated: true });
    setCurrentIndex(idx);
  }, [images.length]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={styles.overlay}>
        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        {/* Counter */}
        <View style={styles.counter}>
          <Text style={styles.counterText}>{currentIndex + 1} / {images.length}</Text>
        </View>

        {/* Image carousel */}
        <FlatList
          ref={flatListRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
          onMomentumScrollEnd={handleScroll}
          keyExtractor={(item, i) => `${i}-${item}`}
          renderItem={({ item }) => (
            <View style={styles.imageContainer}>
              <Image source={{ uri: item }} style={styles.image} resizeMode="contain" />
            </View>
          )}
        />

        {/* Previous (start side) */}
        {currentIndex > 0 && (
          <TouchableOpacity style={[styles.arrow, styles.arrowStart]} onPress={() => goTo(currentIndex - 1)}>
            <Text style={styles.arrowText}>›</Text>
          </TouchableOpacity>
        )}

        {/* Next (end side) */}
        {currentIndex < images.length - 1 && (
          <TouchableOpacity style={[styles.arrow, styles.arrowEnd]} onPress={() => goTo(currentIndex + 1)}>
            <Text style={styles.arrowText}>‹</Text>
          </TouchableOpacity>
        )}

        {/* Dots */}
        <View style={styles.dots}>
          {images.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIndex && styles.dotActive]}
            />
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 40,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  counter: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 44,
    left: 20,
    zIndex: 10,
  },
  counterText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  arrow: {
    position: 'absolute',
    top: '45%',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  arrowStart: {
    start: 12,
  },
  arrowEnd: {
    end: 12,
  },
  arrowText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '300',
    marginTop: -2,
  },
  dots: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 60 : 40,
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
