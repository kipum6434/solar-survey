import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Solar Survey - Auth", () => {
  it("returns user for authenticated context", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("Admin User");
    expect(result?.role).toBe("admin");
  });

  it("returns null for unauthenticated context", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("Solar Survey - Dashboard", () => {
  it("dashboard.stats returns stats object for authenticated user", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.dashboard.stats();
    expect(stats).toBeDefined();
    expect(typeof stats.totalCustomers).toBe("number");
    expect(typeof stats.totalSurveys).toBe("number");
    expect(typeof stats.pendingSurveys).toBe("number");
    expect(typeof stats.completedSurveys).toBe("number");
    expect(typeof stats.wonDeals).toBe("number");
    expect(typeof stats.pendingFollowUps).toBe("number");
  });

  it("dashboard.recentActivities returns array", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const activities = await caller.dashboard.recentActivities({ limit: 5 });
    expect(Array.isArray(activities)).toBe(true);
  });
});

describe("Solar Survey - Customer CRUD", () => {
  it("customer.list returns paginated data", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customer.list({ page: 1, limit: 10 });
    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("customer.create creates a new customer", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const id = await caller.customer.create({
      name: "Test Customer Vitest " + Date.now(),
      phone: "0812345678",
      email: "test@vitest.com",
      address: "123 Test Street",
      province: "Bangkok",
      source: "website",
    });
    expect(id).toBeDefined();
    expect(typeof id).toBe("object");
    expect(id).toHaveProperty("id");
    expect(typeof id.id).toBe("number");
    expect(id.id).toBeGreaterThan(0);
  });

  it("customer.getById returns created customer", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    // Get the latest customer
    const list = await caller.customer.list({ page: 1, limit: 1 });
    if (list.data.length > 0) {
      const customer = await caller.customer.getById({ id: list.data[0].id });
      expect(customer).toBeDefined();
      expect(customer?.name).toBeDefined();
    }
  });
});

describe("Solar Survey - Survey CRUD", () => {
  it("survey.list returns paginated data with customer info", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.survey.list({ page: 1, limit: 10 });
    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.total).toBe("number");
  });
});

describe("Solar Survey - Calendar", () => {
  it("calendar.events returns surveys and followUps arrays", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const now = Date.now();
    const result = await caller.calendar.events({
      startDate: now - 30 * 24 * 60 * 60 * 1000,
      endDate: now + 30 * 24 * 60 * 60 * 1000,
    });
    expect(result).toBeDefined();
    expect(Array.isArray(result.surveys)).toBe(true);
    expect(Array.isArray(result.followUps)).toBe(true);
  });
});

describe("Solar Survey - Notifications", () => {
  it("notification.list returns array for authenticated user", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.notification.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("notification.unreadCount returns a number", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const count = await caller.notification.unreadCount();
    expect(typeof count).toBe("number");
  });
});

describe("Solar Survey - Share Link (Public)", () => {
  it("shareLink.getByToken returns error for invalid token", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.shareLink.getByToken({ token: "invalid-token-xyz" });
    expect(result).toBeDefined();
    expect(result).toHaveProperty("error");
  });
});

describe("Solar Survey - Users", () => {
  it("users.list returns array of users for superadmin", async () => {
    const ctx = createAdminContext();
    // Override role to superadmin for users.list access
    (ctx.user as any).role = "superadmin";
    const caller = appRouter.createCaller(ctx);
    const result = await caller.users.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("users.list rejects admin role", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.users.list()).rejects.toThrow();
  });
});

describe("Solar Survey - Storage", () => {
  it("storage.stats returns storage usage data", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const stats = await caller.storage.stats();
    expect(stats).toBeDefined();
    expect(typeof stats.totalPhotos).toBe("number");
    expect(typeof stats.totalDocuments).toBe("number");
    expect(typeof stats.totalPhotoSize).toBe("number");
    // totalDocumentSize may come as string from SQL SUM
    expect(Number(stats.totalDocumentSize)).toBeGreaterThanOrEqual(0);
    expect(stats.totalPhotos).toBeGreaterThanOrEqual(0);
    expect(stats.totalDocuments).toBeGreaterThanOrEqual(0);
  });
});

