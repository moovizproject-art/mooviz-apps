# MOOVIZ — Milestones & Sprint Plan

> **Project**: MOOVIZ Real-Time Community Delivery Platform (MVP)
> **Duration**: 45 calendar days (~7-8 sprints of 5-7 days)
> **Resource**: Tamir Konortov (CTO, fullstack) — primary developer + part-time fullstack support
> **Budget**: 90,000 NIS + VAT

---

## Milestone Structure

The contract defines 4 payment milestones (plus 50% advance). Below, each is broken into **feature-level sub-milestones** for granular tracking.

---

## Milestone 0 — Project Setup & Kickoff (Pre-Development)
*Not a payment milestone — prerequisite for all work*

### M0.1: Project Infrastructure
- GitHub repository setup (monorepo: mobile + functions + admin)
- CI/CD pipeline configuration (EAS Build for React Native, Cloud Functions deploy)
- Environment separation: dev / staging / production
- KAL CRM project setup with tasks imported from CSV

### M0.2: Firebase / GCP Project Setup
- Firebase project creation (dev + production)
- Enable: Authentication, Firestore, Cloud Functions, Cloud Storage, FCM
- Security rules baseline
- Service account configuration
- GCP billing alerts

### M0.3: Design System & Component Library Scaffold
- React Native project initialization (Expo or bare)
- Navigation structure (React Navigation)
- RTL support configuration
- Base component library: buttons, inputs, cards, modals
- Theme system (colors, typography, spacing)
- Google Maps SDK integration scaffold

---

## Milestone 1 — Backend Foundations + Auth + Base Mobile
**Payment**: 15% = 13,500 NIS + VAT
**Trigger**: Backend foundations, authentication, base data models, initial mobile flows

### M1.1: Firebase Auth (OTP SMS/Email)
- OTP authentication flow (SMS + Email)
- Phone number validation (Israeli + international format)
- Session management
- Auth state persistence
- Error handling (invalid OTP, expired, rate limiting)

### M1.2: User Registration & Profile (KYC-Light)
- Registration form with all required fields
- Profile photo upload (camera + gallery)
- ID/license photo upload for KYC-Light
- Admin approval workflow for new users
- Profile view and edit screens
- Terms of service + privacy consent gate

### M1.3: Firestore Data Models
- **Users collection**: profile data, role, KYC status, rating aggregate, location
- **Deliveries collection**: all listing fields, status, timestamps, participants
- **Chats collection**: messages, system events, proof images
- **Ratings collection**: per-delivery ratings with comments
- **Reports collection**: user reports with admin notes
- **Admin actions collection**: audit trail
- Indexes for common queries (status + location, user + status, etc.)

### M1.4: Cloud Functions Base (Security Rules, RBAC)
- Firestore security rules (read/write per role)
- RBAC enforcement (Sender vs Driver vs Admin)
- Cloud Functions scaffold (TypeScript)
- Status transition validator function
- Utility functions (timestamps, notifications trigger base)

### M1.5: Mobile App Scaffold
- React Native project with navigation (tab + stack)
- RTL layout engine
- Auth flow screens (login, OTP verification)
- Global state management
- API/Firebase service layer
- Error boundary and crash handling
- Splash screen + app icon

### M1.6: Home Screen + Onboarding Flow
- Home screen (role-based CTA)
- Onboarding flow (first-time user)
- Social links (Facebook, Instagram, TikTok)
- Role-based navigation (Sender vs Driver bottom tabs)

---

## Milestone 2 — Delivery Lifecycle + GPS + Chat + Notifications + Admin
**Payment**: 10% = 9,000 NIS + VAT
**Trigger**: Delivery lifecycle, GPS tracking, chat, notifications, admin core

### M2.1: Delivery Creation & Listing Management
- Create listing form (all fields from spec)
- Address autocomplete (Google Places)
- Photo upload for item
- Listing validation (required fields, min price)
- Edit/delete listing (pre-assignment only)
- "My Deliveries" screen (Sender)

### M2.2: Driver Feed with Filters + Radius Search
- Driver feed listing view
- Filters: size, city, distance
- Geohash-based proximity search
- Haversine distance filtering
- "I'm Interested" action
- Feed auto-refresh when listings become unavailable

### M2.3: Delivery Status State Machine (Server-Validated)
- Cloud Function: status transition validator
- All 7 statuses implemented with transition rules
- Concurrency control (one driver per delivery)
- Timeout logic (72h auto-revert)
- Status change triggers: push + chat timeline + timestamp + actor
- Cancellation rules enforced server-side

### M2.4: Live GPS Tracking + Map Integration
- Driver location broadcasting (throttled updates)
- Geohash-indexed location storage
- Live map view (Google Maps SDK)
- Both parties visible on map
- Status-based tracking states
- Navigation deep links (Google Maps, Waze, Apple Maps)
- "Location unavailable" fallback

### M2.5: 1:1 Real-Time Chat + Image Upload + Proof System
- Real-time messaging (Firestore listeners)
- System messages for status changes
- Image upload (camera + gallery)
- Proof of Pickup / Delivery (mandatory image upload)
- Proof of Payment (optional image upload)
- Proof metadata storage
- Chat/timeline view with proof image previews

### M2.6: Push Notifications (FCM)
- Cloud Functions triggers for all 8 notification events
- FCM integration (iOS + Android)
- Geo-targeted push for new listings (radius-based)
- Deep links to relevant screens
- Badge/count management
- In-app notification fallback when push not delivered
- Basic deduplication

### M2.7: Payment Confirmation Flow
- "Payment Sent" action (Sender)
- "Payment Received" action (Driver)
- Payment status display (badges/labels)
- Deep links to Bit / PayBox / bank
- "Completed & Paid" auto-transition
- Chat/timeline logging for payment events
- Push notification on payment confirmations

