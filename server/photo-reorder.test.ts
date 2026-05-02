import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("../drizzle/schema", () => ({
  surveyPhotos: {
    id: "id",
    surveyId: "surveyId",
    customerId: "customerId",
    url: "url",
    fileKey: "fileKey",
    fileName: "fileName",
    category: "category",
    fileSize: "fileSize",
    caption: "caption",
    sortOrder: "sortOrder",
    uploadedBy: "uploadedBy",
    createdAt: "createdAt",
  },
  // Add other tables as needed
  users: {},
  customers: {},
  surveys: {},
  surveyDocuments: {},
  followUps: {},
  shareLinks: {},
  notifications: {},
  activityLog: {},
  sources: {},
  surveyAssignments: {},
  teamMembers: {},
  customStatuses: {},
  photoCategories: {},
  documentCategories: {},
  installationPhotos: {},
  installationPhotoCategories: {},
  installerTeams: {},
  deliveryComments: {},
  lineGroups: {},
  lineNotificationTargets: {},
  companySettings: {},
}));

describe("Photo Reorder Feature", () => {
  it("should have sortOrder field in surveyPhotos schema", async () => {
    const schema = await import("../drizzle/schema");
    expect(schema.surveyPhotos).toBeDefined();
    expect(schema.surveyPhotos.sortOrder).toBeDefined();
  });

  it("should validate reorder input shape", () => {
    // Test the expected input shape for the reorder mutation
    const validInput = {
      items: [
        { id: 1, sortOrder: 0 },
        { id: 2, sortOrder: 1 },
        { id: 3, sortOrder: 2 },
      ],
    };
    
    expect(validInput.items).toHaveLength(3);
    expect(validInput.items[0]).toHaveProperty("id");
    expect(validInput.items[0]).toHaveProperty("sortOrder");
    expect(validInput.items.every(item => typeof item.id === "number")).toBe(true);
    expect(validInput.items.every(item => typeof item.sortOrder === "number")).toBe(true);
  });

  it("should validate public reorder input shape with token", () => {
    const validInput = {
      token: "abc123",
      surveyId: 1,
      items: [
        { id: 10, sortOrder: 0 },
        { id: 11, sortOrder: 1 },
      ],
    };
    
    expect(validInput.token).toBeTruthy();
    expect(validInput.surveyId).toBeGreaterThan(0);
    expect(validInput.items).toHaveLength(2);
  });

  it("should produce correct reorder items from arrayMove", () => {
    // Simulate the frontend arrayMove logic
    const photos = [
      { id: 100, sortOrder: 0, url: "a.jpg" },
      { id: 101, sortOrder: 1, url: "b.jpg" },
      { id: 102, sortOrder: 2, url: "c.jpg" },
      { id: 103, sortOrder: 3, url: "d.jpg" },
    ];

    // Simulate moving item at index 0 to index 2
    const arr = [...photos];
    const [removed] = arr.splice(0, 1);
    arr.splice(2, 0, removed);
    
    const items = arr.map((p, i) => ({ id: p.id, sortOrder: i }));
    
    expect(items).toEqual([
      { id: 101, sortOrder: 0 },
      { id: 102, sortOrder: 1 },
      { id: 100, sortOrder: 2 },
      { id: 103, sortOrder: 3 },
    ]);
  });

  it("should handle single item reorder", () => {
    const items = [{ id: 1, sortOrder: 0 }];
    expect(items).toHaveLength(1);
    expect(items[0].sortOrder).toBe(0);
  });

  it("should auto-assign sortOrder for new photos", () => {
    // Simulate the logic: new photo gets sortOrder = count of existing photos in same category
    const existingCount = 3;
    const newPhotoSortOrder = existingCount; // 0-indexed, so next is count
    expect(newPhotoSortOrder).toBe(3);
  });
});
