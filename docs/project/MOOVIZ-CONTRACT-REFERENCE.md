# MOOVIZ — Contract & Product Reference Document

> **Source**: "gm Mooviz final.pdf" — signed contract dated March 1, 2026
> **Status**: SOW v1.5 | PRD v1.0
> **Prepared by**: KAL Solutions Group
> **Purpose**: Consolidated, deduplicated English reference for execution

---

## 1. Contract Metadata

| Field | Value |
|-------|-------|
| **Supplier** | KAL Solutions (Business ID: 043139120), 14 Chalmish St, Caesarea, Israel |
| **Client** | G.M. Mooviz Software (2026) Ltd (Company No: 517308847) |
| **Client Address** | 2 Lea & David Izhmojik St, Tel-Aviv 6900382 |
| **Client Signatories** | Guy Morduch (ID: 027885730), Vered Sitbon (ID: 036393452) |
| **Client Contact** | Assaf Gerbali (appointed project contact) |
| **Effective Date** | March 1, 2026 |
| **Initial Term** | 6 months from signing |
| **Auto-Renewal** | 12 months, unless either party gives notice |
| **Termination Notice** | 30 business days written notice |
| **Governing Law** | Israel; disputes → mediation → Tel Aviv courts (60-day mediation window) |
| **Existing Product** | https://mooviz-app.glide.page/ (Glide-based prototype) |

---

## 2. Commercial Terms

### 2.1 Total Project Cost
- **90,000 NIS + VAT** (fixed price)
- All prices exclusive of VAT; VAT per Israeli law at time of invoicing
- Some invoices may be issued by EU-based KAL Solutions entity

### 2.2 Payment Structure

| Payment | Amount | Trigger |
|---------|--------|---------|
| **Advance** | 50% — 45,000 NIS + VAT | Upon contract signing & project kickoff |
| **Milestone 1** | 15% — 13,500 NIS + VAT | Backend foundations, auth, base data models, initial mobile flows |
| **Milestone 2** | 10% — 9,000 NIS + VAT | Delivery lifecycle, GPS tracking, chat, notifications, admin core |
| **Milestone 3** | 5% — 4,500 NIS + VAT | Feature completion, stabilization, P0/P1 bug fixing |
| **Final Payment** | 20% — 18,000 NIS + VAT | Production build handover + store submission |

### 2.3 Payment Terms
- Invoices payable within **10 days** of issuance
- Advance invoice payable in full upon signing (prerequisite for work start)
- Milestone payments within 10 days of milestone demo or production release (whichever comes first)
- Milestone completion = functional completion of agreed scope (not dependent on App Store/Play Store approval timelines)

### 2.4 Pricing Discipline
- Fixed price; no changes without signed Change Request
- Scope expansion beyond SOW priced separately via Change Request process

---

## 3. Delivery Model

### 3.1 Approach
**Accelerated Founder-Led MVP** — senior leadership hands-on, AI-assisted development tools, prioritizing fast market entry and validated core functionality over enterprise hardening.

### 3.2 Team

| Role | Person | Scope |
|------|--------|-------|
| **Founder & CTO** | Tamir Konortov | End-to-end technical ownership: architecture, backend, mobile, cloud, releases, store submissions |
| **Fullstack Developer** | Part-time | Feature implementation, backend/mobile support, bug fixing |
| **QA** | Joint: delivery team + MOOVIZ founder/client | Continuous validation of core user flows |

### 3.3 Timeline
- **45 calendar days** estimated delivery
- Assumes: frozen MVP scope, fast feedback cycles, same-day or next-business-day client approvals
- **Delay clause**: Any delay from missing feedback, approvals, assets, or payments extends timeline day-for-day

### 3.4 Working Hours
- Sunday–Friday (Note: contract says Mon-Fri but Israeli work week typically includes Sunday)
- 09:00–18:00 Israel time
- Communication: email + WhatsApp, weekly updates
- Project management in KAL CRM, code in GitHub (KAL Solutions repo; pushed to client remote after milestone payment)

---

## 4. Product Overview

### 4.1 What is MOOVIZ?
A real-time, community-based delivery platform connecting shippers/publishers with drivers already on the move. No intermediaries, no commissions in MVP. Emphasizes transparency, speed, and community trust.

