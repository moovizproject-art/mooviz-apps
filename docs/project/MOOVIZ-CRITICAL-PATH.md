# MOOVIZ — Critical Path Analysis

> **Project**: MOOVIZ MVP
> **Duration**: 45 calendar days
> **Method**: Dependency-driven critical path identification

---

## Critical Path (Longest Chain)

```
Firebase/GCP Setup (M0.2)
    │
    ├──→ Firebase Auth / OTP (M1.1)
    │       │
    │       └──→ User Registration / Profile (M1.2)
    │               │
    │               └──→ Firestore Data Models (M1.3)
    │                       │
    │                       ├──→ Cloud Functions / RBAC (M1.4)
    │                       │       │
    │                       │       ├──→ Status State Machine (M2.3) ←── CRITICAL NODE
    │                       │       │       │
    │                       │       │       ├──→ GPS Tracking (M2.4)
    │                       │       │       ├──→ Push Notifications (M2.6)
    │                       │       │       ├──→ Chat Timeline (M2.5)
    │                       │       │       └──→ Payment Flow (M2.7)
    │                       │       │               │
    │                       │       │               └──→ Ratings (M3.1)
    │                       │       │                       │
    │                       │       │                       └──→ Stabilization (M3.6)
    │                       │       │                               │
    │                       │       │                               └──→ Store Submission (M4.1-M4.5)
    │                       │       │
    │                       │       └──→ Admin Panel (M2.8)
    │                       │
    │                       └──→ Delivery Creation (M2.1)
    │                               │
    │                               └──→ Driver Feed (M2.2)
    │
    └──→ Mobile Scaffold (M1.5)
            │
            └──→ Home Screen (M1.6)
```

---

## Dependency Matrix

| Sub-Milestone | Depends On | Blocks |
|--------------|-----------|--------|
| **M0.1** Project Infrastructure | — | M0.2, M0.3, M1.5 |
| **M0.2** Firebase/GCP Setup | M0.1 | M1.1, M1.3, M1.4 |
| **M0.3** Design System Scaffold | M0.1 | M1.5, M1.6 |
| **M1.1** Firebase Auth (OTP) | M0.2 | M1.2, M1.5 |
| **M1.2** User Registration | M1.1 | M1.3 (user model), M2.1 |
| **M1.3** Firestore Data Models | M0.2, M1.2 | M1.4, M2.1, M2.2, M2.5 |
| **M1.4** Cloud Functions / RBAC | M1.3 | M2.3, M2.6, M2.8 |
| **M1.5** Mobile App Scaffold | M0.1, M0.3, M1.1 | M1.6, M2.1 |
| **M1.6** Home Screen + Onboarding | M1.5 | — (UI only) |
| **M2.1** Delivery Creation | M1.3, M1.5, M1.2 | M2.2, M2.3 |
| **M2.2** Driver Feed + Radius | M1.3, M2.1 | M2.3, M2.4 |
| **M2.3** Status State Machine | M1.4, M2.1 | M2.4, M2.5, M2.6, M2.7, M3.2 |
| **M2.4** GPS Tracking | M2.2, M2.3 | M3.5 |
| **M2.5** Chat + Proof System | M1.3, M2.3 | M3.5 |
| **M2.6** Push Notifications | M1.4, M2.3 | M3.5 |
| **M2.7** Payment Confirmation | M2.3 | M3.1 |
| **M2.8** Admin Panel | M1.4, M1.3 | M3.6 |
| **M3.1** Ratings & Reputation | M2.7 | M3.6 |
| **M3.2** Cancellation Logic | M2.3 | M3.6 |
| **M3.3** Interstitial Infrastructure | M1.5 | — (independent) |
| **M3.4** Analytics Events | M1.5 | — (independent) |
| **M3.5** Edge Case Handling | M2.4, M2.5, M2.6 | M3.6 |
| **M3.6** Bug Fixing + Stabilization | M3.1, M3.2, M3.5, M2.8 | M4.1 |
| **M3.7** User Data Migration | M1.3, M1.2 | M4.1 |
| **M4.1** Production Build | M3.6, M3.7 | M4.2, M4.3 |
| **M4.2** App Store (iOS) | M4.1, M4.4 | M4.5 |
| **M4.3** Play Store (Android) | M4.1, M4.4 | M4.5 |
| **M4.4** Store Compliance | M4.1 | M4.2, M4.3 |
| **M4.5** Handover + Docs | M4.2, M4.3 | — |

---

