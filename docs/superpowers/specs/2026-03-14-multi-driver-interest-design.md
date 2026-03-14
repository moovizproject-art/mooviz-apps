# Multi-Driver Interest System — Design Spec

**Date:** 2026-03-14
**Epic:** Multi-Driver Interest & Selection
**Status:** Draft

## Overview

Replace the single-driver interest model (new → pending → waiting) with a multi-driver bidding system. Multiple drivers express interest in a delivery, the sender reviews and selects one, the selected driver confirms, and only then does the delivery proceed. Unselected drivers are never notified.

## Goals

1. Sender sees multiple interested drivers with ratings, reviews, completed deliveries, and distance
2. Sender can view a driver's full profile and reviews before selecting
3. Selected driver must confirm within 15 minutes
4. If a driver declines/times out or sender cancels, the sender picks another from the list
5. Rejected drivers are struck through with no re-entry
6. Unselected drivers receive no notifications — the delivery silently disappears from their feed when assigned

## Non-Goals

- Drivers do not see other interested drivers (blind bidding)
- No new delivery statuses — `new` is used throughout, `waiting` only after confirmation
- No price negotiation in this epic (handled via existing chat)

## State Machine Changes

The `STATUS_TRANSITIONS` map in `shared/src/constants/statuses.ts` must be updated:

1. **Add `new → waiting`** — direct transition when selected driver confirms (bypasses `pending`)
2. **Add `waiting → new`** — revert when sender cancels selected driver after assignment
3. **Deprecate `pending` status** — no longer used in the multi-driver flow. Keep in `STATUS_TRANSITIONS` for backward compat with existing deliveries already in `pending`, but new deliveries will never enter this state.
4. **Update `TRANSITION_ACTORS`**: `"new → waiting": ["system"]`, `"waiting → new": ["sender"]`
5. **Keep existing `approveDriver`/`declineDriver`/`withdrawInterest` callables** for backward compat with old client versions — they will be removed in a future cleanup epic.

## Driver Withdrawal

A driver who expressed interest can **withdraw** before being selected:

- New callable `withdrawFromInterest`: removes driver's entry from `interestedDrivers` array (sets status to `withdrawn`)
- Validation: driver must be in array with status `interested` (not `selected`/`confirmed`)
- No notification to sender (count just decreases)
- Driver can re-express interest after withdrawing (unlike `declined`/`cancelled` which are permanent)

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Status during bidding | Stay `new` (option C) | Avoids state machine changes that ripple through rules, admin, functions, shared validators |
| Sender selection flow | Quick-select button + tappable profile modal (option C) | Power users go fast, cautious users review first |
| Driver visibility of others | Nothing (option D) | Prevents self-filtering, keeps it simple |
| Notification on selection | Only selected driver | Other drivers don't know, reduces noise |
| Driver confirmation | Required, 15 min timeout | Driver may have changed plans since expressing interest |
| Rejected driver re-entry | Not allowed (option A) | Clean cut, prevents gaming |
| Cancel after waiting | Reverts to list, driver struck through | Handles failed negotiations gracefully |

## Data Model Changes

### Delivery Document — New Fields

```typescript
interface InterestedDriver {
  uid: string;
  name: string;
  photoUrl: string | null;
  rating: number;              // ratingAsDriver.average
  completedDeliveries: number;
  distanceKm: number;          // haversine from pickup point
  expressedAt: Timestamp;
  status: 'interested' | 'selected' | 'confirmed' | 'declined' | 'cancelled';
}

// Added to delivery document:
{
  interestedDrivers: InterestedDriver[];  // replaces single driverId during bidding
  selectedDriverId: string | null;        // currently selected, awaiting confirmation
  selectionExpiresAt: Timestamp | null;   // now + 15 minutes when driver is selected
}
```

### Existing Fields — Behavior Changes

- `driverId`: remains `null` until driver confirms (currently set on express interest)
- `status`: stays `new` during bidding, moves to `waiting` only on confirmation
- `interestedDrivers` array: already exists but currently unused in the multi-driver context

### No New Collections

All data lives on the delivery document. Driver profiles and ratings are fetched on-demand from existing `users` and `ratings` collections.

## Cloud Functions

### `expressInterest` (Modified)

**Current:** Transitions delivery `new` → `pending`, sets `driverId`.
**New:** Appends driver to `interestedDrivers` array. Delivery stays `new`. No status transition.

```
Input:  { deliveryId }
Auth:   Driver (driverUnlocked === true)

Validation:
  - Delivery status === 'new'
  - Driver not already in interestedDrivers (by uid)
  - Driver not struck through (status !== 'declined' | 'cancelled')
  - interestedDrivers.length < 30 (cap to prevent unbounded growth)

⚠️ MUST use db.runTransaction() — read-then-write on array requires atomicity to prevent duplicate entries from concurrent calls.

Action:
  1. Fetch driver profile (name, rating, completedDeliveries, profilePhotoURL)
  2. Compute haversine distance from delivery pickup to driver location
  3. Append to interestedDrivers array:
     { uid, name, photoUrl, rating, completedDeliveries, distanceKm, expressedAt: now, status: 'interested' }
  4. Send push to sender: "נהג חדש מעוניין במשלוח שלך" (new driver interested)

Output: { success: true }
```