### 4.2 MVP Goals
- Native mobile apps for iOS and Android (React Native)
- Live GPS tracking and real-time map visibility
- Direct user communication (1:1 chat)
- Scalable cloud backend (GCP/Firebase)
- Payment via external deep links (Bit/PayBox/bank transfer)
- Transfer existing Glide user database
- Market validation: 5,000 initial users, 500 active listings/month

### 4.3 Target Users & Roles

| Role | Description |
|------|-------------|
| **Sender/Publisher** | Creates delivery requests, sets price, communicates with drivers, approves pickup/delivery, pays directly, rates drivers |
| **Driver/Courier** | Browses feed, accepts deliveries, communicates, picks up and delivers, receives payment, rates senders |
| **Administrator** | Moderates users/listings, handles reports, monitors analytics, manages blocks/verifications |

### 4.4 Core Value Proposition
- Real-time matching without brokerage fees
- Live GPS tracking and shared visibility
- Fast onboarding, minimal friction
- Community-based trust via ratings and transparency
- Direct communication
- GIG industry support
- Product-market fit validation

---

## 5. Functional Scope (MVP)

### 5.1 Authentication & Registration
- **OTP-based** authentication (SMS and/or Email)
- One-time registration for new users
- **Registration fields**:
  - Full name (text, 2–60 characters) — **required**
  - Phone (Israeli/international format validation) — **required**
  - Email (basic validation) — optional for OTP
  - City (selection or text) — **required**
  - Role (Sender/Driver) — **required**
  - Profile photo — optional (default avatar if none)
  - ID card / driver license photo (camera or gallery import) — **required** (KYC-Light)
  - Terms of service + privacy consent — **required**
- **KYC**: Admin approval for MVP (not third-party biometric verification)

### 5.2 Delivery Creation (Sender)

**Listing fields**:
| Field | Type | Required |
|-------|------|----------|
| Pickup address | City + street + number (map autocomplete) | Yes |
| Destination address | City + street + number (map autocomplete) | Yes |
| Item description | Free text, up to 300 chars | Yes |
| Item size | Small / Medium / Large (dropdown) | Yes |
| Item photo | Camera or gallery | Yes |
| Pickup date | ASAP or future date+time | Yes |
| Item type | Envelope / Package / Small furniture / Other (free text up to 300 chars) | Yes |
| Proposed price | Positive number in ₪, minimum 1 | Yes |
| Notes | Free text | No |

**Editing rules**:
- Sender can edit or delete listing before a driver is assigned
- After driver assigned: no editing without prior cancellation

### 5.3 Driver Feed
- View all available listings
- Filters: size, city, distance
- Each listing shows: item photo, pickup address, destination address, price
- Pickup/destination on map with navigation button
- **"I'm Interested"** button → changes status to "Pending Sender Approval", notifies sender
- After clicking "I'm Interested": listing removed from general feed, visible only to sender + selected driver in personal screens
- Chat / phone call buttons

### 5.4 Personal Screens

**My Trips (Driver)**:
- Item photo, pickup address, destination, delivery status
- Drill into delivery: cancel button, navigation to pickup/destination (status-dependent), confirm pickup/delivery (status-dependent), chat/phone, delivery description, addresses, pickup date, sender email/phone, agreed price, sender rating, report sender button

**My Deliveries (Sender)**:
- Same structure as driver screen, adapted for sender perspective
- Cancel delivery, chat/phone, description, addresses, date, driver rating, report driver button

### 5.5 Delivery Status State Machine

**Defined Statuses**:
1. `New Delivery` — created by sender
2. `Pending Sender Approval` — driver expressed interest
3. `Waiting for Pickup` — sender approved driver
4. `Picked Up` — driver collected the package
5. `Delivered` — driver arrived at destination
6. `Cancelled` — either party cancelled (pre-pickup only)
7. `Completed & Paid` — both parties confirmed payment

**Allowed Transitions**:

```
New Delivery ──→ Pending Sender Approval (driver clicks "I'm interested")
             ──→ Cancelled (by Sender)

Pending Sender Approval ──→ Waiting for Pickup (Sender approves)
                        ──→ Cancelled (by Sender or Driver)
                        ──→ New Delivery (if Driver cancels → reverts)

Waiting for Pickup ──→ Picked Up (by Driver)
                   ──→ Cancelled (by Sender or Driver)

Picked Up ──→ Delivered (by Driver)
           [NO cancellation allowed after Picked Up]

Delivered ──→ Completed & Paid (after both parties confirm payment)
```

