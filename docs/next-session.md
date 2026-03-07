# MOOVIZ — Session Continuation Guide
> Last updated: 2026-03-07 | Sprint 2 IN PROGRESS

## Current State

### Branch: `feature/ui-ux-redesign` (merged to main via PR #3)
Next work goes on new branch: `feature/improvements-epic`

### What Was Done This Session (March 6-7)

#### Bug Fixes
1. **Sound crash on device** — Made sound service crash-proof with global kill switch, skip iOS-only `setCategory` on Android, wrap all native calls in try-catch
2. **Onboarding RTL on device** — Removed all broken RTL hacks (inverted/scaleX/direction). Added `scrollToIndex(0)` on mount for RTL. DO NOT ADD RTL HACKS — see comment in code
3. **Driver feed stuck/refresh loop** — Replaced FlatList with ScrollView, removed RefreshControl
4. **Delivery not in My Deliveries** — STATUS_MAP was missing `new`, `waiting`, `completed_paid`
5. **OTP → empty screen** — `refreshUserDoc()` only updated `lastOtpAt` partial. Fixed to full user doc load when `currentUser` is null
6. **Push notifications not arriving** — Fixed token field mismatch (`fcmToken` vs `fcmTokens` array), added Android 13+ POST_NOTIFICATIONS runtime permission, hooked `useNotifications()` in RootNavigator
7. **MapPicker** — Complete rewrite with map pin dragging + reverse geocoding
8. **Radar animation** — Pure Animated concentric circles with rotating sweep beam (no GIF)

#### Features
9. **Email broadcasting** — Cloud Function deployed with SMTP secrets, admin UI page
10. **Functions deployment** — Bundled shared as tgz for Cloud Run compatibility

#### Infra
11. **PR #3 created** — `feature/ui-ux-redesign` → `main`
12. **CRM updated** — 3 tasks moved to Awaiting Feedback (176, 177, 178)
13. **Client PDF** — Gamma sprint report generated

### Key Commits (feature/ui-ux-redesign)
```
757629d fix(mobile): delivery list filter, OTP empty screen, push permissions
25b24a9 fix(functions,mobile): fix FCM push notifications not sending
57888ea fix(mobile): force onboarding FlatList to index 0 on RTL mount
cb17358 fix(mobile): crash-proof sound service, onboarding RTL verified on device
3e556a9 feat(mobile,functions): map picker, driver feed redesign, email deploy, mode switch
```

---

## Next Session Tasks (feature/improvements-epic)

### Priority 1: iOS Build
- [ ] Attempt iOS build — never done before, expect CocoaPods and linking issues
- [ ] Verify all native deps have iOS podspecs
- [ ] Check `apps/mobile/ios/` for Podfile, GoogleService-Info.plist
- [ ] Run `pod install` and fix any version conflicts
- [ ] Test on iOS Simulator

### Priority 2: Sounds Off by Default
- [ ] Change `useSound.tsx` initial state: `useState(true)` → `useState(false)`
- [ ] Or change AsyncStorage default: treat missing key as `false` instead of `true`

### Priority 3: Delivery Save & Multi-Media Upload
- [ ] Fix delivery not saving (investigate CreateDeliveryScreen submit flow)
- [ ] Allow 5 images + 1 video (up to 5MB each) per delivery
- [ ] Add video compression before upload
- [ ] Update Firestore data model: `item.photoURL` → `item.mediaURLs: string[]`
- [ ] Update CreateDeliveryScreen UI with multi-image picker + video picker
- [ ] Update Cloud Storage rules for video content types

### Priority 4: Glide Migration Image Fetcher
- [ ] Modify `scripts/migrate-glide-data.ts`
- [ ] For users with image URLs in Glide data: fetch images in background
- [ ] Upload fetched images to Firebase Storage under `users/{uid}/profile/`
- [ ] Update Firestore user docs with new Storage URLs
- [ ] Handle rate limiting and retries for bulk fetch

### Priority 5: Continue CRM Sprint 2 Tasks
Open tasks (status=1):
- 140: Live map tracking view
- 141: Navigation deep links
- 143: System messages in chat
- 144: Chat image upload
- 146-148: Push notification triggers, FCM client, in-app fallback
- 149-150: Payment confirmation UI + backend
- 159: Interstitial ad infrastructure
- 160: Analytics events

---

## Critical RTL Rules (DO NOT CHANGE)
- Onboarding FlatList: NO `inverted`, NO `scaleX`, NO `direction: 'ltr'`, NO reversed arrays
- Just use `scrollToIndex(0)` on mount when `isRTL`
- Always test on physical Hebrew device, not just emulator

## Environment Quick Start
```bash
# Start emulator
~/Library/Android/sdk/emulator/emulator -avd Pixel_9_Pro_API_35 &

# Start Metro (from apps/mobile/)
cd apps/mobile && node ../../node_modules/react-native/cli.js start --reset-cache

# Start admin panel
cd apps/admin && npm run dev -- --port 5002

# Build release APK
cd apps/mobile/android && ./gradlew assembleRelease

# Deploy to device (replace PORT)
adb connect 10.0.0.18:PORT
adb -s 10.0.0.18:PORT install -r app/build/outputs/apk/release/app-release.apk

# Deploy functions
cd functions && FIREBASE_TOKEN=<token> npx firebase deploy --only functions
```

## CRM Integration
- API: `https://crm-app.kal-trade.com/projects_extended/projects_api`
- Credentials: `.env.crm-api`
- On task completion: `PATCH /task_status/{task_id}` with `{"status": 5}`

## User Preferences
- **NO** `Co-Authored-By: Claude` in git commits
- Client should not see AI attribution
- Hebrew RTL is primary language
- Use Gamma for PDF generation
- Sounds OFF by default
