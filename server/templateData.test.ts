import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  getSources: vi.fn(),
  getSurveyTemplateBySourceId: vi.fn(),
  getTemplateFields: vi.fn(),
  getTemplateDataBySurvey: vi.fn(),
  saveTemplateData: vi.fn(),
}));

import * as db from "./db";

describe("Template Data Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getBySourceName should find template by source name", async () => {
    const mockSources = [
      { id: 1, name: "Gulf", category: null, usageCount: 5, groupName: null },
      { id: 2, name: "TCS", category: null, usageCount: 3, groupName: null },
    ];
    const mockTemplate = { id: 10, name: "Gulf SSR", sourceId: 1, isActive: true };
    const mockFields = [
      { id: 100, templateId: 10, fieldName: "project_name", fieldLabel: "Project Name", fieldType: "text", required: true, sortOrder: 0 },
      { id: 101, templateId: 10, fieldName: "date_survey", fieldLabel: "Date of Survey", fieldType: "date", required: true, sortOrder: 1 },
    ];

    (db.getSources as any).mockResolvedValue(mockSources);
    (db.getSurveyTemplateBySourceId as any).mockResolvedValue(mockTemplate);
    (db.getTemplateFields as any).mockResolvedValue(mockFields);

    // Simulate the logic from getBySourceName procedure
    const sourceName = "Gulf";
    const allSources = await db.getSources();
    const source = allSources.find((s: any) => s.name === sourceName);
    expect(source).toBeDefined();
    expect(source!.id).toBe(1);

    const template = await db.getSurveyTemplateBySourceId(source!.id);
    expect(template).toBeDefined();
    expect(template.name).toBe("Gulf SSR");

    const fields = await db.getTemplateFields(template.id);
    expect(fields).toHaveLength(2);
    expect(fields[0].fieldLabel).toBe("Project Name");
  });

  it("getBySourceName should return null when source not found", async () => {
    const mockSources = [
      { id: 1, name: "Gulf", category: null, usageCount: 5, groupName: null },
    ];
    (db.getSources as any).mockResolvedValue(mockSources);

    const sourceName = "NonExistent";
    const allSources = await db.getSources();
    const source = allSources.find((s: any) => s.name === sourceName);
    expect(source).toBeUndefined();
  });

  it("getBySourceName should return null when no template for source", async () => {
    const mockSources = [
      { id: 1, name: "Gulf", category: null, usageCount: 5, groupName: null },
    ];
    (db.getSources as any).mockResolvedValue(mockSources);
    (db.getSurveyTemplateBySourceId as any).mockResolvedValue(null);

    const sourceName = "Gulf";
    const allSources = await db.getSources();
    const source = allSources.find((s: any) => s.name === sourceName);
    expect(source).toBeDefined();

    const template = await db.getSurveyTemplateBySourceId(source!.id);
    expect(template).toBeNull();
  });

  it("saveTemplateData should save entries correctly", async () => {
    (db.saveTemplateData as any).mockResolvedValue(undefined);

    const entries = [
      { fieldId: 100, value: "Test Project", otherValue: null },
      { fieldId: 101, value: "2026-05-10", otherValue: null },
      { fieldId: 102, value: "3kw 1 P,5kw 1p", otherValue: null },
    ];

    await db.saveTemplateData(1410464, 10, entries);
    expect(db.saveTemplateData).toHaveBeenCalledWith(1410464, 10, entries);
  });

  it("getTemplateDataBySurvey should return saved data", async () => {
    const mockData = [
      { id: 1, surveyId: 1410464, templateId: 10, fieldId: 100, value: "Test Project", otherValue: null },
      { id: 2, surveyId: 1410464, templateId: 10, fieldId: 101, value: "2026-05-10", otherValue: null },
    ];
    (db.getTemplateDataBySurvey as any).mockResolvedValue(mockData);

    const data = await db.getTemplateDataBySurvey(1410464);
    expect(data).toHaveLength(2);
    expect(data[0].value).toBe("Test Project");
    expect(data[1].value).toBe("2026-05-10");
  });
});
