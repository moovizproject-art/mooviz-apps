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
- 15 pre-existing TS errors in scaffold code (navigation typing, unused imports) — Task 110/111
- Firebase Google Services config files still need to be downloaded before first native build

---
