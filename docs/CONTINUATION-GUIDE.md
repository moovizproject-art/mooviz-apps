# MOOVIZ — Continuation Guide

**Last updated**: 2026-03-03
**Author**: Tamir Konortov, CTO — KAL Solutions Group
**Status**: Sprint 0 complete, Sprint 1 ready to begin

---

## Current State

### What's Done (Sprint 0 — M0.1-M0.3)

| Task | Status | Notes |
|------|--------|-------|
| GitHub monorepo created | Done | github.com/tamirkonor/mooviz |
| CI/CD pipelines (GitHub Actions) | Done | ci.yml + deploy.yml |
| Mobile app scaffold (Expo SDK 50) | Done | 13 screens, 8 components, 6 hooks, 7 services |
| Admin panel scaffold (React/Vite) | Done | 8 pages, 9 components, Tailwind CSS |
| Cloud Functions scaffold (Gen 2) | Done | 3 triggers, 6 callable, 1 scheduled |
| Shared types + validators | Done | Status state machine, notification templates |
| Firestore rules + storage rules | Done | RBAC rules for all collections |
| Firestore composite indexes | Done | 4 indexes for common queries |
| Tasks imported into KAL CRM | Done | 73 tasks across 8 sprints, 23 sub-milestones |

### What's NOT Done Yet
- Firebase projects not created (dev + prod)
- No `pnpm install` / dependency installation
- No `.env` files with real Firebase config
- No Google Maps API key configured
- No EAS Build profiles set up
- App hasn't been run on a device yet

---

## Next Steps (Sprint 1 — M1.1-M1.4)

### Priority Order

1. **Create Firebase projects** (tasks #105-#108)
   - Create `mooviz-dev` and `mooviz-prod` Firebase projects
   - Enable: Auth (Phone + Email), Firestore, Cloud Functions, Storage, FCM
   - Download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)
   - Set billing alerts

2. **Install dependencies**
   ```bash
   cd /path/to/mooviz
   pnpm install          # Root + all workspaces
   cd functions && npm install  # Functions has its own node_modules
   ```

3. **Set up environment files**
   ```bash
   # apps/mobile/.env
   EXPO_PUBLIC_FIREBASE_API_KEY=...
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=mooviz-dev

   # apps/admin/.env
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_PROJECT_ID=mooviz-dev
   ```

4. **Configure Firebase emulators**
   ```bash
   firebase login
   firebase use mooviz-dev
   firebase emulators:start   # Auth:9099, Functions:5001, Firestore:8080, Storage:9199
   ```

