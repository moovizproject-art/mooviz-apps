import React, { useEffect } from 'react';
import { I18nManager, LogBox } from 'react-native';
import { LinkingOptions, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';

import { AuthProvider } from './src/hooks/useAuth';
import { ThemeProvider } from './src/theme/ThemeContext';
import { I18nProvider } from './src/i18n/I18nContext';
import { SoundProvider } from './src/hooks/useSound';
import { RootNavigator, RootStackParamList } from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { OfflineBanner } from './src/components/OfflineBanner';
import { navigationRef } from './src/services/navigation';

// Force RTL layout for Hebrew-first UI
// כפיית כיוון ימין-לשמאל עבור ממשק עברית
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

// Suppress known harmless warnings in development
LogBox.ignoreLogs([
  'AsyncStorage has been extracted',
  'Setting a timer for a long period',
  'This method is deprecated',  // RN Firebase namespaced API warnings (v22 migration)
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

export default function App(): React.JSX.Element {
  useEffect(() => {
    // App initialization logic
    // אתחול האפליקציה
    console.log('[MOOVIZ] App initialized');
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <I18nProvider>
          <SafeAreaProvider>
            <OfflineBanner />
            <SoundProvider>
              <AuthProvider>
                <NavigationContainer ref={navigationRef} linking={linking}>
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