**Rules**:
- Cancellation ONLY before "Picked Up" status
- All status changes trigger: push notification + system chat message + timestamp + actor log
- Status changes validated **server-side** (Cloud Functions), not client-controlled
- Only ONE driver can be in "Pending Sender Approval" per delivery at a time
- Once driver approved → listing removed from general driver feed

**Timeout Logic**:
- "Pending Sender Approval" → auto-reverts to "New Delivery" after **72 hours** without approval
- "Waiting for Pickup" → either party may cancel after **72 hours** without pickup confirmation

**Concurrency**:
- Server-side validation prevents race conditions
- Only one driver pending per delivery at a time

### 5.6 Chat (1:1 Real-Time)
- Real-time messaging between sender and driver per delivery
- Shortcut to phone call
- Delivery thumbnail with driver rating displayed
- **All status changes logged in chat timeline** with timestamp and actor, even without conversation
- System messages for status changes:
  - "Pending Sender Approval" — when driver selects delivery
  - "Delivery approved for pickup — arrive at the agreed time" — when sender approves
  - "Delivery picked up and on its way" — when driver picks up
  - "Delivery delivered to your requested address" — when driver arrives
  - "Would appreciate a rating" — post-delivery to both parties
- **Image upload**: camera capture + gallery selection
- Images stored in cloud storage, linked to delivery

### 5.7 Proof System (Chat Media Upload)

| Proof Type | Actor | When | Required? |
|-----------|-------|------|-----------|
| Proof of Pickup | Driver | Marking "Picked Up" | **Yes** — cannot complete status without image |
| Proof of Delivery | Driver | Marking "Delivered" | **Yes** — cannot complete status without image |
| Proof of Payment | Sender | After payment sent | No — optional confirmation |

**Rules**:
- Available from chat screen AND status action screen
- Stored with metadata: `deliveryId`, `uploadedBy`, `proofType`, `timestamp`
- Visible to both parties as system entries with image preview
- Users cannot delete proof images (admin can remove abusive content)

### 5.8 Push Notifications (Mandatory, Server-Side)

Push delivery is a **core MVP requirement**. All notifications triggered server-side via Cloud Functions.

**Push Notification Matrix**:

| Event Key | Recipient | Title (Hebrew) | Deep Link |
|-----------|-----------|----------------|-----------|
| `listing_published` | Relevant drivers (within radius) | "פרסום חדש לידך" / "New delivery near you" | `app://listing/{id}` |
| `driver_interested` | Sender | "נהג התעניין במשלוח שלך" / "A driver is interested" | `app://listing/{id}` |
| `publisher_approved` | Driver | "אושר לאיסוף" / "Approved for pickup" | `app://listing/{id}` |
| `status_collected` | Both parties | "המשלוח נאסף" / "Delivery picked up" | `app://listing/{id}` |
| `status_delivered` | Both parties | "המשלוח נמסר" / "Delivery completed" | `app://rate/{id}` |
| `chat_message` | Counterpart | "הודעה חדשה" / "New message" | `app://chat/{threadId}` |
| `cancelled` | Counterpart | "המשלוח בוטל" / "Delivery cancelled" | `app://listing/{id}` |
| `rate_request` | Both parties | "נשמח לדירוג" / "Please rate" | `app://rate/{id}` |

**Geo-targeted push**: New listings → push to active drivers within configurable radius (default: 3km). Basic deduplication for same listing.

### 5.9 Ratings & Reputation (Mutual)

**Trigger**: After delivery reaches "Delivered" status
- Each party rates counterpart once per delivery (one-time, cannot edit)
- Scale: 1–5 stars
- Optional text comment up to 300 characters
- Rating prompt: in-app screen + push notification
- If skipped: can rate later from "My Deliveries" / "My Trips"

**Display**:
- User profile: average rating (stars) + total completed deliveries/trips
- Listing/delivery details: counterpart rating summary

**Admin moderation**: View reported ratings/comments, remove abusive content

