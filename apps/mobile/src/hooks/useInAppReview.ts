import { useCallback } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MILESTONES = [1, 5] as const;
const STORAGE_PREFIX = '@mooviz/rated_milestone_';

const ANDROID_STORE_URL = 'market://details?id=com.mooviz.app';
const IOS_STORE_URL = 'itms-apps://apps.apple.com/app/mooviz/id'; // placeholder ID

/**
 * Hook that prompts users to rate the app in the store after delivery milestones.
 *
 * Triggers at 1st and 5th completed delivery. Uses AsyncStorage to ensure each
 * milestone prompt is shown only once. Opens the relevant store listing via Linking.
 */
export function useInAppReview() {
  const checkAndPromptReview = useCallback(async (completedCount: number): Promise<void> => {
    try {
      // Check if the current count matches any milestone
      const milestone = MILESTONES.find((m) => m === completedCount);
      if (!milestone) return;

      const storageKey = `${STORAGE_PREFIX}${milestone}`;
      const alreadyShown = await AsyncStorage.getItem(storageKey);
      if (alreadyShown) return;

      // Mark as shown immediately to avoid duplicate prompts
      await AsyncStorage.setItem(storageKey, 'true');

      const storeUrl = Platform.OS === 'ios' ? IOS_STORE_URL : ANDROID_STORE_URL;

      Alert.alert(
        'נהנים מ-MOOVIZ?',
        'אם אתם נהנים מהשירות, נשמח לדירוג בחנות!',
        [
          { text: 'אולי אחר כך', style: 'cancel' },
          {
            text: 'דרגו אותנו',
            onPress: () => {
              Linking.openURL(storeUrl).catch(() => {
                // Fallback — silently ignore if store link fails
              });
            },
          },
        ],
        { cancelable: true },
      );
    } catch {
      // Non-critical feature — swallow errors silently
    }
  }, []);

  return { checkAndPromptReview };
}
