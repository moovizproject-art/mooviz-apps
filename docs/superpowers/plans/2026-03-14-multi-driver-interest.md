# Multi-Driver Interest System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single-driver interest with a multi-driver bidding system where sender reviews and selects from multiple interested drivers, with 15-min confirmation timeout.

**Architecture:** All mutations go through Cloud Functions (transactions for atomicity). Delivery stays `new` during bidding, moves to `waiting` only after driver confirms. `interestedDrivers` array lives on the delivery document for real-time UI via existing `onSnapshot`. New scheduled function handles 15-min selection timeout.

**Tech Stack:** React Native 0.75.5, Firebase Cloud Functions Gen 2 (Node 18), Firestore, FCM, TypeScript strict

**Branch:** `feature/multi-driver-interest`
**Rollback:** `git reset --hard pre-multi-driver-interest`
**Spec:** `docs/superpowers/specs/2026-03-14-multi-driver-interest-design.md`

---

## File Map

### Shared (types + constants)
| File | Action | Purpose |
|------|--------|---------|
| `shared/src/types/delivery.ts` | Modify | Add `InterestedDriver` interface, new fields on `Delivery` |
| `shared/src/constants/statuses.ts` | Modify | Add `new→waiting`, `waiting→new` transitions |
| `shared/src/constants/notifications.ts` | Modify | Add `driver_selected`, `driver_confirmed`, `driver_declined`, `selection_cancelled` events |

### Cloud Functions
| File | Action | Purpose |
|------|--------|---------|
| `functions/src/callable/deliveryCallable.ts` | Modify | Rewrite `expressInterest`, add `selectDriver`, `confirmSelection`, `declineSelection`, `cancelSelectedDriver`, `withdrawFromInterest` |
| `functions/src/scheduled/selectionTimeout.ts` | Create | 1-min cron to auto-decline expired selections |
| `functions/src/index.ts` | Modify | Export new callables + scheduled function |

### Mobile — Components
| File | Action | Purpose |
|------|--------|---------|
| `apps/mobile/src/components/InterestedDriversList.tsx` | Create | Sender-side list of interested drivers |
| `apps/mobile/src/components/DriverProfileModal.tsx` | Create | Full-screen driver profile with reviews + select button |
| `apps/mobile/src/components/SelectionCountdown.tsx` | Create | Reusable countdown timer from `selectionExpiresAt` |
| `apps/mobile/src/components/DriverConfirmBanner.tsx` | Create | Driver-side confirmation banner with accept/decline |

### Mobile — Screens & Hooks
| File | Action | Purpose |
|------|--------|---------|
| `apps/mobile/src/hooks/useDelivery.ts` | Modify | Add `selectDriver`, `confirmSelection`, `declineSelection`, `cancelSelectedDriver`, `withdrawFromInterest` methods |
| `apps/mobile/src/screens/sender/DeliveryDetailScreen.tsx` | Modify | Replace `DriverApprovalCard` section with `InterestedDriversList` |
| `apps/mobile/src/screens/driver/DeliveryDetailScreen.tsx` | Modify | Add `DriverConfirmBanner` when driver is selected |

### Config
| File | Action | Purpose |
|------|--------|---------|
| `firestore.indexes.json` | Modify | Add composite index for selection timeout query |

---

## Chunk 1: Shared Types & Constants

### Task 1: Update Delivery Types

**Files:**
- Modify: `shared/src/types/delivery.ts`

- [ ] **Step 1: Add InterestedDriver interface and new fields to Delivery**

Add before the `Delivery` interface:

```typescript
export type InterestedDriverStatus = 'interested' | 'selected' | 'confirmed' | 'declined' | 'cancelled' | 'withdrawn';

export interface InterestedDriver {
  uid: string;
  name: string;
  photoUrl: string | null;
  rating: number;
  completedDeliveries: number;
  distanceKm: number;
  expressedAt: Timestamp;
  status: InterestedDriverStatus;
}
```

Add to the `Delivery` interface:

```typescript
  interestedDrivers?: InterestedDriver[];
  selectedDriverId?: string | null;
  selectionExpiresAt?: Timestamp | null;
```

- [ ] **Step 2: Rebuild shared tgz**

```bash
cd shared && pnpm build && pnpm pack
cp mooviz-shared-1.0.0.tgz ../functions/mooviz-shared-1.0.0.tgz
cp mooviz-shared-1.0.0.tgz ../functions/shared-bundle/mooviz-shared-1.0.0.tgz
cd ../functions && pnpm install
```

- [ ] **Step 3: Commit**

```bash
git add shared/src/types/delivery.ts shared/mooviz-shared-1.0.0.tgz functions/mooviz-shared-1.0.0.tgz functions/shared-bundle/mooviz-shared-1.0.0.tgz
git commit -m "feat(shared): add InterestedDriver type and multi-driver fields to Delivery"
```

### Task 2: Update Status Transitions

**Files:**
- Modify: `shared/src/constants/statuses.ts`

- [ ] **Step 1: Add new transitions**

In `STATUS_TRANSITIONS`:
- Add `"waiting"` to `new`'s array: `new: ["pending", "waiting", "cancelled"]`
- Add `"new"` to `waiting`'s array: `waiting: ["picked_up", "cancelled", "new"]`

In `TRANSITION_ACTORS`:
- Add: `"new -> waiting": ["system"]`
- Add: `"waiting -> new": ["sender"]`

- [ ] **Step 2: Rebuild shared tgz** (same as Task 1 Step 2)

- [ ] **Step 3: Commit**

