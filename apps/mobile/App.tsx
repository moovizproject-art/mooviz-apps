import React, { useEffect } from 'react';
import { I18nManager, LogBox } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';

import { AuthProvider } from './src/hooks/useAuth';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';

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
]);

const linking = {
  prefixes: ['mooviz://', 'https://mooviz.app'],
  config: {
    screens: {
      Login: 'login',
      Register: 'register',
      OTPVerification: 'otp',
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
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer linking={linking}>
            <StatusBar barStyle="default" />
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