### 5.10 Payment Confirmation Flow (Manual — MVP)
- Payment executed **outside** the app (deep links to Bit/PayBox/bank transfer)
- Internal confirmation mechanism:
  - After "Delivered": Sender marks "Payment Sent"
  - Driver marks "Payment Received"
  - When both confirm → "Completed & Paid"
- Payment status visible in delivery details with badges/labels
- Each confirmation: logged in chat/timeline, triggers push to counterpart

### 5.11 Cancellation Logic
- Allowed in: `New Delivery`, `Pending Sender Approval`, `Waiting for Pickup`
- **NOT allowed** after `Picked Up`
- On cancellation:
  - Status → "Cancelled"
  - Listing returns to driver feed as "New Delivery" (unless sender deletes it)
  - Counterpart receives push notification
  - System message in chat/timeline: who cancelled + when

### 5.12 Interstitial Ad Infrastructure (Monetization-Ready)
- Configurable launch interstitial screen on app entry
- Supports: image/video, configurable duration, optional skip button, click-through link
- Activation/deactivation via Admin Panel
- **Targeting**: user role, individual flag, group/segmentation, premium status, backend rules
- Server-side targeting logic (not hardcoded)
- **Implemented in MVP but may remain disabled** for initial production

### 5.13 User Data Migration
- Transfer all existing users from current Glide-based app to new platform database

---

## 6. Live GPS & Map Tracking

- Real-time driver location sharing
- Live shipment tracking on map
- Shared visibility for shipper and driver
- Status-based tracking states
- Navigation deep links: Google Maps, Waze, Apple Maps
- Show both parties on map

### 6.1 Nearby Discovery & Radius Search
- Geohash-based geo-grid indexing for proximity matching
- Configurable radius: 1km / 3km / 5km (default: 3km)
- Exact distance filtering (Haversine) server-side or client-side
- Driver location stored as: `lat/lng`, `geohash`, `updatedAt`
- Location updates throttled for performance/cost

### 6.2 Future Upgrade Path (Not MVP)
- MongoDB Atlas geo indexes or PostGIS
- Route-based matching with corridor queries
- ETA estimation, heatmaps, advanced analytics
- Dedicated high-frequency location service

---

## 7. Admin Panel (Web)

### 7.1 Core Features
- User management with search/filter
- Delivery listings moderation
- Reports and flags (5 predefined report types minimum)
- Basic operational analytics: listings/week, acceptance rates, wait times, active users

### 7.2 User Controls
- View full profile (rating, completed deliveries, reports)
- Temporarily suspend user
- Permanently block user
- View uploaded proof images
- Remove abusive ratings/comments
- Flag user as "Verified" or "Restricted"

### 7.3 Delivery Controls
- View full delivery timeline (status logs + payment logs)
- Manually change delivery status (admin override)
- Force cancel delivery
- Mark delivery as resolved
- View payment confirmation status
- View proof images (pickup/delivery/payment)

### 7.4 Report & Moderation Controls
- View user reports (5+ predefined report types)
- Add internal admin notes per user/delivery
- Track history of moderation actions (audit trail)

### 7.5 Audit Requirements
All admin override actions must:
- Be logged with timestamp
- Store admin identifier
- Be visible in internal audit log

---

## 8. Technology Stack

| Layer | Technology |
|-------|-----------|
| **Mobile** | React Native (single codebase, iOS + Android) |
| **Maps** | Google Maps SDK (Android + iOS) |
| **Navigation** | Deep links to Google Maps / Waze / Apple Maps |
| **Auth** | Firebase Authentication (OTP via SMS/Email) |
| **Database** | Firestore (real-time) |
| **Business Logic** | Cloud Functions (server-side validation) |
| **Push** | Firebase Cloud Messaging (FCM) |
| **Storage** | Cloud Storage (images, assets) |
| **Cloud** | Google Cloud Platform (GCP) |
| **Source Control** | GitHub |
| **CI/CD** | Pipelines for repeatable builds |
| **Environments** | dev / staging / production |
| **Monitoring** | Firebase / GCP logging |
| **Payments** | Deep links to Bit / PayBox / bank (no in-app processing) |
| **Localization** | Hebrew + English, full RTL support |

