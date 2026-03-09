# CLAUDE.md — MOOVIZ

## Role
Senior Mobile/Cloud Architect: React Native, Firebase/GCP, TypeScript, real-time systems.

## Project

| Key             | Value                                    |
|-----------------|------------------------------------------|
| **Application** | MOOVIZ — Real-Time Community Delivery Platform (MVP) |
| **Mobile**      | React Native (Expo SDK 50+), iOS + Android |
| **Backend**     | Firebase (Auth, Firestore, Functions, Storage, FCM) |
| **Admin**       | React Web (Vite or Next.js)              |
| **Cloud**       | Google Cloud Platform (serverless)       |
| **Maps**        | Google Maps SDK + Geohash proximity      |
| **Payments**    | External deep links (Bit/PayBox/bank transfer) — no in-app processing |
| **Budget**      | 90,000 NIS + VAT (fixed price)           |
| **Timeline**    | 45 calendar days, 8 sprints              |
| **Company**     | KAL Solutions Group (supplier)           |
| **Client**      | G.M. Mooviz Software (2026) Ltd          |
| **CTO**         | Tamir Konortov — end-to-end technical ownership |

## Directory Layout
```
Mooviz/
├── apps/
│   ├── mobile/          # React Native (Expo) — Sender + Driver flows
│   │   ├── src/
│   │   │   ├── screens/     # Screen components per role
│   │   │   ├── components/  # Shared UI components
│   │   │   ├── hooks/       # Custom hooks (auth, location, realtime)
│   │   │   ├── services/    # Firebase service wrappers
│   │   │   ├── navigation/  # React Navigation config
│   │   │   ├── utils/       # Helpers (geohash, validation, formatting)
│   │   │   ├── types/       # TypeScript types & interfaces
│   │   │   └── constants/   # App constants, config
│   │   ├── app.json
│   │   └── tsconfig.json
│   └── admin/           # React Web — Admin panel
│       └── src/
├── functions/           # Firebase Cloud Functions (TypeScript)
│   ├── src/
│   │   ├── triggers/    # Firestore triggers (onWrite, onCreate)
│   │   ├── callable/    # HTTPS callable functions
│   │   ├── scheduled/   # Cron jobs (timeout cleanup, etc.)
│   │   ├── validators/  # Status transition validation
│   │   └── services/    # FCM, geohash, payment helpers
│   └── tsconfig.json
├── shared/              # Shared types, constants, validation schemas
│   └── types/
├── firestore.rules      # Security rules
├── storage.rules        # Storage security rules
├── firebase.json        # Firebase config
└── docs/                # Architecture docs, ADRs
```

## Key Rules
1. **Language**: TypeScript strict mode everywhere (mobile, functions, admin, shared)
2. **RTL**: App is Hebrew-first with RTL layout. Use `I18nManager.forceRTL(true)`. All layouts must support RTL
3. **Server-side validation**: ALL status transitions validated in Cloud Functions — never trust client
4. **Security Rules**: Firestore rules enforce RBAC (sender sees own deliveries, driver sees available + assigned)
5. **Real-time**: Use Firestore `onSnapshot` listeners for live data — no polling
6. **Geohash**: Driver feed uses geohash-based proximity queries (1-5km radius)
7. **Proof system**: Mandatory photo upload for `picked_up` and `delivered` transitions
8. **No raw IDs**: Always use typed references, never expose internal document paths to clients
9. **Error boundaries**: Every screen wrapped in error boundary with retry capability
10. **Offline-first**: Handle offline state gracefully — Firestore persistence enabled

## Data Model (Firestore Collections)

### users/{userId}
```typescript
interface User {
  uid: string;
  fullName: string;
  phone: string;        // E.164 format
  email?: string;
  city: string;
  role: 'sender' | 'driver';
  profilePhotoURL: string;
  kycDocumentURL: string;
  kycStatus: 'pending' | 'approved' | 'rejected';
  rating: { average: number; count: number };
  completedDeliveries: number;
  status: 'active' | 'suspended' | 'blocked';
  fcmToken: string;
  location: { lat: number; lng: number; geohash: string };
  createdAt: Timestamp;
}
```

### deliveries/{deliveryId}
```typescript
interface Delivery {
  senderId: string;     // → users
  driverId?: string;    // → users
  status: DeliveryStatus;
  pickup: GeoPoint;     // { address, city, lat, lng, geohash }
  destination: GeoPoint;
  item: { description: string; type: string; size: string; photoURL: string };
  price: number;        // NIS
  pickupDate: Timestamp | 'asap';
  notes?: string;
  payment: { senderConfirmed: boolean; driverConfirmed: boolean };
  proof: { pickupURL?: string; deliveryURL?: string; paymentURL?: string };
  statusHistory: StatusEntry[];
  cancelledBy?: string;
  timeoutAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type DeliveryStatus = 'new' | 'pending' | 'waiting' | 'picked_up' | 'delivered' | 'cancelled' | 'completed_paid';
```

### chats/{deliveryId} → messages/{messageId} (subcollection)
### ratings/{ratingId}
### reports/{reportId}
### adminActions/{actionId}

## Delivery Status State Machine
```
NEW → (driver interested) → PENDING → (sender approves) → WAITING
  → (driver picks up + proof) → PICKED_UP → (driver delivers + proof) → DELIVERED
  → (both confirm payment) → COMPLETED_PAID

Cancellation: NEW/PENDING/WAITING → CANCELLED (pre-pickup only)
Revert: PENDING → NEW (driver cancels or 72h timeout)
Post-pickup: NO cancellation allowed (picked_up/delivered/completed_paid are irreversible)
```

