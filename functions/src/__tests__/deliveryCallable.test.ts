/**
 * Tests for functions/src/callable/deliveryCallable.ts
 *
 * Uses firebase-functions-test to wrap onCall functions and mocks
 * Firestore interactions. Tests cover:
 * - createDelivery: field validation, defaults
 * - expressInterest: driver role, duplicate prevention
 * - selectDriver: sender role, driver must be interested
 * - confirmSelection: selected driver, 15-min timeout
 * - confirmPickup: requires proof URL
 * - confirmPayment: both parties must confirm
 * - cancelDelivery: pre-pickup only, tracks cancelledBy
 */

import { HttpsError } from "firebase-functions/v2/https";

// ---------------------------------------------------------------------------
// Mock firebase-admin BEFORE importing the callable module
// ---------------------------------------------------------------------------
const mockTimestamp = {
  toMillis: () => Date.now(),
  toDate: () => new Date(),
};

const mockTimestampNow = jest.fn(() => mockTimestamp);
const mockTimestampFromMillis = jest.fn((ms: number) => ({
  toMillis: () => ms,
  toDate: () => new Date(ms),
}));

const mockArrayUnion = jest.fn((...args: any[]) => ({
  _type: "arrayUnion",
  _elements: args,
}));
const mockIncrement = jest.fn((n: number) => ({
  _type: "increment",
  _value: n,
}));

// Transaction mock
const mockTxnGet = jest.fn();
const mockTxnUpdate = jest.fn();
const mockTxnSet = jest.fn();

const mockTransaction = {
  get: mockTxnGet,
  update: mockTxnUpdate,
  set: mockTxnSet,
};

// Document / collection mock infrastructure
const mockDocGet = jest.fn();
const mockDocUpdate = jest.fn();
const mockDocSet = jest.fn();
const mockCollectionAdd = jest.fn();
const mockWhereGet = jest.fn();

const mockDocRef = {
  get: mockDocGet,
  update: mockDocUpdate,
  set: mockDocSet,
  id: "mock-delivery-id",
  collection: jest.fn(() => ({
    add: jest.fn(),
  })),
};

const mockCollectionRef = {
  doc: jest.fn(() => mockDocRef),
  add: mockCollectionAdd,
  where: jest.fn(() => ({
    where: jest.fn(() => ({
      limit: jest.fn(() => ({
        get: mockWhereGet,
      })),
    })),
    limit: jest.fn(() => ({
      get: mockWhereGet,
    })),
  })),
};

const mockRunTransaction = jest.fn(
  async (fn: (txn: typeof mockTransaction) => Promise<void>) => {
    return fn(mockTransaction);
  }
);

const mockDb = {
  collection: jest.fn(() => mockCollectionRef),
  runTransaction: mockRunTransaction,
};

jest.mock("firebase-admin", () => ({
  firestore: Object.assign(jest.fn(() => mockDb), {
    Timestamp: {
      now: mockTimestampNow,
      fromMillis: mockTimestampFromMillis,
    },
    FieldValue: {
      arrayUnion: mockArrayUnion,
      increment: mockIncrement,
    },
  }),
  initializeApp: jest.fn(),
}));

// Mock notification services (fire-and-forget, not under test)
jest.mock("../services/notificationService", () => ({
  sendDeliveryNotification: jest.fn().mockResolvedValue(undefined),
  sendPushNotification: jest.fn().mockResolvedValue(undefined),
}));

// Mock geohash service
jest.mock("../services/geohashService", () => ({
  getNearbyDriverTokensMultiLocation: jest.fn().mockResolvedValue([]),
  encodeGeohash: jest.fn(() => "sv8wrqf"),
}));

// ---------------------------------------------------------------------------
// Import the module under test (must come AFTER mocks)
// ---------------------------------------------------------------------------
import {
  createDelivery,
  expressInterest,
  selectDriver,
  confirmSelection,
  confirmPickup,
  confirmDelivery,
  confirmPayment,
  cancelDelivery,
} from "../callable/deliveryCallable";

