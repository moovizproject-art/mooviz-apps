---
title: "MOOVIZ — Real-Time Community Delivery Platform"
subtitle: "Project Definition, Architecture & Execution Plan"
author: "Tamir Konortov, CTO — KAL Solutions Group"
date: "March 2026"
subject: "MVP Project Document"
keywords: [MOOVIZ, MVP, Delivery Platform, React Native, Firebase]
lang: en
geometry: margin=2.5cm
fontsize: 11pt
toc: true
toc-depth: 3
numbersections: true
colorlinks: true
header-includes: |
  \usepackage{fancyhdr}
  \pagestyle{fancy}
  \fancyhead[L]{MOOVIZ — Project Document}
  \fancyhead[R]{KAL Solutions Group}
  \fancyfoot[C]{\thepage}
  \fancyfoot[R]{Confidential}
---

\newpage

# Executive Summary

## About MOOVIZ

MOOVIZ is a real-time, community-based delivery platform that connects shippers and drivers already on the move. The product is designed as a lean, production-ready MVP to validate market demand, operational flows, and user engagement before scaling into a full logistics marketplace.

The platform removes intermediaries, operates without commissions in the MVP phase, and emphasizes transparency, speed, and community trust.

## Project Scope

This document defines the complete MVP project scope covering:

- Native mobile applications for **iOS and Android** (React Native, single codebase)
- **Live GPS tracking** and real-time map visibility for all parties
- **Direct 1:1 communication** between users (real-time chat)
- **Scalable serverless backend** using Google Cloud Platform and Firebase
- **Payment integration** via external deep links (Bit, PayBox, bank transfer)
- **Admin panel** (web) with full moderation and operational capabilities
- **User data migration** from the existing Glide-based prototype

## MVP Validation Targets

| Metric | Target |
|--------|--------|
| Initial users | 5,000 |
| Active listings/month | 500 |
| Supported platforms | iOS 13+ / Android 7+ |
| Languages | Hebrew + English (full RTL) |

## Project Parameters

| Parameter | Value |
|-----------|-------|
| **Total cost** | 90,000 NIS + VAT |
| **Timeline** | 45 calendar days |
| **Delivery model** | Accelerated Founder-Led MVP |
| **Lead** | Tamir Konortov, CTO — KAL Solutions Group |
| **Client** | G.M. Mooviz Software (2026) Ltd |
| **Client contacts** | Guy Morduch, Assaf Gerbali |
| **Existing product** | https://mooviz-app.glide.page/ |

\newpage

# Target Users & Roles

## Sender / Publisher
Creates delivery requests, sets price, communicates with drivers, approves pickup and delivery, pays directly via external apps, and rates drivers.

## Driver / Courier
Browses the delivery feed, accepts deliveries, communicates with senders, performs pickup and delivery with proof photos, receives payment confirmation, and rates senders.

## Administrator
Moderates users and listings, handles reports, monitors platform analytics, manages blocks and verifications, and performs operational overrides with full audit trail.

## Core Value Proposition

- **Real-time matching** without brokerage fees
- **Live GPS tracking** and shared visibility
- **Fast onboarding** with minimal friction
- **Community-based trust** via ratings and transparency
- **Direct communication** — no intermediary
- **GIG industry support** and market validation

\newpage

# Technology Stack

## Architecture Overview

![System Architecture](images/architecture.png){ width=100% }

## Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Mobile** | React Native | Single codebase for iOS + Android |
| **Maps** | Google Maps SDK + Places | Map rendering, address autocomplete |
| **Navigation** | Deep links | Google Maps / Waze / Apple Maps |
| **Authentication** | Firebase Auth | OTP via SMS and Email |
| **Database** | Cloud Firestore | Real-time database with offline support |
| **Business Logic** | Cloud Functions | Server-side validation, event triggers |
| **Push** | Firebase Cloud Messaging (FCM) | Push notifications to iOS + Android |
| **Storage** | Cloud Storage | Images, proof photos, assets |
| **Cloud** | Google Cloud Platform (GCP) | All infrastructure |
| **Source Control** | GitHub | KAL Solutions org repository |
| **Project Tracking** | KAL CRM | Task and milestone management |
| **CI/CD** | GitHub Actions + EAS Build | Automated builds and deployments |
| **Environments** | dev / staging / production | Full environment separation |
| **Monitoring** | Firebase / GCP Logging | Crash reporting, performance monitoring |
| **Payments** | Bit / PayBox / Bank (Deep Links) | External payment, no in-app processing |
| **Analytics** | GA4 or Amplitude | 11 tracked events |
| **Localization** | Hebrew + English | Full RTL support |

