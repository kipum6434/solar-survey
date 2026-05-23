import { describe, it, expect, vi } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getTechnicalFieldDefinitions: vi.fn().mockResolvedValue([
    { id: 1, label: "ขนาดระบบ (kW)", fieldType: "text", fieldKey: "systemSize", isBuiltIn: true, isActive: true, sortOrder: 1, placeholder: "เช่น 5.5", options: null },
    { id: 2, label: "จำนวนแผง", fieldType: "number", fieldKey: "panelCount", isBuiltIn: true, isActive: true, sortOrder: 2, placeholder: "เช่น 12", options: null },
    { id: 9, label: "ขนาดสายไฟ", fieldType: "text", fieldKey: null, isBuiltIn: false, isActive: true, sortOrder: 9, placeholder: "เช่น 4 sq.mm", options: null },
  ]),
  getSurveyTechnicalValues: vi.fn().mockResolvedValue([
    { id: 1, surveyId: 100, fieldDefinitionId: 9, value: "4 sq.mm" },
  ]),
  setSurveyTechnicalValues: vi.fn().mockResolvedValue(undefined),
  createTechnicalFieldDefinition: vi.fn().mockResolvedValue({ id: 10, label: "Test Field" }),
  updateTechnicalFieldDefinition: vi.fn().mockResolvedValue(undefined),
  deleteTechnicalFieldDefinition: vi.fn().mockResolvedValue(undefined),
  reorderTechnicalFieldDefinitions: vi.fn().mockResolvedValue(undefined),
}));

describe("Technical Field Definitions", () => {
  it("should return field definitions with fieldKey for built-in fields", async () => {
    const db = await import("./db");
    const fields = await db.getTechnicalFieldDefinitions(true);
    expect(fields).toHaveLength(3);
    expect(fields[0].fieldKey).toBe("systemSize");
    expect(fields[0].isBuiltIn).toBe(true);
    expect(fields[2].fieldKey).toBeNull();
    expect(fields[2].isBuiltIn).toBe(false);
  });

  it("should get survey technical values", async () => {
    const db = await import("./db");
    const values = await db.getSurveyTechnicalValues(100);
    expect(values).toHaveLength(1);
    expect(values[0].fieldDefinitionId).toBe(9);
    expect(values[0].value).toBe("4 sq.mm");
  });

  it("should set survey technical values", async () => {
    const db = await import("./db");
    await db.setSurveyTechnicalValues(100, [
      { fieldDefinitionId: 9, value: "6 sq.mm" },
    ]);
    expect(db.setSurveyTechnicalValues).toHaveBeenCalledWith(100, [
      { fieldDefinitionId: 9, value: "6 sq.mm" },
    ]);
  });
});