// ---------------------------------------------------------------------------
// Helper: simulate an onCall request
// ---------------------------------------------------------------------------
interface CallableRequest {
  auth?: { uid: string; token?: Record<string, unknown> };
  data: Record<string, unknown>;
}

/**
 * Invoke a firebase-functions/v2 onCall function with a simulated request.
 * v2 onCall functions receive { auth, data, ... } as a single argument.
 */
async function callFunction(fn: any, request: CallableRequest) {
  // v2 onCall handlers receive a single CallableRequest-like object
  return fn.run(request);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function validDeliveryData() {
  return {
    pickup: {
      address: "123 Main St",
      city: "Tel Aviv",
      lat: 32.0853,
      lng: 34.7818,
    },
    destination: {
      address: "456 Oak Ave",
      city: "Haifa",
      lat: 32.794,
      lng: 34.9896,
    },
    item: {
      description: "Small package",
      size: "small",
      type: "general",
      photoURL: "https://example.com/photo.jpg",
    },
    price: 50,
    pickupDate: "asap",
    notes: "Ring doorbell",
  };
}

function mockSenderUser() {
  return {
    role: "sender",
    activeMode: "client",
    fullName: "Test Sender",
    nickname: "Sender",
    profilePhotoURL: "https://example.com/sender.jpg",
    ratingAsSender: { average: 4.5, count: 10 },
    status: "active",
  };
}

function mockDriverUser() {
  return {
    role: "sender",
    activeMode: "driver",
    driverUnlocked: true,
    fullName: "Test Driver",
    nickname: "Driver",
    profilePhotoURL: "https://example.com/driver.jpg",
    ratingAsDriver: { average: 4.8, count: 20 },
    completedDeliveries: 15,
    status: "active",
    kycStatus: "approved",
    location: { lat: 32.08, lng: 34.78, geohash: "sv8wrqf" },
  };
}

function makeDeliveryDoc(overrides: Record<string, unknown> = {}) {
  return {
    senderId: "sender-1",
    driverId: null,
    status: "new",
    pickup: { address: "A", city: "Tel Aviv", lat: 32.08, lng: 34.78, geohash: "sv8wrqf" },
    destination: { address: "B", city: "Haifa", lat: 32.79, lng: 34.98, geohash: "sv8xabc" },
    item: { description: "pkg", type: "general", size: "small", photoURL: "" },
    price: 50,
    payment: { senderConfirmed: false, driverConfirmed: false },
    proof: {},
    interestedDrivers: [],
    statusHistory: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset mocks
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.clearAllMocks();
  // Default: user lookup returns sender data
  mockDocGet.mockResolvedValue({
    exists: true,
    data: () => mockSenderUser(),
  });
  // Default: no recent duplicates
  mockWhereGet.mockResolvedValue({ docs: [] });
  // Default: collection add returns a doc ref
  mockCollectionAdd.mockResolvedValue({ id: "new-delivery-id" });
});

// ===========================
// createDelivery
// ===========================
describe("createDelivery", () => {
  test("rejects unauthenticated requests", async () => {
    await expect(
      callFunction(createDelivery, { data: validDeliveryData() })
    ).rejects.toThrow(HttpsError);
  });

  test("rejects missing pickup", async () => {
    const data = validDeliveryData();
    delete (data as any).pickup;
    await expect(
      callFunction(createDelivery, {
        auth: { uid: "sender-1" },
        data,
      })
    ).rejects.toThrow(/pickup and destination are required/);
  });

  test("rejects missing destination", async () => {
    const data = validDeliveryData();
    delete (data as any).destination;
    await expect(
      callFunction(createDelivery, {
        auth: { uid: "sender-1" },
        data,
      })
    ).rejects.toThrow(/pickup and destination are required/);
  });

  test("rejects invalid pickup coordinates", async () => {
    const data = validDeliveryData();
    (data.pickup as any).lat = "not-a-number";
    await expect(
      callFunction(createDelivery, {
        auth: { uid: "sender-1" },
        data,
      })
    ).rejects.toThrow(/יש לבחור כתובת איסוף תקינה מהמפה/);
  });

  test("rejects missing item description", async () => {
    const data = validDeliveryData();
    data.item.description = "";
    await expect(
      callFunction(createDelivery, {
        auth: { uid: "sender-1" },
        data,
      })
    ).rejects.toThrow(/item description is required/);
  });

  test("rejects zero or negative price", async () => {
    const data = validDeliveryData();
    data.price = 0;
    await expect(
      callFunction(createDelivery, {
        auth: { uid: "sender-1" },
        data,
      })
    ).rejects.toThrow(/price must be a positive number/);
  });

  test("rejects negative price", async () => {
    const data = validDeliveryData();
    data.price = -10;
    await expect(
      callFunction(createDelivery, {
        auth: { uid: "sender-1" },
        data,
      })
    ).rejects.toThrow(/price must be a positive number/);
  });

  test("creates delivery with correct defaults on success", async () => {
    const result = await callFunction(createDelivery, {
      auth: { uid: "sender-1" },
      data: validDeliveryData(),
    });

    expect(result).toEqual({ success: true, deliveryId: "new-delivery-id" });
    expect(mockCollectionAdd).toHaveBeenCalledTimes(1);

    const doc = mockCollectionAdd.mock.calls[0][0];
    expect(doc.senderId).toBe("sender-1");
    expect(doc.status).toBe("new");
    expect(doc.driverId).toBeNull();
    expect(doc.payment).toEqual({
      senderConfirmed: false,
      driverConfirmed: false,
    });
    expect(doc.proof).toEqual({});
    expect(doc.interestedDrivers).toEqual([]);
    expect(doc.notifiedDrivers).toEqual([]);
    expect(doc.notifyRadius).toBe(15);
    expect(doc.notifyExpansionCount).toBe(0);
    expect(doc.statusHistory).toHaveLength(1);
    expect(doc.statusHistory[0].status).toBe("new");
  });

  test("normalizes legacy field names (latitude/longitude)", async () => {
    const data = {
      ...validDeliveryData(),
      pickup: {
        address: "A",
        city: "Tel Aviv",
        latitude: 32.08,
        longitude: 34.78,
      },
      destination: {
        address: "B",
        city: "Haifa",
        latitude: 32.79,
        longitude: 34.98,
      },
    };

    const result = await callFunction(createDelivery, {
      auth: { uid: "sender-1" },
      data,
    });
    expect(result.success).toBe(true);

    const doc = mockCollectionAdd.mock.calls[0][0];
    expect(doc.pickup.lat).toBe(32.08);
    expect(doc.pickup.lng).toBe(34.78);
  });

  test("handles asap pickupDate", async () => {
    const result = await callFunction(createDelivery, {
      auth: { uid: "sender-1" },
      data: validDeliveryData(),
    });
    expect(result.success).toBe(true);

    const doc = mockCollectionAdd.mock.calls[0][0];
    expect(doc.pickupDate).toBe("asap");
  });
});

// ===========================
// expressInterest
// ===========================
describe("expressInterest", () => {
  /**
   * expressInterest calls:
   *  1. assertUserRole(db, uid, "driver")  -> reads users/{uid}
   *  2. assertDriverApproved(db, uid)      -> reads users/{uid}
   *  3. getDeliveryOrThrow(deliveryId)     -> reads deliveries/{deliveryId}
   * Then runs a transaction that reads the delivery again via txnGet.
   */
  function setupExpressInterestMocks(
    deliveryOverrides: Record<string, unknown> = {},
    txnDeliveryOverrides?: Record<string, unknown>,
  ) {
    let callCount = 0;
    mockDocGet.mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        // assertUserRole + assertDriverApproved
        return Promise.resolve({
          exists: true,
          data: () => mockDriverUser(),
        });
      }
      // getDeliveryOrThrow
      return Promise.resolve({
        exists: true,
        data: () => makeDeliveryDoc({ status: "new", ...deliveryOverrides }),
      });
    });

    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "new",
          interestedDrivers: [],
          ...(txnDeliveryOverrides ?? deliveryOverrides),
        }),
    });
  }

  beforeEach(() => {
    setupExpressInterestMocks();
  });

  test("rejects unauthenticated request", async () => {
    await expect(
      callFunction(expressInterest, { data: { deliveryId: "d1" } })
    ).rejects.toThrow(HttpsError);
  });

  test("rejects missing deliveryId", async () => {
    await expect(
      callFunction(expressInterest, {
        auth: { uid: "driver-1" },
        data: {},
      })
    ).rejects.toThrow(/deliveryId is required/);
  });

  test("rejects if delivery is not in new status", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => mockDriverUser(),
    });
    // getDeliveryOrThrow reads the delivery directly before the transaction
    // The first call is assertUserRole, second is assertDriverApproved, third is getDeliveryOrThrow
    let callCount = 0;
    mockDocGet.mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        // assertUserRole + assertDriverApproved
        return Promise.resolve({
          exists: true,
          data: () => mockDriverUser(),
        });
      }
      // getDeliveryOrThrow
      return Promise.resolve({
        exists: true,
        data: () => makeDeliveryDoc({ status: "picked_up" }),
      });
    });

    await expect(
      callFunction(expressInterest, {
        auth: { uid: "driver-1" },
        data: { deliveryId: "d1" },
      })
    ).rejects.toThrow();
  });

  test("rejects if sender tries to express interest on own delivery", async () => {
    let callCount = 0;
    mockDocGet.mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return Promise.resolve({
          exists: true,
          data: () => mockDriverUser(),
        });
      }
      return Promise.resolve({
        exists: true,
        data: () => makeDeliveryDoc({ senderId: "driver-1", status: "new" }),
      });
    });

    await expect(
      callFunction(expressInterest, {
        auth: { uid: "driver-1" },
        data: { deliveryId: "d1" },
      })
    ).rejects.toThrow(/לא ניתן להביע עניין/);
  });

  test("rejects duplicate interest", async () => {
    const interestedDrivers = [
      {
        uid: "driver-1",
        status: "interested",
        name: "D1",
        photoUrl: null,
        rating: 0,
        completedDeliveries: 0,
        distanceKm: 1,
      },
    ];
    setupExpressInterestMocks(
      { interestedDrivers },
      { interestedDrivers },
    );

    await expect(
      callFunction(expressInterest, {
        auth: { uid: "driver-1" },
        data: { deliveryId: "d1" },
      })
    ).rejects.toThrow(/כבר הבעת עניין/);
  });

  test("allows re-entry after withdrawal", async () => {
    const interestedDrivers = [
      {
        uid: "driver-1",
        status: "withdrawn",
        name: "D1",
        photoUrl: null,
        rating: 0,
        completedDeliveries: 0,
        distanceKm: 1,
      },
    ];
    setupExpressInterestMocks(
      { interestedDrivers },
      { interestedDrivers },
    );

    const result = await callFunction(expressInterest, {
      auth: { uid: "driver-1" },
      data: { deliveryId: "d1" },
    });
    expect(result.success).toBe(true);
    expect(mockTxnUpdate).toHaveBeenCalled();
  });

  test("rejects when 30 drivers already interested", async () => {
    const drivers = Array.from({ length: 30 }, (_, i) => ({
      uid: `d-${i}`,
      status: "interested",
      name: `Driver ${i}`,
      photoUrl: null,
      rating: 0,
      completedDeliveries: 0,
      distanceKm: 1,
    }));

    setupExpressInterestMocks(
      { interestedDrivers: drivers },
      { interestedDrivers: drivers },
    );

    await expect(
      callFunction(expressInterest, {
        auth: { uid: "driver-new" },
        data: { deliveryId: "d1" },
      })
    ).rejects.toThrow(/מקסימום/);
  });

  test("succeeds for valid new interest", async () => {
    const result = await callFunction(expressInterest, {
      auth: { uid: "driver-1" },
      data: { deliveryId: "d1" },
    });
    expect(result).toEqual({ success: true });
    expect(mockTxnUpdate).toHaveBeenCalled();
  });
});