## Why This Stack for MVP

1. **Zero infrastructure management** — Serverless Firebase handles scaling automatically
2. **Real-time by default** — Firestore listeners give instant UI updates across all parties
3. **Pay-per-use** — Costs scale with actual usage, ideal for validation phase
4. **Built-in auth + security** — Firebase Auth + Security Rules reduce custom code
5. **45-day timeline** — Managed services enable fast development
6. **Clear scaling path** — Migration to custom backend possible in Phase 2+

## Development Standards

- Code-first tools and professional IDEs (no no-code or prompt-only generators)
- Clean architecture principles with secure coding standards
- Maintainable, documented, scalable codebase
- AI-assisted development tools for maximum velocity
- TypeScript throughout (mobile + backend)

\newpage

# Functional Scope (MVP)

## Authentication & Registration

- **OTP-based** authentication (SMS and/or Email via Firebase Auth)
- One-time registration with required fields:
  - Full name (2–60 characters)
  - Phone (Israeli/international format) — required
  - Email — optional for OTP
  - City — required
  - Role (Sender/Driver) — required
  - Profile photo — optional (default avatar)
  - ID card / driver license photo (KYC-Light) — required
  - Terms of service + privacy consent — required
- **KYC approach (MVP)**: Admin approval (not third-party biometric verification)

## Delivery Creation (Sender)

| Field | Type | Required |
|-------|------|----------|
| Pickup address | Map autocomplete (city + street + number) | Yes |
| Destination address | Map autocomplete (city + street + number) | Yes |
| Item description | Free text, up to 300 chars | Yes |
| Item size | Small / Medium / Large (dropdown) | Yes |
| Item photo | Camera or gallery | Yes |
| Pickup date | ASAP or future date+time | Yes |
| Item type | Envelope / Package / Small furniture / Other | Yes |
| Proposed price | Positive number in NIS, minimum 1 | Yes |
| Notes | Free text | No |

**Editing rules**: Sender can edit/delete listing before driver assigned. After assignment: no editing without prior cancellation.

## Driver Feed

- Scrollable feed of available delivery listings
- Filters: size, city, distance radius (1km / 3km / 5km)
- Each listing: item photo, pickup address, destination, price
- Map view with pickup/destination markers and navigation button
- **"I'm Interested"** button — triggers status change, removes from general feed
- Geohash-based proximity search with Haversine exact distance filtering

## Delivery Status State Machine

![Delivery Status State Machine](images/state-machine.png){ width=85% }

### Defined Statuses

1. **New Delivery** — Created by sender
2. **Pending Sender Approval** — Driver expressed interest
3. **Waiting for Pickup** — Sender approved driver
4. **Picked Up** — Driver collected the package (proof photo required)
5. **Delivered** — Driver arrived at destination (proof photo required)
6. **Cancelled** — Either party cancelled (pre-pickup only)
7. **Completed & Paid** — Both parties confirmed payment

### Transition Rules

| From | To | Actor | Condition |
|------|----|-------|-----------|
| New Delivery | Pending Sender Approval | Driver | "I'm Interested" |
| New Delivery | Cancelled | Sender | — |
| Pending Sender Approval | Waiting for Pickup | Sender | Approves driver |
| Pending Sender Approval | Cancelled | Sender or Driver | — |
| Pending Sender Approval | New Delivery | System | Driver cancels (revert) or 72h timeout |
| Waiting for Pickup | Picked Up | Driver | Upload proof photo |
| Waiting for Pickup | Cancelled | Sender or Driver | — |
| Picked Up | Delivered | Driver | Upload proof photo |
| Delivered | Completed & Paid | System | Both confirm payment |

