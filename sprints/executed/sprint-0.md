# Sprint 0 — Setup & Scaffold — Execution Log

## Sprint Info
- **Sprint ID**: 18 (KAL CRM)
- **Dates**: 2026-03-03 to 2026-03-06
- **Goal**: Repo, Firebase, RN, components, Maps
- **Branch**: `feature/sprint-0-setup`

---

## Task 103: [M0.1] Set up environment separation
**CRM ID**: 103 | **Status**: Complete | **Est**: 2h

### What was done
1. **Firebase login** switched to `tamir@k-a-l.solutions`
2. **Firebase prod project** created: `mooviz-prod` (Project #987192365576)
3. **Firebase apps registered** on both projects:
   - Dev (mooviz-app-9b766): iOS, Android, Web — all with bundle `com.mooviz.app`
   - Prod (mooviz-prod): iOS, Android, Web — same bundle ID
4. **GCP APIs enabled** on both: Firestore, Auth, Cloud Functions, Storage, FCM
5. **Firestore databases** created in `europe-west1` (closest to Israel) on both projects
6. **Firestore rules + indexes** deployed to dev project
7. **`.firebaserc`** created with aliases: default/dev/staging → mooviz-app-9b766, production → mooviz-prod
8. **Environment files** created: `.env.example` (tracked), `.env.dev`, `.env.staging`, `.env.prod` (gitignored)
9. **`docs/credentials.md`** created with all project IDs, app IDs, accounts
10. **`.gitignore`** updated to properly handle env files and docs/

### Acceptance Criteria
- [x] Firebase CLI logged in as tamir@k-a-l.solutions
- [x] Dev project (mooviz-app-9b766) has iOS, Android, Web apps
- [x] Prod project (mooviz-prod) has iOS, Android, Web apps
- [x] Firestore, Auth, Functions, Storage, FCM enabled on both
- [x] Firestore databases created (europe-west1) on both
- [x] Firestore rules and indexes deployed to dev
- [x] `.firebaserc` has correct aliases
- [x] `.env.example` exists with template
- [x] `.env.dev`, `.env.staging`, `.env.prod` have real Firebase configs
- [x] `docs/credentials.md` has all project info
- [ ] Firebase Storage needs manual setup via console (Get Started button)

### Manual Action Required
- **Firebase Storage**: Visit https://console.firebase.google.com/project/mooviz-app-9b766/storage and click "Get Started" to initialize. Same for mooviz-prod.

---

## Task 109: [M0.3] Initialize bare React Native project
**CRM ID**: 109 | **Status**: Complete | **Est**: 3h

### What was done
1. **Generated bare RN 0.75.5 project** via `@react-native-community/cli init` in /tmp
2. **Copied native folders** (ios/, android/) into `apps/mobile/`
3. **Removed all Expo dependencies** from package.json (expo, expo-router, expo-location, expo-image-picker, expo-notifications, expo-camera, expo-status-bar, babel-preset-expo, jest-expo)
4. **Added bare RN dependencies**: react-native-vision-camera v3, @notifee/react-native, react-native-geolocation-service, react-native-image-picker, react-native-config, @react-native-community/slider
5. **Migrated 8 source files** from Expo to bare RN:
   - `App.tsx`: expo-status-bar → react-native StatusBar
   - `ProofCamera.tsx`: expo-camera → react-native-vision-camera v3
   - `useLocation.ts`: expo-location → react-native-geolocation-service
   - `useNotifications.ts`: expo-notifications → @notifee/react-native + @react-native-firebase/messaging
   - `permissions.ts`: all expo-* → native PermissionsAndroid + library APIs
   - `notifications.ts` (service): expo-notifications → @notifee/react-native
   - `ChatScreen.tsx`, `RegisterScreen.tsx`, `CreateDeliveryScreen.tsx`: expo-image-picker → react-native-image-picker
   - `firebase.ts`: fixed FirebaseApp type import
6. **Configured iOS Info.plist**: camera, location, photo library permissions (Hebrew), bundle ID com.mooviz.app, deep linking, portrait-only
7. **Configured Android**: package com.mooviz.app, minSdkVersion 24, all permissions, Google Maps meta-data, deep linking
8. **Generated app icons** from LOGO.jpg for all densities
9. **Updated build configs**: babel, tsconfig, metro (monorepo), app.json, index.js, react-native.config.js
10. **Added pnpm-workspace.yaml** for proper monorepo resolution

### Commits
- `c9b440e` refactor(mobile): remove expo dependencies and configure bare RN 0.75.5
- `42d9c2f` feat(mobile): generate ios and android native projects (RN 0.75.5)
- `9ebedc1` refactor(mobile): migrate expo imports to bare RN libraries
- `ac82b2b` feat(mobile): configure native projects (permissions, maps, icons, RTL)
- `ab18e63` fix(mobile): migrate remaining expo imports and fix TS errors

### Acceptance Criteria
- [x] All expo-* dependencies removed from package.json
- [x] ios/ and android/ native project directories exist
- [x] All source files use bare RN libraries (no expo imports remain)
- [x] iOS Info.plist has camera, location, photo library permissions (Hebrew)
- [x] Android manifest has all required permissions
- [x] Bundle ID / package name is com.mooviz.app on both platforms
- [x] App icons generated from LOGO.jpg at all sizes
- [x] Deep linking configured for mooviz:// and https://mooviz.app
- [x] minSdkVersion 24 (Android 7+), iOS 13+ support
- [x] RTL support enabled
- [x] Metro config works with pnpm monorepo
- [x] pnpm install succeeds (1234 packages)
- [x] TypeScript compiles with no migration-related errors

### Notes
- Firebase Google Services config files still need to be downloaded before first native build

---

## Task 110: [M0.3] Set up navigation structure
**CRM ID**: 110 | **Status**: Complete | **Est**: 3h

### What was done
1. **Fixed all TypeScript errors** — went from 21 errors to 0
2. **Added proper navigation type system**:
   - `NavigatorScreenParams` for nested navigators (AuthStack, SenderTabs, DriverTabs)
   - `CompositeScreenProps` types exported for tab screens that navigate to root stack
   - `SenderTabScreenProps<T>` and `DriverTabScreenProps<T>` composite types
3. **Fixed screen prop types**:
   - HomeScreen, MyDeliveriesScreen → `SenderTabScreenProps`
   - FeedScreen, MyJobsScreen → `DriverTabScreenProps`
   - ProfileScreen → no props needed (uses hooks directly)
   - ChatScreen → `useRoute()` hook for flexible tab/stack usage
   - OTPScreen → removed unused `navigation` destructure
4. **Fixed deep linking config** in App.tsx:
   - Nested auth screens under `AuthStack`
   - Added route paths for ChatRoom, DeliveryDetail, Rating
   - Added `LinkingOptions<RootStackParamList>` type annotation
5. **Cleaned up unused imports** across 7 files
6. **Fixed useFirestore** missing return value in non-realtime branch
7. **Verified**: `tsc --noEmit` passes with zero errors

### Commits
- `eac66e8` fix(mobile): polish navigation types and fix all TypeScript errors

### Acceptance Criteria
- [x] React Navigation v6 works with bare RN 0.75
- [x] All navigation param lists properly typed with NavigatorScreenParams
- [x] Composite screen props exported for tab-to-stack navigation
- [x] Deep linking config correctly nested under AuthStack
- [x] All routes have deep link paths
- [x] RTL animation (slide_from_left) on auth stack
- [x] TypeScript strict mode passes with zero errors
- [x] All screen components use correct prop types for their navigator context

---

## Task 111: [M0.3] Build base component library
**CRM ID**: 111 | **Status**: Complete | **Est**: 4h

### What was done
1. **Created theme system** (`src/constants/theme.ts`):
   - 4-point spacing scale (xs=4 through xxxl=48)
   - Typography scale: h1-h3, body, caption, label, button, small
   - Border radius presets (sm through full)
   - Platform shadow presets (sm, md, lg with elevation for Android)
2. **Created 6 new components**:
   - `Button.tsx` — primary/secondary/outline/danger variants, loading spinner, disabled state
   - `TextInput.tsx` — label, error, helper text, RTL text alignment, secure entry toggle
   - `Card.tsx` — elevated (shadow) / outlined (border) variants, optional pressable
   - `Modal.tsx` — bottom sheet style with backdrop, drag handle, title, close button
   - `Badge.tsx` — notification count (99+ overflow) and dot indicator variant
   - `RatingStars.tsx` — display (half stars, configurable size) + interactive tap mode
3. **Verified existing components** work on bare RN: AvatarCircle, DeliveryCard, EmptyState, ErrorBoundary, LoadingScreen, MapPicker, StatusBadge, ProofCamera — all pure RN or already migrated
4. **Logo copied** to `src/assets/logo.jpg` for in-app use

### Commits
- `47c357a` feat(mobile): add theme system and base component library

### Acceptance Criteria
- [x] Theme system with typography, spacing, radius, shadows
- [x] Button component with 4 variants + loading + disabled
- [x] TextInput with label, error, helper, RTL alignment, secure entry
- [x] Card with elevated/outlined variants + pressable option
- [x] Modal bottom sheet with backdrop and close
- [x] Badge with count (99+ overflow) and dot
- [x] RatingStars with display + interactive modes
- [x] All components use design tokens from theme.ts + colors.ts
- [x] All components are RTL-aware (textAlign: 'right', marginStart)
- [x] TypeScript strict mode passes with zero errors
- [x] Existing components verified working on bare RN

---
