# MOOVIZ — High-Level Design Document

**Project**: MOOVIZ Real-Time Community Delivery Platform (MVP)
**Version**: 1.0
**Author**: Tamir Konortov, CTO — KAL Solutions Group
**Date**: March 2, 2026
**Classification**: Confidential — Client & Internal

---

## 1. Executive Summary

MOOVIZ is a real-time, community-based delivery platform connecting shippers with drivers already on the move. This HLD defines the MVP architecture — a mobile-first solution built on React Native (iOS + Android) with a serverless backend on Google Cloud Platform (Firebase).

The architecture prioritizes:
- **Speed to market**: 45-day delivery timeline using managed services
- **Real-time UX**: Firestore listeners for instant state sync across all parties
- **Scalability path**: Firebase/GCP foundation supports scaling without re-architecture
- **Cost efficiency**: Serverless billing (pay-per-use) ideal for MVP validation
- **Security**: Server-side validation, RBAC, and encrypted communications

---

## 2. System Architecture

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐│
│  │  React Native    │  │  React Native    │  │  React/Web   ││
│  │  (Sender App)    │  │  (Driver App)    │  │  (Admin)     ││
│  │  iOS + Android   │  │  iOS + Android   │  │              ││
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘│
└───────────┼──────────────────────┼────────────────────┼───────┘
            │                      │                    │
            ▼                      ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                   FIREBASE SERVICES                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Firebase     │  │  Firestore   │  │  Cloud Functions  │  │
│  │  Auth (OTP)   │  │  (Real-time  │  │  (Business Logic) │  │
│  │              │  │   Database)   │  │                   │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Cloud        │  │  FCM (Push   │  │  Firebase         │  │
│  │  Storage      │  │  Notifications│  │  Security Rules   │  │
│  │  (Images)     │  │  )           │  │                   │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
            │                      │                    │
            ▼                      ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                 EXTERNAL SERVICES                            │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Google Maps  │  │  Bit/PayBox  │  │  GA4/Amplitude    │  │
│  │  SDK + Places │  │  (Deep Links)│  │  (Analytics)      │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Mobile framework | React Native | Single codebase, native performance, large ecosystem |
| Backend | Firebase (serverless) | Real-time sync, managed infrastructure, fast development |
| Database | Firestore | Real-time listeners, offline support, auto-scaling |
| Business logic | Cloud Functions | Server-side validation, event-driven, no server management |
| Authentication | Firebase Auth (OTP) | Built-in phone/email OTP, integrates with security rules |
| Push notifications | FCM | Native integration, reliable delivery, topic/condition targeting |
| Image storage | Cloud Storage | Scalable, CDN-backed, integrates with security rules |
| Maps | Google Maps SDK | Best coverage in Israel, Places autocomplete, navigation deep links |
| Payments | External deep links | No payment processing liability, MVP-appropriate |

### 2.3 Why Serverless (Firebase) for MVP

1. **Zero infrastructure management**: No servers to provision, patch, or scale
2. **Real-time by default**: Firestore listeners give instant UI updates
3. **Pay-per-use**: Costs scale with actual usage, ideal for validation phase
4. **Built-in auth + security**: Firebase Auth + Security Rules reduce custom code
5. **Fast development**: 45-day timeline requires managed services
6. **Scaling path**: Firebase/GCP scales automatically; migration to custom backend possible in Phase 2+

---

## 3. Data Model

### 3.1 Firestore Collections

#### `users` Collection
```
users/{userId}
├── uid: string (Firebase Auth UID)
├── fullName: string (2-60 chars)
├── phone: string (E.164 format)
├── email: string (optional)
├── city: string
├── role: "sender" | "driver"
├── profilePhotoURL: string (Cloud Storage URL)
├── kycDocumentURL: string (Cloud Storage URL)
├── kycStatus: "pending" | "approved" | "rejected"
├── rating: { average: number, count: number }
├── completedDeliveries: number
├── completedTrips: number
├── status: "active" | "suspended" | "blocked"
├── fcmToken: string (for push notifications)
├── location: { lat, lng, geohash, updatedAt } (drivers only)
├── createdAt: Timestamp
├── updatedAt: Timestamp
└── termsAcceptedAt: Timestamp
```