### `selectDriver` (New)

```
Input:  { deliveryId, driverUid }
Auth:   Sender (delivery.senderId === caller)

Validation:
  - Delivery status === 'new'
  - selectedDriverId === null (no pending selection)
  - driverUid exists in interestedDrivers with status 'interested'

⚠️ MUST use db.runTransaction() — atomic check-and-set on selectedDriverId to prevent race conditions if sender double-taps or two sessions compete.

Action:
  1. Set selectedDriverId = driverUid
  2. Set selectionExpiresAt = now + 15 minutes
  3. Update driver's entry in interestedDrivers: status = 'selected'
  4. Send push to selected driver only:
     title: "השולח בחר בך!"
     body: "אשר את המשלוח תוך 15 דקות"
     data: { event: 'driver_selected', deliveryId }

Output: { success: true }
```

### `confirmSelection` (New)

```
Input:  { deliveryId }
Auth:   Selected driver (delivery.selectedDriverId === caller)

Validation:
  - Delivery status === 'new'
  - selectedDriverId === caller
  - selectionExpiresAt > now (not expired)

Action:
  1. Update driver entry in interestedDrivers: status = 'confirmed'
  2. Set driverId = caller
  3. Set driverName, driverPhotoUrl, driverRating (denormalize)
  4. Transition status: 'new' → 'waiting'
  5. Add statusHistory entry
  6. Clear selectedDriverId, selectionExpiresAt
  7. Create chat document (existing flow)
  8. Send push to sender:
     title: "הנהג אישר!"
     body: "המשלוח שויך ל-{driverName}"
     data: { event: 'driver_confirmed', deliveryId }

Output: { success: true }
```

### `declineSelection` (New)

```
Input:  { deliveryId }
Auth:   Selected driver (delivery.selectedDriverId === caller)

Validation:
  - Delivery status === 'new'
  - selectedDriverId === caller

Action:
  1. Update driver entry in interestedDrivers: status = 'declined'
  2. Clear selectedDriverId, selectionExpiresAt
  3. Send push to sender:
     title: "הנהג דחה"
     body: "בחר נהג אחר מהרשימה"
     data: { event: 'driver_declined', deliveryId }

Output: { success: true }
```

### `cancelSelectedDriver` (New or modified withdrawInterest)

For when sender cancels the driver after `waiting` status (e.g., price dispute in chat).

```
Input:  { deliveryId }
Auth:   Sender (delivery.senderId === caller)

Validation:
  - Delivery status === 'waiting'
  - driverId is set

Action:
  1. Find driver in interestedDrivers by uid, set status = 'cancelled'
  2. Revert delivery status: 'waiting' → 'new'
  3. Clear driverId, driverName, driverPhotoUrl, driverRating
  4. Clear selectedDriverId, selectionExpiresAt
  5. Add statusHistory entry (reverted)
  6. Send push to cancelled driver:
     title: "השולח ביטל את הבחירה"
     body: "המשלוח הוחזר לרשימה"
     data: { event: 'selection_cancelled', deliveryId }

Output: { success: true }
```

### `selectionTimeout` (Scheduled — every 1 minute)

```
Query: deliveries where:
  - status === 'new'
  - selectedDriverId !== null
  - selectionExpiresAt <= now

Action (per delivery):
  1. Find selected driver in interestedDrivers, set status = 'declined'
  2. Clear selectedDriverId, selectionExpiresAt
  3. Send push to sender: "הנהג לא הגיב בזמן, בחר נהג אחר"
  4. Send push to timed-out driver: "פג תוקף הבחירה"
```

## Firestore Indexes

New composite index required:

```json
{
  "collectionGroup": "deliveries",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "selectedDriverId", "order": "ASCENDING" },
    { "fieldPath": "selectionExpiresAt", "order": "ASCENDING" }
  ]
}
```

## Mobile UI — Sender Side

### Interested Drivers Section (Inline in Delivery Detail)

**Visibility:** `delivery.status === 'new' && interestedDrivers.length > 0`

**Layout:** Below timeline, above map. Blue-bordered card section.

**Header:** "🚗 נהגים מעוניינים ({count})"

**Driver Row (per driver):**
- Avatar (36px circle) + Name + "⭐ {rating} • {deliveries} משלוחים • {distance} ק״מ"
- Blue "בחר" button on the end (quick select)
- Tapping the row (not button) → opens Driver Profile Modal
- Struck-through drivers: grayed out, name with ~~strikethrough~~, no button, status label ("דחה" / "בוטל")

**Selection Pending State:**
- Yellow banner above list: "⏱ ממתין לאישור הנהג ({MM:SS})"
- Countdown timer from `selectionExpiresAt`
- Selected driver highlighted with green border
- Other drivers dimmed (not tappable)