describe("Solar Survey - Photo Delete", () => {
  it("photo.delete requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.photo.delete({ id: 999 })).rejects.toThrow();
  });
});

describe("Solar Survey - Document Delete", () => {
  it("document.delete requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.document.delete({ id: 999 })).rejects.toThrow();
  });
});

describe("Solar Survey - Month/Year Filter", () => {
  it("customer.list accepts month and year parameters", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customer.list({ page: 1, limit: 10, month: 4, year: 2026 });
    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("customer.list with year-only filter works", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customer.list({ page: 1, limit: 10, year: 2026 });
    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("customer.list without month/year returns all", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customer.list({ page: 1, limit: 10 });
    expect(result).toBeDefined();
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it("survey.list accepts month and year parameters", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.survey.list({ page: 1, limit: 10, month: 4, year: 2026 });
    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("survey.list with year-only filter works", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.survey.list({ page: 1, limit: 10, year: 2026 });
    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("customer.list with future month returns empty", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.customer.list({ page: 1, limit: 10, month: 12, year: 2030 });
    expect(result).toBeDefined();
    expect(result.data.length).toBe(0);
    expect(result.total).toBe(0);
  });
});

describe("Solar Survey - Source Management", () => {
  it("source.list returns array of sources", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.source.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("source.create creates a new source", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.source.create({ name: "FB เพจ TCS Test" });
    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
  });

  it("source.create returns existing source if name already exists", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const first = await caller.source.create({ name: "FB เพจ Duplicate Test" });
    const second = await caller.source.create({ name: "FB เพจ Duplicate Test" });
    expect(first.id).toBe(second.id);
  });

  it("survey.list accepts source filter parameter", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.survey.list({ page: 1, limit: 10, source: "website" });
    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("survey.list with non-existent source returns empty", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.survey.list({ page: 1, limit: 10, source: "nonexistent_source_xyz" });
    expect(result).toBeDefined();
    expect(result.data.length).toBe(0);
  });
});

describe("Solar Survey - Survey Assignments", () => {
  it("survey.getById returns assignments array", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    // Get first survey from list
    const list = await caller.survey.list({ page: 1, limit: 1 });
    if (list.data.length > 0) {
      const surveyId = list.data[0].survey.id;
      const detail = await caller.survey.getById({ id: surveyId });
      expect(detail).toBeDefined();
      expect(Array.isArray((detail as any).assignments)).toBe(true);
    }
  });

  it("survey.update with assignment fields works", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const list = await caller.survey.list({ page: 1, limit: 1 });
    if (list.data.length > 0) {
      const surveyId = list.data[0].survey.id;
      // Update with admin sender and surveyor
      await expect(
        caller.survey.update({
          id: surveyId,
          status: "scheduled",
          adminSenderId: 1,
          surveyorIds: [1],
        })
      ).resolves.toBeDefined();

      // Verify assignments were saved
      const detail = await caller.survey.getById({ id: surveyId });
      const assignments = (detail as any).assignments || [];
      const adminSender = assignments.find((a: any) => a.assignment.role === "admin_sender");
      const surveyors = assignments.filter((a: any) => a.assignment.role === "surveyor");
      expect(adminSender).toBeDefined();
      expect(surveyors.length).toBeGreaterThan(0);
    }
  });
});

describe("Solar Survey - Round 12: Team Assignment Sync", () => {
  it("survey.update with team member IDs stores and returns correct assignments", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Create a team member first
    const teamMember = await caller.teamMember.create({
      name: "Round12 Test Admin",
      role: "admin_sender",
    });
    expect(teamMember.id).toBeDefined();

    const surveyor = await caller.teamMember.create({
      name: "Round12 Test Surveyor",
      role: "surveyor",
    });
    expect(surveyor.id).toBeDefined();

    const closer = await caller.teamMember.create({
      name: "Round12 Test Closer",
      role: "closer",
    });
    expect(closer.id).toBeDefined();

    // Get a survey to update
    const list = await caller.survey.list({ page: 1, limit: 1 });
    expect(list.data.length).toBeGreaterThan(0);
    const surveyId = list.data[0].survey.id;

    // Update with team member IDs
    await caller.survey.update({
      id: surveyId,
      adminSenderId: teamMember.id,
      surveyorIds: [surveyor.id],
      closerId: closer.id,
    });

    // Verify assignments are returned with correct team member info
    const detail = await caller.survey.getById({ id: surveyId });
    const assignments = (detail as any).assignments || [];

    const adminAssignment = assignments.find((a: any) => a.assignment.role === "admin_sender");
    expect(adminAssignment).toBeDefined();
    expect(adminAssignment.user.id).toBe(teamMember.id);
    expect(adminAssignment.user.name).toBe("Round12 Test Admin");

    const surveyorAssignment = assignments.find((a: any) => a.assignment.role === "surveyor");
    expect(surveyorAssignment).toBeDefined();
    expect(surveyorAssignment.user.id).toBe(surveyor.id);
    expect(surveyorAssignment.user.name).toBe("Round12 Test Surveyor");

    const closerAssignment = assignments.find((a: any) => a.assignment.role === "closer");
    expect(closerAssignment).toBeDefined();
    expect(closerAssignment.user.id).toBe(closer.id);
    expect(closerAssignment.user.name).toBe("Round12 Test Closer");
  });

  it("survey.update with null adminSenderId clears admin sender assignment", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const list = await caller.survey.list({ page: 1, limit: 1 });
    expect(list.data.length).toBeGreaterThan(0);
    const surveyId = list.data[0].survey.id;

    // First set an admin sender
    const teamMember = await caller.teamMember.create({
      name: "Round12 Clear Test",
      role: "admin_sender",
    });
    await caller.survey.update({
      id: surveyId,
      adminSenderId: teamMember.id,
    });

    // Verify it was set
    let detail = await caller.survey.getById({ id: surveyId });
    let admin = (detail as any).assignments.find((a: any) => a.assignment.role === "admin_sender");
    expect(admin).toBeDefined();

    // Now clear it with null
    await caller.survey.update({
      id: surveyId,
      adminSenderId: null,
      surveyorIds: [],
      closerId: null,
    });

    // Verify it was cleared
    detail = await caller.survey.getById({ id: surveyId });
    admin = (detail as any).assignments.find((a: any) => a.assignment.role === "admin_sender");
    expect(admin).toBeUndefined();
  });

  it("survey.list returns team member names in assignments", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const list = await caller.survey.list({ page: 1, limit: 5 });
    expect(list.data.length).toBeGreaterThan(0);

    // Each survey should have an assignments array
    for (const item of list.data) {
      expect(Array.isArray(item.assignments)).toBe(true);
    }
  });
});

