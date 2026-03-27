/**
 * Tests for firestore.rules
 *
 * Uses @firebase/rules-unit-testing to validate Firestore security rules.
 * Tests cover:
 * - User profile RBAC (read own, update allowed fields, protected fields blocked)
 * - Delivery RBAC (sender reads own, driver reads available/assigned)
 * - Chat participant isolation
 * - Rating creator-only writes
 * - Report creator-only writes, admin manages
 * - AdminActions admin-only
 * - Rate limit collections locked to server-only
 */

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import * as fs from "fs";
import * as path from "path";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  deleteDoc,
} from "firebase/firestore";

let testEnv: RulesTestEnvironment;
let emulatorAvailable = false;

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
// These tests require the Firestore emulator (Java 21+).
// Start it with: firebase emulators:start --only firestore
// Then run:      pnpm --filter @mooviz/functions test:rules
// ---------------------------------------------------------------------------
beforeAll(async () => {
  const rulesPath = path.resolve(__dirname, "../../../firestore.rules");
  const rules = fs.readFileSync(rulesPath, "utf8");

  try {
    testEnv = await initializeTestEnvironment({
      projectId: "mooviz-test-rules",
      firestore: { rules, host: "127.0.0.1", port: 8080 },
    });
    emulatorAvailable = true;
  } catch (err) {
    console.warn(
      "\n  Firestore emulator not running — rules tests will be skipped.\n" +
      "  Start it with: firebase emulators:start --only firestore\n"
    );
  }
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

afterEach(async () => {
  if (testEnv) await testEnv.clearFirestore();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureEmulator() {
  if (!emulatorAvailable) {
    throw new Error(
      "Firestore emulator not available. " +
      "Start it with: firebase emulators:start --only firestore"
    );
  }
}

/** Get a Firestore instance authenticated as the given uid */
function authedDb(uid: string) {
  ensureEmulator();
  return testEnv.authenticatedContext(uid).firestore();
}

/** Get an unauthenticated Firestore instance */
function unauthedDb() {
  ensureEmulator();
  return testEnv.unauthenticatedContext().firestore();
}

/** Seed data using the admin context (bypasses rules) */
async function seedDoc(collectionPath: string, docId: string, data: Record<string, unknown>) {
  ensureEmulator();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, collectionPath, docId), data);
  });
}

