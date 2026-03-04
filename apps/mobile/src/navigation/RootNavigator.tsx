import React from 'react';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { createBottomTabNavigator, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import { useAuth } from '../hooks/useAuth';
import { COLORS } from '../constants/colors';

// Auth screens
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { OTPScreen } from '../screens/auth/OTPScreen';

// Sender screens
import { HomeScreen } from '../screens/sender/HomeScreen';
import { CreateDeliveryScreen } from '../screens/sender/CreateDeliveryScreen';
import { DeliveryDetailScreen as SenderDeliveryDetail } from '../screens/sender/DeliveryDetailScreen';
import { MyDeliveriesScreen } from '../screens/sender/MyDeliveriesScreen';

// Driver screens
import { FeedScreen } from '../screens/driver/FeedScreen';
import { DeliveryDetailScreen as DriverDeliveryDetail } from '../screens/driver/DeliveryDetailScreen';
import { MyJobsScreen } from '../screens/driver/MyJobsScreen';

// Shared screens
import { ChatScreen } from '../screens/shared/ChatScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { RatingScreen } from '../screens/shared/RatingScreen';

// ──────────────────────────────────────────────
// Navigation param types
// ──────────────────────────────────────────────

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  OTPVerification: { phoneNumber: string; verificationId: string };
};

export type SenderTabsParamList = {
  Home: undefined;
  MyDeliveries: undefined;
  Chat: undefined;
  Profile: undefined;
};

export type DriverTabsParamList = {
  Feed: undefined;
  MyJobs: undefined;
  Chat: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  AuthStack: NavigatorScreenParams<AuthStackParamList>;
  SenderTabs: NavigatorScreenParams<SenderTabsParamList>;
  DriverTabs: NavigatorScreenParams<DriverTabsParamList>;
  CreateDelivery: undefined;
  SenderDeliveryDetail: { deliveryId: string };
  DriverDeliveryDetail: { deliveryId: string };
  ChatRoom: { chatId: string; recipientName: string };
  Rating: { deliveryId: string; targetUserId: string };
};

/** Composite props for sender tab screens that navigate to root stack */
export type SenderTabScreenProps<T extends keyof SenderTabsParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<SenderTabsParamList, T>,
    NativeStackScreenProps<RootStackParamList>
  >;

/** Composite props for driver tab screens that navigate to root stack */
export type DriverTabScreenProps<T extends keyof DriverTabsParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<DriverTabsParamList, T>,
    NativeStackScreenProps<RootStackParamList>
  >;

// ──────────────────────────────────────────────
// Stack & Tab navigators
// ──────────────────────────────────────────────

const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStackNav = createNativeStackNavigator<AuthStackParamList>();
const SenderTab = createBottomTabNavigator<SenderTabsParamList>();
const DriverTab = createBottomTabNavigator<DriverTabsParamList>();

/** Auth flow: Login -> Register -> OTP */
function AuthStack(): React.JSX.Element {
  return (
    <AuthStackNav.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_left', // RTL-aware
      }}
    >
      <AuthStackNav.Screen name="Login" component={LoginScreen} />
      <AuthStackNav.Screen name="Register" component={RegisterScreen} />
      <AuthStackNav.Screen name="OTPVerification" component={OTPScreen} />
    </AuthStackNav.Navigator>
  );
}

/** Sender bottom tabs: Home, MyDeliveries, Chat, Profile */
// טאבים לשולח: דף הבית, המשלוחים שלי, צ׳אט, פרופיל
function SenderTabs(): React.JSX.Element {
  return (
    <SenderTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: { borderTopWidth: 1, borderTopColor: COLORS.border },
      }}
    >
      <SenderTab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'ראשי' /* Home */ }}
      />
      <SenderTab.Screen
        name="MyDeliveries"
        component={MyDeliveriesScreen}
        options={{ tabBarLabel: 'משלוחים' /* Deliveries */ }}
      />
      <SenderTab.Screen
        name="Chat"
        component={ChatScreen}
        options={{ tabBarLabel: 'צ׳אט' /* Chat */ }}
      />
      <SenderTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'פרופיל' /* Profile */ }}
      />
    </SenderTab.Navigator>
  );
}

/** Driver bottom tabs: Feed, MyJobs, Chat, Profile */
// טאבים לנהג: פיד, העבודות שלי, צ׳אט, פרופיל
function DriverTabs(): React.JSX.Element {
  return (
    <DriverTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: { borderTopWidth: 1, borderTopColor: COLORS.border },
      }}
    >
      <DriverTab.Screen
        name="Feed"
        component={FeedScreen}
        options={{ tabBarLabel: 'משלוחים' /* Feed */ }}
      />
      <DriverTab.Screen
        name="MyJobs"
        component={MyJobsScreen}
        options={{ tabBarLabel: 'העבודות שלי' /* My Jobs */ }}
      />
      <DriverTab.Screen
        name="Chat"
        component={ChatScreen}
        options={{ tabBarLabel: 'צ׳אט' /* Chat */ }}
      />
      <DriverTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'פרופיל' /* Profile */ }}
      />
    </DriverTab.Navigator>
  );
}

/** Root navigator — switches between Auth, Sender, and Driver flows */
export function RootNavigator(): React.JSX.Element {
  const { currentUser, isLoading } = useAuth();

  // Show loading spinner while checking auth state
  // טוען... בודק מצב התחברות
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!currentUser ? (
        // Not authenticated — show auth flow
        // לא מחובר — הצג מסך התחברות
        <Stack.Screen name="AuthStack" component={AuthStack} />
      ) : currentUser.role === 'driver' ? (
        // Driver flow
        // מסך נהג
        <>
          <Stack.Screen name="DriverTabs" component={DriverTabs} />
          <Stack.Screen
            name="DriverDeliveryDetail"
            component={DriverDeliveryDetail}
            options={{ headerShown: true, title: 'פרטי משלוח' /* Delivery Details */ }}
          />
          <Stack.Screen
            name="ChatRoom"
            component={ChatScreen}
            options={{ headerShown: true, title: 'צ׳אט' }}
          />
          <Stack.Screen
            name="Rating"
            component={RatingScreen}
            options={{ headerShown: true, title: 'דירוג' /* Rating */ }}
          />
        </>
      ) : (
        // Sender flow (default)
        // מסך שולח
        <>
          <Stack.Screen name="SenderTabs" component={SenderTabs} />
          <Stack.Screen
            name="CreateDelivery"
            component={CreateDeliveryScreen}
            options={{ headerShown: true, title: 'משלוח חדש' /* New Delivery */ }}
          />
          <Stack.Screen
            name="SenderDeliveryDetail"
            component={SenderDeliveryDetail}
            options={{ headerShown: true, title: 'פרטי משלוח' /* Delivery Details */ }}
          />
          <Stack.Screen
            name="ChatRoom"
            component={ChatScreen}
            options={{ headerShown: true, title: 'צ׳אט' }}
          />
          <Stack.Screen
            name="Rating"
            component={RatingScreen}
            options={{ headerShown: true, title: 'דירוג' /* Rating */ }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});