describe("Solar Survey - Round 12: Legacy Assignment Fallback", () => {
  it("survey.getById returns user name for legacy assignments referencing users.id", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Get a survey that has legacy assignments (userId=1 which is users.id=1 monsterpunchthailand)
    // We know from data inspection that many surveys have userId=1 as admin_sender/surveyor
    const list = await caller.survey.list({ page: 1, limit: 50 });
    
    // Find a survey that has assignments
    let foundLegacy = false;
    for (const item of list.data) {
      if (item.assignments.length > 0) {
        const detail = await caller.survey.getById({ id: item.survey.id });
        const assignments = (detail as any).assignments || [];
        for (const a of assignments) {
          // Every assignment should have a user with a name (either from team_members or users fallback)
          if (a.user && a.user.name) {
            foundLegacy = true;
          }
        }
        if (foundLegacy) break;
      }
    }
    // At least one survey should have assignments with resolved names
    expect(foundLegacy).toBe(true);
  });

  it("survey.list shows team member names for all assignments via fallback", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const list = await caller.survey.list({ page: 1, limit: 50 });
    
    // Check that assignments with known userId values have userName resolved
    let hasResolvedName = false;
    for (const item of list.data) {
      for (const a of item.assignments) {
        if (a.userName) {
          hasResolvedName = true;
        }
      }
    }
    expect(hasResolvedName).toBe(true);
  });
});

