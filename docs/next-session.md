# MOOVIZ — Session Continuation Guide
> Last updated: 2026-03-16 | Sprint 3 (M3) COMPLETE | v1.0.3

## Current State

### Branch: `main`
### APK: `apps/mobile/android/app/build/outputs/apk/release/mooviz-1.0.3.apk` (81MB)
### Functions: Deployed to `mooviz-app-9b766` (dev) — 33 functions

---

## What Was Done (March 16) — v1.0.3 Bug Fixes

### 1. Firebase Config — Was Pointing to Production
- `google-services.json` had `mooviz-prod` → switched back to `mooviz-app-9b766` (dev)
- This caused "user not exist" errors and phone auth failures
- `apps/admin/.env.production` has prod config — leave it for later

### 2. Nearby Driver Notifications — 3 Bugs Fixed
- **Missing expansion fields**: `createDelivery` callable now sets `notifiedDrivers`, `notifyRadius`, `notifyExpansionCount`, `lastNotifyExpansion` on new deliveries
- **Firestore index error**: `notifyExpansion` had two inequality filters on different fields. Fixed to single inequality (`lastNotifyExpansion`) + JS filter for `notifyExpansionCount`
- **driverAvailable always false**: `useDriverAvailability` hook reset `driverAvailable=false` on every unmount. Fixed: unmount only stops location watch, availability persists as a preference

### 3. Size Matching — Capacity-Based
- **Server** (`geohashService.ts`): driver accepting "large" now matches small/medium/large deliveries
- **UI** (`FeedScreen.tsx`): checking "large" auto-checks small + medium + large. Manual uncheck only removes that one size
- Size hierarchy: small < medium < large < xlarge

### 4. Version Bump
- `build.gradle`: versionCode 103, versionName "1.0.3"
- `config.ts`: APP_VERSION = '1.0.3' (was stuck at 1.0.1)

### 5. Firestore Data Fixes
- All 5 unlocked drivers set to `driverAvailable=true`
- Delivery `nWraDR0uMixrcBGWxz5m` given expansion tracking fields

### Verified Working
- Expansion ran: radius 15→20km, 2 drivers notified (push sent confirmed in logs)
- Geohash proximity: Tel Aviv addresses matched correctly (8 live, 6 home, 1 work candidates)

---

## Files Changed (NOT YET COMMITTED)
| File | Change |
|------|--------|
| `apps/mobile/android/app/google-services.json` | Dev project (gitignored) |
| `apps/mobile/src/constants/config.ts` | APP_VERSION 1.0.3 |
| `apps/mobile/android/app/build.gradle` | versionCode 103, versionName 1.0.3 |
| `apps/mobile/src/hooks/useDriverAvailability.ts` | Removed unmount driverAvailable=false reset |
| `apps/mobile/src/screens/driver/FeedScreen.tsx` | Size auto-fill on check |
| `functions/src/callable/deliveryCallable.ts` | Expansion tracking fields + record notified drivers |
| `functions/src/services/geohashService.ts` | Capacity-based size matching |
| `functions/src/scheduled/notifyExpansion.ts` | Single inequality query fix |
| `firestore.indexes.json` | Simplified expansion index (2-field) |

---

## Next Session Tasks

### Priority 1: Testing & Verification
- [ ] Install v1.0.3 APK and test phone auth (should work with dev config)
- [ ] Test notification flow end-to-end: create delivery → driver gets push
- [ ] Verify size filter UI behavior (auto-check smaller sizes)
- [ ] Commit all v1.0.3 changes

### Priority 2: Remaining Backlog → M4
- [ ] P0/P1 bug triage (#165) — pre-release
- [ ] Production config (#168-169) — prod Firebase project + signing keys
- [ ] Store submissions (#170-172) — App Store + Play Store
- [ ] Handover (#173) — client documentation
- [ ] Interstitial ads (#159) — post-launch
- [ ] Analytics events (#160) — post-launch

---

## Environment Quick Start
```bash
# Start Metro (from apps/mobile/)
cd apps/mobile && node ../../node_modules/react-native/cli.js start --reset-cache

# Android build + install
cd apps/mobile/android && ./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/mooviz-1.0.3.apk

# Admin dev
cd apps/admin && npm run dev -- --port 5002

# Deploy functions
cd functions && npm run build && firebase deploy --only functions

# Deploy admin
cd apps/admin && node ../../node_modules/.pnpm/vite@5.4.21_@types+node@25.3.3_terser@5.46.0/node_modules/vite/bin/vite.js build
firebase deploy --only hosting
```

## User Preferences
- **NO** `Co-Authored-By: Claude` in git commits
- Client should not see AI attribution
- Hebrew RTL is primary language
- Use Gamma for PDF generation
- Sounds OFF by default