**Critical rules**:

- **No cancellation** after "Picked Up" status
- All transitions **validated server-side** (Cloud Functions)
- Each transition triggers: push notification + chat timeline entry + timestamp + actor log
- Only **one driver** can be in "Pending Sender Approval" per delivery
- **72-hour timeout**: auto-reverts pending approvals to "New Delivery"

## Live GPS & Map Tracking

- Real-time driver location sharing (throttled updates, ~15 seconds)
- Live shipment tracking on Google Maps with both parties visible
- Status-based tracking states
- Navigation deep links to Google Maps, Waze, Apple Maps
- Geohash-indexed driver location for proximity queries
- "Location unavailable" fallback for GPS denied scenarios

## Real-Time Chat + Proof System

- 1:1 real-time messaging between sender and driver per delivery
- System messages auto-logged for every status change (timestamp + actor)
- Image upload from camera and gallery
- Phone call shortcut button

### Proof System

| Proof Type | Actor | When | Required? |
|-----------|-------|------|-----------|
| Proof of Pickup | Driver | Marking "Picked Up" | **Yes** — blocks status without image |
| Proof of Delivery | Driver | Marking "Delivered" | **Yes** — blocks status without image |
| Proof of Payment | Sender | After payment sent | No — optional |

Proof images stored with metadata (`deliveryId`, `uploadedBy`, `proofType`, `timestamp`), visible to both parties, non-deletable by users.

## Push Notifications (Mandatory, Server-Side)

All push notifications triggered by Cloud Functions (server-side), not client logic.

| Event | Recipient | Description | Deep Link |
|-------|-----------|-------------|-----------|
| `listing_published` | Drivers in radius | New delivery near you | `app://listing/{id}` |
| `driver_interested` | Sender | A driver is interested | `app://listing/{id}` |
| `publisher_approved` | Driver | Approved for pickup | `app://listing/{id}` |
| `status_collected` | Both | Delivery picked up | `app://listing/{id}` |
| `status_delivered` | Both | Delivery completed | `app://rate/{id}` |
| `chat_message` | Counterpart | New message | `app://chat/{threadId}` |
| `cancelled` | Counterpart | Delivery cancelled | `app://listing/{id}` |
| `rate_request` | Both | Please rate | `app://rate/{id}` |

**Geo-targeted push**: New listings trigger push to active drivers within configurable radius (default: 3km) using geohash query. Basic deduplication for same listing.

## Ratings & Reputation

- Triggered after delivery reaches "Delivered" status
- 1–5 star scale with optional text comment (max 300 characters)
- One-time rating per user per delivery (cannot edit)
- Rating prompt: in-app screen + push notification
- Display: average stars + completed count on user profile and delivery details
- Admin moderation for abusive content

## Payment Confirmation (Manual — MVP)

Payment executed **outside** the application via deep links to Bit, PayBox, or bank transfer.

Internal confirmation mechanism:

1. After "Delivered": Sender marks **"Payment Sent"**
2. Driver marks **"Payment Received"**
3. When both confirm → status transitions to **"Completed & Paid"**
4. Each confirmation logged in chat/timeline with push notification to counterpart

## Cancellation Logic

- Allowed in: New Delivery, Pending Sender Approval, Waiting for Pickup
- **Blocked** after Picked Up
- On cancellation: status → Cancelled, listing returns to driver feed, counterpart notified, timeline logged

## Interstitial Ad Infrastructure (Monetization-Ready)

- Configurable launch screen supporting image/video, skip button, click-through links
- Server-side targeting rules (role, user flag, group, premium status)
- Admin panel activation/deactivation
- **Implemented in MVP but disabled for initial production release**

## User Data Migration

- Export all existing users from Glide-based prototype
- Transform and import into Firestore
- Validation and reconciliation

\newpage

# Admin Panel (Web)

## User Controls

- View full user profile (rating, completed deliveries, reports, KYC document)
- Temporarily suspend user
- Permanently block user
- Flag user as "Verified" or "Restricted"
- Remove abusive ratings/comments
- View uploaded proof images

