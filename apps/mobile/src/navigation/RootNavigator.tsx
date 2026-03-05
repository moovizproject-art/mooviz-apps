import React from 'react';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { createBottomTabNavigator, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { HomeIcon, PackageIcon, ChatIcon, ProfileIcon, TruckIcon, ClipboardIcon } from '../components/TabIcons';

// Auth screens
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { OTPScreen } from '../screens/auth/OTPScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { AddPhoneScreen } from '../screens/auth/AddPhoneScreen';

// Sender screens
import { HomeScreen } from '../screens/sender/HomeScreen';
import { CreateDeliveryScreen } from '../screens/sender/CreateDeliveryScreen';
import { DeliveryDetailScreen as SenderDeliveryDetail } from '../screens/sender/DeliveryDetailScreen';
import { MyDeliveriesScreen } from '../screens/sender/MyDeliveriesScreen';

// Driver screens
import { FeedScreen } from '../screens/driver/FeedScreen';
import { DeliveryDetailScreen as DriverDeliveryDetail } from '../screens/driver/DeliveryDetailScreen';
import { MyJobsScreen } from '../screens/driver/MyJobsScreen';
import { DriverKYCScreen } from '../screens/driver/DriverKYCScreen';

// Shared screens
import { ChatScreen } from '../screens/shared/ChatScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { RatingScreen } from '../screens/shared/RatingScreen';

// Verification screens
import { EmailVerificationScreen } from '../screens/auth/EmailVerificationScreen';

// ──────────────────────────────────────────────
// Navigation param types
// ──────────────────────────────────────────────

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  OTPVerification: { phoneNumber: string; verificationId: string; mode?: 'register' | 'login' | 'addPhone' };
  ForgotPassword: undefined;
  AddPhone: undefined;
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
  EmailVerification: undefined;
  PhoneVerification: undefined;
  PhoneOTP: { phoneNumber: string; verificationId: string; mode?: 'register' | 'login' | 'addPhone' };
  SenderTabs: NavigatorScreenParams<SenderTabsParamList>;
  DriverTabs: NavigatorScreenParams<DriverTabsParamList>;
  CreateDelivery: undefined;
  DriverKYC: undefined;
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
      <AuthStackNav.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStackNav.Screen name="AddPhone" component={AddPhoneScreen} />
    </AuthStackNav.Navigator>
  );
}

/** Sender bottom tabs: Home, MyDeliveries, Chat, Profile */
function SenderTabs(): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <SenderTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
      }}
    >
      <SenderTab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: t('tabs.home'),
          tabBarIcon: ({ color }) => <HomeIcon color={color} />,
        }}
      />
      <SenderTab.Screen
        name="MyDeliveries"
        component={MyDeliveriesScreen}
        options={{
          tabBarLabel: t('tabs.deliveries'),
          tabBarIcon: ({ color }) => <PackageIcon color={color} />,
        }}
      />
      <SenderTab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarLabel: t('tabs.chat'),
          tabBarIcon: ({ color }) => <ChatIcon color={color} />,
        }}
      />
      <SenderTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('tabs.profile'),
          tabBarIcon: ({ color }) => <ProfileIcon color={color} />,
        }}
      />
    </SenderTab.Navigator>
  );
}

/** Driver bottom tabs: Feed, MyJobs, Chat, Profile */
function DriverTabs(): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  return (
    <DriverTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
      }}
    >
      <DriverTab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarLabel: t('tabs.deliveries'),
          tabBarIcon: ({ color }) => <TruckIcon color={color} />,
        }}
      />
      <DriverTab.Screen
        name="MyJobs"
        component={MyJobsScreen}
        options={{
          tabBarLabel: t('driver.myJobs'),
          tabBarIcon: ({ color }) => <ClipboardIcon color={color} />,
        }}
      />
      <DriverTab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarLabel: t('tabs.chat'),
          tabBarIcon: ({ color }) => <ChatIcon color={color} />,
        }}
      />
      <DriverTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t('tabs.profile'),
          tabBarIcon: ({ color }) => <ProfileIcon color={color} />,
        }}
      />
    </DriverTab.Navigator>
  );
}