```bash
git add shared/src/constants/statuses.ts shared/mooviz-shared-1.0.0.tgz functions/mooviz-shared-1.0.0.tgz functions/shared-bundle/mooviz-shared-1.0.0.tgz
git commit -m "feat(shared): add new→waiting and waiting→new status transitions"
```

### Task 3: Add Notification Event Types

**Files:**
- Modify: `shared/src/constants/notifications.ts`

- [ ] **Step 1: Add new notification events**

Add to `NotificationEventType`:
- `"driver_selected"` — sent to selected driver
- `"driver_confirmed"` — sent to sender when driver confirms
- `"driver_declined"` — sent to sender when driver declines
- `"selection_cancelled"` — sent to cancelled driver
- `"selection_timeout"` — sent to sender + timed-out driver

Add templates with Hebrew strings matching the spec.

- [ ] **Step 2: Rebuild shared tgz + commit**

```bash
git add shared/src/constants/notifications.ts shared/mooviz-shared-1.0.0.tgz functions/mooviz-shared-1.0.0.tgz functions/shared-bundle/mooviz-shared-1.0.0.tgz
git commit -m "feat(shared): add notification events for multi-driver selection flow"
```

---

## Chunk 2: Cloud Functions — Core Callables

### Task 4: Rewrite `expressInterest`

**Files:**
- Modify: `functions/src/callable/deliveryCallable.ts` (lines 238-294)

- [ ] **Step 1: Rewrite expressInterest to append to interestedDrivers array**

Replace the current `expressInterest` function (lines 238-294) with:

```typescript
export const expressInterest = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

  const driverData = await assertUserRole(db, uid, "driver");
  const { deliveryId } = request.data;
  if (!deliveryId) throw new HttpsError("invalid-argument", "deliveryId is required");

  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  // Validate status
  if (delivery.status !== "new") {
    throw new HttpsError("failed-precondition", "Delivery must be in 'new' status");
  }

  // Prevent driver from expressing interest in own delivery
  if (delivery.senderId === uid) {
    throw new HttpsError("permission-denied", "Cannot express interest in your own delivery");
  }

  // Transaction: atomic read-check-append
  await db.runTransaction(async (txn) => {
    const freshDoc = await txn.get(ref);
    const freshData = freshDoc.data()!;
    const interested: InterestedDriver[] = freshData.interestedDrivers || [];

    // Check cap
    if (interested.length >= 30) {
      throw new HttpsError("resource-exhausted", "Maximum interested drivers reached");
    }

    // Check duplicate or struck-through
    const existing = interested.find((d: any) => d.uid === uid);
    if (existing) {
      if (existing.status === 'withdrawn') {
        // Re-entry after withdrawal: update status back to interested
        const updated = interested.map((d: any) =>
          d.uid === uid ? { ...d, status: 'interested', expressedAt: admin.firestore.Timestamp.now() } : d
        );
        txn.update(ref, { interestedDrivers: updated, updatedAt: admin.firestore.Timestamp.now() });
        return;
      }
      throw new HttpsError("already-exists", "Already expressed interest or previously rejected");
    }

    // Compute distance from pickup
    const pickupLat = freshData.pickup?.lat ?? freshData.pickup?.latitude;
    const pickupLng = freshData.pickup?.lng ?? freshData.pickup?.longitude;
    const driverLat = driverData.location?.lat;
    const driverLng = driverData.location?.lng;
    let distanceKm = 0;
    if (pickupLat && pickupLng && driverLat && driverLng) {
      distanceKm = haversineKm(pickupLat, pickupLng, driverLat, driverLng);
    }

    const entry = {
      uid,
      name: driverData.nickname || driverData.fullName || "",
      photoUrl: driverData.profilePhotoURL || null,
      rating: driverData.ratingAsDriver?.average ?? 0,
      completedDeliveries: driverData.completedDeliveries ?? 0,
      distanceKm: Math.round(distanceKm * 10) / 10,
      expressedAt: admin.firestore.Timestamp.now(),
      status: "interested",
    };

    txn.update(ref, {
      interestedDrivers: admin.firestore.FieldValue.arrayUnion(entry),
      updatedAt: admin.firestore.Timestamp.now(),
    });
  });

  // Fire-and-forget: notify sender
  const driverName = driverData.nickname || driverData.fullName || "";
  sendPushNotification(
    delivery.senderId,
    "נהג חדש מעוניין",
    `${driverName} רוצה לאסוף את המשלוח שלך`,
    { event: "driver_interested", deliveryId, driverName }
  ).catch((err: unknown) => console.error("expressInterest notification failed:", err));

  return { success: true };
});
```

Note: Add a `haversineKm` helper at the top of the file if not already present (check — it exists in `geohashService.ts` but may not be exported). If not exported, add a local copy:

```typescript
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

- [ ] **Step 2: Build and verify**

```bash
cd functions && npm run build
```

Expected: Clean build, no errors.

- [ ] **Step 3: Commit**

```bash
git add functions/src/callable/deliveryCallable.ts
git commit -m "feat(functions): rewrite expressInterest for multi-driver interest array"
```

### Task 5: Add `selectDriver` callable

**Files:**
- Modify: `functions/src/callable/deliveryCallable.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Add selectDriver function**

Add after `expressInterest` in `deliveryCallable.ts`:

```typescript
export const selectDriver = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

  const { deliveryId, driverUid } = request.data;
  if (!deliveryId || !driverUid) {
    throw new HttpsError("invalid-argument", "deliveryId and driverUid are required");
  }

  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  if (delivery.senderId !== uid) {
    throw new HttpsError("permission-denied", "Only the sender can select a driver");
  }

  const SELECTION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

  await db.runTransaction(async (txn) => {
    const freshDoc = await txn.get(ref);
    const freshData = freshDoc.data()!;

    if (freshData.status !== "new") {
      throw new HttpsError("failed-precondition", "Delivery must be in 'new' status");
    }
    if (freshData.selectedDriverId) {
      throw new HttpsError("failed-precondition", "Another driver is already selected, wait or cancel first");
    }

    const interested: any[] = freshData.interestedDrivers || [];
    const driverEntry = interested.find((d) => d.uid === driverUid && d.status === "interested");
    if (!driverEntry) {
      throw new HttpsError("not-found", "Driver not found in interested list or not available");
    }

    // Update driver status in array
    const updated = interested.map((d) =>
      d.uid === driverUid ? { ...d, status: "selected" } : d
    );

    const now = admin.firestore.Timestamp.now();
    txn.update(ref, {
      interestedDrivers: updated,
      selectedDriverId: driverUid,
      selectionExpiresAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + SELECTION_TIMEOUT_MS),
      updatedAt: now,
    });
  });

  // Notify selected driver only
  const interested: any[] = delivery.interestedDrivers || [];
  const driverName = interested.find((d: any) => d.uid === driverUid)?.name || "";
  sendPushNotification(
    driverUid,
    "השולח בחר בך!",
    "אשר את המשלוח תוך 15 דקות",
    { event: "driver_selected", deliveryId }
  ).catch((err: unknown) => console.error("selectDriver notification failed:", err));

  console.log(`selectDriver: sender ${uid} selected driver ${driverUid} for delivery ${deliveryId}`);
  return { success: true };
});
```

- [ ] **Step 2: Export in index.ts**

Add to `functions/src/index.ts`:

```typescript
export { selectDriver } from "./callable/deliveryCallable";
```

- [ ] **Step 3: Build and commit**

```bash
cd functions && npm run build
git add functions/src/callable/deliveryCallable.ts functions/src/index.ts
git commit -m "feat(functions): add selectDriver callable for sender to pick a driver"
```

### Task 6: Add `confirmSelection` and `declineSelection` callables

**Files:**
- Modify: `functions/src/callable/deliveryCallable.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Add confirmSelection**

```typescript
export const confirmSelection = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

  const { deliveryId } = request.data;
  if (!deliveryId) throw new HttpsError("invalid-argument", "deliveryId is required");

  const { delivery, ref } = await getDeliveryOrThrow(deliveryId);

  if (delivery.status !== "new") {
    throw new HttpsError("failed-precondition", "Delivery must be in 'new' status");
  }
  if ((delivery as any).selectedDriverId !== uid) {
    throw new HttpsError("permission-denied", "You are not the selected driver");
  }

  const expiresAt = (delivery as any).selectionExpiresAt;
  if (expiresAt && expiresAt.toMillis() < Date.now()) {
    throw new HttpsError("deadline-exceeded", "Selection has expired");
  }

  // Find driver info from interestedDrivers
  const interested: any[] = (delivery as any).interestedDrivers || [];
  const driverEntry = interested.find((d: any) => d.uid === uid);

  await db.runTransaction(async (txn) => {
    const freshDoc = await txn.get(ref);
    const freshData = freshDoc.data()!;

    if (freshData.status !== "new" || freshData.selectedDriverId !== uid) {
      throw new HttpsError("failed-precondition", "State changed, please try again");
    }

    const now = admin.firestore.Timestamp.now();
    const updatedInterested = (freshData.interestedDrivers || []).map((d: any) =>
      d.uid === uid ? { ...d, status: "confirmed" } : d
    );

    txn.update(ref, {
      status: "waiting",
      driverId: uid,
      driverName: driverEntry?.name || "",
      driverPhotoUrl: driverEntry?.photoUrl || null,
      driverRating: driverEntry?.rating || 0,
      interestedDrivers: updatedInterested,
      selectedDriverId: null,
      selectionExpiresAt: null,
      statusHistory: admin.firestore.FieldValue.arrayUnion({
        status: "waiting",
        timestamp: now,
        actor: uid,
        note: "Driver confirmed selection",
      }),
      updatedAt: now,
    });

    // Create chat
    const chatRef = db.collection("chats").doc();
    txn.set(chatRef, {
      deliveryId,
      participants: [freshData.senderId, uid],
      lastMessage: "",
      lastMessageAt: now,
      lastSenderId: "",
      createdAt: now,
      closed: false,
    });
    txn.update(ref, { chatId: chatRef.id });
  });

  // Notify sender
  sendPushNotification(
    delivery.senderId,
    "הנהג אישר!",
    `המשלוח שויך ל-${driverEntry?.name || "נהג"}`,
    { event: "driver_confirmed", deliveryId }
  ).catch((err: unknown) => console.error("confirmSelection notification failed:", err));

  console.log(`confirmSelection: driver ${uid} confirmed for delivery ${deliveryId}`);
  return { success: true };
});
```

- [ ] **Step 2: Add declineSelection**

```typescript
export const declineSelection = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

  const { deliveryId } = request.data;
  if (!deliveryId) throw new HttpsError("invalid-argument", "deliveryId is required");

  const { ref } = await getDeliveryOrThrow(deliveryId);

  let senderId = "";

  await db.runTransaction(async (txn) => {
    const freshDoc = await txn.get(ref);
    const freshData = freshDoc.data()!;
    senderId = freshData.senderId;

    if (freshData.selectedDriverId !== uid) {
      throw new HttpsError("permission-denied", "You are not the selected driver");
    }

    const now = admin.firestore.Timestamp.now();
    const interested: any[] = freshData.interestedDrivers || [];
    const updated = interested.map((d: any) =>
      d.uid === uid ? { ...d, status: "declined" } : d
    );

    txn.update(ref, {
      interestedDrivers: updated,
      selectedDriverId: null,
      selectionExpiresAt: null,
      updatedAt: now,
    });
  });

  // Notify sender
  sendPushNotification(
    senderId,
    "הנהג דחה",
    "בחר נהג אחר מהרשימה",
    { event: "driver_declined", deliveryId }
  ).catch((err: unknown) => console.error("declineSelection notification failed:", err));

  console.log(`declineSelection: driver ${uid} declined for delivery ${deliveryId}`);
  return { success: true };
});
```

- [ ] **Step 3: Export in index.ts, build, commit**

```bash
# Add exports to index.ts:
# export { confirmSelection, declineSelection } from "./callable/deliveryCallable";

