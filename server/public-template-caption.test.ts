import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";

// Mock db module
vi.mock("./db", () => ({
  default: {},
  getShareLinkByToken: vi.fn(),
  getSources: vi.fn(),
  getSurveyTemplateBySourceId: vi.fn(),
  getTemplateFields: vi.fn(),
  getTemplateDataBySurvey: vi.fn(),
  saveTemplateData: vi.fn(),
  updatePhotoCaption: vi.fn(),
}));

import * as db from "./db";

const mockedDb = db as any;

function createPublicContext() {
  return {
    user: null,
    req: {} as any,
    res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
  };
}

const caller = appRouter.createCaller(createPublicContext());

describe("Public Template & Caption Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("surveyTemplate.publicGetBySourceName", () => {
    it("should reject invalid token", async () => {
      mockedDb.getShareLinkByToken.mockResolvedValue(null);
      await expect(
        caller.surveyTemplate.publicGetBySourceName({ token: "invalid", sourceName: "Gulf" })
      ).rejects.toThrow("ลิงก์ไม่ถูกต้อง");
    });

    it("should reject inactive link", async () => {
      mockedDb.getShareLinkByToken.mockResolvedValue({ isActive: false });
      await expect(
        caller.surveyTemplate.publicGetBySourceName({ token: "test", sourceName: "Gulf" })
      ).rejects.toThrow("ลิงก์ไม่ถูกต้อง");
    });

    it("should reject expired link", async () => {
      mockedDb.getShareLinkByToken.mockResolvedValue({ isActive: true, expiresAt: Date.now() - 1000 });
      await expect(
        caller.surveyTemplate.publicGetBySourceName({ token: "test", sourceName: "Gulf" })
      ).rejects.toThrow("ลิงก์หมดอายุ");
    });

    it("should return null if source not found", async () => {
      mockedDb.getShareLinkByToken.mockResolvedValue({ isActive: true, expiresAt: null });
      mockedDb.getSources.mockResolvedValue([{ id: 1, name: "TCS" }]);
      const result = await caller.surveyTemplate.publicGetBySourceName({ token: "test", sourceName: "Gulf" });
      expect(result).toBeNull();
    });

    it("should return template with fields for valid token and source", async () => {
      mockedDb.getShareLinkByToken.mockResolvedValue({ isActive: true, expiresAt: null });
      mockedDb.getSources.mockResolvedValue([{ id: 5, name: "Gulf" }]);
      mockedDb.getSurveyTemplateBySourceId.mockResolvedValue({ id: 10, name: "Gulf SSR" });
      mockedDb.getTemplateFields.mockResolvedValue([
        { id: 1, fieldName: "test", fieldLabel: "Test", fieldType: "text" },
      ]);
      const result = await caller.surveyTemplate.publicGetBySourceName({ token: "test", sourceName: "Gulf" });
      expect(result).toMatchObject({ id: 10, name: "Gulf SSR" });
      expect(result!.fields).toHaveLength(1);
    });
  });

  describe("surveyTemplate.publicGetData", () => {
    it("should reject invalid token", async () => {
      mockedDb.getShareLinkByToken.mockResolvedValue(null);
      await expect(
        caller.surveyTemplate.publicGetData({ token: "bad", surveyId: 1 })
      ).rejects.toThrow("ลิงก์ไม่ถูกต้อง");
    });

    it("should reject mismatched surveyId", async () => {
      mockedDb.getShareLinkByToken.mockResolvedValue({ isActive: true, surveyId: 99 });
      await expect(
        caller.surveyTemplate.publicGetData({ token: "test", surveyId: 1 })
      ).rejects.toThrow("ลิงก์ไม่ตรงกับงาน");
    });

    it("should return saved data for valid token", async () => {
      mockedDb.getShareLinkByToken.mockResolvedValue({ isActive: true, surveyId: 5 });
      mockedDb.getTemplateDataBySurvey.mockResolvedValue([
        { fieldId: 1, value: "hello", otherValue: null },
      ]);
      const result = await caller.surveyTemplate.publicGetData({ token: "test", surveyId: 5 });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ fieldId: 1, value: "hello" });
    });
  });

  describe("surveyTemplate.publicSaveData", () => {
    it("should reject invalid token", async () => {
      mockedDb.getShareLinkByToken.mockResolvedValue(null);
      await expect(
        caller.surveyTemplate.publicSaveData({ token: "bad", surveyId: 1, templateId: 1, entries: [] })
      ).rejects.toThrow("ลิงก์ไม่ถูกต้อง");
    });

    it("should reject mismatched surveyId", async () => {
      mockedDb.getShareLinkByToken.mockResolvedValue({ isActive: true, surveyId: 99 });
      await expect(
        caller.surveyTemplate.publicSaveData({ token: "test", surveyId: 1, templateId: 1, entries: [] })
      ).rejects.toThrow("ลิงก์ไม่ตรงกับงาน");
    });

    it("should save data for valid token", async () => {
      mockedDb.getShareLinkByToken.mockResolvedValue({ isActive: true, surveyId: 5 });
      mockedDb.saveTemplateData.mockResolvedValue(undefined);
      const result = await caller.surveyTemplate.publicSaveData({
        token: "test",
        surveyId: 5,
        templateId: 10,
        entries: [{ fieldId: 1, value: "test value", otherValue: null }],
      });
      expect(result).toEqual({ success: true });
      expect(mockedDb.saveTemplateData).toHaveBeenCalledWith(5, 10, [{ fieldId: 1, value: "test value", otherValue: null }]);
    });
  });

  describe("photo.publicUpdateCaption", () => {
    it("should reject invalid token", async () => {
      mockedDb.getShareLinkByToken.mockResolvedValue(null);
      await expect(
        caller.photo.publicUpdateCaption({ token: "bad", photoId: 1, caption: "test" })
      ).rejects.toThrow("ลิงก์ไม่ถูกต้อง");
    });

    it("should reject expired link", async () => {
      mockedDb.getShareLinkByToken.mockResolvedValue({ isActive: true, expiresAt: Date.now() - 1000 });
      await expect(
        caller.photo.publicUpdateCaption({ token: "test", photoId: 1, caption: "test" })
      ).rejects.toThrow("ลิงก์หมดอายุ");
    });

    it("should update caption for valid token", async () => {
      mockedDb.getShareLinkByToken.mockResolvedValue({ isActive: true, expiresAt: null });
      mockedDb.updatePhotoCaption.mockResolvedValue(undefined);
      const result = await caller.photo.publicUpdateCaption({ token: "test", photoId: 42, caption: "new caption" });
      expect(result).toEqual({ success: true });
      expect(mockedDb.updatePhotoCaption).toHaveBeenCalledWith(42, "new caption");
    });

    it("should allow clearing caption with empty string", async () => {
      mockedDb.getShareLinkByToken.mockResolvedValue({ isActive: true, expiresAt: null });
      mockedDb.updatePhotoCaption.mockResolvedValue(undefined);
      const result = await caller.photo.publicUpdateCaption({ token: "test", photoId: 42, caption: "" });
      expect(result).toEqual({ success: true });
      expect(mockedDb.updatePhotoCaption).toHaveBeenCalledWith(42, "");
    });
  });
});
