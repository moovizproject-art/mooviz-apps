/**
 * Tests for functions/src/validators/statusValidator.ts
 *
 * Covers:
 * - All valid status transitions succeed
 * - Invalid transitions throw HttpsError (failed-precondition)
 * - Role-based permissions (sender vs driver vs system)
 * - Terminal statuses block all transitions
 * - assertIsSender / assertIsDriver identity checks
 * - assertUserRole with dual-mode drivers and admin override
 * - assertUserActive and assertDriverApproved
 */

import { HttpsError } from "firebase-functions/v2/https";
import {
  STATUS_TRANSITIONS,
  TRANSITION_ACTORS,
  TERMINAL_STATUSES,
  DeliveryStatus,
} from "@mooviz/shared";
import {
  assertValidTransition,
  assertIsSender,
  assertIsDriver,
  assertUserRole,
  assertUserActive,
  assertDriverApproved,
} from "../validators/statusValidator";

// ---------------------------------------------------------------------------
// Mock Firestore for assertUserRole / assertUserActive / assertDriverApproved
// ---------------------------------------------------------------------------
function mockFirestore(userData: Record<string, unknown> | null) {
  return {
    collection: () => ({
      doc: () => ({
        get: async () => ({
          exists: userData !== null,
          data: () => userData,
        }),
      }),
    }),
  } as unknown as FirebaseFirestore.Firestore;
}

// ===========================
// assertValidTransition
// ===========================
describe("assertValidTransition", () => {
  describe("valid transitions", () => {
    // Iterate every entry in STATUS_TRANSITIONS + TRANSITION_ACTORS and
    // verify the function does NOT throw for each.
    const cases: Array<{
      from: DeliveryStatus;
      to: DeliveryStatus;
      role: string;
    }> = [];

    for (const [key, actors] of Object.entries(TRANSITION_ACTORS)) {
      const [from, to] = key.split(" -> ") as [DeliveryStatus, DeliveryStatus];
      for (const actor of actors) {
        cases.push({ from, to, role: actor });
      }
    }

    test.each(cases)(
      "$from -> $to by $role succeeds",
      ({ from, to, role }) => {
        expect(() =>
          assertValidTransition(from, to, role as any, "actor-123")
        ).not.toThrow();
      }
    );
  });

  describe("invalid transitions throw failed-precondition", () => {
    const invalidPairs: Array<[DeliveryStatus, DeliveryStatus]> = [
      ["new", "picked_up"],
      ["new", "delivered"],
      ["new", "completed_paid"],
      ["pending", "delivered"],
      ["picked_up", "new"],
      ["picked_up", "cancelled"],
      ["delivered", "new"],
      ["delivered", "cancelled"],
      ["completed_paid", "new"],
    ];

    test.each(invalidPairs)(
      "%s -> %s throws",
      (from, to) => {
        expect(() =>
          assertValidTransition(from, to, "sender", "actor-123")
        ).toThrow(HttpsError);

        try {
          assertValidTransition(from, to, "sender", "actor-123");
        } catch (err: any) {
          expect(err.code).toBe("failed-precondition");
        }
      }
    );
  });

  describe("terminal statuses cannot transition", () => {
    for (const terminal of TERMINAL_STATUSES) {
      test(`${terminal} -> any throws`, () => {
        // Try every possible target
        const allStatuses: DeliveryStatus[] = [
          "new",
          "pending",
          "awaiting_confirm",
          "waiting_for_pickup",
          "picked_up",
          "delivered",
          "awaiting_payment",
          "completed_paid",
          "cancelled",
        ];
        for (const target of allStatuses) {
          expect(() =>
            assertValidTransition(terminal, target, "sender", "actor-123")
          ).toThrow(HttpsError);

          try {
            assertValidTransition(terminal, target, "sender", "actor-123");
          } catch (err: any) {
            expect(err.code).toBe("failed-precondition");
            expect(err.message).toContain("terminal status");
          }
        }
      });
    }
  });

  describe("RBAC - wrong role throws permission-denied", () => {
    test("sender cannot transition new -> pending (driver only)", () => {
      expect(() =>
        assertValidTransition("new", "pending", "sender", "sender-1")
      ).toThrow(HttpsError);

      try {
        assertValidTransition("new", "pending", "sender", "sender-1");
      } catch (err: any) {
        expect(err.code).toBe("permission-denied");
      }
    });

    test("driver cannot transition pending -> awaiting_confirm (sender only)", () => {
      expect(() =>
        assertValidTransition(
          "pending",
          "awaiting_confirm",
          "driver",
          "driver-1"
        )
      ).toThrow(HttpsError);

      try {
        assertValidTransition(
          "pending",
          "awaiting_confirm",
          "driver",
          "driver-1"
        );
      } catch (err: any) {
        expect(err.code).toBe("permission-denied");
      }
    });

    test("driver cannot transition awaiting_confirm -> cancelled (sender only)", () => {
      expect(() =>
        assertValidTransition(
          "awaiting_confirm",
          "cancelled",
          "driver",
          "driver-1"
        )
      ).toThrow(HttpsError);

      try {
        assertValidTransition(
          "awaiting_confirm",
          "cancelled",
          "driver",
          "driver-1"
        );
      } catch (err: any) {
        expect(err.code).toBe("permission-denied");
      }
    });

    test("sender cannot transition waiting_for_pickup -> picked_up (driver only)", () => {
      expect(() =>
        assertValidTransition(
          "waiting_for_pickup",
          "picked_up",
          "sender",
          "sender-1"
        )
      ).toThrow(HttpsError);

      try {
        assertValidTransition(
          "waiting_for_pickup",
          "picked_up",
          "sender",
          "sender-1"
        );
      } catch (err: any) {
        expect(err.code).toBe("permission-denied");
      }
    });

    test("sender cannot transition picked_up -> delivered (driver only)", () => {
      expect(() =>
        assertValidTransition("picked_up", "delivered", "sender", "sender-1")
      ).toThrow(HttpsError);

      try {
        assertValidTransition("picked_up", "delivered", "sender", "sender-1");
      } catch (err: any) {
        expect(err.code).toBe("permission-denied");
      }
    });
  });

  describe("picked_up is irreversible except to delivered", () => {
    test("picked_up only allows delivered", () => {
      expect(STATUS_TRANSITIONS["picked_up"]).toEqual(["delivered"]);
    });

    test("picked_up -> cancelled is blocked", () => {
      expect(() =>
        assertValidTransition("picked_up", "cancelled", "sender", "s1")
      ).toThrow(HttpsError);
    });

    test("picked_up -> new is blocked", () => {
      expect(() =>
        assertValidTransition("picked_up", "new", "driver", "d1")
      ).toThrow(HttpsError);
    });
  });
});