cd functions && npm run build
git add functions/src/callable/deliveryCallable.ts functions/src/index.ts
git commit -m "feat(functions): add confirmSelection and declineSelection callables"
```

### Task 7: Add `cancelSelectedDriver` and `withdrawFromInterest` callables

**Files:**
- Modify: `functions/src/callable/deliveryCallable.ts`
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Add cancelSelectedDriver**

```typescript
export const cancelSelectedDriver = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

  const { deliveryId } = request.data;
  if (!deliveryId) throw new HttpsError("invalid-argument", "deliveryId is required");

  const { ref } = await getDeliveryOrThrow(deliveryId);

  let cancelledDriverId = "";

  await db.runTransaction(async (txn) => {
    const freshDoc = await txn.get(ref);
    const freshData = freshDoc.data()!;

    if (freshData.senderId !== uid) {
      throw new HttpsError("permission-denied", "Only the sender can cancel the selected driver");
    }
    if (freshData.status !== "waiting") {
      throw new HttpsError("failed-precondition", "Delivery must be in 'waiting' status");
    }
    if (!freshData.driverId) {
      throw new HttpsError("failed-precondition", "No driver assigned");
    }

    cancelledDriverId = freshData.driverId;
    const now = admin.firestore.Timestamp.now();
    const interested: any[] = freshData.interestedDrivers || [];
    const updated = interested.map((d: any) =>
      d.uid === cancelledDriverId ? { ...d, status: "cancelled" } : d
    );

    txn.update(ref, {
      status: "new",
      driverId: null,
      driverName: null,
      driverPhotoUrl: null,
      driverRating: null,
      interestedDrivers: updated,
      selectedDriverId: null,
      selectionExpiresAt: null,
      statusHistory: admin.firestore.FieldValue.arrayUnion({
        status: "new",
        timestamp: now,
        actor: uid,
        note: "Sender cancelled selected driver, reverted to new",
      }),
      updatedAt: now,
    });
  });

  // Notify cancelled driver
  sendPushNotification(
    cancelledDriverId,
    "השולח ביטל את הבחירה",
    "המשלוח הוחזר לרשימה",
    { event: "selection_cancelled", deliveryId }
  ).catch((err: unknown) => console.error("cancelSelectedDriver notification failed:", err));

  console.log(`cancelSelectedDriver: sender ${uid} cancelled driver ${cancelledDriverId} for delivery ${deliveryId}`);
  return { success: true };
});
```

- [ ] **Step 2: Add withdrawFromInterest**

```typescript
export const withdrawFromInterest = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required");

  const { deliveryId } = request.data;
  if (!deliveryId) throw new HttpsError("invalid-argument", "deliveryId is required");

  const { ref } = await getDeliveryOrThrow(deliveryId);

  await db.runTransaction(async (txn) => {
    const freshDoc = await txn.get(ref);
    const freshData = freshDoc.data()!;

    const interested: any[] = freshData.interestedDrivers || [];
    const entry = interested.find((d: any) => d.uid === uid);

    if (!entry || entry.status !== "interested") {
      throw new HttpsError("failed-precondition", "Not in interested list or already selected/declined");
    }

    const updated = interested.map((d: any) =>
      d.uid === uid ? { ...d, status: "withdrawn" } : d
    );

    txn.update(ref, {
      interestedDrivers: updated,
      updatedAt: admin.firestore.Timestamp.now(),
    });
  });

  console.log(`withdrawFromInterest: driver ${uid} withdrew from delivery ${deliveryId}`);
  return { success: true };
});
```

- [ ] **Step 3: Export in index.ts, build, commit**

```bash
cd functions && npm run build
git add functions/src/callable/deliveryCallable.ts functions/src/index.ts
git commit -m "feat(functions): add cancelSelectedDriver and withdrawFromInterest callables"
```

### Task 8: Add `selectionTimeout` scheduled function

**Files:**
- Create: `functions/src/scheduled/selectionTimeout.ts`
- Modify: `functions/src/index.ts`
- Modify: `firestore.indexes.json`

- [ ] **Step 1: Create selectionTimeout.ts**

```typescript
import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { sendPushNotification } from "../services/notificationService";

const db = admin.firestore();