**Data source:** Real-time via existing `onSnapshot` on delivery document. No additional listeners needed — `interestedDrivers` is on the delivery doc.

### Driver Profile Modal (Page Sheet)

**Trigger:** Tap driver row in interested drivers list.

**Layout:**
1. **Header** — blue gradient background, large avatar circle, driver name, "נהג פעיל מאז {date}"
2. **Stats row** — 3 columns: rating (gold), completed deliveries (blue), distance (green)
3. **Recent reviews** — 2 latest reviews from `ratings` collection (targetUserId === driver.uid, role === 'sender'), each with stars + date + comment preview
4. **"Show all X reviews" link** — opens existing `RatingsHistoryModal` with mode='driver'
5. **Select button** — green, full width: "✓ בחר נהג זה"

**Data fetching:** On modal open, fetch latest 2 ratings from `ratings` collection. Use `getCountFromServer` for total count.

### Component: `InterestedDriversList`

New component at `apps/mobile/src/components/InterestedDriversList.tsx`:
- Receives `interestedDrivers` array and callbacks (`onSelect`, `onViewProfile`)
- Renders as a flat list (not FlatList — small list, inside ScrollView)
- Handles struck-through state rendering

### Component: `DriverProfileModal`

New component at `apps/mobile/src/components/DriverProfileModal.tsx`:
- Page sheet modal (presentationStyle="pageSheet")
- Receives `driverUid` and `onSelect` callback
- Fetches ratings on mount
- Reuses existing `RatingsHistoryModal` for full reviews view

## Mobile UI — Driver Side

### Confirmation Banner (Delivery Detail)

**Visibility:** Driver opens a delivery where `selectedDriverId === currentUser.uid`

**Layout:** Yellow card at top of delivery detail:
- "🔔 השולח בחר בך!"
- "אשר את המשלוח תוך {MM:SS}"
- Two buttons: green "אשר" + red "דחה"
- Countdown timer from `selectionExpiresAt`

### No Other Changes

- Drivers don't see other interested drivers
- Express interest button works as before (label may change to "הצע שירות" / "Offer service")
- Feed shows deliveries with status `new` as before

## Security Rules

No Firestore security rule changes needed. All mutations go through Cloud Functions which enforce:

1. Only sender can select/cancel drivers on their delivery
2. Only the selected driver can confirm/decline
3. Drivers can only express interest once per delivery
4. Struck-through drivers cannot re-enter (status check in function)
5. `interestedDrivers` array is part of the delivery document — existing read rules apply

## Shared Type Updates

The `Delivery` interface in `shared/src/types/delivery.ts` must be updated with:
- `interestedDrivers: InterestedDriver[]`
- `selectedDriverId: string | null`
- `selectionExpiresAt: Timestamp | null`

The `InterestedDriver` interface should be defined in `shared/src/types/delivery.ts` and re-exported.

## Feed Behavior During Confirmation Window

While a driver is selected and the 15-minute confirmation window is active:
- The delivery **remains visible** in other drivers' feeds (status is still `new`)
- Other drivers **can still express interest** (they don't know a selection is pending)
- `expressInterest` does NOT check `selectedDriverId` — it just appends to the array
- If the selected driver confirms, the delivery moves to `waiting` and disappears from all feeds
- This is intentional: more interest is always better for the sender as a fallback

## Migration & Backwards Compatibility

- **No migration needed** — new fields (`interestedDrivers`, `selectedDriverId`, `selectionExpiresAt`) default to `[]` / `null`
- **Existing deliveries** — already in `pending`/`waiting`/etc. are unaffected (new flow only applies to `new` deliveries)
- **Old client versions** — will call `expressInterest` which now appends instead of transitioning. Old sender clients won't see the interested drivers list but the delivery will still work if a driver is eventually selected. **Minimum client version should be enforced via remote config** to push users to update.
- **Denormalized data staleness** — driver info (name, rating, completedDeliveries) is snapshot at expression time. May be slightly stale if driver's rating changes between expressing and being reviewed. Acceptable for MVP.

## Error Handling

| Scenario | Handling |
|----------|----------|
| Two senders select simultaneously | Transaction in `selectDriver` — first write wins, second gets "already selected" error |
| Driver confirms after timeout | `confirmSelection` checks `selectionExpiresAt > now`, rejects if expired |
| Network failure during confirm | Client retries, function is idempotent (checks current state) |
| Delivery cancelled during selection | `selectDriver`/`confirmSelection` check delivery status === 'new', reject if cancelled |

## Testing Plan

1. **Unit tests** — Cloud Function logic for each callable (express, select, confirm, decline, cancel, timeout)
2. **Integration test** — Full flow: 3 drivers express interest → sender selects → driver confirms → status = waiting
3. **Edge cases** — timeout expiry, double-select race condition, cancel after waiting, re-express after decline (should fail)
4. **Manual QA** — Hebrew RTL layout, profile modal, countdown timer, push notifications on physical device