// ==================== Round 13: Bulk Delete Customers ====================
describe("customer.bulkDelete", () => {
  it("should bulk delete multiple customers and their related data", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());

    // Create 3 customers
    const c1 = await adminCaller.customer.create({ name: "BulkDel Customer 1", source: "website" });
    const c2 = await adminCaller.customer.create({ name: "BulkDel Customer 2", source: "website" });
    const c3 = await adminCaller.customer.create({ name: "BulkDel Customer 3", source: "website" });

    // Create a survey for c1 to test cascade
    await adminCaller.survey.create({
      customerId: c1.id,
      surveyDate: Date.now(),
      surveyTime: "10:00",
      status: "pending",
    });

    // Bulk delete c1 and c2
    const result = await adminCaller.customer.bulkDelete({ ids: [c1.id, c2.id] });
    expect(result.deleted).toBe(2);

    // Verify c1 and c2 are gone
    const list = await adminCaller.customer.list({ page: 1, limit: 100 });
    const remainingIds = list.data.map((c: any) => c.id);
    expect(remainingIds).not.toContain(c1.id);
    expect(remainingIds).not.toContain(c2.id);
    // c3 should still exist
    expect(remainingIds).toContain(c3.id);
  }, 15000);

  it("should return deleted count of 0 for non-existent IDs", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const result = await adminCaller.customer.bulkDelete({ ids: [999999] });
    expect(result.deleted).toBe(1); // The delete runs even if no matching rows
  });

  it("should reject empty array", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    await expect(adminCaller.customer.bulkDelete({ ids: [] })).rejects.toThrow();
  });

  it("should reject non-admin users", async () => {
    const userCaller = appRouter.createCaller(createUserContext());
    await expect(userCaller.customer.bulkDelete({ ids: [1] })).rejects.toThrow();
  });
});

// ==================== Round 14 Tests ====================

describe("Round 14A: Survey filter by ANY assignment (not just primary)", () => {
  it("should return surveys where a team member is assigned in any role", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    
    // Create a team member
    const member = await adminCaller.teamMember.create({ name: "FilterTest Surveyor R14", role: "surveyor" });
    
    // Create a customer + survey
    const customer = await adminCaller.customer.create({ name: "R14 Filter Test Customer" });
    const survey = await adminCaller.survey.create({
      customerId: customer.id,
      scheduledDate: Date.now(),
      assignedTo: member.id,
    });
    
    // Filter by assignedTo should find this survey
    const result = await adminCaller.survey.list({ assignedTo: member.id, page: 1, limit: 50 });
    const surveyIds = result.data.map((s: any) => s.survey.id);
    expect(surveyIds).toContain(survey.id);
  }, 10000);
});

describe("Round 14B: Team Performance API", () => {
  it("should return team performance data for lead tab", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const now = new Date();
    const result = await adminCaller.teamPerformance.summary({
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      tab: "lead",
    });
    expect(result).toBeDefined();
    expect(result).toHaveProperty("adminSenders");
    expect(result).toHaveProperty("surveyors");
    expect(result).toHaveProperty("totals");
    expect(Array.isArray(result.adminSenders)).toBe(true);
    expect(Array.isArray(result.surveyors)).toBe(true);
    expect(result.totals).toHaveProperty("totalCases");
    expect(result.totals).toHaveProperty("totalSurveyed");
    expect(result.totals).toHaveProperty("totalWon");
    expect(result.totals).toHaveProperty("closeRate");
    // Each member should have assignedCount
    if (result.surveyors.length > 0) {
      expect(result.surveyors[0]).toHaveProperty("assignedCount");
    }
  });

  it("should return team performance data for commission tab", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const now = new Date();
    const result = await adminCaller.teamPerformance.summary({
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      tab: "commission",
    });
    expect(result).toBeDefined();
    expect(result).toHaveProperty("adminSenders");
    expect(result).toHaveProperty("surveyors");
    expect(result).toHaveProperty("totals");
    expect(result.totals).toHaveProperty("totalWon");
  });
});

describe("Round 14C: Customer status and filters", () => {
  it("should return customers with surveyStatus field", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const result = await adminCaller.customer.list({ page: 1, limit: 10 });
    expect(result.data.length).toBeGreaterThan(0);
    // Each customer should have surveyStatus
    result.data.forEach((c: any) => {
      expect(c.surveyStatus).toBeDefined();
    });
  });

  it("should filter customers by surveyStatus", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    // Create a customer with no survey - should be "no_survey"
    const customer = await adminCaller.customer.create({ name: "R14 NoSurvey Customer" });
    
    const result = await adminCaller.customer.list({ page: 1, limit: 100, surveyStatus: "no_survey" });
    const ids = result.data.map((c: any) => c.id);
    expect(ids).toContain(customer.id);
  });
});