export const selectionTimeout = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "Asia/Jerusalem",
    retryCount: 1,
  },
  async () => {
    const now = admin.firestore.Timestamp.now();

    const snapshot = await db
      .collection("deliveries")
      .where("status", "==", "new")
      .where("selectionExpiresAt", "<=", now)
      .limit(50)
      .get();

    if (snapshot.empty) return;

    console.log(`[selectionTimeout] Found ${snapshot.size} expired selections`);

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        const selectedDriverId = data.selectedDriverId;
        if (!selectedDriverId) continue; // safety check

        const interested: any[] = data.interestedDrivers || [];
        const updated = interested.map((d: any) =>
          d.uid === selectedDriverId ? { ...d, status: "declined" } : d
        );

        await doc.ref.update({
          interestedDrivers: updated,
          selectedDriverId: null,
          selectionExpiresAt: null,
          updatedAt: now,
        });

        // Notify sender
        await sendPushNotification(
          data.senderId,
          "הנהג לא הגיב בזמן",
          "בחר נהג אחר מהרשימה",
          { event: "selection_timeout", deliveryId: doc.id }
        ).catch(() => {});

        // Notify timed-out driver
        await sendPushNotification(
          selectedDriverId,
          "פג תוקף הבחירה",
          "לא אישרת בזמן, השולח יבחר נהג אחר",
          { event: "selection_timeout", deliveryId: doc.id }
        ).catch(() => {});

        console.log(`[selectionTimeout] Expired selection for delivery ${doc.id}, driver ${selectedDriverId}`);
      } catch (error) {
        console.error(`[selectionTimeout] Error processing ${doc.id}:`, error);
      }
    }
  }
);
```

- [ ] **Step 2: Add Firestore index**

Add to `firestore.indexes.json`:

```json
{
  "collectionGroup": "deliveries",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "selectionExpiresAt", "order": "ASCENDING" }
  ]
}
```

- [ ] **Step 3: Export in index.ts, build, commit**

```bash
# Add to index.ts:
# export { selectionTimeout } from "./scheduled/selectionTimeout";

cd functions && npm run build
git add functions/src/scheduled/selectionTimeout.ts functions/src/index.ts firestore.indexes.json
git commit -m "feat(functions): add selectionTimeout scheduled function (1-min cron)"
```

- [ ] **Step 4: Deploy functions and indexes**

```bash
firebase deploy --only functions,firestore:indexes
```

---

## Chunk 3: Mobile — Hooks & New Components

### Task 9: Update `useDelivery` hook

**Files:**
- Modify: `apps/mobile/src/hooks/useDelivery.ts`

- [ ] **Step 1: Add new methods to UseDeliveryResult interface**

Add to the `UseDeliveryResult` interface:

```typescript
selectDriver: (deliveryId: string, driverUid: string) => Promise<void>;
confirmSelection: (deliveryId: string) => Promise<void>;
declineSelection: (deliveryId: string) => Promise<void>;
cancelSelectedDriver: (deliveryId: string) => Promise<void>;
withdrawFromInterest: (deliveryId: string) => Promise<void>;
```

- [ ] **Step 2: Implement the methods**

Add inside `useDelivery` function, after existing `withdrawInterest`:

```typescript
const selectDriver = useCallback(async (deliveryId: string, driverUid: string) => {
  const fn = functions().httpsCallable('selectDriver');
  await fn({ deliveryId, driverUid });
}, []);

const confirmSelection = useCallback(async (deliveryId: string) => {
  const fn = functions().httpsCallable('confirmSelection');
  await fn({ deliveryId });
}, []);

const declineSelection = useCallback(async (deliveryId: string) => {
  const fn = functions().httpsCallable('declineSelection');
  await fn({ deliveryId });
}, []);

const cancelSelectedDriver = useCallback(async (deliveryId: string) => {
  const fn = functions().httpsCallable('cancelSelectedDriver');
  await fn({ deliveryId });
}, []);

const withdrawFromInterest = useCallback(async (deliveryId: string) => {
  const fn = functions().httpsCallable('withdrawFromInterest');
  await fn({ deliveryId });
}, []);
```

Add to the return object.

- [ ] **Step 3: Add InterestedDriver fields to Delivery type in hook**

Add to the `Delivery` interface in useDelivery.ts:

```typescript
interestedDrivers?: Array<{
  uid: string;
  name: string;
  photoUrl: string | null;
  rating: number;
  completedDeliveries: number;
  distanceKm: number;
  expressedAt?: Date | string;
  status: string;
}>;
selectedDriverId?: string | null;
selectionExpiresAt?: Date | string | null;
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/hooks/useDelivery.ts
git commit -m "feat(mobile): add multi-driver selection methods to useDelivery hook"
```

### Task 10: Create `SelectionCountdown` component

**Files:**
- Create: `apps/mobile/src/components/SelectionCountdown.tsx`

- [ ] **Step 1: Create countdown timer component**

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  expiresAt: Date | string;
  label: string;
  onExpired?: () => void;
}

export function SelectionCountdown({ expiresAt, label, onExpired }: Props): React.JSX.Element | null {
  const { colors } = useTheme();
  const [remaining, setRemaining] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const target = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;

    const tick = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('00:00');
        setExpired(true);
        onExpired?.();
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  if (expired) return null;

  return (
    <View style={[styles.container, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.timer}>⏱ {remaining}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#92400E' },
  timer: { fontSize: 16, fontWeight: '800', color: '#92400E' },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/SelectionCountdown.tsx
git commit -m "feat(mobile): add SelectionCountdown reusable timer component"
```

### Task 11: Create `InterestedDriversList` component