## Delivery Controls

- View full delivery timeline (status logs + payment logs)
- Manually change delivery status (admin override)
- Force cancel delivery
- Mark delivery as resolved
- View payment confirmation status and proof images

## Report & Moderation

- View user reports (5+ predefined report types)
- Add internal admin notes per user/delivery
- Track history of moderation actions (audit trail)

## Audit Requirements

All admin actions logged with timestamp + admin identifier, visible in internal audit log.

\newpage

# Data Model

![Firestore Data Model (ERD)](images/data-model.png){ width=100% }

## Collections Overview

### `users/{userId}`
User profiles with auth info, KYC status, role, rating aggregate, FCM token, and location (drivers).

### `deliveries/{deliveryId}`
Delivery listings with all fields, status, participants, payment confirmations, proof images, and full status history array.

### `chats/{deliveryId}` + `messages` subcollection
Per-delivery chat threads with real-time messages, system events, and proof image entries.

### `ratings/{ratingId}`
Per-delivery mutual ratings (1-5 stars + optional comment).

### `reports/{reportId}`
User reports with predefined types, admin notes, and resolution status.

### `adminActions/{actionId}`
Audit trail for all admin override actions.

\newpage

# User Flows

![User Journey — Sender and Driver](images/user-flow.png){ width=100% }

## Sender Journey

1. **Open App** → Register (OTP + profile + KYC photo)
2. **Home Screen** → "Create New Delivery" CTA
3. **Create Listing** → Fill all fields (pickup, destination, price, photo, type, size)
4. **Publish** → Listing goes live in driver feed
5. **Wait** → Receive push when driver expresses interest
6. **Approve Driver** → Review driver profile, accept
7. **Chat** → Coordinate pickup details
8. **Track** → Live map showing driver location
9. **Receive Delivery** → Confirm via chat/timeline
10. **Pay** → Deep link to Bit/PayBox/bank, mark "Payment Sent"
11. **Rate Driver** → 1-5 stars + optional comment

## Driver Journey

1. **Open App** → Register (OTP + profile + KYC photo + license)
2. **Home Screen** → "Find Nearby Deliveries" CTA
3. **Browse Feed** → Filter by radius, size, city
4. **Express Interest** → "I'm Interested" on a listing
5. **Wait** → Sender reviews and approves
6. **Chat** → Coordinate with sender
7. **Navigate** → Deep link to Google Maps/Waze
8. **Pickup** → Upload proof photo → status changes to "Picked Up"
9. **Deliver** → Upload proof photo → status changes to "Delivered"
10. **Confirm Payment** → Mark "Payment Received"
11. **Rate Sender** → 1-5 stars + optional comment

\newpage

# Push Notification Architecture

![Push Notification Event Flow](images/push-events.png){ width=100% }

## How It Works

1. **Trigger**: A Firestore document write (status change, new message, new listing, etc.)
2. **Cloud Function**: Background function fires, determines recipients and notification type
3. **FCM API**: Function sends structured message to Firebase Cloud Messaging
4. **Device Delivery**: FCM routes to iOS (via APNs) and Android (via FCM transport)
5. **App Handling**: Notification tap opens the relevant screen via deep link

## Notification Payload Structure

Each push includes: title (Hebrew/English), body with context, deep link to relevant screen, badge count update, and platform-specific options (sound, priority).

## Geo-Targeted Push

When a new listing is published, the system queries active drivers within the configurable radius (default 3km) using geohash-based proximity matching, then batch-sends FCM notifications to matching driver tokens with deduplication.

\newpage

# Security Model

## Authentication & Authorization

| Layer | Approach |
|-------|---------|
| Auth method | Firebase Auth with OTP (SMS + Email) |
| Session | Firebase ID tokens (JWT), auto-refreshed |
| Admin access | Custom claims (`admin: true`) |
| RBAC | Sender / Driver / Admin with enforced permissions |

## Security Rules

- **Users**: Read own profile (full), limited fields for others, admin reads all
- **Deliveries**: Read by participants + drivers (if active), write via Cloud Functions only
- **Chats**: Read/write by delivery participants only
- **Ratings/Reports**: Create by authenticated, admin reads all
- All status transitions validated server-side (no direct client writes to status fields)