5. **Implement OTP Auth** (tasks #113-#115)
   - The auth screens (`LoginScreen.tsx`, `OTPScreen.tsx`, `RegisterScreen.tsx`) have full UI
   - Need to wire up real Firebase Auth calls in `services/auth.ts`
   - Test with Firebase Auth emulator first

6. **Implement Firestore data models** (task #120)
   - Types are defined in `shared/src/types/`
   - Security rules are in `firestore.rules`
   - Need to create seed data for testing

---

## Architecture Overview

```
mooviz/
├── apps/
│   ├── mobile/          # React Native (Expo) — Sender + Driver
│   │   ├── src/
│   │   │   ├── screens/     # 13 screens (auth/sender/driver/shared)
│   │   │   ├── components/  # 8 reusable components
│   │   │   ├── hooks/       # 6 custom hooks (auth, firestore, location, delivery, chat, notifications)
│   │   │   ├── services/    # 7 Firebase service wrappers
│   │   │   ├── navigation/  # Role-based navigation (AuthStack, SenderTabs, DriverTabs)
│   │   │   ├── constants/   # Colors, config, status display
│   │   │   ├── utils/       # Formatters, validators, permissions
│   │   │   └── types/       # Re-exports from @mooviz/shared
│   │   └── App.tsx          # Entry: RTL + ErrorBoundary + AuthProvider + Navigation
│   └── admin/           # React Web — Admin dashboard
│       └── src/
│           ├── pages/       # 8 pages (Dashboard, Users, Deliveries, Reports, Settings)
│           ├── components/  # 9 components (Layout, DataTable, StatusBadge, etc.)
│           ├── hooks/       # 3 hooks (auth, firestore, stats)
│           └── services/    # 5 services (firebase, auth, users, deliveries, reports)
├── functions/           # Firebase Cloud Functions (TypeScript, Gen 2)
│   └── src/
│       ├── triggers/    # 3 Firestore triggers (delivery, user, chat)
│       ├── callable/    # 6 HTTPS callable (express interest, approve, pickup, deliver, payment, cancel)
│       ├── scheduled/   # 1 cron job (timeout cleanup, hourly)
│       ├── validators/  # Server-side status transition + RBAC
│       └── services/    # FCM notifications, geohash proximity
├── shared/              # @mooviz/shared — shared across all packages
│   └── src/
│       ├── types/       # User, Delivery, Chat, Rating, Report, AdminAction
│       ├── constants/   # Status state machine, notification templates
│       └── validators/  # Status transition validator, user/delivery validators
├── firestore.rules      # Firestore security rules (RBAC)
├── storage.rules        # Storage rules (5MB max, image only)
├── firebase.json        # Firebase config + emulators
└── turbo.json           # Turborepo pipeline config
```

---

## Key Design Decisions

1. **Hebrew-first RTL** — All UI text in Hebrew, `I18nManager.forceRTL(true)` at app startup
2. **Server-side validation** — ALL status transitions validated in Cloud Functions, never trust client
3. **Geohash proximity** — Driver feed uses geohash-based queries (no GeoFirestore dependency)
4. **Real-time via onSnapshot** — No polling, Firestore listeners for instant updates
5. **Proof system** — Mandatory photo upload for `picked_up` and `delivered` transitions
6. **Status state machine** — Defined in `shared/src/constants/statuses.ts` with transition map + RBAC

---

## Delivery Status Flow

```
NEW → (driver interested) → PENDING → (sender approves) → WAITING
  → (driver picks up + proof photo) → PICKED_UP
  → (driver delivers + proof photo) → DELIVERED
  → (both confirm payment) → COMPLETED_PAID

Cancellation: NEW/PENDING/WAITING → CANCELLED (pre-pickup only)
Revert: PENDING → NEW (driver cancels or 72h timeout)
```

---

## CRM Task Management

All 73 tasks are tracked in KAL CRM (Project #1 — Mooviz Application).

### API Access
```bash
CRM_URL="http://localhost:8080/projects_extended/projects_api"
API_KEY="20ecc8d1c487e0b7666da0fd7ea975a210875572160b980b9e99b10ea0ce2332"
API_SECRET="0c029cf7b2c61c68b0fd48f6ed030d0ed465697a57b404067afca5c680cae5ab"

# List tasks
curl -s "$CRM_URL/tasks?project_id=1&per_page=100" \
  -H "X-API-Key: $API_KEY" -H "X-API-Secret: $API_SECRET"

# Update task status (1=Not Started, 4=In Progress, 5=Complete)
curl -s -X PATCH "$CRM_URL/task_status/{TASK_ID}" \
  -H "X-API-Key: $API_KEY" -H "X-API-Secret: $API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"status": 5}'
```

### Sprint Overview (8 sprints, 45 calendar days)

| Sprint | Days | Focus | Key Tasks |
|--------|------|-------|-----------|
| Sprint 0 | Days 1-3 | Setup & scaffold | #101-#112 (DONE) |
| Sprint 1 | Days 4-10 | Auth + users + data models | #113-#124 |
| Sprint 2 | Days 11-17 | Mobile scaffold + home + onboarding | #125-#131 |
| Sprint 3 | Days 18-24 | Delivery CRUD + feed + state machine | #132-#138 |
| Sprint 4 | Days 25-31 | GPS + chat + push + payments | #139-#150 |
| Sprint 5 | Days 32-37 | Admin panel + ratings + cancellation | #151-#158 |
| Sprint 6 | Days 38-42 | Polish + edge cases + migration | #159-#165 |
| Sprint 7 | Days 43-45 | Store submission + handover | #166-#173 |

### Critical Path
```
Firebase Setup → Auth/OTP → User Profile → Data Models → Delivery Creation →
Driver Feed → Status Machine → GPS Tracking → Chat →
Push Notifications → Payment Flow → Ratings →
Admin Panel → Stabilization → Store Submission
```

---

## Claude Code Skills

When working on this project with Claude Code, use these skills:

| Skill | When |
|-------|------|
| `crm-task` | Managing tasks in KAL CRM via API |
| `fullstack-dev-skills:react-native-expert` | Mobile app screens, navigation, platform code |
| `fullstack-dev-skills:typescript-pro` | Type safety, generics, strict mode |
| `fullstack-dev-skills:cloud-architect` | Firebase/GCP infrastructure |
| `fullstack-dev-skills:security-reviewer` | Auth, RBAC, Firestore rules |
| `fullstack-dev-skills:test-master` | Jest, testing strategy |
| `draw-io:draw-io` | Architecture diagrams |

---

## Payment Milestones

| Milestone | Amount (ILS) | Trigger |
|-----------|-------------|---------|
| Advance | 45,000 + VAT | Contract signing |
| M1 | 13,500 + VAT | Auth + users + data models + base mobile |
| M2 | 9,000 + VAT | Delivery lifecycle + GPS + chat + push + admin |
| M3 | 4,500 + VAT | Feature completion + stabilization |
| M4 | 18,000 + VAT | Production build + store submission |
| **Total** | **90,000 + VAT** | |

---

## Quick Commands

```bash
# Development
pnpm dev:mobile          # Start Expo dev server
pnpm dev:admin           # Start admin Vite dev server
pnpm dev:functions       # Start functions emulator

# Build
pnpm build               # Build all packages
turbo run build           # Parallel build with Turborepo

# Deploy
firebase deploy --only functions   # Deploy Cloud Functions
firebase deploy --only hosting     # Deploy admin panel
eas build --platform ios           # Build iOS app
eas build --platform android       # Build Android app

# Testing
pnpm test                # Run all tests
firebase emulators:start # Start local emulators
```