**Files:**
- Create: `apps/mobile/src/components/InterestedDriversList.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { AvatarCircle } from './AvatarCircle';
import { SelectionCountdown } from './SelectionCountdown';

interface InterestedDriverEntry {
  uid: string;
  name: string;
  photoUrl: string | null;
  rating: number;
  completedDeliveries: number;
  distanceKm: number;
  status: string;
}

interface Props {
  interestedDrivers: InterestedDriverEntry[];
  selectedDriverId: string | null;
  selectionExpiresAt: Date | string | null;
  onSelect: (driverUid: string) => void;
  onViewProfile: (driverUid: string) => void;
  onCancelSelection: () => void;
}

const STRUCK_STATUSES = ['declined', 'cancelled'];

export function InterestedDriversList({
  interestedDrivers,
  selectedDriverId,
  selectionExpiresAt,
  onSelect,
  onViewProfile,
  onCancelSelection,
}: Props): React.JSX.Element {
  const { colors } = useTheme();

  // Filter: show interested + selected + struck-through, hide withdrawn
  const visible = interestedDrivers.filter((d) => d.status !== 'withdrawn');
  const activeCount = visible.filter((d) => d.status === 'interested' || d.status === 'selected').length;
  const isSelectionPending = !!selectedDriverId;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: '#1a73e8' }]}>
      <Text style={[styles.header, { color: colors.textPrimary }]}>
        🚗 נהגים מעוניינים ({activeCount})
      </Text>

      {/* Countdown banner when a driver is selected */}
      {isSelectionPending && selectionExpiresAt && (
        <SelectionCountdown
          expiresAt={selectionExpiresAt}
          label="ממתין לאישור הנהג"
        />
      )}

      {visible.map((driver) => {
        const isStruck = STRUCK_STATUSES.includes(driver.status);
        const isSelected = driver.uid === selectedDriverId;
        const isDimmed = isSelectionPending && !isSelected && !isStruck;

        return (
          <TouchableOpacity
            key={driver.uid}
            onPress={() => !isStruck && !isDimmed && onViewProfile(driver.uid)}
            activeOpacity={isStruck || isDimmed ? 1 : 0.7}
            style={[
              styles.driverRow,
              { backgroundColor: isSelected ? '#F0FFF4' : isStruck ? '#F9FAFB' : '#F0F7FF', borderColor: isSelected ? '#22c55e' : colors.border },
              isDimmed && { opacity: 0.4 },
            ]}
          >
            <AvatarCircle name={driver.name} photoUrl={driver.photoUrl} size={36} />
            <View style={styles.driverInfo}>
              <Text
                style={[
                  styles.driverName,
                  { color: isStruck ? '#9CA3AF' : colors.textPrimary },
                  isStruck && styles.strikethrough,
                ]}
                numberOfLines={1}
              >
                {driver.name}
              </Text>
              <Text style={[styles.driverMeta, { color: colors.textSecondary }]}>
                ⭐ {driver.rating.toFixed(1)} • {driver.completedDeliveries} משלוחים • {driver.distanceKm} ק״מ
              </Text>
              {isStruck && (
                <Text style={styles.struckLabel}>
                  {driver.status === 'declined' ? 'דחה' : 'בוטל'}
                </Text>
              )}
            </View>
            {!isStruck && !isDimmed && !isSelected && (
              <TouchableOpacity
                style={styles.selectBtn}
                onPress={() => onSelect(driver.uid)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.selectBtnText}>בחר</Text>
              </TouchableOpacity>
            )}
            {isSelected && (
              <Text style={styles.selectedLabel}>נבחר ✓</Text>
            )}
          </TouchableOpacity>
        );
      })}

      {isSelectionPending && (
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancelSelection}>
          <Text style={styles.cancelBtnText}>בטל בחירה</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    marginBottom: 12,
  },
  header: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  driverInfo: {
    flex: 1,
    minWidth: 0,
  },
  driverName: {
    fontSize: 14,
    fontWeight: '600',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  driverMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  struckLabel: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '600',
    marginTop: 2,
  },
  selectBtn: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  selectBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#22c55e',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  cancelBtnText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/InterestedDriversList.tsx
git commit -m "feat(mobile): add InterestedDriversList component for sender delivery detail"
```

### Task 12: Create `DriverProfileModal` component

**Files:**
- Create: `apps/mobile/src/components/DriverProfileModal.tsx`

- [ ] **Step 1: Create the modal**