## Data Security

- All communication over **TLS/SSL**
- No secrets in client applications
- Service account keys in GCP Secret Manager
- Cloud Storage: authenticated uploads only, scoped paths
- Proof images: immutable (no user delete)
- Input validation on all user inputs

## MVP Security Exclusions (Phase 2+)

- Formal penetration testing
- SOC2 / ISO certification
- Advanced fraud detection
- Certificate pinning, jailbreak detection
- Third-party KYC (biometric verification)

\newpage

# User Stories

| ID | Priority | Actor | Story | Acceptance |
|----|----------|-------|-------|------------|
| US-001 | P0 | Sender | Register with OTP to enter the app quickly | SMS/email received, login succeeds |
| US-002 | P0 | Sender | Create a listing to find a driver | All fields validated, published, appears in feed |
| US-003 | P0 | Driver | Get push notification for nearby listings | Push received, listing opens, can accept |
| US-004 | P0 | Both | Chat 1:1 to coordinate delivery details | Real-time send/receive, push on new message |
| US-005 | P0 | Driver | Accept listing and get navigation | Status updates, Maps/Waze opens, chat active |
| US-006 | P1 | Sender | Pay directly via Bit/PayBox | Deep link works, manual "Paid" confirmation |
| US-007 | P1 | Both | Rate counterpart after delivery | Rating prompt shown, 1-5 stars saved |
| US-008 | P0 | Admin | View and manage users/listings | Admin table with search, block/delete actions |

\newpage

# Analytics Events

All events tracked via GA4 or Amplitude SDK.

| Event | Parameters | Trigger |
|-------|-----------|---------|
| `sign_up` | method, phone_country | After registration |
| `login_success` | method | After login |
| `create_listing` | item_type, has_images | Save listing form |
| `publish_listing` | price, distance_km | Publish listing |
| `view_listing` | listing_id, source | Open listing details |
| `accept_listing` | listing_id | Driver accepts |
| `chat_opened` | thread_id, role | Chat opened |
| `message_sent` | len, has_image | Message sent |
| `delivery_done` | duration_min | Delivery completed |
| `rate_sent` | score, role | Rating submitted |
| `share_app` | channel | App shared |

\newpage

# Milestones & Payment Schedule

## Payment Structure

**Total: 90,000 NIS + VAT**

| Payment | Percentage | Amount (NIS + VAT) | Trigger |
|---------|-----------|---------------------|---------|
| Advance | 50% | 45,000 | Contract signing & kickoff |
| Milestone 1 | 15% | 13,500 | Backend + Auth + Data Models + Initial Mobile |
| Milestone 2 | 10% | 9,000 | Delivery Lifecycle + GPS + Chat + Push + Admin |
| Milestone 3 | 5% | 4,500 | Feature Completion + Stabilization + P0/P1 Bugs |
| Final | 20% | 18,000 | Production Build + Store Submission + Handover |

Invoices payable within 10 days. Milestone = functional completion of agreed scope.

## Sub-Milestones (23 Total)

### Milestone 0 — Project Setup (Pre-Development)

| Code | Sub-Milestone | Deliverables |
|------|--------------|-------------|
| M0.1 | Project Infrastructure | GitHub repo, CI/CD, environments, KAL CRM setup |
| M0.2 | Firebase/GCP Setup | Firebase projects (dev + prod), all services enabled |
| M0.3 | Design System Scaffold | React Native project, navigation, components, Maps SDK |

### Milestone 1 — Backend + Auth + Mobile (15%)

| Code | Sub-Milestone | Deliverables |
|------|--------------|-------------|
| M1.1 | Firebase Auth (OTP) | SMS + Email OTP, session management |
| M1.2 | User Registration & Profile | Registration form, photo upload, KYC-Light |
| M1.3 | Firestore Data Models | All collections, schemas, indexes |
| M1.4 | Cloud Functions / RBAC | Security rules, role validation, function scaffold |
| M1.5 | Mobile App Scaffold | Navigation, state management, service layer |
| M1.6 | Home Screen + Onboarding | Role-based home, onboarding slides |

