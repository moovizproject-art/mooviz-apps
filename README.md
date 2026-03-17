<p align="center">
  <img src="https://mooviz.co.il/logo.png" alt="MOOVIZ Logo" width="200" />
</p>

<h1 align="center">MOOVIZ</h1>
<h3 align="center">Real-Time Community Delivery Platform</h3>

<p align="center">
  <strong>Built by Tamir Leo Konortov</strong><br/>
  <a href="https://kal.solutions">KAL Solutions Group</a> &mdash; <a href="mailto:info@kal.solutions">info@kal.solutions</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-0.75.5-61DAFB?logo=react" alt="React Native" />
  <img src="https://img.shields.io/badge/Firebase-GCP-FFCA28?logo=firebase" alt="Firebase" />
  <img src="https://img.shields.io/badge/TypeScript-5.x_strict-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Platform-iOS_%7C_Android-000000?logo=apple" alt="Platform" />
  <img src="https://img.shields.io/badge/License-Proprietary-red" alt="License" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/ISO_27001-Compliant-00A86B" alt="ISO 27001" />
  <img src="https://img.shields.io/badge/SOC_2_Type_II-Compliant-00A86B" alt="SOC 2" />
  <img src="https://img.shields.io/badge/OWASP_Top_10-Protected-00A86B" alt="OWASP" />
  <img src="https://img.shields.io/badge/GDPR-Ready-00A86B" alt="GDPR" />