#### `deliveries` Collection
```
deliveries/{deliveryId}
├── senderId: string (user reference)
├── driverId: string | null
├── status: "new" | "pending_approval" | "waiting_pickup" | "picked_up" | "delivered" | "cancelled" | "completed_paid"
├── pickup: { address, city, lat, lng, geohash }
├── destination: { address, city, lat, lng, geohash }
├── item: { description, type, size, photoURL }
├── price: number (NIS)
├── pickupDate: Timestamp | "asap"
├── notes: string (optional)
├── payment: { senderConfirmed: bool, driverConfirmed: bool, senderConfirmedAt, driverConfirmedAt }
├── proof: { pickupImageURL, deliveryImageURL, paymentImageURL }
├── statusHistory: [{ status, actor, timestamp, note }]
├── cancelledBy: string | null
├── createdAt: Timestamp
├── updatedAt: Timestamp
└── timeoutAt: Timestamp (for auto-revert logic)
```

#### `chats` Collection
```
chats/{deliveryId}
├── participants: [senderId, driverId]
├── lastMessage: { text, sender, timestamp }
├── unreadCount: { [userId]: number }
└── messages/ (subcollection)
    └── {messageId}
        ├── senderId: string
        ├── type: "text" | "image" | "system" | "proof"
        ├── text: string
        ├── imageURL: string (if image/proof)
        ├── proofType: "pickup" | "delivery" | "payment" (if proof)
        ├── metadata: { deliveryId, proofType, uploadedBy }
        └── createdAt: Timestamp
```

#### `ratings` Collection
```
ratings/{ratingId}
├── deliveryId: string
├── raterId: string
├── ratedUserId: string
├── score: number (1-5)
├── comment: string (max 300 chars, optional)
└── createdAt: Timestamp
```

#### `reports` Collection
```
reports/{reportId}
├── reporterId: string
├── reportedUserId: string
├── deliveryId: string (optional)
├── type: string (5+ predefined types)
├── description: string
├── status: "new" | "investigating" | "resolved"
├── adminNotes: [{ note, adminId, timestamp }]
└── createdAt: Timestamp
```

#### `adminActions` Collection (Audit Trail)
```
adminActions/{actionId}
├── adminId: string
├── action: string (e.g., "block_user", "override_status", "remove_rating")
├── targetType: "user" | "delivery" | "rating" | "report"
├── targetId: string
├── details: map
└── createdAt: Timestamp
```

### 3.2 Indexes

| Collection | Fields | Purpose |
|-----------|--------|---------|
| deliveries | status + pickup.geohash | Driver feed radius query |
| deliveries | senderId + status | Sender's deliveries |
| deliveries | driverId + status | Driver's trips |
| deliveries | status + timeoutAt | Timeout auto-revert |
| ratings | ratedUserId + createdAt | User rating history |
| reports | status + createdAt | Admin report queue |
| messages | createdAt (in chats subcollection) | Chat message ordering |

---

## 4. API Design (Cloud Functions)

### 4.1 HTTP Callable Functions

| Function | Method | Description | Auth Required |
|----------|--------|-------------|--------------|
| `createDelivery` | callable | Create new delivery listing | Sender |
| `updateDelivery` | callable | Edit listing (pre-assignment) | Sender (owner) |
| `deleteDelivery` | callable | Delete listing (pre-assignment) | Sender (owner) |
| `expressInterest` | callable | Driver expresses interest | Driver |
| `approveDriver` | callable | Sender approves driver | Sender (owner) |
| `updateDeliveryStatus` | callable | Status transition (with validation) | Participant |
| `cancelDelivery` | callable | Cancel delivery (pre-pickup) | Participant |
| `confirmPayment` | callable | Sender/Driver payment confirmation | Participant |
| `submitRating` | callable | Post-delivery rating | Participant |
| `submitReport` | callable | Report user | Authenticated |

### 4.2 Firestore Triggers (Background Functions)

| Trigger | Event | Action |
|---------|-------|--------|
| `onDeliveryStatusChange` | deliveries/{id} write | Send push notifications, update chat timeline |
| `onNewMessage` | chats/{id}/messages/{msgId} create | Send push to counterpart |
| `onNewDelivery` | deliveries/{id} create | Geo-targeted push to nearby drivers |
| `onRatingCreate` | ratings/{id} create | Update user aggregate rating |
| `onUserBlockedChanged` | users/{id} write | Revoke auth sessions if blocked |
| `scheduledTimeoutCheck` | Scheduled (every 1h) | Auto-revert expired pending deliveries |

### 4.3 Status Transition Validation

