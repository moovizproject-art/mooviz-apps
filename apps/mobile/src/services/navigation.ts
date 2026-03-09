/**
 * Navigation Service — שירות ניווט
 * Provides a navigation ref accessible outside React components (e.g., from notification handlers).
 * Also tracks the currently active chat so notifications can be suppressed when the user is already
 * viewing that chat thread.
 */
import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/RootNavigator';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Currently active chatId — set by ChatScreen on mount/unmount */
let _activeChatId: string | null = null;

export function setActiveChatId(chatId: string | null): void {
  _activeChatId = chatId;
}

export function getActiveChatId(): string | null {
  return _activeChatId;
}

/**
 * Navigate to a screen from anywhere (notification handlers, etc.).
 * Waits until the navigator is ready before dispatching.
 */
export function navigateFromNotification(
  screen: keyof RootStackParamList,
  params?: Record<string, unknown>,
): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate(screen as any, params as any);
  } else {
    // Navigator not ready yet (app cold-start). Retry after a short delay.
    setTimeout(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate(screen as any, params as any);
      }
    }, 1000);
  }
}
