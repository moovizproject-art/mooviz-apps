import React, { useState, useEffect } from 'react';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { createBottomTabNavigator, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { ErrorBoundary, withErrorBoundary } from '../components/ErrorBoundary';

import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';

/** Hook to count unread chat threads using lastReadBy timestamp tracking */
function useUnreadChatCount(userId: string | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = firestore()
      .collection('chats')
      .where('participants', 'array-contains', userId)
      .onSnapshot(
        (snapshot) => {
          let unread = 0;
          snapshot.docs.forEach((doc) => {
            const data = doc.data();
            if (!data.lastMessage || data.lastSenderId === userId || data.lastSenderId === 'system') return;
            if (data.closed) return;
            // Compare lastMessageAt against user's lastReadBy timestamp
            const lastReadAt = data.lastReadBy?.[userId]?.toDate?.()?.getTime() ?? 0;
            const lastMsgAt = data.lastMessageAt?.toDate?.()?.getTime() ?? 0;
            if (lastMsgAt > lastReadAt) {
              unread++;
            }
          });
          setCount(unread);
        },
        () => setCount(0),
      );
    return unsubscribe;
  }, [userId]);

  return count;
}
import { useTheme } from '../theme/ThemeContext';
import { useI18n } from '../i18n/I18nContext';
import { HomeIcon, PackageIcon, ChatIcon, ProfileIcon, TruckIcon, ClipboardIcon } from '../components/TabIcons';

// Auth screens
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { OTPScreen } from '../screens/auth/OTPScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { AddPhoneScreen } from '../screens/auth/AddPhoneScreen';
import { CompleteProfileScreen } from '../screens/auth/CompleteProfileScreen';
import { AcceptTermsScreen } from '../screens/auth/AcceptTermsScreen';

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
import { FullScreenMapScreen } from '../screens/shared/FullScreenMapScreen';

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
  CompleteProfile: undefined;
  AcceptTerms: undefined;
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
  FullScreenMap: {
    pickup: { latitude: number; longitude: number; address?: string };
    destination: { latitude: number; longitude: number; address?: string };
    driverId: string;
    driverPhone?: string;
    chatId?: string;
    recipientName?: string;
    deliveryStatus?: string;
    deliveredAt?: string | null;
  };
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
      <AuthStackNav.Screen name="Login" component={withErrorBoundary(LoginScreen, 'Login')} />
      <AuthStackNav.Screen name="Register" component={withErrorBoundary(RegisterScreen, 'Register')} />
      <AuthStackNav.Screen name="OTPVerification" component={withErrorBoundary(OTPScreen, 'OTPVerification')} />
      <AuthStackNav.Screen name="ForgotPassword" component={withErrorBoundary(ForgotPasswordScreen, 'ForgotPassword')} />
      <AuthStackNav.Screen name="AddPhone" component={withErrorBoundary(AddPhoneScreen, 'AddPhone')} />
    </AuthStackNav.Navigator>
  );
}