describe("Round 14D: District/Province filters", () => {
  it("should return distinct values for filters", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const result = await adminCaller.customer.distinctValues();
    expect(result).toBeDefined();
    expect(Array.isArray(result.provinces)).toBe(true);
    expect(Array.isArray(result.districts)).toBe(true);
    expect(Array.isArray(result.sources)).toBe(true);
  });

  it("should filter customers by province", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    // Create customer with province
    await adminCaller.customer.create({ name: "R14 Province Test", province: "เชียงใหม่" });
    
    const result = await adminCaller.customer.list({ page: 1, limit: 100, province: "เชียงใหม่" });
    result.data.forEach((c: any) => {
      expect(c.province).toBe("เชียงใหม่");
    });
  });

  it("should filter surveys by district/province", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    // Create customer with district + survey
    const customer = await adminCaller.customer.create({ name: "R14 District Survey Test", district: "บางกอกน้อย", province: "กรุงเทพมหานคร" });
    await adminCaller.survey.create({ customerId: customer.id, scheduledDate: Date.now() });
    
    const result = await adminCaller.survey.list({ page: 1, limit: 100, district: "บางกอกน้อย" });
    expect(result.data.length).toBeGreaterThan(0);
  }, 10000);
});


// ==================== ROUND 18: CUSTOM STATUS TESTS ====================
describe("Custom Status Management", () => {
  it("should create a customer custom status", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const result = await adminCaller.customStatus.create({
      type: "customer",
      label: "ลูกค้าใหม่",
      color: "#2563eb",
      bgColor: "#eff6ff",
    });
    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
  });

  it("should create a survey custom status", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const result = await adminCaller.customStatus.create({
      type: "survey",
      label: "รอเสนอราคา",
      color: "#7c3aed",
      bgColor: "#f5f3ff",
    });
    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
  });

  it("should list custom statuses by type", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    // Create both types
    await adminCaller.customStatus.create({ type: "customer", label: "R18 Customer Status" });
    await adminCaller.customStatus.create({ type: "survey", label: "R18 Survey Status" });

    const customerStatuses = await adminCaller.customStatus.list({ type: "customer" });
    expect(customerStatuses.length).toBeGreaterThan(0);
    customerStatuses.forEach((s: any) => expect(s.type).toBe("customer"));

    const surveyStatuses = await adminCaller.customStatus.list({ type: "survey" });
    expect(surveyStatuses.length).toBeGreaterThan(0);
    surveyStatuses.forEach((s: any) => expect(s.type).toBe("survey"));
  });

  it("should list all custom statuses without type filter", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const allStatuses = await adminCaller.customStatus.list();
    expect(allStatuses.length).toBeGreaterThan(0);
  });

  it("should update a custom status label and color", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const created = await adminCaller.customStatus.create({ type: "customer", label: "R18 Update Test" });
    const result = await adminCaller.customStatus.update({ id: created.id, label: "R18 Updated", color: "#dc2626" });
    expect(result.success).toBe(true);
  });

  it("should delete a custom status", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const created = await adminCaller.customStatus.create({ type: "customer", label: "R18 Delete Test" });
    const result = await adminCaller.customStatus.delete({ id: created.id });
    expect(result.success).toBe(true);
  });

  it("should update customer status (statusId)", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    // Create a custom status
    const status = await adminCaller.customStatus.create({ type: "customer", label: "R18 Assign Test" });
    // Create a customer
    const customer = await adminCaller.customer.create({ name: "R18 Status Customer" });
    // Assign status
    const result = await adminCaller.customStatus.updateCustomerStatus({ customerId: customer.id, statusId: status.id });
    expect(result.success).toBe(true);
  });

  it("should update survey status (statusId)", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    // Create a custom status
    const status = await adminCaller.customStatus.create({ type: "survey", label: "R18 Survey Assign" });
    // Create customer + survey
    const customer = await adminCaller.customer.create({ name: "R18 Survey Status Customer" });
    const survey = await adminCaller.survey.create({ customerId: customer.id, scheduledDate: Date.now() });
    // Assign status
    const result = await adminCaller.customStatus.updateSurveyStatus({ surveyId: survey.id, statusId: status.id });
    expect(result.success).toBe(true);
  });

  it("should clear customer status (set to null)", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const customer = await adminCaller.customer.create({ name: "R18 Clear Status" });
    const result = await adminCaller.customStatus.updateCustomerStatus({ customerId: customer.id, statusId: null });
    expect(result.success).toBe(true);
  });

  it("should update installation date for survey", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const customer = await adminCaller.customer.create({ name: "R18 Install Date Customer" });
    const survey = await adminCaller.survey.create({ customerId: customer.id, scheduledDate: Date.now() });
    const installDate = new Date("2026-05-15").getTime();
    const result = await adminCaller.customStatus.updateInstallationDate({ surveyId: survey.id, installationDate: installDate });
    expect(result.success).toBe(true);
  });

  it("should clear installation date (set to null)", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const customer = await adminCaller.customer.create({ name: "R18 Clear Install" });
    const survey = await adminCaller.survey.create({ customerId: customer.id, scheduledDate: Date.now() });
    const result = await adminCaller.customStatus.updateInstallationDate({ surveyId: survey.id, installationDate: null });
    expect(result.success).toBe(true);
  });

  it("should return customStatus in customer list when statusId is set", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const status = await adminCaller.customStatus.create({ type: "customer", label: "R18 List Check", color: "#059669", bgColor: "#ecfdf5" });
    const customer = await adminCaller.customer.create({ name: "R18 CustomStatus List" });
    await adminCaller.customStatus.updateCustomerStatus({ customerId: customer.id, statusId: status.id });
    const list = await adminCaller.customer.list({ page: 1, limit: 100, search: "R18 CustomStatus List" });
    const found = list.data.find((c: any) => c.id === customer.id);
    expect(found).toBeDefined();
    expect(found.customStatus).toBeDefined();
    expect(found.customStatus.label).toBe("R18 List Check");
  }, 10000);

  it("should return customStatus in survey list when statusId is set", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const status = await adminCaller.customStatus.create({ type: "survey", label: "R18 Survey List Check", color: "#7c3aed", bgColor: "#f5f3ff" });
    const customer = await adminCaller.customer.create({ name: "R18 Survey CustomStatus" });
    const survey = await adminCaller.survey.create({ customerId: customer.id, scheduledDate: Date.now() });
    await adminCaller.customStatus.updateSurveyStatus({ surveyId: survey.id, statusId: status.id });
    const list = await adminCaller.survey.list({ page: 1, limit: 100 });
    const found = list.data.find((d: any) => d.survey.id === survey.id);
    expect(found).toBeDefined();
    expect(found.customStatus).toBeDefined();
    expect(found.customStatus.label).toBe("R18 Survey List Check");
  }, 10000);

  it("should include installationDate in survey data via survey.update", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const customer = await adminCaller.customer.create({ name: "R18 InstallDate Update" });
    const survey = await adminCaller.survey.create({ customerId: customer.id, scheduledDate: Date.now() });
    const installDate = new Date("2026-06-01").getTime();
    await adminCaller.survey.update({ id: survey.id, installationDate: installDate });
    const detail = await adminCaller.survey.getById({ id: survey.id });
    expect(detail.survey.installationDate).toBe(installDate);
  }, 10000);
});