```typescript
const VALID_TRANSITIONS: Record<Status, { nextStatus: Status; actor: Role }[]> = {
  'new': [
    { nextStatus: 'pending_approval', actor: 'driver' },
    { nextStatus: 'cancelled', actor: 'sender' },
  ],
  'pending_approval': [
    { nextStatus: 'waiting_pickup', actor: 'sender' },
    { nextStatus: 'cancelled', actor: 'sender' },
    { nextStatus: 'cancelled', actor: 'driver' }, // reverts to 'new'
  ],
  'waiting_pickup': [
    { nextStatus: 'picked_up', actor: 'driver' },
    { nextStatus: 'cancelled', actor: 'sender' },
    { nextStatus: 'cancelled', actor: 'driver' },
  ],
  'picked_up': [
    { nextStatus: 'delivered', actor: 'driver' },
    // NO cancellation allowed
  ],
  'delivered': [
    { nextStatus: 'completed_paid', actor: 'system' }, // auto when both confirm
  ],
};
```

---

## 5. Security Model

### 5.1 Authentication
- **Method**: Firebase Auth with OTP (SMS + Email)
- **Session**: Firebase ID tokens (JWT), auto-refreshed
- **Admin**: Custom claims (`admin: true`) set via admin SDK

### 5.2 Authorization (RBAC)

| Role | Permissions |
|------|------------|
| **Sender** | Create/edit/delete own deliveries, view own chats, rate counterpart, report users |
| **Driver** | View feed, express interest, update assigned delivery status, view own chats, rate counterpart |
| **Admin** | All read access, user management, delivery override, moderation, audit trail |

### 5.3 Firestore Security Rules (Summary)
```
users/{userId}:
  read: authenticated (limited fields for non-self, full for self/admin)
  write: self only (profile fields), admin (status/KYC fields)

deliveries/{deliveryId}:
  read: participants + drivers (if status=new) + admin
  write: via Cloud Functions only (no direct client writes)

chats/{deliveryId}/messages:
  read: participants only
  create: participants only
  delete: none (admin via functions)

ratings, reports: create by authenticated, read by admin + participants
```

### 5.4 Data Security
- All communication over TLS/SSL
- No secrets in client applications
- Service account keys in GCP Secret Manager
- Firestore field-level security via rules
- Cloud Storage: authenticated uploads only, scoped paths
- Proof images: immutable (no user delete)

### 5.5 Client-Side Security
- Input validation on all user inputs
- XSS prevention (React Native is inherently safe from traditional XSS)
- No sensitive data in AsyncStorage/local storage
- Certificate pinning (optional, Phase 2)
- Jailbreak/root detection (optional, Phase 2)

---

## 6. Real-Time & Location Architecture

### 6.1 Real-Time Data Sync
Firestore real-time listeners provide instant synchronization:
- **Delivery status**: All participants see status changes immediately
- **Chat messages**: Real-time message delivery via onSnapshot
- **Driver location**: Location updates streamed to map in real-time
- **Feed updates**: New listings appear, cancelled listings disappear

### 6.2 Location Service (MVP)

```
Driver App                    Firestore                     Sender App
    │                            │                              │
    ├── Location Update ────────►│                              │
    │   (throttled, ~15s)        │◄── onSnapshot ──────────────┤
    │                            │                              │
    │   Fields:                  │   Map renders:               │
    │   - lat/lng               │   - Driver marker            │
    │   - geohash               │   - Pickup marker            │
    │   - heading               │   - Destination marker       │
    │   - speed                 │   - Route line               │
    │   - updatedAt             │                              │
```

### 6.3 Geohash-Based Proximity Search
- **Indexing**: Each delivery's pickup location stored with geohash prefix
- **Query**: Neighboring geohash cells queried for radius search
- **Filter**: Haversine formula for exact distance post-query
- **Performance**: Geohash precision tuned for 1-5km radius queries
- **Scaling**: Suitable for MVP scale (~500 active listings)

---

## 7. Push Notification Architecture

```
Firestore Write (status change)
        │
        ▼
Cloud Function Trigger
        │
        ├── Determine recipients
        ├── Determine notification type
        ├── Build FCM message (title, body, deep link, data)
        │
        ▼
    FCM API
        │
        ├──► iOS (APNs)
        └──► Android (FCM transport)
```

### 7.1 Notification Payload Structure
```json
{
  "notification": {
    "title": "New delivery near you",
    "body": "Package pickup at 14 Dizengoff St",
  },
  "data": {
    "type": "listing_published",
    "deliveryId": "abc123",
    "deepLink": "mooviz://listing/abc123"
  },
  "android": { "priority": "high" },
  "apns": { "payload": { "aps": { "sound": "default", "badge": 1 } } }
}
```