/** Sender bottom tabs: Home, MyDeliveries, Chat, Profile */
function SenderTabs(): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { currentUser } = useAuth();
  const unreadChats = useUnreadChatCount(currentUser?.uid);
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
        component={withErrorBoundary(HomeScreen, 'Home')}
        options={{
          tabBarLabel: t('tabs.home'),
          tabBarIcon: ({ color }) => <HomeIcon color={color} />,
        }}
      />
      <SenderTab.Screen
        name="MyDeliveries"
        component={withErrorBoundary(MyDeliveriesScreen, 'MyDeliveries')}
        options={{
          tabBarLabel: t('tabs.deliveries'),
          tabBarIcon: ({ color }) => <PackageIcon color={color} />,
        }}
      />
      <SenderTab.Screen
        name="Chat"
        component={withErrorBoundary(ChatScreen, 'SenderChat')}
        options={{
          tabBarLabel: t('tabs.chat'),
          tabBarIcon: ({ color }) => <ChatIcon color={color} />,
          tabBarBadge: unreadChats > 0 ? unreadChats : undefined,
        }}
      />
      <SenderTab.Screen
        name="Profile"
        component={withErrorBoundary(ProfileScreen, 'SenderProfile')}
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
  const { currentUser } = useAuth();
  const unreadChats = useUnreadChatCount(currentUser?.uid);
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
        component={withErrorBoundary(FeedScreen, 'Feed')}
        options={{
          tabBarLabel: t('tabs.deliveries'),
          tabBarIcon: ({ color }) => <TruckIcon color={color} />,
        }}
      />
      <DriverTab.Screen
        name="MyJobs"
        component={withErrorBoundary(MyJobsScreen, 'MyJobs')}
        options={{
          tabBarLabel: t('driver.myJobs'),
          tabBarIcon: ({ color }) => <ClipboardIcon color={color} />,
        }}
      />
      <DriverTab.Screen
        name="Chat"
        component={withErrorBoundary(ChatScreen, 'DriverChat')}
        options={{
          tabBarLabel: t('tabs.chat'),
          tabBarIcon: ({ color }) => <ChatIcon color={color} />,
          tabBarBadge: unreadChats > 0 ? unreadChats : undefined,
        }}
      />
      <DriverTab.Screen
        name="Profile"
        component={withErrorBoundary(ProfileScreen, 'DriverProfile')}
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
  useNotifications(); // Register FCM token & handle foreground/background notifications
  const { colors } = useTheme();
  const { t } = useI18n();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [firestoreTimeout, setFirestoreTimeout] = useState(false);

  // Safety timeout: if firebaseUser exists but currentUser never loads,
  // stop waiting after 8s so the user doesn't get stuck on a spinner forever.
  useEffect(() => {
    if (!firebaseUser || currentUser || isLoading) {
      setFirestoreTimeout(false);
      return;
    }
    const timer = setTimeout(async () => {
      console.warn('[RootNavigator] Firestore user doc timeout — signing out for clean retry');
      try { await auth().signOut(); } catch (_) {}
      setFirestoreTimeout(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [firebaseUser, currentUser, isLoading]);

  useEffect(() => {
    console.log('[RootNavigator] Checking onboarding status...');
    AsyncStorage.getItem('@onboarding_complete').then((val) => {
      console.log('[RootNavigator] onboarding_complete =', val);
      setOnboardingDone(val === 'true');
    }).catch((err) => {
      console.error('[RootNavigator] AsyncStorage error:', err);
      setOnboardingDone(false);
    });
  }, []);

  console.log('[RootNavigator] Render — isLoading:', isLoading, 'onboardingDone:', onboardingDone, 'firebaseUser:', !!firebaseUser, 'currentUser:', !!currentUser);

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Show onboarding on first launch (before auth)
  if (onboardingDone === null) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!onboardingDone) {
    return <OnboardingScreen onComplete={() => setOnboardingDone(true)} />;
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

  // Debug logging for verification gates (PII redacted)
  if (firebaseUser) {
    console.log('[RootNavigator] Gate check — emailVerified:', firebaseUser.emailVerified,
      'hasPhone:', !!firebaseUser.phoneNumber,
      'currentUser:', !!currentUser,
      'hasOtpAt:', !!currentUser?.lastOtpAt,
      'needsEmail:', !!needsEmailVerification,
      'needsPhone:', !!needsPhoneVerification);
  }

  // firebaseUser exists but Firestore doc not loaded yet → show loading
  // We need currentUser to check lastOtpAt, so wait for it (max 8s)
  if (firebaseUser && !currentUser && !needsEmailVerification && !firestoreTimeout) {
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
    <ErrorBoundary fallbackColors={{ background: colors.background, textPrimary: colors.textPrimary, textSecondary: colors.textSecondary, primary: colors.primary, border: colors.border, error: colors.error }}>
    <Stack.Navigator screenOptions={{ headerShown: false, headerBackTitle: t('common.back') }}>
      {!firebaseUser ? (
        <Stack.Screen name="AuthStack" component={AuthStack} />
      ) : needsEmailVerification ? (
        <Stack.Screen name="EmailVerification" component={withErrorBoundary(EmailVerificationScreen, 'EmailVerification')} />
      ) : needsPhoneVerification ? (
        <>
          <Stack.Screen name="PhoneVerification" component={withErrorBoundary(AddPhoneScreen, 'PhoneVerification')} />
          <Stack.Screen name="PhoneOTP" component={withErrorBoundary(OTPScreen, 'PhoneOTP')} />
        </>
      ) : !currentUser ? (
        <Stack.Screen name="AuthStack" component={AuthStack} />
      ) : !currentUser.fullName || !currentUser.phone ? (
        <Stack.Screen name="CompleteProfile" component={withErrorBoundary(CompleteProfileScreen, 'CompleteProfile')} />
      ) : currentUser.migratedFrom && !currentUser.acceptedTermsAt ? (
        <Stack.Screen name="AcceptTerms" component={withErrorBoundary(AcceptTermsScreen, 'AcceptTerms')} />
      ) : currentUser.activeMode === 'driver' ? (
        <>
          <Stack.Screen name="DriverTabs" component={DriverTabs} options={{ title: t('common.back') }} />
          <Stack.Screen
            name="DriverDeliveryDetail"
            component={withErrorBoundary(DriverDeliveryDetail, 'DriverDeliveryDetail')}
            options={{ headerShown: true, title: t('delivery.deliveryDetails') }}
          />
          <Stack.Screen
            name="ChatRoom"
            component={withErrorBoundary(ChatScreen, 'DriverChatRoom')}
            options={{
              headerShown: true,
              title: '',
              headerStyle: { backgroundColor: colors.surface },
            }}
          />
          <Stack.Screen
            name="Rating"
            component={withErrorBoundary(RatingScreen, 'DriverRating')}
            options={{ headerShown: true, title: t('profile.rating') }}
          />
          <Stack.Screen
            name="FullScreenMap"
            component={withErrorBoundary(FullScreenMapScreen, 'DriverFullScreenMap')}
            options={{ headerShown: false, animation: 'fade' }}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="SenderTabs" component={SenderTabs} options={{ title: t('common.back') }} />
          <Stack.Screen
            name="DriverKYC"
            component={withErrorBoundary(DriverKYCScreen, 'DriverKYC')}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CreateDelivery"
            component={withErrorBoundary(CreateDeliveryScreen, 'CreateDelivery')}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="SenderDeliveryDetail"
            component={withErrorBoundary(SenderDeliveryDetail, 'SenderDeliveryDetail')}
            options={{ headerShown: true, title: t('delivery.deliveryDetails') }}
          />
          <Stack.Screen
            name="ChatRoom"
            component={withErrorBoundary(ChatScreen, 'SenderChatRoom')}
            options={{
              headerShown: true,
              title: '',
              headerStyle: { backgroundColor: colors.surface },
            }}
          />
          <Stack.Screen
            name="Rating"
            component={withErrorBoundary(RatingScreen, 'SenderRating')}
            options={{ headerShown: true, title: t('profile.rating') }}
          />
          <Stack.Screen
            name="FullScreenMap"
            component={withErrorBoundary(FullScreenMapScreen, 'SenderFullScreenMap')}
            options={{ headerShown: false, animation: 'fade' }}
          />
        </>
      )}
    </Stack.Navigator>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
