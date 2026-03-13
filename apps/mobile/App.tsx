import React, { useEffect, useRef } from 'react';
import { I18nManager, LogBox } from 'react-native';
import { LinkingOptions, NavigationContainer, NavigationState } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import RNRestart from 'react-native-restart';
import crashlytics from '@react-native-firebase/crashlytics';

import { AuthProvider } from './src/hooks/useAuth';
import { ThemeProvider } from './src/theme/ThemeContext';
import { I18nProvider } from './src/i18n/I18nContext';
import { SoundProvider } from './src/hooks/useSound';
import { RootNavigator, RootStackParamList } from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { OfflineBanner } from './src/components/OfflineBanner';
import { navigationRef } from './src/services/navigation';
import { logScreenView } from './src/services/analytics';

// Force RTL layout for Hebrew-first UI
// כפיית כיוון ימין-לשמאל עבור ממשק עברית
// forceRTL requires an app restart to take effect on first install
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
  // Auto-restart on first install so RTL takes effect immediately
  setTimeout(() => RNRestart.restart(), 100);
}

// Suppress known harmless warnings in development
LogBox.ignoreLogs([
  'AsyncStorage has been extracted',
  'Setting a timer for a long period',
  'This method is deprecated',  // RN Firebase namespaced API warnings (v22 migration)
  '[useFirestore]',  // Missing index warnings — deploying indexes fixes this
  '[useNotifications]',  // Expected on iOS Simulator (no APNs)
]);

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['mooviz://', 'https://mooviz.app'],
  config: {
    screens: {
      AuthStack: {
        screens: {
          Login: 'login',
          Register: 'register',
          OTPVerification: 'otp',
        },
      },
      SenderTabs: {
        screens: {
          Home: 'home',
          MyDeliveries: 'my-deliveries',
          Chat: 'chat',
          Profile: 'profile',
        },
      },
      DriverTabs: {
        screens: {
          Feed: 'feed',
          MyJobs: 'my-jobs',
          Chat: 'chat',
          Profile: 'profile',
        },
      },
      ChatRoom: 'chat-room/:chatId',
      SenderDeliveryDetail: 'delivery/:deliveryId',
      DriverDeliveryDetail: 'driver-delivery/:deliveryId',
      Rating: 'rating/:deliveryId',
    },
  },
};

/** Extract the active route name from nested navigation state */
function getActiveRouteName(state: NavigationState | undefined): string | undefined {
  if (!state) return undefined;
  const route = state.routes[state.index];
  if (route.state) return getActiveRouteName(route.state as NavigationState);
  return route.name;
}

export default function App(): React.JSX.Element {
  const routeNameRef = useRef<string | undefined>();

  useEffect(() => {
    // Enable Crashlytics collection
    crashlytics().setCrashlyticsCollectionEnabled(true);
    console.log('[MOOVIZ] App initialized — Analytics + Crashlytics enabled');
  }, []);

  const onNavigationReady = (): void => {
    routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name;
  };

  const onNavigationStateChange = (state: NavigationState | undefined): void => {
    const currentRouteName = getActiveRouteName(state);
    if (currentRouteName && currentRouteName !== routeNameRef.current) {
      logScreenView(currentRouteName);
    }
    routeNameRef.current = currentRouteName;
  };

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <I18nProvider>
          <SafeAreaProvider>
            <OfflineBanner />
            <SoundProvider>
              <AuthProvider>
                <NavigationContainer
                  ref={navigationRef}
                  linking={linking}
                  onReady={onNavigationReady}
                  onStateChange={onNavigationStateChange}
                >
                  <StatusBar barStyle="light-content" />
                  <RootNavigator />
                </NavigationContainer>
              </AuthProvider>
            </SoundProvider>
          </SafeAreaProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