</p>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Directory Structure](#directory-structure)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Getting Started](#getting-started)
- [Running the Apps](#running-the-apps)
- [Firebase Deployment](#firebase-deployment)
- [Security & Compliance](#security--compliance)
- [API Key & Secrets Management](#api-key--secrets-management)
- [Data Model](#data-model)
- [Delivery Lifecycle](#delivery-lifecycle)
- [Push Notifications](#push-notifications)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**MOOVIZ** is a real-time community delivery platform connecting senders who need packages delivered with nearby drivers. The platform provides a complete delivery lifecycle with real-time GPS tracking, in-app chat, proof-of-delivery, multi-driver interest system, payment confirmation, and a comprehensive admin dashboard.

**Key Capabilities:**
- Real-time delivery matching with geohash-based proximity search (1-5km radius)
- Multi-driver interest system with 15-minute confirmation windows
- Proof-of-delivery photo capture for pickup and delivery transitions
- In-app real-time chat between sender and driver
- Two-tier driver location tracking (idle: 5min, active: 1min)
- Push notifications for 8 lifecycle events via FCM
- Admin dashboard with analytics, user management, and delivery oversight
- Hebrew-first RTL interface with full i18n support

**Client:** G.M. Mooviz Software (2026) Ltd
**Supplier:** KAL Solutions Group
**CTO & Lead Architect:** Tamir Leo Konortov

---

## Architecture

```
                    ┌─────────────────────────┐
                    │     Mobile App (RN)      │
                    │   iOS + Android (Expo)   │
                    └────────┬────────────────┘
                             │
                    ┌────────▼────────────────┐
                    │   Firebase Auth (OTP)    │
                    └────────┬────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
     │  Cloud         │ │ Firestore│ │   Cloud     │
     │  Functions     │ │ (RT DB)  │ │   Storage   │
     │  (Gen 2)       │ │          │ │   (Photos)  │
     └────────┬───────┘ └──────────┘ └─────────────┘
              │
     ┌────────▼──────────┐
     │  FCM Push         │
     │  Notifications    │
     └───────────────────┘

     ┌───────────────────┐
     │  Admin Panel      │
     │  (React + Vite)   │
     └───────────────────┘
```

| Layer        | Technology                           |
|--------------|--------------------------------------|
| Mobile       | React Native 0.75.5 (Expo SDK 50+)  |
| Navigation   | React Navigation 6.x                |
| State        | React Context + Firestore listeners  |
| Maps         | react-native-maps + Google Maps SDK  |
| Backend      | Firebase Cloud Functions (Node 20, Gen 2) |
| Database     | Cloud Firestore (real-time)          |
| Auth         | Firebase Auth (OTP SMS + Email)      |
| Storage      | Firebase Cloud Storage               |
| Push         | Firebase Cloud Messaging (FCM v1)    |
| Admin        | React 18 + Vite + Tailwind CSS       |
| Language     | TypeScript 5.x (strict mode)         |
| Monorepo     | pnpm workspaces + Turborepo          |

---

## Directory Structure

```
Mooviz/
├── apps/
│   ├── mobile/                 # React Native — Sender + Driver flows
│   │   ├── src/
│   │   │   ├── screens/        # Screen components per role
│   │   │   ├── components/     # Shared UI components
│   │   │   ├── hooks/          # Custom hooks (auth, location, realtime)
│   │   │   ├── services/       # Firebase service wrappers
│   │   │   ├── navigation/     # React Navigation config
│   │   │   ├── utils/          # Helpers (geohash, validation, formatting)
│   │   │   ├── types/          # TypeScript types & interfaces
│   │   │   └── constants/      # App constants, config
│   │   ├── android/            # Native Android project
│   │   ├── ios/                # Native iOS project (Xcode)
│   │   └── package.json
│   └── admin/                  # React Web — Admin dashboard
│       ├── src/
│       │   ├── pages/          # Dashboard, Users, Deliveries, Email, Analytics
│       │   ├── components/     # Reusable UI (charts, tables, CSV export)
│       │   ├── hooks/          # Firebase hooks, analytics hooks
│       │   └── constants/      # Regions, status maps
│       └── package.json
├── functions/                  # Firebase Cloud Functions (TypeScript)
│   ├── src/
│   │   ├── triggers/           # Firestore triggers (onWrite, onCreate)
│   │   ├── callable/           # HTTPS callable functions
│   │   ├── scheduled/          # Cron jobs (timeout, chat auto-close)
│   │   ├── validators/         # Status transition validation
│   │   └── services/           # FCM, geohash, email helpers
│   └── package.json
├── shared/                     # Shared types, constants, validation schemas
│   └── types/
├── firestore.rules             # Firestore security rules (RBAC)
├── storage.rules               # Storage security rules (5MB, image-only)
├── firebase.json               # Firebase project configuration
├── pnpm-workspace.yaml         # pnpm monorepo config
├── turbo.json                  # Turborepo task pipeline
└── package.json                # Root workspace
```

---

## Prerequisites

| Tool           | Version    | Installation                         |
|----------------|------------|--------------------------------------|
| **Node.js**    | >= 18.0.0  | https://nodejs.org                   |
| **pnpm**       | 9.x        | `npm install -g pnpm@9`             |
| **Firebase CLI**| >= 15.9   | `npm install -g firebase-tools`      |
| **Java JDK**   | 17         | Required for Android builds          |
| **Xcode**      | 15+        | Required for iOS builds (macOS only) |
| **Android Studio** | Latest | SDK 34, NDK, CMake                   |
| **CocoaPods**  | >= 1.14    | `gem install cocoapods`              |
| **Watchman**   | Latest     | `brew install watchman` (macOS)      |

---

## Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/<org>/mooviz-apps.git
cd mooviz-apps
```

### 2. Install Dependencies

```bash
pnpm install
```

This installs all workspace packages: `apps/mobile`, `apps/admin`, `functions`, and `shared`.

### 3. Firebase Configuration (CRITICAL)

> **SECURITY NOTICE:** Firebase configuration files contain API keys and project identifiers.
> These files are **gitignored** and must be obtained securely from the project administrator.

**Required files (NOT included in the repository):**

| File | Location | Purpose |
|------|----------|---------|
| `google-services.json` | `apps/mobile/android/app/` | Android Firebase config |
| `GoogleService-Info.plist` | `apps/mobile/ios/MoovizMobile/` | iOS Firebase config |
| `GoogleService-Info.plist` | `apps/mobile/ios/` | iOS root Firebase config |
| `.env` | Project root | Environment variables |
| `.env.crm-api` | Project root | CRM API credentials |
| `serviceAccountKey.json` | Project root | Firebase Admin SDK key |

**To obtain these files:**
1. Contact the project administrator (info@kal.solutions)
2. Files will be shared via encrypted channel only
3. Place them in the exact paths listed above
4. **NEVER commit these files to version control**

### 4. Firebase Project Setup

```bash
# Login to Firebase
firebase login

# Select the project
firebase use mooviz-app-9b766   # Development
# firebase use mooviz-prod      # Production (requires separate project)

# Verify connection
firebase projects:list
```

### 5. iOS Dependencies (macOS only)

```bash
cd apps/mobile/ios
pod install --repo-update
cd ../../..
```

> **Note:** Firebase iOS SDK 11.11 is pinned with selective modular headers. Do not update Pod versions without testing.

### 6. Android Setup

Ensure your `local.properties` file exists in `apps/mobile/android/`:

```properties
sdk.dir=/Users/<your-username>/Library/Android/sdk
```

---

## Getting Started

### Build Shared Package

The shared package must be built before other packages can use it:

```bash
cd shared
pnpm build
pnpm pack            # Creates mooviz-shared-1.0.0.tgz
cd ..
```

### Build Cloud Functions

```bash
cd functions
pnpm install         # Installs the shared .tgz bundle
pnpm build           # Compiles TypeScript
cd ..
```

### Start Firebase Emulators (Optional)

For local development with emulated Firebase services:

```bash
firebase emulators:start
```

Emulator ports:
| Service    | Port |
|------------|------|
| Auth       | 9099 |
| Functions  | 5001 |
| Firestore  | 8080 |
| Storage    | 9199 |
| Emulator UI| Auto |

---

## Running the Apps

### Mobile App (React Native)

```bash
# Start Metro bundler
cd apps/mobile
pnpm start

# Or from root:
pnpm start:mobile

# Run on Android
pnpm android

# Run on iOS (macOS only)
pnpm ios
```

> **RTL Note:** The app is Hebrew-first. `I18nManager.forceRTL(true)` is set at startup. Test on a physical device with Hebrew locale for accurate RTL rendering.

### Admin Dashboard

```bash
cd apps/admin
pnpm dev
```

Opens at `http://localhost:5173`

### Using Turborepo

```bash
# Run all dev servers
pnpm build           # Build all packages

# Filtered commands
pnpm dev:mobile      # Mobile only
pnpm dev:admin       # Admin only
pnpm dev:functions   # Functions watch mode
```

---

## Firebase Deployment

### Deploy Cloud Functions

```bash
# From root — runs predeploy (build shared + functions)
pnpm deploy:functions

# Or manually
cd shared && pnpm build && pnpm pack
cp mooviz-shared-1.0.0.tgz ../functions/
cd ../functions && pnpm install && pnpm build
firebase deploy --only functions
```

> **CRITICAL:** When updating shared validators, you must rebuild the `.tgz` bundle. The `predeploy` script in `firebase.json` copies the directory, but `node_modules/@mooviz/shared` is resolved from the `.tgz` — not the copied directory.

### Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### Deploy Storage Rules

```bash
firebase deploy --only storage
```

### Deploy Admin (Hosting)

```bash
cd apps/admin && pnpm build
cd ../..
firebase deploy --only hosting
```

---

## Security & Compliance

### ISO 27001 Compliance

This project adheres to ISO 27001 information security management principles:

| Control Area | Implementation |
|-------------|----------------|
| **Access Control (A.9)** | Firebase Auth with OTP/Email verification; RBAC enforced at Firestore rules and Cloud Functions level |
| **Cryptography (A.10)** | Profile photos and KYC documents encrypted at rest via Cloud Functions; HTTPS enforced for all communications |
| **Operations Security (A.12)** | All status transitions validated server-side; no client-side trust; audit trail via `statusHistory` and `adminActions` collections |
| **Communications Security (A.13)** | TLS/HTTPS enforced; Firebase security rules prevent unauthorized data access; Storage rules enforce content-type and size limits |
| **Supplier Relationships (A.15)** | All third-party dependencies audited; Firebase services run on Google Cloud infrastructure with Google's compliance certifications |
| **Information Security Incident Management (A.16)** | Crashlytics for mobile error tracking; Cloud Functions error logging; admin dashboard for incident review |
| **Asset Management (A.8)** | All secrets managed via environment variables; no hardcoded credentials; `.gitignore` enforced for sensitive files |

### SOC 2 Type II Compliance

The platform meets SOC 2 Trust Service Criteria:

| Criteria | Implementation |
|----------|----------------|
| **Security** | Firebase Auth mandatory for all API calls; Firestore Security Rules enforce RBAC (sender sees own deliveries, driver sees available + assigned); Storage rules validate file type (`image/*`) and size (< 5MB); Cloud Functions validate ALL state transitions server-side |
| **Availability** | Built on Google Cloud Platform (99.95% SLA); Firestore automatic replication; offline-first architecture with Firestore persistence; error boundaries with retry on every screen |
| **Processing Integrity** | Delivery state machine enforced server-side with immutable `statusHistory`; dual payment confirmation (sender + driver); mandatory proof photos for pickup/delivery; 72-hour timeout with automatic revert |
| **Confidentiality** | KYC documents encrypted at rest (temp upload + Cloud Function encryption); profile photos encrypted at rest; no PII in logs; `serviceAccountKey` files gitignored and never committed |
| **Privacy** | GDPR-ready data model; user data scoped by role; no cross-user data leakage via Security Rules; phone numbers in E.164 format only; admin actions audited in `adminActions` collection |

### OWASP Top 10 Protections

| Vulnerability | Mitigation |
|--------------|------------|
| **A01: Broken Access Control** | Firestore Security Rules enforce per-document RBAC; Cloud Functions validate caller identity on every transition |
| **A02: Cryptographic Failures** | KYC/profile encryption at rest; HTTPS enforced; Firebase tokens for auth (no custom JWT) |
| **A03: Injection** | Firestore is NoSQL (no SQL injection); all user input validated via shared schemas; parameterized queries only |
| **A04: Insecure Design** | Server-side state machine prevents invalid transitions; proof photos mandatory; cancellation restricted pre-pickup |
| **A05: Security Misconfiguration** | Security rules deployed via CI; headers set (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`); Firebase Admin SDK for privileged operations only |
| **A06: Vulnerable Components** | pnpm lockfile for deterministic installs; pinned critical dependencies (React Native, Reanimated, Maps) |
| **A07: Authentication Failures** | Firebase Auth with OTP rate limiting; email verification; KYC approval workflow |
| **A08: Data Integrity Failures** | All deliveries created with `status: 'new'` enforced by rules; `statusHistory` is append-only; server timestamps prevent clock manipulation |
| **A09: Logging & Monitoring** | Firebase Crashlytics; Cloud Functions logging; admin dashboard with delivery and user activity monitoring |
| **A10: SSRF** | No user-controlled URLs processed server-side; all external calls are to Firebase/Google services only |

---

## API Key & Secrets Management

### Gitignored Secrets

The following files contain sensitive data and are **excluded from version control**:

```
# .gitignore entries for secrets
google-services.json          # Firebase Android config
GoogleService-Info.plist      # Firebase iOS config
serviceAccountKey*.json       # Firebase Admin SDK
.env                          # Environment variables
.env.local / .env.*.local     # Local overrides
.env.dev / .env.staging / .env.prod
.env.crm-api                  # CRM credentials
```

### API Key Rotation Policy

| Key Type | Rotation Frequency | Responsibility |
|----------|--------------------|----------------|
| Firebase API Keys | Per environment | Project Administrator |
| Service Account Keys | Quarterly | DevOps Lead |
| FCM Server Key | On compromise | Project Administrator |
| SMTP Credentials | Quarterly | Project Administrator |
| Google Maps API Key | On compromise | Project Administrator |

### Obtaining Credentials

All credentials are distributed via encrypted channels only. Contact:

**Tamir Leo Konortov**
KAL Solutions Group
Email: info@kal.solutions
Web: https://kal.solutions

---

## Data Model

### Core Collections

| Collection | Purpose | Access |
|-----------|---------|--------|
| `users/{userId}` | User profiles (sender/driver) | Owner + authenticated users (read); owner (restricted update) |
| `deliveries/{deliveryId}` | Delivery lifecycle documents | Sender (own); Driver (available + assigned); Admin (all) |
| `chats/{chatId}/messages/{id}` | Real-time chat per delivery | Participants only |
| `ratings/{ratingId}` | Post-delivery ratings | Creator (create); Public (read) |
| `reports/{reportId}` | User reports | Creator (create); Admin (manage) |
| `adminActions/{actionId}` | Admin audit log | Admin only |
| `config/{configId}` | App configuration | Authenticated (read); Admin (write) |

### User Roles

| Role | Capabilities |
|------|-------------|
| `sender` | Create deliveries, approve drivers, confirm payment, chat, rate |
| `driver` | Browse nearby deliveries, express interest, pickup/deliver with proof, chat, rate |
| `admin` | Full CRUD on all collections, user management, KYC approval, analytics |

---

## Delivery Lifecycle

```
  ┌─────┐     driver        ┌─────────┐    sender      ┌─────────┐
  │ NEW │ ──interested──►   │ PENDING │ ──approves──►   │ WAITING │
  └──┬──┘                   └────┬────┘                 └────┬────┘
     │                           │                           │
     │                    driver cancels               driver picks up
     │                    or 72h timeout                + proof photo
     │                           │                           │
     │                     ┌─────▼─────┐              ┌──────▼──────┐
     │                     │  REVERTS  │              │  PICKED_UP  │
     │                     │  TO NEW   │              └──────┬──────┘
     │                     └───────────┘                     │
     │                                                driver delivers
     │                                                 + proof photo
     │                                                       │
     │    pre-pickup only     ┌───────────┐           ┌──────▼──────┐
     └──── cancellation ───►  │ CANCELLED │           │  DELIVERED  │
                              └───────────┘           └──────┬──────┘
                                                             │
                                                     both confirm
                                                       payment
                                                             │
                                                    ┌────────▼────────┐
                                                    │ COMPLETED_PAID  │
                                                    └─────────────────┘
```

**Rules:**
- Cancellation is only allowed pre-pickup (`new`, `pending`, `waiting`)
- Post-pickup statuses are irreversible (`picked_up`, `delivered`, `completed_paid`)
- `pending` reverts to `new` after 72 hours or if the driver cancels
- Proof photos are **mandatory** for `picked_up` and `delivered` transitions
- Payment requires dual confirmation (both sender and driver)

---

## Push Notifications

8 mandatory FCM push notification events:

| Event | Recipient | Trigger |
|-------|-----------|---------|
| `new_listing_nearby` | Drivers within radius | New delivery created (geohash match) |
| `driver_interested` | Sender | Driver expresses interest |
| `sender_approved` | Driver | Sender approves driver |
| `delivery_picked_up` | Sender | Driver confirms pickup |
| `delivery_delivered` | Sender | Driver confirms delivery |
| `payment_confirmed` | Both parties | Both confirm payment |
| `delivery_cancelled` | Other party | Cancellation by either party |
| `new_chat_message` | Recipient | New message in delivery chat |

All notifications triggered by Cloud Functions on Firestore document writes.

---

## Testing

```bash
# Run all tests
pnpm test

# Mobile tests
cd apps/mobile && pnpm test

# Functions tests
cd functions && pnpm test

# Type checking
cd apps/mobile && pnpm typecheck

# Linting
pnpm lint
```

---

## CI/CD

| Target | Tool | Command |
|--------|------|---------|
| Mobile (Android) | EAS Build | `eas build --platform android` |
| Mobile (iOS) | EAS Build | `eas build --platform ios` |
| Cloud Functions | Firebase CLI | `firebase deploy --only functions` |
| Admin Dashboard | Firebase Hosting | `firebase deploy --only hosting` |
| Firestore Rules | Firebase CLI | `firebase deploy --only firestore:rules` |
| Storage Rules | Firebase CLI | `firebase deploy --only storage` |

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `development` | Integration branch |
| `feature/*` | Feature branches |
| `release/*` | Release candidates |
| `staging` | Pre-production testing |

### Commit Convention

```
<type>(<scope>): <description>

Types: feat, fix, refactor, style, docs, test, chore
Scope: mobile, admin, functions, shared, infra
```

---

## Contributing

This is a proprietary project. All contributions must be authorized by KAL Solutions Group.

1. Create a feature branch from `development`
2. Follow the commit convention above
3. Ensure all tests pass and TypeScript compiles without errors
4. Submit a pull request for code review
5. Squash merge after approval

---

## License

**Proprietary** — All rights reserved.

Copyright (c) 2026 G.M. Mooviz Software (2026) Ltd
Developed by **Tamir Leo Konortov** at **KAL Solutions Group**

This software is proprietary and confidential. Unauthorized copying, distribution, or modification of this project, via any medium, is strictly prohibited. The source code is provided to the client under the terms of the development agreement between KAL Solutions Group and G.M. Mooviz Software (2026) Ltd.

---

<p align="center">
  <strong>KAL Solutions Group</strong><br/>
  <a href="https://kal.solutions">kal.solutions</a> &bull; <a href="mailto:info@kal.solutions">info@kal.solutions</a><br/><br/>
  <em>Engineering excellence, delivered.</em>
</p>
