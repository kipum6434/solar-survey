import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

const testCtx = {
  user: { id: 1, openId: "test-open-id", name: "Test Vitest User", role: "admin" },
};

function createCaller() {
  return appRouter.createCaller(testCtx as any);
}

describe("Team Member CRUD", () => {
  let memberId: number;

  it("teamMember.create creates a new team member", async () => {
    const caller = createCaller();
    const result = await caller.teamMember.create({
      name: "Test Admin Sender",
      role: "admin_sender",
    });
    expect(result).toBeDefined();
    expect(result.id).toBeGreaterThan(0);
    expect(result.name).toBe("Test Admin Sender");
    expect(result.role).toBe("admin_sender");
    memberId = result.id;
  });

  it("teamMember.list returns members filtered by role", async () => {
    const caller = createCaller();
    // Create additional members
    await caller.teamMember.create({ name: "Test Surveyor 1", role: "surveyor" });
    await caller.teamMember.create({ name: "Test Closer 1", role: "closer" });

    const adminSenders = await caller.teamMember.list({ role: "admin_sender" });
    expect(Array.isArray(adminSenders)).toBe(true);
    expect(adminSenders.some((m: any) => m.name === "Test Admin Sender")).toBe(true);

    const surveyors = await caller.teamMember.list({ role: "surveyor" });
    expect(Array.isArray(surveyors)).toBe(true);
    expect(surveyors.some((m: any) => m.name === "Test Surveyor 1")).toBe(true);

    const closers = await caller.teamMember.list({ role: "closer" });
    expect(Array.isArray(closers)).toBe(true);
    expect(closers.some((m: any) => m.name === "Test Closer 1")).toBe(true);
  });

  it("teamMember.list without role returns all members", async () => {
    const caller = createCaller();
    const all = await caller.teamMember.list({});
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThanOrEqual(3);
  });

  it("teamMember.update updates a member name and role", async () => {
    const caller = createCaller();
    const updated = await caller.teamMember.update({
      id: memberId,
      name: "Updated Admin Sender",
      role: "closer",
    });
    expect(updated.name).toBe("Updated Admin Sender");
    expect(updated.role).toBe("closer");
  });

  it("teamMember.delete removes a member", async () => {
    const caller = createCaller();
    const result = await caller.teamMember.delete({ id: memberId });
    expect(result.success).toBe(true);

    // Verify it's gone
    const all = await caller.teamMember.list({});
    expect(all.some((m: any) => m.id === memberId)).toBe(false);
  });
});