### M2.8: Admin Panel (Web)
- Web-based admin panel (React or similar)
- Authentication (admin login)
- Dashboard with basic analytics
- User management: list, search, filter, view profile, suspend, block, verify
- Delivery management: list, timeline view, status override, force cancel
- Report management: view reports, admin notes, moderation actions
- Proof image viewer
- Payment status viewer
- Audit trail (all admin actions logged)

---

## Milestone 3 — Feature Completion + Stabilization
**Payment**: 5% = 4,500 NIS + VAT
**Trigger**: Feature completion, stabilization, store submission readiness + P0/P1 bug fixing

### M3.1: Ratings & Reputation System
- Post-delivery rating prompt (in-app + push)
- 1–5 star rating with optional comment
- One-time rating per delivery (no edits)
- Average rating calculation + display
- Completed deliveries/trips count
- Rating in user profile + listing details
- Admin moderation of abusive ratings

### M3.2: Cancellation Logic + Edge Cases
- Pre-pickup cancellation for both parties
- Post-cancellation: listing reverts to feed
- Cancellation notification + timeline log
- Block cancellation after "Picked Up"
- All edge cases from binding list implemented

### M3.3: Interstitial Ad Infrastructure
- Configurable launch interstitial screen
- Image/video support
- Skip button, click-through link
- Server-side targeting rules
- Admin activation/deactivation
- **Disabled for initial production release**

### M3.4: Analytics Events Integration
- GA4 or Amplitude SDK integration
- All 11 analytics events from Annex C implemented
- Event parameters properly tracked

### M3.5: Edge Case Handling
- Loading states for all data fetches
- Empty states with appropriate messaging
- Offline mode: graceful failures + retry
- GPS denied handling
- Third-party failure handling
- Idempotent action handling
- Feed staleness handling

### M3.6: P0/P1 Bug Fixing + Stabilization
- Bug triage and prioritization
- P0 critical bug fixes
- P1 high-severity bug fixes
- Performance optimization
- Memory leak identification and fixes
- Crash rate reduction

### M3.7: User Data Migration
- Export existing Glide users
- Data transformation/mapping
- Import to Firestore
- Validation and reconciliation
- Communication to existing users

---

## Milestone 4 — Final Delivery + Store Submission
**Payment**: 20% = 18,000 NIS + VAT
**Trigger**: Production build handover + store submission

### M4.1: Production Build + Environment Config
- Production Firebase/GCP configuration
- Environment variables and secrets
- Production security rules review
- Backup configuration
- Monitoring and alerting setup

### M4.2: App Store Submission (iOS)
- Production iOS build (signed)
- App Store Connect setup
- Screenshots and metadata
- Privacy nutrition labels
- Test account for Apple review

### M4.3: Play Store Submission (Android)
- Production Android build (signed APK/AAB)
- Google Play Console setup
- Store listing and screenshots
- Content rating questionnaire
- Test account for Google review

### M4.4: Store Review Compliance
- Privacy Policy page/screen
- Terms of Service page/screen
- Permission usage descriptions
- Demo video (if needed)
- Native capabilities verification (avoid "wrapped website" classification)
- iOS 13+ / Android 7+ compatibility verification

### M4.5: Production Handover + Documentation
- Source code access handover (GitHub)
- Firebase/GCP project access
- Deployment documentation
- Architecture documentation
- Runbook for common operations
- Final project sign-off

---

## Sprint Plan

| Sprint | Days | Calendar | Focus | Sub-Milestones | Deliverables |
|--------|------|----------|-------|----------------|-------------|
| **Sprint 0** | 1-3 | Days 1-3 | Setup & scaffold | M0.1, M0.2, M0.3 | Repo, CI/CD, Firebase project, RN scaffold |
| **Sprint 1** | 4-10 | Days 4-10 | Auth + users + data models | M1.1, M1.2, M1.3, M1.4 | Working OTP auth, registration, Firestore schema, security rules |
| **Sprint 2** | 11-17 | Days 11-17 | Mobile scaffold + screens | M1.5, M1.6, M2.1 | App navigation, home screen, listing creation |
| **Sprint 3** | 18-24 | Days 18-24 | Delivery core + feed | M2.2, M2.3 | Driver feed, state machine, geohash search |
| **Sprint 4** | 25-31 | Days 25-31 | GPS + chat + push | M2.4, M2.5, M2.6 | Live tracking, real-time chat, push notifications |
| **Sprint 5** | 32-37 | Days 32-37 | Payment + admin + ratings | M2.7, M2.8, M3.1 | Payment flow, admin panel, rating system |
| **Sprint 6** | 38-42 | Days 38-42 | Polish + edge cases | M3.2-M3.7 | Cancellation, analytics, edge cases, migration, stabilization |
| **Sprint 7** | 43-45 | Days 43-45 | Store submission + handover | M4.1-M4.5 | Production builds, store submissions, documentation |

---

## Risk Factors

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Apple App Store rejection | Delays M4 payment | Native capabilities, early TestFlight, compliance checklist |
| Firebase OTP SMS costs | Budget impact | Email OTP fallback, rate limiting |
| Glide data migration complexity | Delays M3.7 | Early data audit, incremental migration |
| Client feedback delays | Timeline extension | Day-for-day clause, weekly syncs |
| Scope creep via verbal requests | Budget/timeline | Change Request process, written-only changes |
| React Native performance on older devices | UX degradation | Android 7+/iOS 13+ minimum, performance testing |

---

*23 sub-milestones across 4 payment milestones + 1 setup phase, planned in 8 sprints over 45 calendar days.*
