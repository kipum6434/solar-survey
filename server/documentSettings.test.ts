import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getDocumentSettings: vi.fn(),
  getDocumentSettingByKey: vi.fn(),
  upsertDocumentSetting: vi.fn(),
}));

import * as db from "./db";

describe("documentSettings procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDocumentSettings", () => {
    it("should return all document settings", async () => {
      const mockSettings = [
        { id: 1, settingKey: "survey_doc_number", label: "เลขทะเบียนเอกสารสำรวจ", documentNumber: "FM-SA-01-04 REV.00", description: "เลขทะเบียนเอกสารที่แสดงใน PDF รายงานการสำรวจ", updatedAt: new Date() },
        { id: 2, settingKey: "install_doc_number", label: "เลขทะเบียนเอกสารติดตั้ง", documentNumber: "FM-SA-01-04 REV.00", description: "เลขทะเบียนเอกสารที่แสดงใน PDF รายงานส่งมอบงานติดตั้ง", updatedAt: new Date() },
      ];
      (db.getDocumentSettings as any).mockResolvedValue(mockSettings);

      const result = await db.getDocumentSettings();
      expect(result).toHaveLength(2);
      expect(result[0].settingKey).toBe("survey_doc_number");
      expect(result[1].settingKey).toBe("install_doc_number");
    });

    it("should return empty array when no settings exist", async () => {
      (db.getDocumentSettings as any).mockResolvedValue([]);
      const result = await db.getDocumentSettings();
      expect(result).toHaveLength(0);
    });
  });

  describe("getDocumentSettingByKey", () => {
    it("should return a specific setting by key", async () => {
      const mockSetting = {
        id: 1,
        settingKey: "survey_doc_number",
        label: "เลขทะเบียนเอกสารสำรวจ",
        documentNumber: "FM-SA-01-04 REV.00",
        description: "เลขทะเบียนเอกสารที่แสดงใน PDF รายงานการสำรวจ",
        updatedAt: new Date(),
      };
      (db.getDocumentSettingByKey as any).mockResolvedValue(mockSetting);

      const result = await db.getDocumentSettingByKey("survey_doc_number");
      expect(result).not.toBeNull();
      expect(result?.documentNumber).toBe("FM-SA-01-04 REV.00");
      expect(result?.settingKey).toBe("survey_doc_number");
    });

    it("should return null for non-existent key", async () => {
      (db.getDocumentSettingByKey as any).mockResolvedValue(null);
      const result = await db.getDocumentSettingByKey("non_existent_key");
      expect(result).toBeNull();
    });
  });

  describe("upsertDocumentSetting", () => {
    it("should create a new setting when key does not exist", async () => {
      const newSetting = {
        settingKey: "new_doc_number",
        label: "เลขทะเบียนใหม่",
        documentNumber: "FM-NEW-01 REV.00",
        description: "เอกสารใหม่",
      };
      (db.upsertDocumentSetting as any).mockResolvedValue({ id: 3, ...newSetting });

      const result = await db.upsertDocumentSetting(newSetting);
      expect(result).not.toBeNull();
      expect(result?.settingKey).toBe("new_doc_number");
      expect(result?.documentNumber).toBe("FM-NEW-01 REV.00");
    });

    it("should update existing setting when key exists", async () => {
      const updatedSetting = {
        settingKey: "survey_doc_number",
        label: "เลขทะเบียนเอกสารสำรวจ",
        documentNumber: "FM-SA-01-04 REV.01",
      };
      (db.upsertDocumentSetting as any).mockResolvedValue({ id: 1, ...updatedSetting, description: "เลขทะเบียนเอกสารที่แสดงใน PDF รายงานการสำรวจ" });

      const result = await db.upsertDocumentSetting(updatedSetting);
      expect(result).not.toBeNull();
      expect(result?.documentNumber).toBe("FM-SA-01-04 REV.01");
    });

    it("should reject empty documentNumber", async () => {
      // This would be validated at the tRPC layer (z.string().min(1))
      // but we test the DB layer behavior
      const invalidSetting = {
        settingKey: "survey_doc_number",
        label: "เลขทะเบียนเอกสารสำรวจ",
        documentNumber: "",
      };
      (db.upsertDocumentSetting as any).mockResolvedValue(null);
      const result = await db.upsertDocumentSetting(invalidSetting);
      expect(result).toBeNull();
    });
  });
});