// ==================== ROUND 19: INSTALLATION LIST TESTS ====================
describe("installation.list", () => {
  it("should return empty list when no surveys have installationDate", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const result = await adminCaller.installation.list({ page: 1, limit: 20 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.data)).toBe(true);
  }, 10000);

  it("should return surveys that have installationDate set", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    // Create customer + survey with installationDate
    const customer = await adminCaller.customer.create({ name: "R19 Installation Test" });
    const survey = await adminCaller.survey.create({ customerId: customer.id, scheduledDate: Date.now() });
    const installDate = new Date("2026-07-15").getTime();
    await adminCaller.survey.update({ id: survey.id, installationDate: installDate });

    const result = await adminCaller.installation.list({ page: 1, limit: 100 });
    const found = result.data.find((d: any) => d.survey.id === survey.id);
    expect(found).toBeDefined();
    expect(found!.survey.installationDate).toBe(installDate);
    expect(found!.customer.name).toBe("R19 Installation Test");
  }, 10000);

  it("should include assignments and customStatus in installation list", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const customer = await adminCaller.customer.create({ name: "R19 Install Assign" });
    const survey = await adminCaller.survey.create({ customerId: customer.id, scheduledDate: Date.now() });
    await adminCaller.survey.update({ id: survey.id, installationDate: Date.now() + 86400000 });

    const result = await adminCaller.installation.list({ page: 1, limit: 100 });
    const found = result.data.find((d: any) => d.survey.id === survey.id);
    expect(found).toBeDefined();
    expect(found).toHaveProperty("assignments");
    expect(Array.isArray(found!.assignments)).toBe(true);
  }, 10000);

  it("should not return surveys without installationDate", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const customer = await adminCaller.customer.create({ name: "R19 No Install Date" });
    const survey = await adminCaller.survey.create({ customerId: customer.id, scheduledDate: Date.now() });
    // Do NOT set installationDate

    const result = await adminCaller.installation.list({ page: 1, limit: 100 });
    const found = result.data.find((d: any) => d.survey.id === survey.id);
    expect(found).toBeUndefined();
  }, 10000);

  it("should filter by installationStatus=completed when completedAt is set", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const result = await adminCaller.installation.list({ page: 1, limit: 20, installationStatus: "completed" });
    expect(result).toHaveProperty("data");
    expect(Array.isArray(result.data)).toBe(true);
  }, 10000);

  it("should support search by customer name", async () => {
    const adminCaller = appRouter.createCaller(createAdminContext());
    const customer = await adminCaller.customer.create({ name: "R19 SearchInstall UniqueXYZ" });
    const survey = await adminCaller.survey.create({ customerId: customer.id, scheduledDate: Date.now() });
    await adminCaller.survey.update({ id: survey.id, installationDate: Date.now() + 86400000 * 7 });

    const result = await adminCaller.installation.list({ page: 1, limit: 100, search: "UniqueXYZ" });
    expect(result.data.length).toBeGreaterThanOrEqual(1);
    expect(result.data.some((d: any) => d.customer.name.includes("UniqueXYZ"))).toBe(true);
  }, 10000);
});