// ===========================
// selectDriver
// ===========================
describe("selectDriver", () => {
  beforeEach(() => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          senderId: "sender-1",
          status: "new",
          interestedDrivers: [
            {
              uid: "driver-1",
              status: "interested",
              name: "Driver 1",
              photoUrl: null,
              rating: 4.5,
              completedDeliveries: 10,
              distanceKm: 2,
            },
          ],
        }),
    });

    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          senderId: "sender-1",
          status: "new",
          interestedDrivers: [
            {
              uid: "driver-1",
              status: "interested",
              name: "Driver 1",
              photoUrl: null,
              rating: 4.5,
              completedDeliveries: 10,
              distanceKm: 2,
            },
          ],
        }),
    });
  });

  test("rejects unauthenticated request", async () => {
    await expect(
      callFunction(selectDriver, {
        data: { deliveryId: "d1", driverUid: "driver-1" },
      })
    ).rejects.toThrow(HttpsError);
  });

  test("rejects missing deliveryId or driverUid", async () => {
    await expect(
      callFunction(selectDriver, {
        auth: { uid: "sender-1" },
        data: { deliveryId: "d1" },
      })
    ).rejects.toThrow(/deliveryId and driverUid are required/);
  });

  test("rejects non-sender caller", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          senderId: "sender-1",
          status: "new",
        }),
    });

    await expect(
      callFunction(selectDriver, {
        auth: { uid: "stranger" },
        data: { deliveryId: "d1", driverUid: "driver-1" },
      })
    ).rejects.toThrow(/רק השולח/);
  });

  test("rejects if driver not in interested list", async () => {
    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          senderId: "sender-1",
          status: "new",
          interestedDrivers: [
            { uid: "other-driver", status: "interested", name: "Other" },
          ],
        }),
    });

    await expect(
      callFunction(selectDriver, {
        auth: { uid: "sender-1" },
        data: { deliveryId: "d1", driverUid: "driver-1" },
      })
    ).rejects.toThrow(/הנהג לא נמצא ברשימה/);
  });

  test("rejects if another driver already selected", async () => {
    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          senderId: "sender-1",
          status: "new",
          selectedDriverId: "other-driver",
          interestedDrivers: [
            { uid: "driver-1", status: "interested", name: "D1" },
          ],
        }),
    });

    await expect(
      callFunction(selectDriver, {
        auth: { uid: "sender-1" },
        data: { deliveryId: "d1", driverUid: "driver-1" },
      })
    ).rejects.toThrow(/נהג אחר כבר נבחר/);
  });

  test("succeeds and sets awaiting_confirm status", async () => {
    const result = await callFunction(selectDriver, {
      auth: { uid: "sender-1" },
      data: { deliveryId: "d1", driverUid: "driver-1" },
    });

    expect(result).toEqual({ success: true });
    expect(mockTxnUpdate).toHaveBeenCalled();

    const updateCall = mockTxnUpdate.mock.calls[0][1];
    expect(updateCall.status).toBe("awaiting_confirm");
    expect(updateCall.selectedDriverId).toBe("driver-1");
    expect(updateCall.driverId).toBe("driver-1");
    expect(updateCall.selectionExpiresAt).toBeDefined();
  });
});