### Development Standards
- Code-first (no no-code/prompt-only generators)
- Clean architecture, secure coding, readable structure
- Maintainable, documented, scalable codebase
- AI-assisted development tools where appropriate

---

## 9. UI/UX Scope

### 9.1 Screen Inventory

**Sender Screens**: Registration (one-time OTP), Home, Create Listing, My Deliveries, Chat, Profile, Settings

**Driver Screens**: Registration (one-time OTP), Home, Delivery Feed, Chat, My Trips, Driver Profile

**Admin Screens (Web)**: Login, Dashboard, Listings, Users, Reports, Analytics, System Settings

### 9.2 Design Principles
- Functional, production-ready first version (not pixel-perfect)
- Focus: clarity, usability, RTL correctness, mobile performance, functional completeness
- Created by founder using internal expertise + AI-assisted design tools

### 9.3 Optional Designer
- Up to 3 design revision cycles included if designer engaged
- Additional revisions priced separately
- Designer does not automatically extend timeline

### 9.4 Home Screen
- Greeting: "Hi {name}, glad to see you again"
- Tagline: "Connecting people on your way"
- CTA: "Find nearby deliveries" (Driver) / "Create new delivery" (Sender)
- Social links: Facebook, Instagram, TikTok

### 9.5 Non-Functional Requirements
- Performance: Home screen load < 2 seconds on 4G
- Reliability: 99.5% monthly availability
- Security: All communication TLS, permission consents, basic GDPR-light/Israeli privacy compliance
- Accessibility: Clear text, contrast, full RTL support
- Compatibility: iOS 13+ / Android 7+

---

## 10. Edge Cases & System States (Binding)

### 10.1 Loading States
- Clear loading indicators for all data fetch operations
- Disabled action buttons during critical operations

### 10.2 Empty States
- Driver Feed: "No deliveries found in your area" + change radius / refresh
- My Trips / My Deliveries: "No active deliveries" + CTA
- Chat: empty state when no messages

### 10.3 Offline / No Internet
- User informed, critical actions blocked gracefully
- Status update failure → error + retry option
- UI prevents duplicate submissions on retry

### 10.4 GPS / Location Permission
- GPS denied/off → clear prompt + fallback:
  - Driver Feed: manual city selection or limited mode
  - Publishing: requires pickup/drop-off address regardless of GPS
- Tracking failure → "Location unavailable" status, no crash

### 10.5 Third-Party Service Failures
- Graceful error messaging + retry prompts
- No app crash on Firebase/Maps/Push downtime
- Core screens accessible where possible

### 10.6 Specific MVP Edge Cases (Binding)
- Missing pickup/drop-off → explicit validation error
- "Picked Up" without network → not completed until server confirmation
- Double-tap → idempotent handling (one request processed)
- Push not delivered (OS restrictions) → in-app badge updates on next open
- Listing unavailable (cancelled/assigned) → feed updates, prevents acceptance
- GPS disabled during tracking → "Location unavailable", chat/status flows continue

---

## 11. Security & Compliance

### 11.1 MVP Security Controls
- Role-based access control (RBAC)
- Firebase Security Rules
- TLS encryption / SSL
- Access logging
- Secrets management, least-privilege for service accounts
- No secrets stored in client applications

### 11.2 Exclusions (Phase 2+)
- Formal penetration testing
- SOC2 / ISO certification
- Advanced fraud detection
- DPO Report & Audit
- KYC by third party (biometric verification)

---

## 12. Quality Assurance

### 12.1 Included
- Continuous functional testing during development
- Validation: core user journeys, delivery lifecycle, GPS tracking, chat, notifications
- P0–P1 bug fixing
- Store submission readiness testing
- Targeted unit tests for critical logic
- Edge case validation (loading, empty, error states, offline, GPS denied, failed retries)

### 12.2 Excluded
- Formal QA test plans
- Automated testing frameworks
- Load or stress testing
- Pixel-level UI refinements
- Long-term maintenance SLAs

---

## 13. Bug Severity & SLA

### 13.1 Severity Levels

