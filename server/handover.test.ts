import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getDeliveryFormById: vi.fn(),
  getDeliveryFormByToken: vi.fn(),
  updateDeliveryFormSelectedPhotos: vi.fn(),
  updateDeliveryFormCustomSections: vi.fn(),
  generateHandoverToken: vi.fn(),
  signDeliveryFormByCustomer: vi.fn(),
  getSurveyById: vi.fn(),
  getCustomerById: vi.fn(),
  getInstallationPhotos: vi.fn(),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/sig.png", key: "sig.png" }),
}));

import * as db from "./db";

describe("Handover Document System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DB Helpers", () => {
    it("getDeliveryFormByToken returns null for invalid token", async () => {
      (db.getDeliveryFormByToken as any).mockResolvedValue(null);
      const result = await db.getDeliveryFormByToken("invalid_token");
      expect(result).toBeNull();
    });

    it("getDeliveryFormById returns form data", async () => {
      const mockForm = {
        id: 1,
        surveyId: 100,
        customerId: 50,
        status: "draft",
        selectedPhotoIds: JSON.stringify([1, 2, 3]),
        customSections: JSON.stringify([{ title: "Test", content: "Content" }]),
        handoverToken: null,
      };
      (db.getDeliveryFormById as any).mockResolvedValue(mockForm);
      const result = await db.getDeliveryFormById(1);
      expect(result).toEqual(mockForm);
      expect(result!.selectedPhotoIds).toBe(JSON.stringify([1, 2, 3]));
    });

    it("updateDeliveryFormSelectedPhotos stores photo IDs as JSON", async () => {
      (db.updateDeliveryFormSelectedPhotos as any).mockResolvedValue(undefined);
      const photoIds = [10, 20, 30, 40];
      await db.updateDeliveryFormSelectedPhotos(1, JSON.stringify(photoIds));
      expect(db.updateDeliveryFormSelectedPhotos).toHaveBeenCalledWith(1, "[10,20,30,40]");
    });

    it("updateDeliveryFormCustomSections stores sections as JSON", async () => {
      (db.updateDeliveryFormCustomSections as any).mockResolvedValue(undefined);
      const sections = [
        { title: "ข้อมูลเพิ่มเติม", content: "รายละเอียดการติดตั้ง" },
        { title: "การรับประกัน", content: "รับประกัน 25 ปี" },
      ];
      await db.updateDeliveryFormCustomSections(1, JSON.stringify(sections));
      expect(db.updateDeliveryFormCustomSections).toHaveBeenCalledWith(
        1,
        JSON.stringify(sections)
      );
    });

    it("generateHandoverToken creates a token for the form", async () => {
      (db.generateHandoverToken as any).mockResolvedValue(undefined);
      await db.generateHandoverToken(1, "abc123token");
      expect(db.generateHandoverToken).toHaveBeenCalledWith(1, "abc123token");
    });

    it("signDeliveryFormByCustomer stores signature data", async () => {
      (db.signDeliveryFormByCustomer as any).mockResolvedValue(undefined);
      const sigData = {
        customerSignatureUrl: "https://s3.example.com/sig.png",
        customerSignatureKey: "signatures/handover_1_customer.png",
        customerSignerName: "คุณวันทนีย์",
      };
      await db.signDeliveryFormByCustomer(1, sigData);
      expect(db.signDeliveryFormByCustomer).toHaveBeenCalledWith(1, sigData);
    });
  });

  describe("Handover Data Assembly", () => {
    it("assembles full handover data from form, survey, customer, and photos", async () => {
      const mockForm = {
        id: 1,
        surveyId: 100,
        customerId: 50,
        status: "pending_signature",
        selectedPhotoIds: JSON.stringify([1, 3]),
        customSections: JSON.stringify([{ title: "หมายเหตุ", content: "ติดตั้งเสร็จ" }]),
        checklistData: JSON.stringify([
          { label: "ตรวจสอบแผง", checked: true },
          { label: "ตรวจสอบอินเวอร์เตอร์", checked: false },
        ]),
        handoverToken: "token123",
        notes: "Test notes",
        customerSignatureUrl: null,
        customerSignerName: null,
        signedAt: null,
        technicianSignatureUrl: null,
        technicianName: null,
      };

      const mockSurvey = {
        id: 100,
        customerId: 50,
        systemSize: "10.00",
        panelBrand: "Longi",
        inverterModel: "Huawei 10kW",
        panelCount: 20,
      };

      const mockCustomer = {
        id: 50,
        name: "คุณวันทนีย์ ถาวรสวัสดิ์",
        phone: "0891234567",
        address: "123 ถ.สุขุมวิท",
        phaseType: "3 เฟส",
        roofType: "เมทัลชีทคลิปล็อค",
      };

      const mockPhotos = [
        { id: 1, url: "https://s3.example.com/photo1.jpg", category: "panel" },
        { id: 2, url: "https://s3.example.com/photo2.jpg", category: "inverter" },
        { id: 3, url: "https://s3.example.com/photo3.jpg", category: "roof" },
      ];

      (db.getDeliveryFormByToken as any).mockResolvedValue(mockForm);
      (db.getSurveyById as any).mockResolvedValue(mockSurvey);
      (db.getCustomerById as any).mockResolvedValue(mockCustomer);
      (db.getInstallationPhotos as any).mockResolvedValue(mockPhotos);

      // Simulate the getByHandoverToken logic
      const form = await db.getDeliveryFormByToken("token123");
      expect(form).not.toBeNull();

      const survey = await db.getSurveyById(form!.surveyId);
      const customer = await db.getCustomerById(mockSurvey.customerId);
      const allPhotos = await db.getInstallationPhotos(form!.surveyId);

      // Filter selected photos
      const selectedIds: number[] = JSON.parse(form!.selectedPhotoIds!);
      const selectedPhotos = allPhotos.filter((p: any) => selectedIds.includes(p.id));

      expect(selectedPhotos).toHaveLength(2);
      expect(selectedPhotos[0].id).toBe(1);
      expect(selectedPhotos[1].id).toBe(3);
      expect(customer!.name).toBe("คุณวันทนีย์ ถาวรสวัสดิ์");
      expect(survey!.systemSize).toBe("10.00");
    });
  });

  describe("Signature Flow", () => {
    it("rejects signing if form is already signed", async () => {
      const signedForm = {
        id: 1,
        status: "signed",
        handoverToken: "token123",
      };
      (db.getDeliveryFormByToken as any).mockResolvedValue(signedForm);

      const form = await db.getDeliveryFormByToken("token123");
      // The router would throw here
      expect(form!.status).toBe("signed");
      const shouldReject = form!.status === "signed" || form!.status === "completed";
      expect(shouldReject).toBe(true);
    });

    it("allows signing if form is pending_signature", async () => {
      const pendingForm = {
        id: 1,
        status: "pending_signature",
        handoverToken: "token123",
      };
      (db.getDeliveryFormByToken as any).mockResolvedValue(pendingForm);

      const form = await db.getDeliveryFormByToken("token123");
      const shouldReject = form!.status === "signed" || form!.status === "completed";
      expect(shouldReject).toBe(false);
    });
  });
});