// ===========================
// confirmSelection
// ===========================
describe("confirmSelection", () => {
  const futureExpiry = { toMillis: () => Date.now() + 10 * 60 * 1000 };
  const pastExpiry = { toMillis: () => Date.now() - 1000 };

  test("rejects unauthenticated request", async () => {
    await expect(
      callFunction(confirmSelection, { data: { deliveryId: "d1" } })
    ).rejects.toThrow(HttpsError);
  });

  test("rejects if caller is not the selected driver", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "awaiting_confirm",
          selectedDriverId: "other-driver",
        }),
    });
    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "awaiting_confirm",
          selectedDriverId: "other-driver",
        }),
    });

    await expect(
      callFunction(confirmSelection, {
        auth: { uid: "driver-1" },
        data: { deliveryId: "d1" },
      })
    ).rejects.toThrow(/לא הנהג שנבחר/);
  });

  test("rejects if selection has expired", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "awaiting_confirm",
          selectedDriverId: "driver-1",
          selectionExpiresAt: pastExpiry,
        }),
    });
    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "awaiting_confirm",
          selectedDriverId: "driver-1",
          selectionExpiresAt: pastExpiry,
        }),
    });

    await expect(
      callFunction(confirmSelection, {
        auth: { uid: "driver-1" },
        data: { deliveryId: "d1" },
      })
    ).rejects.toThrow(/פג תוקף/);
  });

  test("succeeds and transitions to waiting_for_pickup", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "awaiting_confirm",
          senderId: "sender-1",
          selectedDriverId: "driver-1",
          selectionExpiresAt: futureExpiry,
          interestedDrivers: [
            { uid: "driver-1", status: "selected", name: "D1" },
          ],
        }),
    });
    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "awaiting_confirm",
          senderId: "sender-1",
          selectedDriverId: "driver-1",
          selectionExpiresAt: futureExpiry,
          interestedDrivers: [
            { uid: "driver-1", status: "selected", name: "D1" },
          ],
        }),
    });

    const result = await callFunction(confirmSelection, {
      auth: { uid: "driver-1" },
      data: { deliveryId: "d1" },
    });

    expect(result).toEqual({ success: true });
    expect(mockTxnUpdate).toHaveBeenCalled();

    const updateCall = mockTxnUpdate.mock.calls[0][1];
    expect(updateCall.status).toBe("waiting_for_pickup");
    expect(updateCall.driverId).toBe("driver-1");
    expect(updateCall.selectedDriverId).toBeNull();
  });
});

