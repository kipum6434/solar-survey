import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      role: "admin",
      name: "Admin User",
      openId: "admin-test-color",
    } as AuthenticatedUser,
  };
}

vi.mock("./db", async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    createInstallerTeam: vi.fn().mockResolvedValue({ id: 1, name: "ทีม A", color: "#FF5733" }),
    getInstallerTeams: vi.fn().mockResolvedValue([
      { id: 1, name: "ทีม A", color: "#FF5733", memberCount: 3 },
      { id: 2, name: "ทีม B", color: "#33FF57", memberCount: 2 },
    ]),
    updateInstallerTeam: vi.fn().mockResolvedValue({ id: 1, name: "ทีม A Updated", color: "#0000FF" }),
  };
});

describe("Installer Team Color", () => {
  const caller = appRouter.createCaller(createAdminContext());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create team with color", async () => {
    const result = await caller.installerTeam.create({
      name: "ทีม A",
      color: "#FF5733",
    });
    expect(result).toBeDefined();
  });

  it("should create team without color (optional)", async () => {
    const { createInstallerTeam } = await import("./db");
    (createInstallerTeam as any).mockResolvedValueOnce({ id: 2, name: "ทีม B", color: null });
    const result = await caller.installerTeam.create({
      name: "ทีม B",
    });
    expect(result).toBeDefined();
  });

  it("should list teams with color", async () => {
    const result = await caller.installerTeam.list();
    expect(result).toHaveLength(2);
    expect(result[0].color).toBe("#FF5733");
    expect(result[1].color).toBe("#33FF57");
  });

  it("should update team color", async () => {
    const result = await caller.installerTeam.update({
      id: 1,
      name: "ทีม A Updated",
      color: "#0000FF",
    });
    expect(result).toBeDefined();
  });

  it("should accept valid hex color format", async () => {
    const result = await caller.installerTeam.create({
      name: "ทีม C",
      color: "#AABBCC",
    });
    expect(result).toBeDefined();
  });
});