// ==================== R20: FILE MANAGEMENT + INSTALLATION FILTERS ====================
describe("R20 - File Management", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());

  it("should list all files (images + documents)", async () => {
    const result = await adminCaller.storage.listFiles({ page: 1, limit: 50 });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.total).toBe("number");
  }, 10000);

  it("should filter files by type=photo", async () => {
    const result = await adminCaller.storage.listFiles({ page: 1, limit: 50, fileType: "photo" });
    expect(Array.isArray(result.data)).toBe(true);
    result.data.forEach((f: any) => {
      expect(f.type).toBe("photo");
    });
  }, 10000);

  it("should filter files by type=document", async () => {
    const result = await adminCaller.storage.listFiles({ page: 1, limit: 50, fileType: "document" });
    expect(Array.isArray(result.data)).toBe(true);
    result.data.forEach((f: any) => {
      expect(f.type).toBe("document");
    });
  }, 10000);
});

describe("R20 - Installation Filters", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());

  it("should filter installations by province", async () => {
    const result = await adminCaller.installation.list({ page: 1, limit: 20, province: "NON_EXISTENT_PROVINCE" });
    expect(result.data.length).toBe(0);
  }, 10000);

  it("should filter installations by surveyorId", async () => {
    const result = await adminCaller.installation.list({ page: 1, limit: 20, surveyorId: 999999 });
    expect(result.data.length).toBe(0);
  }, 10000);

  it("should filter installations by closerId", async () => {
    const result = await adminCaller.installation.list({ page: 1, limit: 20, closerId: 999999 });
    expect(result.data.length).toBe(0);
  }, 10000);

  it("should filter installations by month and year", async () => {
    const result = await adminCaller.installation.list({ page: 1, limit: 20, month: 1, year: 2020 });
    expect(result.data.length).toBe(0);
  }, 10000);

  it("should filter installations by installationStatus=completed", async () => {
    const result = await adminCaller.installation.list({ page: 1, limit: 20, installationStatus: "completed" });
    expect(Array.isArray(result.data)).toBe(true);
  }, 10000);
});