// ===========================
// confirmPickup
// ===========================
describe("confirmPickup", () => {
  beforeEach(() => {
    // User is a driver
    let callCount = 0;
    mockDocGet.mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        // assertUserRole + assertDriverApproved
        return Promise.resolve({
          exists: true,
          data: () => mockDriverUser(),
        });
      }
      // getDeliveryOrThrow
      return Promise.resolve({
        exists: true,
        data: () =>
          makeDeliveryDoc({
            status: "waiting_for_pickup",
            driverId: "driver-1",
            senderId: "sender-1",
          }),
      });
    });
  });

  test("rejects unauthenticated request", async () => {
    await expect(
      callFunction(confirmPickup, {
        data: { deliveryId: "d1", pickupPhotoURL: "https://proof.jpg" },
      })
    ).rejects.toThrow(HttpsError);
  });

  test("rejects missing proof photo URL", async () => {
    await expect(
      callFunction(confirmPickup, {
        auth: { uid: "driver-1" },
        data: { deliveryId: "d1" },
      })
    ).rejects.toThrow(/pickupPhotoURL is required/);
  });

  test("rejects empty string proof URL", async () => {
    await expect(
      callFunction(confirmPickup, {
        auth: { uid: "driver-1" },
        data: { deliveryId: "d1", pickupPhotoURL: "" },
      })
    ).rejects.toThrow(/pickupPhotoURL is required/);
  });

  test("rejects non-string proof URL", async () => {
    await expect(
      callFunction(confirmPickup, {
        auth: { uid: "driver-1" },
        data: { deliveryId: "d1", pickupPhotoURL: 12345 },
      })
    ).rejects.toThrow(/pickupPhotoURL is required/);
  });

  test("succeeds with valid proof URL", async () => {
    const result = await callFunction(confirmPickup, {
      auth: { uid: "driver-1" },
      data: { deliveryId: "d1", pickupPhotoURL: "https://storage.com/proof.jpg" },
    });
    expect(result).toEqual({
      success: true,
      message: "Pickup confirmed successfully",
    });
    expect(mockDocUpdate).toHaveBeenCalled();
  });
});