### Milestone 2 — Delivery + GPS + Chat + Push + Admin (10%)

| Code | Sub-Milestone | Deliverables |
|------|--------------|-------------|
| M2.1 | Delivery Creation & Management | Create listing form, edit/delete, "My Deliveries" |
| M2.2 | Driver Feed + Radius Search | Feed UI, filters, geohash proximity search |
| M2.3 | Status State Machine | Server-validated transitions, timeout, concurrency |
| M2.4 | Live GPS Tracking | Location broadcasting, live map, navigation links |
| M2.5 | Chat + Proof System | Real-time chat, image upload, mandatory proof photos |
| M2.6 | Push Notifications (FCM) | All 8 events, geo-targeted, deep links, badge |
| M2.7 | Payment Confirmation | Payment UI, deep links, Completed & Paid logic |
| M2.8 | Admin Panel (Web) | User/delivery management, moderation, audit trail |

### Milestone 3 — Completion + Stabilization (5%)

| Code | Sub-Milestone | Deliverables |
|------|--------------|-------------|
| M3.1 | Ratings & Reputation | Rating prompt, 1-5 stars, aggregate display |
| M3.2 | Cancellation Logic | Pre-pickup cancellation, revert, notifications |
| M3.3 | Interstitial Infrastructure | Ad framework (disabled for launch) |
| M3.4 | Analytics Events | 11 GA4/Amplitude events |
| M3.5 | Edge Case Handling | Loading, empty, offline, GPS states |
| M3.6 | P0/P1 Bug Fixing | Critical bug fixes, performance optimization |
| M3.7 | User Data Migration | Glide user export → Firestore import |

### Milestone 4 — Store Submission + Handover (20%)

| Code | Sub-Milestone | Deliverables |
|------|--------------|-------------|
| M4.1 | Production Build | Production config, security review, monitoring |
| M4.2 | App Store (iOS) | Build, metadata, screenshots, submission |
| M4.3 | Play Store (Android) | Build, listing, content rating, submission |
| M4.4 | Store Compliance | Privacy policy, ToS, permissions, native features |
| M4.5 | Handover + Documentation | Code access, Firebase access, documentation, runbook |

\newpage

# Sprint Plan

**Timeline**: 45 calendar days | **8 sprints** | **Resource**: Tamir Konortov (CTO) + part-time fullstack developer

| Sprint | Days | Focus | Sub-Milestones |
|--------|------|-------|----------------|
| **Sprint 0** | 1-3 | Setup & scaffold | M0.1, M0.2, M0.3 |
| **Sprint 1** | 4-10 | Auth + users + data models | M1.1, M1.2, M1.3, M1.4 |
| **Sprint 2** | 11-17 | Mobile scaffold + screens | M1.5, M1.6, M2.1 |
| **Sprint 3** | 18-24 | Delivery core + feed | M2.2, M2.3 |
| **Sprint 4** | 25-31 | GPS + chat + push | M2.4, M2.5, M2.6 |
| **Sprint 5** | 32-37 | Payment + admin + ratings | M2.7, M2.8, M3.1 |
| **Sprint 6** | 38-42 | Polish + edge cases | M3.2–M3.7 |
| **Sprint 7** | 43-45 | Store submission + handover | M4.1–M4.5 |

**Assumptions**: Frozen MVP scope, fast feedback cycles, same-day or next-business-day client approvals. Delays from missing feedback/approvals/assets/payments extend timeline day-for-day.

\newpage

# Task Breakdown

73 tasks across 23 sub-milestones. Full CSV available for KAL CRM import.

## Task Distribution by Milestone

| Milestone | Tasks | Estimated Hours |
|-----------|-------|----------------|
| M0 — Setup | 12 | ~28h |
| M1 — Auth + Data + Mobile | 16 | ~68h |
| M2 — Delivery + GPS + Chat + Push + Admin | 25 | ~118h |
| M3 — Polish + Stabilization | 12 | ~49h |
| M4 — Store + Handover | 8 | ~30h |
| **Total** | **73** | **~293h** |