// ===========================
// Users collection
// ===========================
describe("users collection", () => {
  const senderProfile = {
    fullName: "Test Sender",
    phone: "+972501234567",
    city: "Tel Aviv",
    role: "sender",
    activeMode: "client",
    status: "active",
  };

  const adminProfile = {
    fullName: "Admin User",
    role: "admin",
    status: "active",
  };

  describe("read access", () => {
    test("user can read own profile", async () => {
      await seedDoc("users", "user-1", senderProfile);
      const db = authedDb("user-1");
      await assertSucceeds(getDoc(doc(db, "users", "user-1")));
    });

    test("authenticated user can read other user profile", async () => {
      await seedDoc("users", "user-2", senderProfile);
      const db = authedDb("user-1");
      await assertSucceeds(getDoc(doc(db, "users", "user-2")));
    });

    test("unauthenticated user cannot read profiles", async () => {
      await seedDoc("users", "user-1", senderProfile);
      const db = unauthedDb();
      await assertFails(getDoc(doc(db, "users", "user-1")));
    });
  });

  describe("create access", () => {
    test("user can create own profile with valid role", async () => {
      const db = authedDb("user-1");
      await assertSucceeds(
        setDoc(doc(db, "users", "user-1"), senderProfile)
      );
    });

    test("user cannot create profile for another user", async () => {
      const db = authedDb("user-1");
      await assertFails(
        setDoc(doc(db, "users", "user-2"), senderProfile)
      );
    });

    test("user cannot create profile with admin role", async () => {
      const db = authedDb("user-1");
      await assertFails(
        setDoc(doc(db, "users", "user-1"), { ...senderProfile, role: "admin" })
      );
    });
  });

  describe("update access - allowed fields", () => {
    beforeEach(async () => {
      await seedDoc("users", "user-1", senderProfile);
    });

    test("user can update allowed fields (fullName, city, fcmToken)", async () => {
      const db = authedDb("user-1");
      await assertSucceeds(
        updateDoc(doc(db, "users", "user-1"), {
          fullName: "Updated Name",
          city: "Haifa",
          fcmToken: "new-token",
        })
      );
    });

    test("user can update activeMode", async () => {
      const db = authedDb("user-1");
      await assertSucceeds(
        updateDoc(doc(db, "users", "user-1"), { activeMode: "driver" })
      );
    });

    test("user can set kycStatus to pending", async () => {
      const db = authedDb("user-1");
      await assertSucceeds(
        updateDoc(doc(db, "users", "user-1"), { kycStatus: "pending" })
      );
    });

    test("user can update location", async () => {
      const db = authedDb("user-1");
      await assertSucceeds(
        updateDoc(doc(db, "users", "user-1"), {
          location: { lat: 32.08, lng: 34.78, geohash: "sv8wrqf" },
        })
      );
    });

    test("user can update driverSettings", async () => {
      const db = authedDb("user-1");
      await assertSucceeds(
        updateDoc(doc(db, "users", "user-1"), {
          driverSettings: { maxDistance: 20 },
        })
      );
    });

    test("user can update acceptedTermsAt", async () => {
      const db = authedDb("user-1");
      await assertSucceeds(
        updateDoc(doc(db, "users", "user-1"), {
          acceptedTermsAt: new Date(),
        })
      );
    });
  });

  describe("update access - protected fields blocked", () => {
    beforeEach(async () => {
      await seedDoc("users", "user-1", senderProfile);
    });

    test("user cannot change own role", async () => {
      const db = authedDb("user-1");
      await assertFails(
        updateDoc(doc(db, "users", "user-1"), { role: "admin" })
      );
    });

    test("user cannot change own status", async () => {
      const db = authedDb("user-1");
      await assertFails(
        updateDoc(doc(db, "users", "user-1"), { status: "blocked" })
      );
    });

    test("user cannot set driverUnlocked", async () => {
      const db = authedDb("user-1");
      await assertFails(
        updateDoc(doc(db, "users", "user-1"), { driverUnlocked: true })
      );
    });

    test("user cannot set completedDeliveries", async () => {
      const db = authedDb("user-1");
      await assertFails(
        updateDoc(doc(db, "users", "user-1"), { completedDeliveries: 100 })
      );
    });

    test("user cannot set kycStatus to approved", async () => {
      const db = authedDb("user-1");
      await assertFails(
        updateDoc(doc(db, "users", "user-1"), { kycStatus: "approved" })
      );
    });

    test("user cannot set kycStatus to rejected", async () => {
      const db = authedDb("user-1");
      await assertFails(
        updateDoc(doc(db, "users", "user-1"), { kycStatus: "rejected" })
      );
    });

    test("user cannot change rating fields", async () => {
      const db = authedDb("user-1");
      await assertFails(
        updateDoc(doc(db, "users", "user-1"), {
          ratingAsDriver: { average: 5, count: 100 },
        })
      );
    });

    test("user cannot update disallowed fields (e.g. createdAt)", async () => {
      const db = authedDb("user-1");
      await assertFails(
        updateDoc(doc(db, "users", "user-1"), { createdAt: new Date() })
      );
    });
  });

  describe("admin access", () => {
    beforeEach(async () => {
      await seedDoc("users", "admin-1", adminProfile);
      await seedDoc("users", "user-1", senderProfile);
    });

    test("admin can read any user profile", async () => {
      const db = authedDb("admin-1");
      await assertSucceeds(getDoc(doc(db, "users", "user-1")));
    });

    test("admin can update any user profile", async () => {
      const db = authedDb("admin-1");
      await assertSucceeds(
        updateDoc(doc(db, "users", "user-1"), {
          status: "blocked",
          role: "driver",
          kycStatus: "approved",
        })
      );
    });

    test("admin can delete a user", async () => {
      const db = authedDb("admin-1");
      await assertSucceeds(deleteDoc(doc(db, "users", "user-1")));
    });
  });
});