// ===========================
// assertIsSender
// ===========================
describe("assertIsSender", () => {
  test("passes when caller matches senderId", () => {
    expect(() => assertIsSender("user-1", "user-1")).not.toThrow();
  });

  test("throws permission-denied when caller does not match", () => {
    expect(() => assertIsSender("user-1", "user-2")).toThrow(HttpsError);
    try {
      assertIsSender("user-1", "user-2");
    } catch (err: any) {
      expect(err.code).toBe("permission-denied");
      expect(err.message).toContain("Only the sender");
    }
  });
});

// ===========================
// assertIsDriver
// ===========================
describe("assertIsDriver", () => {
  test("passes when caller matches driverId", () => {
    expect(() => assertIsDriver("driver-1", "driver-1")).not.toThrow();
  });

  test("throws permission-denied when caller does not match", () => {
    expect(() => assertIsDriver("driver-1", "driver-2")).toThrow(HttpsError);
    try {
      assertIsDriver("driver-1", "driver-2");
    } catch (err: any) {
      expect(err.code).toBe("permission-denied");
    }
  });

  test("throws permission-denied when driverId is undefined", () => {
    expect(() => assertIsDriver(undefined, "driver-1")).toThrow(HttpsError);
    try {
      assertIsDriver(undefined, "driver-1");
    } catch (err: any) {
      expect(err.code).toBe("permission-denied");
    }
  });
});

// ===========================
// assertUserRole
// ===========================
describe("assertUserRole", () => {
  test("returns user data when role matches", async () => {
    const db = mockFirestore({
      role: "sender",
      activeMode: "client",
      fullName: "Test User",
    });
    const result = await assertUserRole(db, "user-1", "sender");
    expect(result.fullName).toBe("Test User");
  });

  test("throws not-found for missing user", async () => {
    const db = mockFirestore(null);
    await expect(assertUserRole(db, "missing", "sender")).rejects.toThrow(
      HttpsError
    );
    try {
      await assertUserRole(db, "missing", "sender");
    } catch (err: any) {
      expect(err.code).toBe("not-found");
    }
  });

  test("admin can perform any role action", async () => {
    const db = mockFirestore({ role: "admin", activeMode: "client" });
    const result = await assertUserRole(db, "admin-1", "driver");
    expect(result.role).toBe("admin");
  });

  test("driver in activeMode=driver passes driver role check", async () => {
    const db = mockFirestore({
      role: "sender",
      activeMode: "driver",
      driverUnlocked: true,
    });
    const result = await assertUserRole(db, "user-1", "driver");
    expect(result).toBeTruthy();
  });

  test("sender in activeMode=client fails driver role check", async () => {
    const db = mockFirestore({
      role: "sender",
      activeMode: "client",
      driverUnlocked: false,
    });
    await expect(assertUserRole(db, "user-1", "driver")).rejects.toThrow(
      HttpsError
    );
    try {
      await assertUserRole(db, "user-1", "driver");
    } catch (err: any) {
      expect(err.code).toBe("permission-denied");
    }
  });

  test("defaults role to sender when not set", async () => {
    const db = mockFirestore({ activeMode: "client" });
    const result = await assertUserRole(db, "user-1", "sender");
    expect(result).toBeTruthy();
  });

  test("defaults activeMode to client when not set", async () => {
    const db = mockFirestore({ role: "sender" });
    const result = await assertUserRole(db, "user-1", "sender");
    expect(result).toBeTruthy();
  });
});