## Sample Tasks (High-Priority)

**M1.1 — Implement OTP Login (SMS)**
As CTO, I need to implement Firebase OTP authentication supporting both SMS and email verification. This is the foundation for all user flows — nothing works without auth. Acceptance: phone input with country code, 6-digit OTP screen, error handling for invalid/expired codes, auth state persistence.

**M2.3 — Delivery Status State Machine (Cloud Function)**
The most critical backend component. Server-validated status transitions with concurrency locking, 72h timeout logic, and automatic trigger of push + chat + audit log on every transition. Acceptance: all 7 statuses with correct transitions, cancellation blocked post-pickup, timeout auto-revert works.

**M2.6 — Push Notification Triggers (Cloud Functions)**
Server-side push triggers for all 8 notification events. Geo-targeted push for new listings using geohash radius query. Acceptance: all events trigger correctly, geo-targeted delivery works, deep links open correct screens.

**M2.8 — Admin Panel (Web)**
Full admin panel with user management, delivery management, moderation tools, proof viewer, and audit trail. All admin overrides logged with timestamp and identifier.

\newpage

# Critical Path

## Primary Critical Chain

```
Firebase Setup → Auth/OTP → User Profiles → Data Models →
Cloud Functions → Status State Machine → GPS Tracking →
Push Notifications → Payment Flow → Ratings →
Stabilization → Store Submission → Handover
```

## Key Blocking Dependencies

1. **Firebase project setup** blocks ALL development
2. **Auth/OTP** blocks user profiles, which blocks everything else
3. **Firestore data models** block delivery CRUD and chat
4. **Status state machine** (M2.3) is the **single most critical component** — GPS, chat timeline, push events, and payment flow all depend on it
5. **Cloud Functions** block status transitions and push notifications
6. **Store submission** blocked by ALL feature completion + privacy policy

## Parallelization Streams

| Stream | Path | Risk |
|--------|------|------|
| **A: Backend** (Critical) | Firebase → Auth → Models → Functions → State Machine → Push | Highest risk |
| **B: Mobile UI** (Parallel) | Design System → Scaffold → Screens → Feed UI → Map UI | Can proceed with mock data |
| **C: Admin** (Semi-independent) | Starts after M1.4 — runs parallel to M2.4-M2.7 | Low risk |
| **D: Independent** | Analytics, Interstitial, Migration — anytime after M1.5 | No blocking |

\newpage

# Acceptance Criteria (Complete Checklist)

## Core Flows
- [ ] OTP registration works on iOS 13+ and Android 7+
- [ ] Full end-to-end flow: Create → Publish → Accept → Chat → Pickup → Deliver → Rate
- [ ] Hebrew/English localization with full RTL support

## Delivery Lifecycle
- [ ] Status transitions strictly follow defined state machine
- [ ] All transitions validated server-side
- [ ] Each transition triggers push notification + timeline log
- [ ] Cancellation blocked after "Picked Up"
- [ ] Pending auto-reverts to "New" after 72h timeout
- [ ] Only one driver approved per delivery

## Push Notifications
- [ ] All 8 events trigger correctly
- [ ] Geo-targeted push for new listings within configured radius
- [ ] Push includes deep links to relevant screens

## Chat & Proof
- [ ] Chat supports image upload (camera + gallery)
- [ ] Proof of Pickup required for "Picked Up" status
- [ ] Proof of Delivery required for "Delivered" status
- [ ] Proof images stored with metadata, visible to both parties

## Payment
- [ ] Sender can mark "Payment Sent" after "Delivered"
- [ ] Driver can mark "Payment Received"
- [ ] Both confirmations → "Completed & Paid"
- [ ] Payment status visible in delivery details

## Ratings
- [ ] Post-delivery rating prompt (in-app + push)
- [ ] 1-5 stars with optional comment, one-time per delivery
- [ ] Ratings reflected in user profiles

## Admin
- [ ] Admin can suspend/block users, override status, view proof images
- [ ] All admin actions logged with timestamp + identifier