### 7.2 Geo-Targeted Push
For `listing_published` events:
1. Get pickup location geohash
2. Query `users` collection for active drivers within radius (geohash query)
3. Batch send FCM to matching driver tokens
4. Deduplication: track sent notifications per listing ID

---

## 8. Deployment Strategy

### 8.1 Environments

| Environment | Firebase Project | Purpose | Deploy Trigger |
|------------|-----------------|---------|----------------|
| **Development** | mooviz-dev | Local + CI testing | Push to `develop` |
| **Staging** | mooviz-dev (separate config) | Client preview | Manual / PR merge |
| **Production** | mooviz-prod | Live users | Manual deploy with approval |

### 8.2 Mobile Deployment
- **Development**: Expo Go / Dev Client
- **Internal Testing**: EAS Build → TestFlight (iOS) + Internal Track (Android)
- **Production**: EAS Build → App Store / Play Store

### 8.3 Cloud Functions Deployment
```bash
firebase deploy --only functions --project mooviz-dev    # Dev
firebase deploy --only functions --project mooviz-prod   # Production
```

### 8.4 Rollback Strategy
- Cloud Functions: redeploy previous version from Git tag
- Firestore Rules: redeploy from versioned rules file
- Mobile: submit hotfix build via EAS (expedited review for critical bugs)

---

## 9. Monitoring & Observability

### 9.1 Firebase/GCP Monitoring
- **Crashlytics**: Mobile crash reporting (React Native)
- **Firebase Performance**: App startup time, network request latency
- **Cloud Functions Logs**: Structured logging via Cloud Logging
- **Firestore Usage**: Read/write/delete metrics dashboard
- **FCM Delivery Reports**: Push delivery success rates

### 9.2 Alerting
| Alert | Threshold | Channel |
|-------|-----------|---------|
| App crash spike | > 1% crash rate | Email + Slack |
| Function error rate | > 5% | Email |
| Firestore daily reads | > 50K | Email (billing alert) |
| FCM delivery failure | > 10% | Email |
| Auth failures spike | > 20/hour | Email |

### 9.3 Analytics
- GA4 or Amplitude integration
- 11 tracked events (see Contract Reference, Section 18)
- User funnel: Registration → First Listing → First Delivery → Rating
- Retention metrics: DAU/WAU/MAU

---

## 10. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Firebase vendor lock-in** | Medium | Medium | Clean service abstraction layer; migration path documented |
| **Firestore cost at scale** | Low (MVP) | High (at scale) | Read/write optimization, caching, Phase 2 migration plan |
| **OTP SMS cost** | Medium | Low | Email fallback, rate limiting, budget alerts |
| **App Store rejection** | Low-Medium | High | Early TestFlight, compliance checklist, native features |
| **Real-time sync latency** | Low | Medium | Firestore regional deployment (US-East or Europe), connection pooling |
| **Data migration (Glide)** | Medium | Medium | Early data audit, incremental migration, rollback plan |
| **Scope creep** | High | High | Change Request process, frozen MVP scope |
| **Single point of failure (CTO)** | Medium | High | Documentation, clean code, onboarding-ready codebase |

---

## 11. Phase 2+ Considerations (Not in MVP)

For reference, the following are intentionally excluded from MVP and may be addressed in Phase 2:

- **Payments**: In-app payment processing, escrow, commission model
- **KYC**: Third-party biometric verification (Sumsub)
- **Geo**: Route-based matching, ETA estimation, heatmaps
- **Scale**: Dedicated location service, read replicas, CDN optimization
- **Security**: Penetration testing, SOC2, advanced fraud detection
- **Features**: Recurring deliveries, income screen, scheduled routes
- **Operations**: 24/7 support, uptime SLA, financial penalties
- **Analytics**: Advanced reporting, A/B testing, cohort analysis

---

## Appendix A: Technology Version Pinning

| Technology | Version | Notes |
|-----------|---------|-------|
| React Native | 0.73+ (or Expo SDK 50+) | Latest stable at project start |
| TypeScript | 5.x | Strict mode enabled |
| Node.js | 18 LTS | Cloud Functions runtime |
| Firebase SDK | v10+ (modular) | Tree-shakeable imports |
| Google Maps RN | 1.x | Latest stable |
| React Navigation | 6.x | Latest stable |

---

**Document Control**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-02 | Tamir Konortov | Initial HLD for MVP |

---

*© 2026 KAL Solutions Group. All rights reserved. This document is confidential and intended for authorized recipients only.*