| Level | Name | Description | Examples |
|-------|------|-------------|----------|
| **P0** | Critical | Core functionality disabled, system unusable | Can't register/login, app crash, GPS/Chat completely broken, data loss |
| **P1** | High | Key functionality impaired, partial workaround only | Delivery stuck in status, push not sending, chat issues for some users |
| **P2** | Medium | Non-blocking issue | UI bugs, RTL issues, display problems on certain screens |
| **P3** | Low | Cosmetic/optimization | Small design errors, UX improvement suggestions, fine-tuning |

### 13.2 Response Times

| Severity | Response Time | Target Resolution |
|----------|--------------|-------------------|
| P0 | Up to 4 business hours | Immediate hotfix ASAP |
| P1 | 1 business day | Up to 3 business days |
| P2 | 2 business days | Next sprint / upcoming release |
| P3 | Per version priority | Roadmap only |

### 13.3 SLA Terms
- Business hours: Sun–Fri, 09:00–18:00 Israel time
- After-hours issues handled next business day
- Times are **best effort**, not financial SLA commitments
- SLA applies to bugs only, not new features or scope changes

### 13.4 SLA Exclusions
- Third-party service failures (Firebase, Apple, Google)
- Infrastructure outside supplier's control
- Changes made by client or third party
- Usage not per guidelines

### 13.5 MVP Model Acknowledgment
This SLA does NOT include: 24/7 support, uptime SLA, financial penalties

---

## 14. Acceptance Criteria (Complete List)

### Authentication & Onboarding
- [ ] OTP registration works on supported devices (iOS 13+, Android 7+)

### End-to-End Delivery Flow
- [ ] Create listing → Publish → Driver acceptance → Chat → Pickup → Delivery → Rating (full flow functional)

### Cancellation
- [ ] Sender and Driver can cancel prior to pickup per status rules
- [ ] After cancellation, delivery returns to driver feed as "New Delivery"
- [ ] Push notification triggered to counterpart on cancellation
- [ ] Cancellation blocked after "Picked Up"
- [ ] Cancellation logged in chat/timeline with actor + timestamp

### Ratings
- [ ] After "Delivered", both parties receive rating request (in-app + push)
- [ ] Each party submits one-time 1–5 star rating (optional comment)
- [ ] Ratings reflected in user profiles (average + count)
- [ ] Admin can moderate abusive ratings/comments

### Push Notifications
- [ ] All events in Push Notification Matrix trigger correctly
- [ ] Geo-targeted push for new listings within radius
- [ ] Status change notifications sent automatically
- [ ] Push includes deep links to relevant screens

### Chat & Proof
- [ ] Chat supports image upload (camera + gallery)
- [ ] Proof of Pickup image required for "Picked Up" status
- [ ] Proof of Delivery image required for "Delivered" status
- [ ] Proof of Payment image uploadable by Sender
- [ ] Proof images stored with metadata, visible to both, non-deletable by users

### Payment
- [ ] After "Delivered": Sender can mark "Payment Sent"
- [ ] Driver can mark "Payment Received"
- [ ] Payment confirmations logged in chat/timeline
- [ ] Push notification on each confirmation action
- [ ] "Completed & Paid" when both confirm
- [ ] Payment status visible in delivery details

### State Machine
- [ ] Delivery lifecycle follows defined state transitions strictly
- [ ] Status transitions validated server-side
- [ ] All status changes trigger push + timeline log
- [ ] Pending auto-reverts to "New" after timeout
- [ ] Only one driver approved per delivery

### Edge Cases & Resilience
- [ ] Loading, empty, error states handled without crashes
- [ ] Offline mode: critical actions fail gracefully with retry, no duplicates
- [ ] GPS denied/disabled: app prompts, continues in limited mode
- [ ] Service failures: user-friendly errors, no crashes
- [ ] Idempotent handling for rapid taps
- [ ] Feed updates when listing becomes unavailable

### Admin
- [ ] Admin can suspend/block users
- [ ] Admin can manually override delivery status
- [ ] Admin can view proof images and payment status
- [ ] Admin can remove abusive ratings/comments
- [ ] All admin actions logged with timestamp + identifier

### Localization & Store
- [ ] Hebrew/English localization with full RTL support
- [ ] Production builds delivered
- [ ] Applications submitted to Google Play + Apple App Store

---

## 15. Legal & IP Summary