## Edge Cases
- [ ] Loading, empty, and error states handled without crashes
- [ ] Offline mode: graceful failures with retry, no duplicates
- [ ] GPS denied: app prompts, continues in limited mode
- [ ] Service failures: user-friendly errors, no crashes
- [ ] Idempotent handling for rapid taps

## Store Submission
- [ ] Production builds submitted to App Store + Play Store
- [ ] Privacy policy + Terms of Service pages
- [ ] Test account for store reviewers

\newpage

# QA Scope

## Included
- Continuous functional testing during development
- Validation of core user journeys, delivery lifecycle, GPS, chat, notifications
- P0–P1 bug fixing
- Store submission readiness testing
- Targeted unit tests for critical logic
- Edge case validation (offline, GPS denied, loading/empty states)

## Excluded
- Formal QA test plans
- Automated testing frameworks
- Load or stress testing
- Pixel-level UI refinements
- Long-term maintenance SLAs

\newpage

# Bug Severity & SLA

| Level | Name | Description | Response Time | Resolution Target |
|-------|------|-------------|--------------|-------------------|
| P0 | Critical | Core functionality disabled | 4 business hours | Immediate hotfix |
| P1 | High | Key functionality impaired | 1 business day | 3 business days |
| P2 | Medium | Non-blocking issue | 2 business days | Next sprint |
| P3 | Low | Cosmetic / optimization | Per version priority | Roadmap only |

**Business hours**: Sun–Fri, 09:00–18:00 Israel time. Best effort, not financial SLA.

\newpage

# Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Firebase vendor lock-in | Medium | Medium | Clean service abstraction, migration path documented |
| Firestore cost at scale | Low (MVP) | High (at scale) | Read/write optimization, Phase 2 migration plan |
| OTP SMS cost | Medium | Low | Email fallback, rate limiting, budget alerts |
| App Store rejection | Low-Medium | High | Early TestFlight, compliance checklist, native features |
| Scope creep | High | High | Change Request process, frozen MVP scope |
| Client feedback delays | Medium | Medium | Day-for-day clause, weekly syncs |
| Data migration complexity | Medium | Medium | Early data audit, incremental migration |

\newpage

# Delivery Model & Team

## Approach
**Accelerated Founder-Led MVP** — Senior leadership hands-on, AI-assisted development tools. Prioritizes fast market entry and validated functionality over enterprise hardening.

## Team

| Role | Person | Responsibilities |
|------|--------|-----------------|
| **Founder & CTO** | Tamir Konortov | End-to-end: architecture, backend, mobile, cloud, releases, store submissions |
| **Fullstack Developer** | Part-time | Feature implementation, backend/mobile support, bug fixing |
| **QA** | Joint | Delivery team + MOOVIZ founder/client |

## Communication & Tracking

- **Weekly updates** via WhatsApp/email
- **Ad-hoc communication** via WhatsApp
- **Project tracking** via KAL CRM
- **Source code** in GitHub (KAL Solutions org; pushed to client remote after paid milestones)

## IP & Code Delivery

- All IP remains with KAL Solutions until full payment of completed milestones
- Upon payment: proportional IP rights transfer to client
- Code pushed to client's GitHub remote after each paid milestone
- Full handover (GitHub + Firebase + GCP access) upon final payment

\newpage

# Phase 2+ Considerations (Not in MVP)

For reference, the following are intentionally excluded from MVP:

- **Payments**: In-app payment processing, escrow, commission model
- **KYC**: Third-party biometric verification (Sumsub)
- **Geo**: Route-based matching, ETA estimation, heatmaps
- **Scale**: Dedicated location service, read replicas, CDN optimization
- **Security**: Penetration testing, SOC2, advanced fraud detection
- **Features**: Recurring deliveries, income screen, scheduled routes
- **Operations**: 24/7 support, uptime SLA, financial penalties
- **Analytics**: Advanced reporting, A/B testing, cohort analysis

\newpage

# Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | March 2, 2026 | Tamir Konortov, CTO | Initial project document |

---

*© 2026 KAL Solutions Group. All rights reserved.*
*This document is confidential and intended for authorized recipients only.*