/** Root navigator — switches between Auth, Verification, and App flows */
export function RootNavigator(): React.JSX.Element {
  const { currentUser, firebaseUser, isLoading, forceOtp } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Verification gates:
  // 1. Not logged in → Auth flow
  // 2. Firestore loading → spinner (don't flash login screen)
  // 3. Email not verified → EmailVerification screen
  // 4. Phone not linked → AddPhone → OTP flow
  // 5. Both verified → App
  const needsEmailVerification = firebaseUser && !firebaseUser.emailVerified;
  // Phone OTP required on every fresh login (2FA).
  // forceOtp is set by LoginScreen before signIn — immune to Firestore race conditions.
  const needsPhoneOtp = (() => {
    if (!firebaseUser) return false;
    // Fresh login → always require OTP
    if (forceOtp) return true;
    // Phone not linked at all → need to link + verify
    if (!firebaseUser.phoneNumber) return true;
    // Phone linked but no recent OTP → need re-verification
    if (!currentUser?.lastOtpAt) return true;
    const daysSinceOtp = (Date.now() - currentUser.lastOtpAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceOtp > 30;
  })();
  // Keep old name for navigator conditions
  const needsPhoneVerification = needsPhoneOtp;

  // Debug logging for verification gates
  if (firebaseUser) {
    console.log('[RootNavigator] Gate check — emailVerified:', firebaseUser.emailVerified,
      'phoneNumber:', firebaseUser.phoneNumber,
      'currentUser:', !!currentUser,
      'lastOtpAt:', currentUser?.lastOtpAt,
      'needsEmail:', !!needsEmailVerification,
      'needsPhone:', !!needsPhoneVerification);
  }

  // firebaseUser exists but Firestore doc not loaded yet → show loading
  // We need currentUser to check lastOtpAt, so wait for it
  if (firebaseUser && !currentUser && !needsEmailVerification) {
    // Only exception: phone not linked at all → can show AddPhone right away
    if (!firebaseUser.phoneNumber) {
      // Fall through to show PhoneVerification screen
    } else {
      return (
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!firebaseUser ? (
        <Stack.Screen name="AuthStack" component={AuthStack} />
      ) : needsEmailVerification ? (
        <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
      ) : needsPhoneVerification ? (
        <>
          <Stack.Screen name="PhoneVerification" component={AddPhoneScreen} />
          <Stack.Screen name="PhoneOTP" component={OTPScreen} />
        </>
      ) : !currentUser ? (
        <Stack.Screen name="AuthStack" component={AuthStack} />
      ) : currentUser.activeMode === 'driver' ? (
        <>
          <Stack.Screen name="DriverTabs" component={DriverTabs} />
          <Stack.Screen
            name="DriverDeliveryDetail"
            component={DriverDeliveryDetail}
            options={{ headerShown: true, title: t('delivery.deliveryDetails') }}
          />
          <Stack.Screen
            name="ChatRoom"
            component={ChatScreen}
            options={{ headerShown: true, title: t('tabs.chat') }}
          />
          <Stack.Screen
            name="Rating"
            component={RatingScreen}
            options={{ headerShown: true, title: t('profile.rating') }}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="SenderTabs" component={SenderTabs} />
          <Stack.Screen
            name="DriverKYC"
            component={DriverKYCScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CreateDelivery"
            component={CreateDeliveryScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="SenderDeliveryDetail"
            component={SenderDeliveryDetail}
            options={{ headerShown: true, title: t('delivery.deliveryDetails') }}
          />
          <Stack.Screen
            name="ChatRoom"
            component={ChatScreen}
            options={{ headerShown: true, title: t('tabs.chat') }}
          />
          <Stack.Screen
            name="Rating"
            component={RatingScreen}
            options={{ headerShown: true, title: t('profile.rating') }}
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
  },
});