### 15.1 Intellectual Property
- All IP (code, specs, documents) remains with **Supplier** until full payment of completed milestones
- Upon payment: proportional IP rights transfer to Client
- Supplier's pre-existing methods, tools, technologies remain Supplier's property
- All code embedded in solution is licensed to Client perpetually (unless agreed otherwise in writing)
- Client materials remain Client property; Supplier may only use for this project

### 15.2 Portfolio Usage
- Supplier may use Client logo and project name for promotional purposes (social media, website, documents)
- No confidential information disclosed; Client notified and tagged if desired

### 15.3 Liability
- No indirect/consequential damages (except for confidentiality breach, IP infringement, or gross negligence)
- Total cumulative liability capped at total payments actually made
- Supplier not liable for: third-party actions, software/infra outside control, client modifications, misuse
- Supplier indemnifies Client against third-party IP claims (with conditions)

### 15.4 Early Termination
- Either party: 30 business days written notice
- Client cancellation: proportional payment for work completed
- Supplier invoice within 5 days of termination

---

## 16. Change Request Process

1. Client submits written Change Request with: detailed description, business rationale, supporting docs (wireframes, specs)
2. Supplier reviews within **3 business days**: approve for evaluation or reject with reasoning
3. Supplier provides impact assessment: scope, timeline, cost
4. Parties discuss in good faith and agree in writing on: approved scope, timeline update, cost update, SOW update
5. Change binding **only after** mutual signature on CR document
6. Until signed: no obligation to perform, no timeline/cost changes

---

## 17. User Stories (Annex A)

| ID | Priority | Actor | Goal | Acceptance |
|----|----------|-------|------|------------|
| US-001 | P0 | Sender | Register with OTP | SMS received, login succeeds |
| US-002 | P0 | Sender | Create listing (pickup/dest/price/type/time/photo) | Validation, publish, appears in driver feed |
| US-003 | P0 | Driver | Get push for nearby listings | Push received, open listing, accept |
| US-004 | P0 | Both | 1:1 chat | Real-time send/receive, push |
| US-005 | P0 | Driver | Accept listing, get contact/navigation | Status updates, navigation opens, chat active |
| US-006 | P1 | Sender | Pay directly (Bit/PayBox) | Deep link + "Paid" manual confirmation |
| US-007 | P1 | Both | Rate after delivery | Rating prompt, saved |
| US-008 | P0 | Admin | View/filter listings & users | Admin table, search, block/delete |

---

## 18. Analytics Events (Annex C)

| Event | Parameters | Trigger |
|-------|-----------|---------|
| `sign_up` | method, phone_country | After registration |
| `login_success` | method | After login |
| `create_listing` | item_type, has_images | Save listing form |
| `publish_listing` | price, distance_km | Publish listing |
| `view_listing` | listing_id, source | Open listing details |
| `accept_listing` | listing_id | Driver accepts listing |
| `chat_opened` | thread_id, role | Chat opened |
| `message_sent` | len, has_image | Message sent |
| `delivery_done` | duration_min | Delivery completed |
| `rate_sent` | score, role | Rating submitted |
| `share_app` | channel | App shared |

---

## 19. Open Questions / TBD

| Item | Status | Notes |
|------|--------|-------|
| Acceptance signature (is delivery photo sufficient?) | TBD | Currently using proof images |
| KYC method | **MVP: Admin approval** | Phase 2: Sumsub or similar |
| Recurring deliveries | Out of MVP scope | Future feature |
| Income screen (driver earnings) | Out of MVP scope | Future feature |
| Legal/insurance aspects | TBD | Usage terms drafted |
| Future commission/billing model | TBD | No commissions in MVP |
| Invoicing/receipts | Phase 2+ | |
| Language support | HE + EN confirmed | Full RTL |
| SLA & operational support | MVP SLA defined | Best-effort model |

---

## 20. Store Submission Requirements

- Description of permission usage (notifications)
- Privacy Policy + Terms of Service screens
- Test account / demo video for store reviewers
- For Apple: native capabilities (push, deep links, share) to avoid "wrapped website" classification
- iOS 13+ / Android 7+ compatibility

---

*Document generated from signed contract "gm Mooviz final.pdf" dated March 1, 2026. All Hebrew sections translated. Duplicated content between SOW and PRD merged into single reference.*