// ===========================
// confirmDelivery
// ===========================
describe("confirmDelivery", () => {
  beforeEach(() => {
    let callCount = 0;
    mockDocGet.mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return Promise.resolve({
          exists: true,
          data: () => mockDriverUser(),
        });
      }
      return Promise.resolve({
        exists: true,
        data: () =>
          makeDeliveryDoc({
            status: "picked_up",
            driverId: "driver-1",
            senderId: "sender-1",
          }),
      });
    });
  });

  test("rejects missing proof photo URL", async () => {
    await expect(
      callFunction(confirmDelivery, {
        auth: { uid: "driver-1" },
        data: { deliveryId: "d1" },
      })
    ).rejects.toThrow(/deliveryPhotoURL is required/);
  });

  test("succeeds with valid proof URL", async () => {
    const result = await callFunction(confirmDelivery, {
      auth: { uid: "driver-1" },
      data: {
        deliveryId: "d1",
        deliveryPhotoURL: "https://storage.com/delivered.jpg",
      },
    });
    expect(result).toEqual({
      success: true,
      message: "Delivery confirmed successfully",
    });
  });
});

// ===========================
// confirmPayment
// ===========================
describe("confirmPayment", () => {
  test("rejects unauthenticated request", async () => {
    await expect(
      callFunction(confirmPayment, { data: { deliveryId: "d1" } })
    ).rejects.toThrow(HttpsError);
  });

  test("rejects if status is not delivered or awaiting_payment", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => makeDeliveryDoc({ status: "new", senderId: "sender-1" }),
    });
    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () => makeDeliveryDoc({ status: "new", senderId: "sender-1" }),
    });

    await expect(
      callFunction(confirmPayment, {
        auth: { uid: "sender-1" },
        data: { deliveryId: "d1" },
      })
    ).rejects.toThrow(/delivered.*awaiting_payment/);
  });

  test("rejects if caller is neither sender nor driver", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "delivered",
          senderId: "sender-1",
          driverId: "driver-1",
        }),
    });
    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "delivered",
          senderId: "sender-1",
          driverId: "driver-1",
        }),
    });

    await expect(
      callFunction(confirmPayment, {
        auth: { uid: "stranger" },
        data: { deliveryId: "d1" },
      })
    ).rejects.toThrow(/Only the sender or driver/);
  });

  test("rejects double confirmation by sender", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "awaiting_payment",
          senderId: "sender-1",
          driverId: "driver-1",
          payment: { senderConfirmed: true, driverConfirmed: false },
        }),
    });
    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "awaiting_payment",
          senderId: "sender-1",
          driverId: "driver-1",
          payment: { senderConfirmed: true, driverConfirmed: false },
        }),
    });

    await expect(
      callFunction(confirmPayment, {
        auth: { uid: "sender-1" },
        data: { deliveryId: "d1" },
      })
    ).rejects.toThrow(/already confirmed/);
  });

  test("first confirmation transitions to awaiting_payment", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "delivered",
          senderId: "sender-1",
          driverId: "driver-1",
          payment: { senderConfirmed: false, driverConfirmed: false },
        }),
    });
    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "delivered",
          senderId: "sender-1",
          driverId: "driver-1",
          payment: { senderConfirmed: false, driverConfirmed: false },
        }),
    });

    const result = await callFunction(confirmPayment, {
      auth: { uid: "sender-1" },
      data: { deliveryId: "d1" },
    });

    expect(result).toEqual({
      success: true,
      message: "Payment confirmation recorded",
    });

    // Check txn.update was called with awaiting_payment
    const updateArgs = mockTxnUpdate.mock.calls[0][1];
    expect(updateArgs.status).toBe("awaiting_payment");
    expect(updateArgs["payment.senderConfirmed"]).toBe(true);
  });

  test("second confirmation transitions to completed_paid", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "awaiting_payment",
          senderId: "sender-1",
          driverId: "driver-1",
          payment: { senderConfirmed: true, driverConfirmed: false },
        }),
    });
    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "awaiting_payment",
          senderId: "sender-1",
          driverId: "driver-1",
          payment: { senderConfirmed: true, driverConfirmed: false },
        }),
    });

    const result = await callFunction(confirmPayment, {
      auth: { uid: "driver-1" },
      data: { deliveryId: "d1" },
    });

    expect(result).toEqual({
      success: true,
      message: "Payment confirmation recorded",
    });

    // Should transition to completed_paid and increment completedDeliveries
    const mainUpdate = mockTxnUpdate.mock.calls[0][1];
    expect(mainUpdate.status).toBe("completed_paid");
    expect(mainUpdate["payment.driverConfirmed"]).toBe(true);

    // Should increment completedDeliveries for both users
    expect(mockTxnUpdate).toHaveBeenCalledTimes(3); // delivery + sender + driver
  });
});