```typescript
import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../theme/ThemeContext';
import { AvatarCircle } from './AvatarCircle';
import { RatingsHistoryModal } from './RatingsHistoryModal';

interface Props {
  visible: boolean;
  onClose: () => void;
  driverUid: string;
  driverName: string;
  driverPhotoUrl: string | null;
  driverRating: number;
  driverCompletedDeliveries: number;
  driverDistanceKm: number;
  onSelect: () => void;
  selectionPending?: boolean;
}

interface ReviewDoc {
  id: string;
  rating: number;
  comment: string;
  createdAt: any;
}

export function DriverProfileModal({
  visible, onClose, driverUid, driverName, driverPhotoUrl,
  driverRating, driverCompletedDeliveries, driverDistanceKm,
  onSelect, selectionPending,
}: Props): React.JSX.Element {
  const { colors } = useTheme();
  const [reviews, setReviews] = useState<ReviewDoc[]>([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [ratingsModalVisible, setRatingsModalVisible] = useState(false);

  useEffect(() => {
    if (!visible || !driverUid) return;
    setLoadingReviews(true);

    const ratingsRef = firestore().collection('ratings');
    const query = ratingsRef
      .where('targetUserId', '==', driverUid)
      .where('role', '==', 'sender')
      .orderBy('createdAt', 'desc')
      .limit(2);

    Promise.all([
      query.get(),
      ratingsRef
        .where('targetUserId', '==', driverUid)
        .where('role', '==', 'sender')
        .count()
        .get(),
    ]).then(([snap, countSnap]) => {
      setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReviewDoc)));
      setTotalReviews(countSnap.data().count);
    }).catch(() => {})
    .finally(() => setLoadingReviews(false));
  }, [visible, driverUid]);

  const renderStars = (rating: number) => (
    <Text style={styles.stars}>
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
    </Text>
  );

  const formatDate = (ts: any): string => {
    if (!ts?.toDate) return '';
    try {
      return ts.toDate().toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
    } catch { return ''; }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <AvatarCircle name={driverName} photoUrl={driverPhotoUrl} size={72} />
          <Text style={styles.headerName}>{driverName}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#FFB800' }]}>{driverRating.toFixed(1)}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>דירוג</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#1a73e8' }]}>{driverCompletedDeliveries}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>משלוחים</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#22c55e' }]}>{driverDistanceKm}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>ק״מ ממך</Text>
          </View>
        </View>

        {/* Reviews */}
        <ScrollView style={styles.reviewsSection} contentContainerStyle={{ paddingBottom: 100 }}>
          <Text style={[styles.reviewsTitle, { color: colors.textPrimary }]}>
            ביקורות אחרונות
          </Text>

          {loadingReviews ? (
            <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
          ) : reviews.length === 0 ? (
            <Text style={[styles.noReviews, { color: colors.textSecondary }]}>אין ביקורות עדיין</Text>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.reviewHeader}>
                  {renderStars(review.rating)}
                  <Text style={[styles.reviewDate, { color: colors.textTertiary }]}>{formatDate(review.createdAt)}</Text>
                </View>
                {review.comment ? (
                  <Text style={[styles.reviewComment, { color: colors.textPrimary }]} numberOfLines={3}>
                    &quot;{review.comment}&quot;
                  </Text>
                ) : (
                  <Text style={[styles.noComment, { color: colors.textSecondary }]}>ללא תגובה</Text>
                )}
              </View>
            ))
          )}

          {totalReviews > 2 && (
            <TouchableOpacity onPress={() => setRatingsModalVisible(true)} style={styles.showAllBtn}>
              <Text style={styles.showAllText}>הצג את כל {totalReviews} הביקורות ←</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Select Button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.selectButton, selectionPending && styles.selectButtonDisabled]}
            onPress={onSelect}
            disabled={selectionPending}
          >
            <Text style={styles.selectButtonText}>
              {selectionPending ? 'ממתין לאישור נהג אחר...' : '✓ בחר נהג זה'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <RatingsHistoryModal
        visible={ratingsModalVisible}
        onClose={() => setRatingsModalVisible(false)}
        userId={driverUid}
        mode="driver"
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    backgroundColor: '#1a73e8',
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  closeBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 56 : 16, left: 16,
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  closeBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  headerName: { color: '#FFF', fontSize: 20, fontWeight: '700', marginTop: 10 },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 20,
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 36 },
  reviewsSection: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  reviewsTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  noReviews: { fontSize: 14, textAlign: 'center', marginTop: 20 },
  reviewCard: { borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  stars: { fontSize: 14, color: '#FFB800' },
  reviewDate: { fontSize: 11 },
  reviewComment: { fontSize: 13, fontStyle: 'italic', writingDirection: 'rtl' },
  noComment: { fontSize: 12, fontStyle: 'italic' },
  showAllBtn: { alignItems: 'center', paddingVertical: 10 },
  showAllText: { fontSize: 13, color: '#1a73e8', fontWeight: '600' },
  bottomBar: { padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16 },
  selectButton: {
    backgroundColor: '#22c55e', borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  selectButtonDisabled: { opacity: 0.5 },
  selectButtonText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/DriverProfileModal.tsx
git commit -m "feat(mobile): add DriverProfileModal with reviews and select button"
```

### Task 13: Create `DriverConfirmBanner` component

**Files:**
- Create: `apps/mobile/src/components/DriverConfirmBanner.tsx`

- [ ] **Step 1: Create the banner for driver's delivery detail**

Yellow card with:
- "🔔 השולח בחר בך!"
- SelectionCountdown showing time remaining
- Green "אשר" button + Red "דחה" button
- Loading state while confirming/declining

Props:
```typescript
interface Props {
  deliveryId: string;
  expiresAt: Date | string;
  onConfirm: () => void;
  onDecline: () => void;
  isLoading?: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/components/DriverConfirmBanner.tsx
git commit -m "feat(mobile): add DriverConfirmBanner for driver confirmation flow"
```

---

## Chunk 4: Mobile — Screen Integration

### Task 14: Integrate into Sender Delivery Detail Screen

**Files:**
- Modify: `apps/mobile/src/screens/sender/DeliveryDetailScreen.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { InterestedDriversList } from '../../components/InterestedDriversList';
import { DriverProfileModal } from '../../components/DriverProfileModal';
```

- [ ] **Step 2: Add state for profile modal**

```typescript
const [profileModalVisible, setProfileModalVisible] = useState(false);
const [profileDriverUid, setProfileDriverUid] = useState<string | null>(null);
```

- [ ] **Step 3: Add handler functions**

```typescript
const { selectDriver, cancelSelectedDriver } = useDelivery({ userId: currentUser?.uid, role: 'sender' });

const handleSelectDriver = async (driverUid: string) => {
  try {
    setLoadingVisible(true);
    await selectDriver(delivery.id, driverUid);
    setProfileModalVisible(false);
    carAlert.show('success', t('common.success'), 'הנהג נבחר, ממתין לאישור');
  } catch (err) {
    carAlert.show('error', t('common.error'), (err as Error).message);
  } finally {
    setLoadingVisible(false);
  }
};

const handleViewProfile = (driverUid: string) => {
  setProfileDriverUid(driverUid);
  setProfileModalVisible(true);
};

const handleCancelSelection = async () => {
  try {
    await cancelSelectedDriver(delivery.id);
  } catch (err) {
    carAlert.show('error', t('common.error'), (err as Error).message);
  }
};
```

- [ ] **Step 4: Replace DriverApprovalCard with InterestedDriversList**