// ===========================
// assertUserActive
// ===========================
describe("assertUserActive", () => {
  test("passes for active user", async () => {
    const db = mockFirestore({ status: "active" });
    await expect(assertUserActive(db, "user-1")).resolves.toBeUndefined();
  });

  test("throws for suspended user", async () => {
    const db = mockFirestore({ status: "suspended" });
    await expect(assertUserActive(db, "user-1")).rejects.toThrow(HttpsError);
  });

  test("throws for blocked user", async () => {
    const db = mockFirestore({ status: "blocked" });
    await expect(assertUserActive(db, "user-1")).rejects.toThrow(HttpsError);
  });

  test("throws not-found for missing user", async () => {
    const db = mockFirestore(null);
    await expect(assertUserActive(db, "missing")).rejects.toThrow(HttpsError);
    try {
      await assertUserActive(db, "missing");
    } catch (err: any) {
      expect(err.code).toBe("not-found");
    }
  });
});

// ===========================
// assertDriverApproved
// ===========================
describe("assertDriverApproved", () => {
  test("passes for approved KYC driver", async () => {
    const db = mockFirestore({ status: "active", kycStatus: "approved" });
    await expect(assertDriverApproved(db, "d1")).resolves.toBeUndefined();
  });

  test("passes for grandfathered Glide driver (driverUnlocked)", async () => {
    const db = mockFirestore({
      status: "active",
      kycStatus: "pending",
      driverUnlocked: true,
    });
    await expect(assertDriverApproved(db, "d1")).resolves.toBeUndefined();
  });

  test("throws for pending KYC without driverUnlocked", async () => {
    const db = mockFirestore({
      status: "active",
      kycStatus: "pending",
      driverUnlocked: false,
    });
    await expect(assertDriverApproved(db, "d1")).rejects.toThrow(HttpsError);
    try {
      await assertDriverApproved(db, "d1");
    } catch (err: any) {
      expect(err.code).toBe("permission-denied");
    }
  });

  test("throws for inactive user even with approved KYC", async () => {
    const db = mockFirestore({ status: "suspended", kycStatus: "approved" });
    await expect(assertDriverApproved(db, "d1")).rejects.toThrow(HttpsError);
    try {
      await assertDriverApproved(db, "d1");
    } catch (err: any) {
      expect(err.code).toBe("permission-denied");
    }
  });

  test("throws not-found for missing user", async () => {
    const db = mockFirestore(null);
    await expect(assertDriverApproved(db, "missing")).rejects.toThrow(
      HttpsError
    );
    try {
      await assertDriverApproved(db, "missing");
    } catch (err: any) {
      expect(err.code).toBe("not-found");
    }
  });
});

// ===========================
// State machine integrity checks
// ===========================
describe("state machine integrity", () => {
  test("completed_paid has no outgoing transitions", () => {
    expect(STATUS_TRANSITIONS["completed_paid"]).toEqual([]);
  });

  test("cancelled has no outgoing transitions", () => {
    expect(STATUS_TRANSITIONS["cancelled"]).toEqual([]);
  });

  test("every transition in TRANSITION_ACTORS exists in STATUS_TRANSITIONS", () => {
    for (const key of Object.keys(TRANSITION_ACTORS)) {
      const [from, to] = key.split(" -> ") as [DeliveryStatus, DeliveryStatus];
      expect(STATUS_TRANSITIONS[from]).toBeDefined();
      expect(STATUS_TRANSITIONS[from]).toContain(to);
    }
  });

  test("every transition in STATUS_TRANSITIONS has an actor entry", () => {
    for (const [from, targets] of Object.entries(STATUS_TRANSITIONS)) {
      for (const to of targets) {
        const key = `${from} -> ${to}`;
        expect(TRANSITION_ACTORS[key]).toBeDefined();
        expect(TRANSITION_ACTORS[key].length).toBeGreaterThan(0);
      }
    }
  });

  test("TERMINAL_STATUSES matches statuses with empty transition arrays", () => {
    const emptyTransitions = Object.entries(STATUS_TRANSITIONS)
      .filter(([, targets]) => targets.length === 0)
      .map(([status]) => status);
    expect(TERMINAL_STATUSES.sort()).toEqual(emptyTransitions.sort());
  });
});