// ===========================
// cancelDelivery
// ===========================
describe("cancelDelivery", () => {
  test("rejects unauthenticated request", async () => {
    await expect(
      callFunction(cancelDelivery, { data: { deliveryId: "d1" } })
    ).rejects.toThrow(HttpsError);
  });

  test("rejects if caller is neither sender nor driver", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "new",
          senderId: "sender-1",
          driverId: "driver-1",
        }),
    });
    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "new",
          senderId: "sender-1",
          driverId: "driver-1",
        }),
    });

    await expect(
      callFunction(cancelDelivery, {
        auth: { uid: "stranger" },
        data: { deliveryId: "d1" },
      })
    ).rejects.toThrow(/Only the sender or assigned driver/);
  });

  test("rejects cancellation after pickup (picked_up status)", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "picked_up",
          senderId: "sender-1",
          driverId: "driver-1",
        }),
    });
    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "picked_up",
          senderId: "sender-1",
          driverId: "driver-1",
        }),
    });

    await expect(
      callFunction(cancelDelivery, {
        auth: { uid: "sender-1" },
        data: { deliveryId: "d1" },
      })
    ).rejects.toThrow(); // picked_up -> cancelled is not in STATUS_TRANSITIONS
  });

  test("rejects cancellation after delivery (delivered status)", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "delivered",
          senderId: "sender-1",
          driverId: "driver-1",
        }),
    });
    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "delivered",
          senderId: "sender-1",
          driverId: "driver-1",
        }),
    });

    await expect(
      callFunction(cancelDelivery, {
        auth: { uid: "sender-1" },
        data: { deliveryId: "d1" },
      })
    ).rejects.toThrow(); // delivered -> cancelled is not allowed
  });

  test("sender can cancel a new delivery", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "new",
          senderId: "sender-1",
        }),
    });
    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "new",
          senderId: "sender-1",
        }),
    });

    const result = await callFunction(cancelDelivery, {
      auth: { uid: "sender-1" },
      data: { deliveryId: "d1", reason: "Changed my mind" },
    });

    expect(result).toEqual({
      success: true,
      message: "Delivery cancelled",
    });

    const updateArgs = mockTxnUpdate.mock.calls[0][1];
    expect(updateArgs.status).toBe("cancelled");
    expect(updateArgs.cancelledBy).toBe("sender-1");
  });

  test("driver can cancel a waiting_for_pickup delivery", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "waiting_for_pickup",
          senderId: "sender-1",
          driverId: "driver-1",
        }),
    });
    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "waiting_for_pickup",
          senderId: "sender-1",
          driverId: "driver-1",
        }),
    });

    const result = await callFunction(cancelDelivery, {
      auth: { uid: "driver-1" },
      data: { deliveryId: "d1" },
    });

    expect(result).toEqual({
      success: true,
      message: "Delivery returned to new",
    });
  });

  test("cancelledBy is set to the caller uid", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "pending",
          senderId: "sender-1",
          driverId: "driver-1",
        }),
    });
    mockTxnGet.mockResolvedValue({
      exists: true,
      data: () =>
        makeDeliveryDoc({
          status: "pending",
          senderId: "sender-1",
          driverId: "driver-1",
        }),
    });

    await callFunction(cancelDelivery, {
      auth: { uid: "driver-1" },
      data: { deliveryId: "d1" },
    });

    const updateArgs = mockTxnUpdate.mock.calls[0][1];
    expect(updateArgs.cancelledBy).toBe("driver-1");
  });
});
