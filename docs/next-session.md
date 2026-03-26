# MOOVIZ — Session Continuation Guide
> Last updated: 2026-03-25 | v0.9.0 (build 92)

## Current State
- **Branch**: `main` (uncommitted changes for v0.9.0 iOS fixes)
- **Version**: v0.9.0 (build 92) — both iOS and Android
- **APK**: not yet built for 0.9.0
- **iOS**: TestFlight build 91 uploaded, build 92 needs clean archive + upload
- **Functions**: deployed (27 functions)
- **Hosting**: deployed — admin + terms + privacy pages
- **Firestore rules**: deployed — `acceptedTermsAt` in allowed fields
- **Admin env**: `.env.production` fixed to dev (`mooviz-app-9b766`), gitignored
- **All Firebase envs**: dev project (`mooviz-app-9b766`) — mobile, admin, functions

## What Was Done This Session (v1.1.5 → v1.1.7)

### Mobile
- KYC camera permission + error handling + file size check
- AcceptTerms: optimistic state update via `updateProfile()` (was stuck due to serverTimestamp cache)
- Firestore rules: `acceptedTermsAt` added to `allowedUserUpdateFields()`
- 7 new Hebrew i18n keys for camera/upload/storage errors

### Admin
- Search: removed limit, normalized Israeli phone format (054 → +97254)
- `.env.production`: was pointing to `mooviz-prod`, fixed to `mooviz-app-9b766`

### Hosting
- Created `terms.html` + `privacy.html` (Hebrew), firebase.json rewrites added

### Auth
- Passwords reset for `admin@mooviz.co.il`, `tamir@kal.solutions`, `tamir.konor@gmail.com` → `1q2w3e4r`

## Open Items

### P0
1. **Glide migrated drivers** — have `driverUnlocked: true` without KYC. Decide: reset or grandfather?
   - Example: Asaf (`ykM2sEmNDdaW8byv3AJ3koorcW13`): role=sender, activeMode=driver, driverUnlocked=true, kycStatus=pending
2. **Honda-xr650 KYC upload retest** — camera permission fix in v1.1.7, needs retest

### P1
3. **Admin `.env.production` gitignored** — deployment needs env injection strategy
4. **gcloud credentials expired** — run `gcloud auth login` to restore Admin SDK access

### Backlog
- Interstitial ads (#159), Analytics events (#160)
- P0/P1 bug triage (#165)
- Production config (#168-169), Store submissions (#170-172), Handover (#173)