Find the section where `DriverApprovalCard` is currently rendered (around the timeline/driver card area) and add the `InterestedDriversList` section instead:

```tsx
{/* Interested Drivers List — shown when status is 'new' and drivers have expressed interest */}
{delivery.status === 'new' && (delivery as any).interestedDrivers?.length > 0 && (
  <InterestedDriversList
    interestedDrivers={(delivery as any).interestedDrivers}
    selectedDriverId={(delivery as any).selectedDriverId}
    selectionExpiresAt={(delivery as any).selectionExpiresAt}
    onSelect={handleSelectDriver}
    onViewProfile={handleViewProfile}
    onCancelSelection={handleCancelSelection}
  />
)}
```

Keep the existing `DriverApprovalCard` for backward compat with deliveries already in `pending` status.

- [ ] **Step 5: Add DriverProfileModal**

Add at the bottom, before the closing `</ScrollView>`:

```tsx
{profileDriverUid && (() => {
  const driver = (delivery as any).interestedDrivers?.find((d: any) => d.uid === profileDriverUid);
  if (!driver) return null;
  return (
    <DriverProfileModal
      visible={profileModalVisible}
      onClose={() => setProfileModalVisible(false)}
      driverUid={driver.uid}
      driverName={driver.name}
      driverPhotoUrl={driver.photoUrl}
      driverRating={driver.rating}
      driverCompletedDeliveries={driver.completedDeliveries}
      driverDistanceKm={driver.distanceKm}
      onSelect={() => handleSelectDriver(driver.uid)}
      selectionPending={!!(delivery as any).selectedDriverId}
    />
  );
})()}
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/screens/sender/DeliveryDetailScreen.tsx
git commit -m "feat(mobile): integrate InterestedDriversList + DriverProfileModal in sender detail"
```

### Task 15: Integrate into Driver Delivery Detail Screen

**Files:**
- Modify: `apps/mobile/src/screens/driver/DeliveryDetailScreen.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { DriverConfirmBanner } from '../../components/DriverConfirmBanner';
```

- [ ] **Step 2: Add confirm/decline handlers**

```typescript
const { confirmSelection, declineSelection } = useDelivery({ userId: currentUser?.uid, role: 'driver' });
const [confirmLoading, setConfirmLoading] = useState(false);

const handleConfirmSelection = async () => {
  try {
    setConfirmLoading(true);
    await confirmSelection(deliveryId);
    carAlert.show('success', 'אושר!', 'המשלוח שויך אליך');
  } catch (err) {
    carAlert.show('error', t('common.error'), (err as Error).message);
  } finally {
    setConfirmLoading(false);
  }
};

const handleDeclineSelection = async () => {
  try {
    setConfirmLoading(true);
    await declineSelection(deliveryId);
    carAlert.show('info', 'דחית', 'המשלוח הוחזר לשולח');
    navigation.goBack();
  } catch (err) {
    carAlert.show('error', t('common.error'), (err as Error).message);
  } finally {
    setConfirmLoading(false);
  }
};
```

- [ ] **Step 3: Add DriverConfirmBanner at top of scroll content**

Add right after the summary card section (before the timeline):

```tsx
{/* Driver Confirmation Banner — shown when sender selected this driver */}
{delivery.selectedDriverId === currentUser?.uid && delivery.selectionExpiresAt && (
  <DriverConfirmBanner
    deliveryId={deliveryId}
    expiresAt={delivery.selectionExpiresAt}
    onConfirm={handleConfirmSelection}
    onDecline={handleDeclineSelection}
    isLoading={confirmLoading}
  />
)}
```

- [ ] **Step 4: Include new fields in snapshot mapping**

In the `onSnapshot` handler (around line 80-110), add:

```typescript
selectedDriverId: d.selectedDriverId || null,
selectionExpiresAt: d.selectionExpiresAt?.toDate?.() || null,
interestedDrivers: d.interestedDrivers || [],
```

- [ ] **Step 5: Update express interest button visibility**

Change the condition for showing the express interest button:

```typescript
// Old: isAvailable && !isMyJob
// New: also check if driver already expressed interest
const alreadyInterested = (delivery?.interestedDrivers || []).some(
  (d: any) => d.uid === currentUser?.uid && d.status !== 'withdrawn'
);
const canExpress = delivery?.status === 'new' && !alreadyInterested && delivery?.senderId !== currentUser?.uid;
```

Show a "withdraw" button if already interested and status is 'interested'.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/screens/driver/DeliveryDetailScreen.tsx
git commit -m "feat(mobile): add DriverConfirmBanner and multi-interest UI to driver detail"
```

---

## Chunk 5: Deploy & Verify

### Task 16: Final Build & Deploy

- [ ] **Step 1: Build functions**

```bash
cd functions && npm run build
```

- [ ] **Step 2: Deploy all functions**

```bash
firebase deploy --only functions,firestore:indexes
```

- [ ] **Step 3: Test on device**

Manual QA checklist:
1. Create delivery as sender → status `new`
2. Express interest as driver 1 → sender sees list with 1 driver
3. Express interest as driver 2 → sender sees list with 2 drivers
4. Sender taps driver 1 row → profile modal opens with reviews
5. Sender taps "בחר" → driver 1 gets push notification
6. Sender sees countdown timer (15:00)
7. Driver 1 taps "אשר" → delivery moves to `waiting`
8. Test decline: repeat, driver declines → struck through, sender picks another
9. Test timeout: wait 15 min (or set to 1 min for testing) → auto-decline
10. Test cancel after waiting: sender cancels → reverts to list
11. Verify RTL layout on Hebrew device

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "fix(mobile,functions): final adjustments from manual QA"
```
