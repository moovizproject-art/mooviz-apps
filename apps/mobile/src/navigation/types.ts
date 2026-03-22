/**
 * Navigation Types — טיפוסי ניווט
 * Centralized navigation param list types for the entire app.
 * טיפוסי רשימת פרמטרי ניווט מרכזיים לכל האפליקציה
 */

import { NavigatorScreenParams, CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

// ──────────────────────────────────────────────
// Auth Stack
// ──────────────────────────────────────────────

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  OTPVerification: {
    phoneNumber: string;
    verificationId?: string;
    mode: 'register' | 'login' | 'addPhone';
  };
  ForgotPassword: undefined;
  AddPhone: undefined;
};

// ──────────────────────────────────────────────
// Client (Sender) Tabs
// ──────────────────────────────────────────────

export type ClientTabsParamList = {
  Home: undefined;
  MyDeliveries: undefined;
  Chat: undefined;
  Profile: undefined;
};

/** Alias — RootNavigator uses SenderTabsParamList */
export type SenderTabsParamList = ClientTabsParamList;

// ──────────────────────────────────────────────
// Driver Tabs
// ──────────────────────────────────────────────

export type DriverTabsParamList = {
  Feed: undefined;
  MyJobs: undefined;
  Chat: undefined;
  Profile: undefined;
};

// ──────────────────────────────────────────────
// Root Stack
// ──────────────────────────────────────────────

export type RootStackParamList = {
  AuthStack: NavigatorScreenParams<AuthStackParamList>;
  EmailVerification: undefined;
  PhoneVerification: undefined;
  PhoneOTP: { phoneNumber: string; verificationId: string; mode?: 'register' | 'login' | 'addPhone' };
  ClientTabs: NavigatorScreenParams<ClientTabsParamList>;
  SenderTabs: NavigatorScreenParams<SenderTabsParamList>;
  DriverTabs: NavigatorScreenParams<DriverTabsParamList>;
  CreateDelivery: undefined;
  SenderDeliveryDetail: { deliveryId: string; justRated?: boolean };
  DriverDeliveryDetail: { deliveryId: string; justRated?: boolean };
  ChatRoom: { chatId: string; recipientName: string };
  Rating: { deliveryId: string; targetUserId: string };
  DriverKYC: undefined;
  CompleteProfile: undefined;
};

// ──────────────────────────────────────────────
// Composite Screen Props
// ──────────────────────────────────────────────

/** Props for screens within the root stack */
export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

/** Props for screens within the auth stack */
export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, T>;

/** Props for screens within the client (sender) tabs */
export type ClientTabScreenProps<T extends keyof ClientTabsParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<ClientTabsParamList, T>,
    NativeStackScreenProps<RootStackParamList>
  >;

/** Alias — RootNavigator uses SenderTabScreenProps */
export type SenderTabScreenProps<T extends keyof SenderTabsParamList> = ClientTabScreenProps<T>;

/** Props for screens within the driver tabs */
export type DriverTabScreenProps<T extends keyof DriverTabsParamList> =
  CompositeScreenProps<
    BottomTabScreenProps<DriverTabsParamList, T>,
    NativeStackScreenProps<RootStackParamList>
  >;