// ===========================
// Deliveries collection
// ===========================
describe("deliveries collection", () => {
  const deliveryDoc = {
    senderId: "sender-1",
    driverId: null,
    status: "new",
    pickup: { address: "A", city: "TLV", lat: 32, lng: 34, geohash: "abc" },
    destination: { address: "B", city: "HFA", lat: 32.7, lng: 35, geohash: "def" },
    item: { description: "pkg", type: "general", size: "small", photoURL: "" },
    price: 50,
    payment: { senderConfirmed: false, driverConfirmed: false },
  };

  describe("create access", () => {
    test("authenticated user can create delivery with own senderId and new status", async () => {
      const db = authedDb("sender-1");
      await assertSucceeds(
        setDoc(doc(db, "deliveries", "d1"), {
          ...deliveryDoc,
          senderId: "sender-1",
          status: "new",
        })
      );
    });

    test("user cannot create delivery with another user as sender", async () => {
      const db = authedDb("sender-1");
      await assertFails(
        setDoc(doc(db, "deliveries", "d1"), {
          ...deliveryDoc,
          senderId: "other-user",
          status: "new",
        })
      );
    });

    test("user cannot create delivery with non-new status", async () => {
      const db = authedDb("sender-1");
      await assertFails(
        setDoc(doc(db, "deliveries", "d1"), {
          ...deliveryDoc,
          senderId: "sender-1",
          status: "picked_up",
        })
      );
    });
  });

  describe("read access", () => {
    test("sender can read own delivery", async () => {
      await seedDoc("deliveries", "d1", deliveryDoc);
      const db = authedDb("sender-1");
      await assertSucceeds(getDoc(doc(db, "deliveries", "d1")));
    });

    test("driver can read available delivery (status new)", async () => {
      await seedDoc("deliveries", "d1", { ...deliveryDoc, status: "new" });
      const db = authedDb("driver-1");
      await assertSucceeds(getDoc(doc(db, "deliveries", "d1")));
    });

    test("driver can read available delivery (status pending)", async () => {
      await seedDoc("deliveries", "d1", { ...deliveryDoc, status: "pending" });
      const db = authedDb("driver-1");
      await assertSucceeds(getDoc(doc(db, "deliveries", "d1")));
    });

    test("driver can read available delivery (status awaiting_confirm)", async () => {
      await seedDoc("deliveries", "d1", {
        ...deliveryDoc,
        status: "awaiting_confirm",
      });
      const db = authedDb("driver-1");
      await assertSucceeds(getDoc(doc(db, "deliveries", "d1")));
    });

    test("assigned driver can read their delivery", async () => {
      await seedDoc("deliveries", "d1", {
        ...deliveryDoc,
        status: "picked_up",
        driverId: "driver-1",
      });
      const db = authedDb("driver-1");
      await assertSucceeds(getDoc(doc(db, "deliveries", "d1")));
    });

    test("unrelated user cannot read picked_up delivery", async () => {
      await seedDoc("deliveries", "d1", {
        ...deliveryDoc,
        status: "picked_up",
        driverId: "driver-1",
      });
      const db = authedDb("stranger");
      await assertFails(getDoc(doc(db, "deliveries", "d1")));
    });

    test("unauthenticated user cannot read deliveries", async () => {
      await seedDoc("deliveries", "d1", deliveryDoc);
      const db = unauthedDb();
      await assertFails(getDoc(doc(db, "deliveries", "d1")));
    });
  });

  describe("update access", () => {
    test("sender can update allowed fields (payment, proof, updatedAt)", async () => {
      await seedDoc("deliveries", "d1", deliveryDoc);
      const db = authedDb("sender-1");
      await assertSucceeds(
        updateDoc(doc(db, "deliveries", "d1"), {
          payment: { senderConfirmed: true, driverConfirmed: false },
          updatedAt: new Date(),
        })
      );
    });

    test("sender cannot update status directly", async () => {
      await seedDoc("deliveries", "d1", deliveryDoc);
      const db = authedDb("sender-1");
      await assertFails(
        updateDoc(doc(db, "deliveries", "d1"), {
          status: "picked_up",
        })
      );
    });

    test("sender cannot update interestedDrivers directly", async () => {
      await seedDoc("deliveries", "d1", deliveryDoc);
      const db = authedDb("sender-1");
      await assertFails(
        updateDoc(doc(db, "deliveries", "d1"), {
          interestedDrivers: [{ uid: "hacker" }],
        })
      );
    });

    test("sender cannot update driverId directly", async () => {
      await seedDoc("deliveries", "d1", deliveryDoc);
      const db = authedDb("sender-1");
      await assertFails(
        updateDoc(doc(db, "deliveries", "d1"), {
          driverId: "hacker",
        })
      );
    });

    test("assigned driver can update allowed fields (payment, proof)", async () => {
      await seedDoc("deliveries", "d1", {
        ...deliveryDoc,
        driverId: "driver-1",
        status: "picked_up",
      });
      const db = authedDb("driver-1");
      await assertSucceeds(
        updateDoc(doc(db, "deliveries", "d1"), {
          proof: { pickupURL: "https://proof.jpg" },
          updatedAt: new Date(),
        })
      );
    });

    test("unassigned driver cannot update delivery", async () => {
      await seedDoc("deliveries", "d1", {
        ...deliveryDoc,
        driverId: "driver-1",
        status: "picked_up",
      });
      const db = authedDb("driver-2");
      await assertFails(
        updateDoc(doc(db, "deliveries", "d1"), {
          proof: { pickupURL: "https://evil.jpg" },
        })
      );
    });
  });

  describe("admin access", () => {
    beforeEach(async () => {
      await seedDoc("users", "admin-1", { role: "admin", status: "active" });
      await seedDoc("deliveries", "d1", deliveryDoc);
    });

    test("admin can read any delivery", async () => {
      const db = authedDb("admin-1");
      await assertSucceeds(getDoc(doc(db, "deliveries", "d1")));
    });

    test("admin can update any delivery", async () => {
      const db = authedDb("admin-1");
      await assertSucceeds(
        updateDoc(doc(db, "deliveries", "d1"), {
          status: "cancelled",
        })
      );
    });

    test("admin can delete a delivery", async () => {
      const db = authedDb("admin-1");
      await assertSucceeds(deleteDoc(doc(db, "deliveries", "d1")));
    });
  });
});