## Blocking Dependencies (Critical)

### 1. Firebase Project Setup → ALL Development
**Why**: Every service (Auth, Firestore, Functions, Storage, FCM) depends on the Firebase project existing.
**Mitigation**: Complete M0.2 on Day 1. Pre-create both dev and production projects.

### 2. Auth/OTP → User Profiles → Everything Else
**Why**: Users can't be created without auth. Deliveries, chat, ratings all require authenticated users.
**Mitigation**: Use Firebase Auth emulator for parallel development while OTP is being configured.

### 3. Firestore Data Models → Delivery CRUD + Chat
**Why**: All application data flows through Firestore. Collections and indexes must be defined before feature work.
**Mitigation**: Define schema early (Sprint 1), iterate as needed. Use TypeScript interfaces for type safety.

### 4. Status State Machine → GPS, Chat Timeline, Push, Payments
**Why**: This is the **single most critical component**. GPS tracking states, chat system messages, push event triggers, and payment flow all depend on the state machine working correctly.
**Mitigation**: Build and test the state machine Cloud Function first in Sprint 3. Deploy to dev immediately.

### 5. Cloud Functions → Status Transitions + Push Notifications
**Why**: Server-side validation is mandatory (contract requirement). Status changes and push events are Function-triggered.
**Mitigation**: Deploy Cloud Functions iteratively. Use Firebase emulator for local testing.

### 6. Store Submission → ALL Feature Completion + Privacy Policy
**Why**: Can't submit to stores until all features work, privacy policy exists, test accounts ready.
**Mitigation**: Start App Store Connect / Play Console setup in Sprint 0. Submit TestFlight build early.

---

## Parallelization Opportunities

Despite the critical path, several streams can run in parallel:

### Stream A: Backend (Critical Path)
```
M0.2 → M1.1 → M1.3 → M1.4 → M2.3 → M2.6 → M3.6 → M4.1
```

### Stream B: Mobile UI (Parallel)
```
M0.3 → M1.5 → M1.6 → M2.1 (UI) → M2.2 (UI) → M2.4 (UI) → M3.5
```

### Stream C: Admin (Semi-Independent)
```
M2.8 can start once M1.4 is done — runs parallel to M2.4-M2.7
```

### Stream D: Independent Tasks
```
M3.3 (Interstitial) — anytime after M1.5
M3.4 (Analytics) — anytime after M1.5
M3.7 (Migration) — anytime after M1.2 + M1.3
```

---

## Minimum Viable Critical Path Timeline

| Day | Critical Path Activity | Parallel Activities |
|-----|----------------------|---------------------|
| 1-3 | M0.1, M0.2 setup | M0.3 design system |
| 4-7 | M1.1 Auth/OTP | M1.5 mobile scaffold |
| 8-10 | M1.2 Registration | M1.6 home screen |
| 11-14 | M1.3 Data models | M2.1 listing UI |
| 15-17 | M1.4 Cloud Functions | M2.2 feed UI |
| 18-21 | M2.3 State machine | M2.1 backend integration |
| 22-24 | M2.3 testing + M2.6 push | M2.2 geohash + M2.5 chat start |
| 25-28 | M2.4 GPS + M2.5 chat | M2.7 payment UI |
| 29-31 | M2.6 push + M2.7 backend | M2.8 admin panel start |
| 32-34 | M2.8 admin panel | M3.1 ratings |
| 35-37 | M3.1 + M3.2 cancellation | M3.3, M3.4 parallel |
| 38-40 | M3.5 edge cases + M3.6 bugs | M3.7 migration |
| 41-42 | M3.6 stabilization | M4.4 store compliance |
| 43-44 | M4.1 production build | M4.2 + M4.3 store submissions |
| 45 | M4.5 handover | — |

---

## Risk: What If Critical Path Slips?

| Delay Point | Impact | Recovery Options |
|-------------|--------|-----------------|
| M0.2 (Firebase setup) | Everything delayed | Pre-configure, use emulators |
| M1.1 (Auth) | 3-4 day cascade | Use mock auth for UI work |
| M2.3 (State machine) | 5-7 day cascade | Prototype transitions client-side, validate server-side later |
| M3.6 (Stabilization) | Store submission delayed | Prioritize P0 only, defer P2/P3 |
| M4.2/M4.3 (Store rejection) | Payment milestone delayed | Early TestFlight, follow guidelines strictly |

---

*No circular dependencies detected. Critical path length: ~40 working days with 5 days of parallel buffer.*