## Push Notification Events (8 mandatory)
1. `new_listing_nearby` → Drivers within radius (geohash match)
2. `driver_interested` → Sender (delivery owner)
3. `sender_approved` → Driver (assigned)
4. `delivery_picked_up` → Sender
5. `delivery_delivered` → Sender
6. `payment_confirmed` → Both parties
7. `delivery_cancelled` → Other party
8. `new_chat_message` → Recipient (other party in chat)

All via FCM Cloud Messaging, triggered by Cloud Functions on Firestore writes.

## Technology Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Mobile | React Native (Expo) | SDK 50+ |
| Navigation | React Navigation | 7.x |
| State | React Context + Firestore listeners | — |
| Maps | react-native-maps + Google Maps SDK | — |
| Backend | Firebase Cloud Functions | Node 18, Gen 2 |
| Database | Cloud Firestore | — |
| Auth | Firebase Auth (OTP SMS + Email) | — |
| Storage | Firebase Cloud Storage | — |
| Push | Firebase Cloud Messaging (FCM v1 HTTP API) | — |
| Admin | React + Vite (or Next.js) | — |
| Analytics | GA4 / Amplitude | — |
| Language | TypeScript | 5.x strict |

## Milestones & Payment
| Milestone | Scope | Payment |
|-----------|-------|---------|
| M0 | Setup & scaffold | (advance: 50% = 45,000 NIS) |
| M1 | Auth + users + data models + base mobile | 15% = 13,500 NIS |
| M2 | Delivery lifecycle + GPS + chat + push + admin | 10% = 9,000 NIS |
| M3 | Ratings + cancellation + polish + migration | 5% = 4,500 NIS |
| M4 | Production build + store submission | 20% = 18,000 NIS |

## Git & Deployment
- **Source control**: KAL Solutions GitHub org (private)
- **Client remote**: Code pushed to client remote ONLY after milestone payment received
- **Branches**: main, develop, feature/*, release/*
- **Commit format**: `<type>(<scope>): <description>` — types: feat, fix, refactor, style, docs, test, chore
- **CI/CD**: EAS Build (mobile), Firebase CLI deploy (functions), Vercel or Firebase Hosting (admin)
- **Environments**: dev → staging → production (separate Firebase projects)

## Detailed References
- [Contract Reference](../initDocs/MOOVIZ-CONTRACT-REFERENCE.md)
- [Milestones & Sprint Plan](../initDocs/MOOVIZ-MILESTONES.md)
- [Critical Path](../initDocs/MOOVIZ-CRITICAL-PATH.md)
- [Task List (CSV)](../initDocs/MOOVIZ-TASKS.csv)
- [High-Level Design](../initDocs/MOOVIZ-HLD.md)
- [Combined Project Document](../initDocs/MOOVIZ-PROJECT-DOCUMENT.md)
- [Architecture Diagram](../initDocs/diagrams/architecture.drawio)
- [State Machine Diagram](../initDocs/diagrams/state-machine.drawio)
- [Data Model Diagram](../initDocs/diagrams/data-model.drawio)
- [User Flow Diagram](../initDocs/diagrams/user-flow.drawio)
- [Push Events Diagram](../initDocs/diagrams/push-events.drawio)

## Skills to Use
| Phase | Skill | Purpose |
|-------|-------|---------|
| Architecture | `fullstack-dev-skills:architecture-designer` | System design, ADRs |
| Architecture | `fullstack-dev-skills:cloud-architect` | Firebase/GCP infrastructure |
| Features | `fullstack-dev-skills:feature-forge` | Feature specs, acceptance criteria |
| Mobile | `fullstack-dev-skills:react-native-expert` | Navigation, platform code, performance |
| TypeScript | `fullstack-dev-skills:typescript-pro` | Type safety, generics, strict mode |
| API | `fullstack-dev-skills:api-designer` | Cloud Functions callable API design |
| Fullstack | `fullstack-dev-skills:fullstack-guardian` | End-to-end feature implementation |
| Security | `fullstack-dev-skills:security-reviewer` | Auth, RBAC, Firestore rules, OWASP |
| Testing | `fullstack-dev-skills:test-master` | Jest, Detox, E2E testing strategy |
| Reviews | `fullstack-dev-skills:code-reviewer` | PR quality gates |
| DevOps | `fullstack-dev-skills:devops-engineer` | CI/CD, EAS Build, Firebase deploy |
| Diagrams | `draw-io:draw-io` | Architecture & flow diagrams |
| Workflow | `superpowers:brainstorming` | Before creative/feature work |
| Workflow | `superpowers:test-driven-development` | TDD for critical paths |
| Workflow | `superpowers:systematic-debugging` | Bug investigation |
| Workflow | `superpowers:writing-plans` | Sprint/feature planning |

## Workflow Guidelines

### Plan First
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Write detailed specs upfront to reduce ambiguity

### Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- One task per subagent for focused execution

### Self-Improvement
- After ANY correction from the user: update memory files with the pattern
- Write rules that prevent the same mistake repeating

### Verification Before Done
- Never mark a task complete without proving it works
- Ask: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- Skip this for simple, obvious fixes — don't over-engineer

### Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user

### Core Principles
- **Simplicity First**: Make every change as simple as possible. Minimal code impact
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs

## Security Requirements
- Firebase Auth required for all API calls
- Firestore Security Rules: users read own profile, drivers read available deliveries, write restricted to role
- Cloud Functions validate all status transitions (RBAC + state machine)
- Image uploads: max 5MB, validated content type (image/jpeg, image/png)
- Phone validation: E.164 format
- Rate limiting on Cloud Functions (especially OTP)
- No PII in logs
- HTTPS everywhere