// ===========================
// Chats collection
// ===========================
describe("chats collection", () => {
  const chatDoc = {
    deliveryId: "d1",
    participants: ["sender-1", "driver-1"],
    lastMessage: "Hello",
    lastMessageAt: new Date(),
    closed: false,
    createdAt: new Date(),
  };

  describe("read access", () => {
    test("participant can read chat", async () => {
      await seedDoc("chats", "chat-1", chatDoc);
      const db = authedDb("sender-1");
      await assertSucceeds(getDoc(doc(db, "chats", "chat-1")));
    });

    test("non-participant cannot read chat", async () => {
      await seedDoc("chats", "chat-1", chatDoc);
      const db = authedDb("stranger");
      await assertFails(getDoc(doc(db, "chats", "chat-1")));
    });

    test("unauthenticated user cannot read chat", async () => {
      await seedDoc("chats", "chat-1", chatDoc);
      const db = unauthedDb();
      await assertFails(getDoc(doc(db, "chats", "chat-1")));
    });
  });

  describe("create access", () => {
    test("participant can create chat with self in participants", async () => {
      const db = authedDb("sender-1");
      await assertSucceeds(
        setDoc(doc(db, "chats", "chat-new"), chatDoc)
      );
    });

    test("user cannot create chat without self in participants", async () => {
      const db = authedDb("stranger");
      await assertFails(
        setDoc(doc(db, "chats", "chat-new"), chatDoc)
      );
    });
  });

  describe("update access", () => {
    test("participant can update message-related fields", async () => {
      await seedDoc("chats", "chat-1", chatDoc);
      const db = authedDb("driver-1");
      await assertSucceeds(
        updateDoc(doc(db, "chats", "chat-1"), {
          lastMessage: "Updated",
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });

    test("participant cannot update non-message fields (e.g. participants)", async () => {
      await seedDoc("chats", "chat-1", chatDoc);
      const db = authedDb("sender-1");
      await assertFails(
        updateDoc(doc(db, "chats", "chat-1"), {
          participants: ["sender-1", "hacker"],
        })
      );
    });

    test("non-participant cannot update chat", async () => {
      await seedDoc("chats", "chat-1", chatDoc);
      const db = authedDb("stranger");
      await assertFails(
        updateDoc(doc(db, "chats", "chat-1"), {
          lastMessage: "hacked",
        })
      );
    });
  });

  describe("messages subcollection", () => {
    test("participant can write messages", async () => {
      await seedDoc("chats", "chat-1", chatDoc);
      const db = authedDb("sender-1");
      await assertSucceeds(
        addDoc(collection(db, "chats", "chat-1", "messages"), {
          text: "Hello driver!",
          senderId: "sender-1",
          createdAt: new Date(),
        })
      );
    });

    test("non-participant cannot write messages", async () => {
      await seedDoc("chats", "chat-1", chatDoc);
      const db = authedDb("stranger");
      await assertFails(
        addDoc(collection(db, "chats", "chat-1", "messages"), {
          text: "I should not be here",
          senderId: "stranger",
          createdAt: new Date(),
        })
      );
    });
  });
});

// ===========================
// Ratings collection
// ===========================
describe("ratings collection", () => {
  describe("create access", () => {
    test("user can create rating with own fromUserId", async () => {
      const db = authedDb("user-1");
      await assertSucceeds(
        setDoc(doc(db, "ratings", "r1"), {
          fromUserId: "user-1",
          toUserId: "user-2",
          deliveryId: "d1",
          score: 5,
          comment: "Great!",
        })
      );
    });

    test("user cannot create rating with another fromUserId", async () => {
      const db = authedDb("user-1");
      await assertFails(
        setDoc(doc(db, "ratings", "r1"), {
          fromUserId: "other-user",
          toUserId: "user-2",
          deliveryId: "d1",
          score: 5,
        })
      );
    });

    test("unauthenticated user cannot create rating", async () => {
      const db = unauthedDb();
      await assertFails(
        setDoc(doc(db, "ratings", "r1"), {
          fromUserId: "anon",
          toUserId: "user-2",
          deliveryId: "d1",
          score: 3,
        })
      );
    });
  });

  describe("read access", () => {
    test("any authenticated user can read ratings", async () => {
      await seedDoc("ratings", "r1", {
        fromUserId: "user-1",
        toUserId: "user-2",
        score: 5,
      });
      const db = authedDb("user-3");
      await assertSucceeds(getDoc(doc(db, "ratings", "r1")));
    });
  });

  describe("update/delete access", () => {
    test("regular user cannot update ratings", async () => {
      await seedDoc("ratings", "r1", {
        fromUserId: "user-1",
        toUserId: "user-2",
        score: 5,
      });
      const db = authedDb("user-1");
      await assertFails(
        updateDoc(doc(db, "ratings", "r1"), { score: 1 })
      );
    });

    test("admin can update ratings", async () => {
      await seedDoc("users", "admin-1", { role: "admin", status: "active" });
      await seedDoc("ratings", "r1", {
        fromUserId: "user-1",
        toUserId: "user-2",
        score: 5,
      });
      const db = authedDb("admin-1");
      await assertSucceeds(
        updateDoc(doc(db, "ratings", "r1"), { score: 3 })
      );
    });

    test("admin can delete ratings", async () => {
      await seedDoc("users", "admin-1", { role: "admin", status: "active" });
      await seedDoc("ratings", "r1", {
        fromUserId: "user-1",
        toUserId: "user-2",
        score: 5,
      });
      const db = authedDb("admin-1");
      await assertSucceeds(deleteDoc(doc(db, "ratings", "r1")));
    });
  });
});

// ===========================
// Reports collection
// ===========================
describe("reports collection", () => {
  describe("create access", () => {
    test("user can create report with own reporterId", async () => {
      const db = authedDb("user-1");
      await assertSucceeds(
        setDoc(doc(db, "reports", "rep1"), {
          reporterId: "user-1",
          targetId: "user-2",
          reason: "Inappropriate behavior",
        })
      );
    });

    test("user cannot create report with another reporterId", async () => {
      const db = authedDb("user-1");
      await assertFails(
        setDoc(doc(db, "reports", "rep1"), {
          reporterId: "other-user",
          targetId: "user-2",
          reason: "Spoofed",
        })
      );
    });
  });

  describe("read/update/delete access", () => {
    test("regular user cannot read reports", async () => {
      await seedDoc("reports", "rep1", {
        reporterId: "user-1",
        targetId: "user-2",
        reason: "test",
      });
      const db = authedDb("user-1");
      await assertFails(getDoc(doc(db, "reports", "rep1")));
    });

    test("admin can read reports", async () => {
      await seedDoc("users", "admin-1", { role: "admin", status: "active" });
      await seedDoc("reports", "rep1", {
        reporterId: "user-1",
        targetId: "user-2",
        reason: "test",
      });
      const db = authedDb("admin-1");
      await assertSucceeds(getDoc(doc(db, "reports", "rep1")));
    });

    test("admin can update reports", async () => {
      await seedDoc("users", "admin-1", { role: "admin", status: "active" });
      await seedDoc("reports", "rep1", {
        reporterId: "user-1",
        targetId: "user-2",
        reason: "test",
      });
      const db = authedDb("admin-1");
      await assertSucceeds(
        updateDoc(doc(db, "reports", "rep1"), { resolved: true })
      );
    });

    test("admin can delete reports", async () => {
      await seedDoc("users", "admin-1", { role: "admin", status: "active" });
      await seedDoc("reports", "rep1", {
        reporterId: "user-1",
        targetId: "user-2",
        reason: "test",
      });
      const db = authedDb("admin-1");
      await assertSucceeds(deleteDoc(doc(db, "reports", "rep1")));
    });
  });
});

// ===========================
// AdminActions collection
// ===========================
describe("adminActions collection", () => {
  test("regular user cannot read adminActions", async () => {
    await seedDoc("adminActions", "a1", { action: "block", targetId: "user-1" });
    const db = authedDb("user-1");
    await assertFails(getDoc(doc(db, "adminActions", "a1")));
  });

  test("regular user cannot write adminActions", async () => {
    const db = authedDb("user-1");
    await assertFails(
      setDoc(doc(db, "adminActions", "a1"), {
        action: "unblock",
        targetId: "user-2",
      })
    );
  });

  test("admin can read adminActions", async () => {
    await seedDoc("users", "admin-1", { role: "admin", status: "active" });
    await seedDoc("adminActions", "a1", { action: "block", targetId: "user-1" });
    const db = authedDb("admin-1");
    await assertSucceeds(getDoc(doc(db, "adminActions", "a1")));
  });

  test("admin can write adminActions", async () => {
    await seedDoc("users", "admin-1", { role: "admin", status: "active" });
    const db = authedDb("admin-1");
    await assertSucceeds(
      setDoc(doc(db, "adminActions", "a2"), {
        action: "suspend",
        targetId: "user-1",
      })
    );
  });
});

// ===========================
// Config collection
// ===========================
describe("config collection", () => {
  test("authenticated user can read config", async () => {
    await seedDoc("config", "app", { maintenanceMode: false });
    const db = authedDb("user-1");
    await assertSucceeds(getDoc(doc(db, "config", "app")));
  });

  test("regular user cannot write config", async () => {
    const db = authedDb("user-1");
    await assertFails(
      setDoc(doc(db, "config", "app"), { maintenanceMode: true })
    );
  });

  test("admin can write config", async () => {
    await seedDoc("users", "admin-1", { role: "admin", status: "active" });
    const db = authedDb("admin-1");
    await assertSucceeds(
      setDoc(doc(db, "config", "app"), { maintenanceMode: true })
    );
  });
});

// ===========================
// Rate limit collections (server-only)
// ===========================
describe("rate limit collections", () => {
  const rateLimitCollections = [
    "rateLimits_otp",
    "rateLimits_login",
    "rateLimits_email",
  ];

  for (const coll of rateLimitCollections) {
    test(`${coll}: authenticated user cannot read`, async () => {
      await seedDoc(coll, "doc1", { count: 1 });
      const db = authedDb("user-1");
      await assertFails(getDoc(doc(db, coll, "doc1")));
    });

    test(`${coll}: authenticated user cannot write`, async () => {
      const db = authedDb("user-1");
      await assertFails(setDoc(doc(db, coll, "doc1"), { count: 1 }));
    });

    test(`${coll}: unauthenticated user cannot read`, async () => {
      await seedDoc(coll, "doc1", { count: 1 });
      const db = unauthedDb();
      await assertFails(getDoc(doc(db, coll, "doc1")));
    });
  }
});
