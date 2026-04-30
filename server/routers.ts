import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, superadminProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { storagePut, storageDelete, getS3BucketUsage } from "./storage";
import * as db from "./db";
import { getUserScope } from "./dataScope";
import { notifyOwner } from "./_core/notification";
import { invokeLLM } from "./_core/llm";
import { sendLineNotification } from "./lineNotify";

// ==================== CUSTOMER ROUTER ====================
const customerRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
      month: z.number().min(1).max(12).optional(),
      year: z.number().optional(),
      district: z.string().optional(),
      province: z.string().optional(),
      source: z.string().optional(),
      surveyStatus: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const scope = await getUserScope(ctx.user);
      return db.getCustomers({ ...input, scopedCustomerIds: scope?.customerIds });
    }),

  distinctValues: protectedProcedure
    .query(() => db.getCustomerDistinctValues()),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => db.getCustomerById(input.id)),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().optional(),
      address: z.string().optional(),
      province: z.string().optional(),
      district: z.string().optional(),
      subDistrict: z.string().optional(),
      postalCode: z.string().optional(),
      latitude: z.string().optional(),
      longitude: z.string().optional(),
      source: z.string().optional(),
      electricityBill: z.string().optional(),
      roofType: z.string().optional(),
      roofArea: z.string().optional(),
      phaseType: z.enum(["single", "three"]).optional(),
      meterSize: z.string().optional(),
      fullAddress: z.string().optional(),
      facebookName: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.source) await db.getOrCreateSource(input.source);
      const id = await db.createCustomer({ ...input, createdBy: ctx.user.id });
      await db.logActivity({ userId: ctx.user.id, action: "create", entityType: "customer", entityId: id, details: `สร้างลูกค้า: ${input.name}` });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      phone: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      province: z.string().nullable().optional(),
      district: z.string().nullable().optional(),
      subDistrict: z.string().nullable().optional(),
      postalCode: z.string().nullable().optional(),
      latitude: z.string().nullable().optional(),
      longitude: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
      electricityBill: z.string().nullable().optional(),
      roofType: z.string().nullable().optional(),
      roofArea: z.string().nullable().optional(),
      phaseType: z.enum(["single", "three"]).nullable().optional(),
      meterSize: z.string().nullable().optional(),
      fullAddress: z.string().nullable().optional(),
      facebookName: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      // Filter out null/undefined/empty-string values so Drizzle doesn't send them as NULL/empty to DB
      // Keep 'name' even if empty (it's required)
      const keepFields = new Set(["name"]);
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([k, v]) => {
          if (keepFields.has(k)) return v !== null && v !== undefined;
          if (v === null || v === undefined) return false;
          if (typeof v === "string" && v.trim() === "") return false;
          return true;
        })
      );
      if (cleanData.source) await db.getOrCreateSource(cleanData.source as string);
      await db.updateCustomer(id, cleanData);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "customer", entityId: id, details: `แก้ไขลูกค้า ID: ${id}` });
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.deleteCustomer(input.id);
      await db.logActivity({ userId: ctx.user.id, action: "delete", entityType: "customer", entityId: input.id, details: `ลบลูกค้า ID: ${input.id}` });
      return { success: true };
    }),

  bulkDelete: adminProcedure
    .input(z.object({ ids: z.array(z.number()).min(1).max(100) }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.bulkDeleteCustomers(input.ids);
      await db.logActivity({ userId: ctx.user.id, action: "delete", entityType: "customer", entityId: input.ids[0], details: `ลบลูกค้า ${input.ids.length} รายการ (IDs: ${input.ids.join(", ")})` });
      return result;
    }),

  checkDuplicate: protectedProcedure
    .input(z.object({
      phone: z.string(),
      excludeId: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const matches = await db.checkDuplicateByPhone(input.phone, input.excludeId);
      return { duplicates: matches };
    }),

  checkDuplicateBatch: protectedProcedure
    .input(z.object({
      phones: z.array(z.string()),
    }))
    .mutation(async ({ input }) => {
      const dupMap = await db.checkDuplicatePhones(input.phones);
      const result: { phone: string; matches: { id: number; name: string; phone: string | null }[] }[] = [];
      for (const [phone, matches] of Array.from(dupMap.entries())) {
        result.push({ phone, matches });
      }
      return { duplicates: result };
    }),

  importBatch: protectedProcedure
    .input(z.object({
      customers: z.array(z.object({
        name: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        province: z.string().optional(),
        district: z.string().optional(),
        source: z.string().optional(),
        electricityBill: z.string().optional(),
        roofType: z.string().optional(),
        phaseType: z.enum(["single", "three"]).optional(),
        meterSize: z.string().optional(),
        facebookName: z.string().optional(),
        notes: z.string().optional(),
      })),
      skipDuplicateCheck: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Check for duplicates first (unless skipped)
      if (!input.skipDuplicateCheck) {
        const phones = input.customers.map(c => c.phone).filter((p): p is string => !!p && p.length >= 3);
        if (phones.length > 0) {
          const dupMap = await db.checkDuplicatePhones(phones);
          if (dupMap.size > 0) {
            const duplicateWarnings: { phone: string; existingCustomer: string; existingId: number }[] = [];
            for (const [phone, matches] of Array.from(dupMap.entries())) {
              for (const m of matches) {
                duplicateWarnings.push({ phone, existingCustomer: m.name, existingId: m.id });
              }
            }
            return {
              successCount: 0,
              errorCount: 0,
              errors: [] as string[],
              hasDuplicates: true,
              duplicateWarnings,
            };
          }
        }
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      for (const customer of input.customers) {
        try {
          if (customer.source) await db.getOrCreateSource(customer.source);
          await db.createCustomer({ ...customer, createdBy: ctx.user.id });
          successCount++;
        } catch (err: any) {
          errorCount++;
          errors.push(`${customer.name}: ${err.message}`);
        }
      }
      await db.logActivity({ userId: ctx.user.id, action: "create", entityType: "customer", entityId: 0, details: `Import ลูกค้า ${successCount} รายการ (ผิดพลาด ${errorCount})` });
      return { successCount, errorCount, errors: errors.slice(0, 10), hasDuplicates: false, duplicateWarnings: [] as { phone: string; existingCustomer: string; existingId: number }[] };
    }),
});

// ==================== SURVEY ROUTER ====================
const surveyRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      assignedTo: z.number().optional(),
      adminSenderId: z.number().optional(),
      closerId: z.number().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
      search: z.string().optional(),
      month: z.number().min(1).max(12).optional(),
      year: z.number().optional(),
      source: z.string().optional(),
      district: z.string().optional(),
      province: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const scope = await getUserScope(ctx.user);
      return db.getSurveysWithCustomer({ ...input, scopedSurveyIds: scope?.surveyIds });
    }),

  exportExcel: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      month: z.number().min(1).max(12).optional(),
      year: z.number().optional(),
      source: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const scope = await getUserScope(ctx.user);
      const result = await db.getSurveysWithCustomer({ ...input, page: 1, limit: 10000, scopedSurveyIds: scope?.surveyIds });
      return result.data;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => db.getSurveyWithCustomer(input.id)),

  getByCustomer: protectedProcedure
    .input(z.object({ customerId: z.number() }))
    .query(({ input }) => db.getSurveys({ customerId: input.customerId })),

  create: protectedProcedure
    .input(z.object({
      customerId: z.number(),
      scheduledDate: z.number().optional(),
      scheduledTime: z.string().optional(),
      assignedTo: z.number().optional(),
      surveyNotes: z.string().optional(),
      status: z.enum(["pending", "scheduled", "in_progress", "surveyed", "follow_up", "quoted", "negotiating", "won", "lost", "cancelled"]).optional(),
      adminSenderId: z.number().optional(),
      surveyorIds: z.array(z.number()).optional(),
      panelBrand: z.string().optional(),
      needBattery: z.string().optional(),
      needOptimizer: z.string().optional(),
      systemType: z.enum(["string", "micro", "both"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { surveyorIds, ...surveyData } = input;
      const status = surveyData.scheduledDate ? "scheduled" : (surveyData.status || "pending");
      const id = await db.createSurvey({ ...surveyData, status, createdBy: ctx.user.id, adminSenderId: surveyData.adminSenderId || ctx.user.id });
      // Save assignments
      const assignments: { userId: number; role: "admin_sender" | "surveyor" | "closer" }[] = [];
      assignments.push({ userId: surveyData.adminSenderId || ctx.user.id, role: "admin_sender" });
      if (surveyorIds && surveyorIds.length > 0) {
        surveyorIds.forEach(uid => assignments.push({ userId: uid, role: "surveyor" }));
      } else if (surveyData.assignedTo) {
        assignments.push({ userId: surveyData.assignedTo, role: "surveyor" });
      }
      await db.setSurveyAssignments(id, assignments);
      await db.logActivity({ userId: ctx.user.id, action: "create", entityType: "survey", entityId: id, details: `สร้างงานสำรวจ ID: ${id}` });
      // Notify surveyors
      const notifyIds = surveyorIds || (surveyData.assignedTo ? [surveyData.assignedTo] : []);
      for (const uid of notifyIds) {
        if (uid !== ctx.user.id) {
          await db.createNotification({
            userId: uid,
            type: "new_assignment",
            title: "งานสำรวจใหม่",
            message: `คุณได้รับมอบหมายงานสำรวจใหม่ #${id}`,
            relatedSurveyId: id,
            relatedCustomerId: input.customerId,
          });
        }
      }
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["pending", "scheduled", "in_progress", "surveyed", "follow_up", "quoted", "negotiating", "won", "lost", "cancelled"]).optional(),
      scheduledDate: z.number().optional(),
      scheduledTime: z.string().nullable().optional(),
      assignedTo: z.number().nullable().optional(),
      surveyNotes: z.string().nullable().optional(),
      systemSize: z.string().nullable().optional(),
      panelCount: z.number().nullable().optional(),
      inverterModel: z.string().nullable().optional(),
      quotedPrice: z.string().nullable().optional(),
      panelBrand: z.string().nullable().optional(),
      needBattery: z.string().nullable().optional(),
      needOptimizer: z.string().nullable().optional(),
      systemType: z.enum(["string", "micro", "both"]).nullable().optional(),
      adminSenderId: z.number().nullable().optional(),
      surveyorIds: z.array(z.number()).optional(),
      closerId: z.number().nullable().optional(),
      statusId: z.number().nullable().optional(),
      installationDate: z.number().nullable().optional(),
      installationStatus: z.enum(["waiting", "in_progress", "completed", "delivered"]).nullable().optional(),
      installerTeamId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, surveyorIds, ...rawData } = input;
      // Remove null/undefined/empty-string values so they don't get sent to DB
      // Keep scheduledTime even if empty, keep status/scheduledDate always
      const keepEvenIfEmpty = new Set(["status", "scheduledDate", "scheduledTime", "adminSenderId"]);
      const data = Object.fromEntries(
        Object.entries(rawData).filter(([k, v]) => {
          if (keepEvenIfEmpty.has(k)) return v !== null && v !== undefined;
          if (v === null || v === undefined) return false;
          if (typeof v === "string" && v.trim() === "") return false;
          return true;
        })
      ) as Partial<typeof rawData>;
      const oldSurvey = await db.getSurveyById(id);
      if (data.status === "surveyed" || data.status === "won") {
        (data as any).completedAt = Date.now();
      }
      await db.updateSurvey(id, data);
      // Update assignments if surveyorIds provided — use rawData for null checks
      if (surveyorIds !== undefined || rawData.adminSenderId !== undefined || rawData.closerId !== undefined) {
        const currentAssignments = await db.getSurveyAssignments(id);
        const assignments: { userId: number; role: "admin_sender" | "surveyor" | "closer" }[] = [];
        // Admin sender - null means remove, undefined means keep existing
        if (rawData.adminSenderId === null) {
          // explicitly removed
        } else {
          const adminId = rawData.adminSenderId || currentAssignments.find(a => a.assignment.role === "admin_sender")?.assignment.userId;
          if (adminId) assignments.push({ userId: adminId, role: "admin_sender" });
        }
        // Surveyors - empty array means remove all
        if (surveyorIds !== undefined) {
          surveyorIds.forEach(uid => assignments.push({ userId: uid, role: "surveyor" }));
        } else {
          const existingSurveyors = currentAssignments.filter(a => a.assignment.role === "surveyor");
          existingSurveyors.forEach(a => assignments.push({ userId: a.assignment.userId, role: "surveyor" }));
        }
        // Closer - null means remove, undefined means keep existing
        if (rawData.closerId === null) {
          // explicitly removed
        } else {
          const closerIdVal = rawData.closerId || currentAssignments.find(a => a.assignment.role === "closer")?.assignment.userId;
          if (closerIdVal) assignments.push({ userId: closerIdVal, role: "closer" });
        }
        await db.setSurveyAssignments(id, assignments);
      }
      if (data.status && oldSurvey && data.status !== oldSurvey.status) {
        if (oldSurvey.assignedTo && oldSurvey.assignedTo !== ctx.user.id) {
          await db.createNotification({
            userId: oldSurvey.assignedTo,
            type: "status_changed",
            title: "สถานะงานเปลี่ยน",
            message: `งานสำรวจ #${id} เปลี่ยนสถานะเป็น ${data.status}`,
            relatedSurveyId: id,
            relatedCustomerId: oldSurvey.customerId,
          });
        }
      }
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "survey", entityId: id, details: `แก้ไขงานสำรวจ ID: ${id}${data.status ? ` สถานะ: ${data.status}` : ""}` });
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.deleteSurvey(input.id);
      await db.logActivity({ userId: ctx.user.id, action: "delete", entityType: "survey", entityId: input.id, details: `ลบงานสำรวจ ID: ${input.id}` });
      return { success: true };
    }),

  bulkDelete: adminProcedure
    .input(z.object({ ids: z.array(z.number()).min(1).max(100) }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.bulkDeleteSurveys(input.ids);
      await db.logActivity({ userId: ctx.user.id, action: "delete", entityType: "survey", entityId: input.ids[0], details: `ลบงานสำรวจ ${input.ids.length} รายการ (IDs: ${input.ids.join(", ")})` });
      return result;
    }),

  // สำรวจเสร็จสิ้น → เปลี่ยนสถานะเป็น "surveyed" (สำรวจเสร็จ)
  completeSurvey: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const survey = await db.getSurveyById(input.id);
      if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบงานสำรวจ" });
      await db.updateSurvey(input.id, { status: "follow_up", completedAt: Date.now() } as any);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "survey", entityId: input.id, details: `สำรวจเสร็จสิ้น ID: ${input.id}` });
      // Notify owner
      try {
        const surveyData = await db.getSurveyWithCustomer(input.id);
        const customerName = surveyData?.customer?.name || `งาน #${input.id}`;
        await notifyOwner({
          title: "สำรวจเสร็จสิ้น",
          content: `งานสำรวจของลูกค้า "${customerName}" (ID: ${input.id}) สำรวจเสร็จสิ้นแล้ว`,
        });
        // LINE notification
        await sendLineNotification(
          "สำรวจเสร็จสิ้น",
          `งานสำรวจของลูกค้า "${customerName}" (ID: ${input.id}) สำรวจเสร็จสิ้นแล้ว`
        );
      } catch (e) {
        console.warn("[Survey] Failed to notify owner:", e);
      }
      return { success: true };
    }),

  // Public สำรวจเสร็จสิ้น (share link)
  publicCompleteSurvey: publicProcedure
    .input(z.object({ token: z.string(), surveyId: z.number() }))
    .mutation(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.expiresAt && link.expiresAt < Date.now()) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์หมดอายุ" });
      if (link.surveyId !== input.surveyId) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ตรงกับงาน" });
      const survey = await db.getSurveyById(input.surveyId);
      if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบงานสำรวจ" });
      await db.updateSurvey(input.surveyId, { status: "follow_up", completedAt: Date.now() } as any);
      // Notify owner
      try {
        const surveyData = await db.getSurveyWithCustomer(input.surveyId);
        const customerName = surveyData?.customer?.name || `งาน #${input.surveyId}`;
        await notifyOwner({
          title: "สำรวจเสร็จสิ้น (Share Link)",
          content: `งานสำรวจของลูกค้า "${customerName}" (ID: ${input.surveyId}) สำรวจเสร็จสิ้นแล้ว (ผ่าน Share Link)`,
        });
        // LINE notification
        await sendLineNotification(
          "สำรวจเสร็จสิ้น (Share Link)",
          `งานสำรวจของลูกค้า "${customerName}" (ID: ${input.surveyId}) สำรวจเสร็จสิ้นแล้ว (ผ่าน Share Link)`
        );
      } catch (e) {
        console.warn("[Survey] Failed to notify owner:", e);
      }
      return { success: true };
    }),

  // ปิดหน้างาน → เปลี่ยนสถานะเป็น "won" + installationStatus "waiting" (รอการติดตั้ง)
  closeToInstallation: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const survey = await db.getSurveyById(input.id);
      if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบงานสำรวจ" });
      await db.updateSurvey(input.id, { status: "won", installationStatus: "waiting", completedAt: Date.now() } as any);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "survey", entityId: input.id, details: `ปิดหน้างาน → รอการติดตั้ง ID: ${input.id}` });
      return { success: true };
    }),
});

// ==================== PHOTO ROUTER ====================
const photoRouter = router({
  list: protectedProcedure
    .input(z.object({ surveyId: z.number() }))
    .query(({ input }) => db.getSurveyPhotos(input.surveyId)),

  upload: protectedProcedure
    .input(z.object({
      surveyId: z.number(),
      customerId: z.number(),
      fileName: z.string(),
      category: z.string().optional(),
      caption: z.string().optional(),
      base64Data: z.string(),
      mimeType: z.string().default("image/jpeg"),
    }))
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.base64Data, "base64");
      const fileKey = `surveys/${input.surveyId}/photos/${input.fileName}`;
      const { url, key } = await storagePut(fileKey, buffer, input.mimeType);
      const id = await db.createSurveyPhoto({
        surveyId: input.surveyId,
        customerId: input.customerId,
        url,
        fileKey: key,
        fileName: input.fileName,
        category: input.category || "other",
        fileSize: buffer.length,
        caption: input.caption,
        uploadedBy: ctx.user.id,
      });
      await db.logActivity({ userId: ctx.user.id, action: "upload_photo", entityType: "survey", entityId: input.surveyId, details: `อัพโหลดรูป: ${input.fileName}` });
      return { id, url };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const photo = await db.getSurveyPhotoById(input.id);
      if (photo?.fileKey) {
        await storageDelete(photo.fileKey);
      }
      await db.deleteSurveyPhoto(input.id);
      await db.logActivity({ userId: ctx.user.id, action: "delete_photo", entityType: "photo", entityId: input.id, details: `ลบรูป: ${photo?.fileName || input.id}` });
      return { success: true };
    }),
});

// ==================== DOCUMENT ROUTER ====================
const documentRouter = router({
  list: protectedProcedure
    .input(z.object({ surveyId: z.number() }))
    .query(({ input }) => db.getSurveyDocuments(input.surveyId)),

  upload: protectedProcedure
    .input(z.object({
      surveyId: z.number(),
      customerId: z.number(),
      fileName: z.string(),
      fileType: z.string().optional(),
      base64Data: z.string(),
      mimeType: z.string().default("application/pdf"),
      fileSize: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.base64Data, "base64");
      const fileKey = `surveys/${input.surveyId}/documents/${input.fileName}`;
      const { url, key } = await storagePut(fileKey, buffer, input.mimeType);
      const id = await db.createSurveyDocument({
        surveyId: input.surveyId,
        customerId: input.customerId,
        url,
        fileKey: key,
        fileName: input.fileName,
        fileType: input.fileType || "other",
        fileSize: input.fileSize || buffer.length,
        mimeType: input.mimeType,
        uploadedBy: ctx.user.id,
      });
      if (input.fileType === "quotation") {
        const survey = await db.getSurveyById(input.surveyId);
        if (survey && (survey.status === "surveyed" || survey.status === "in_progress")) {
          await db.updateSurvey(input.surveyId, { status: "quoted" });
        }
      }
      await db.logActivity({ userId: ctx.user.id, action: "upload_document", entityType: "survey", entityId: input.surveyId, details: `อัพโหลดเอกสาร: ${input.fileName}` });
      return { id, url };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const doc = await db.getSurveyDocumentById(input.id);
      if (doc?.fileKey) {
        await storageDelete(doc.fileKey);
      }
      await db.deleteSurveyDocument(input.id);
      await db.logActivity({ userId: ctx.user.id, action: "delete_document", entityType: "document", entityId: input.id });
      return { success: true };
    }),
});

// ==================== FOLLOW UP ROUTER ====================
const followUpRouter = router({
  list: protectedProcedure
    .input(z.object({
      surveyId: z.number().optional(),
      customerId: z.number().optional(),
      status: z.string().optional(),
      startDate: z.number().optional(),
      endDate: z.number().optional(),
    }))
    .query(({ input }) => db.getFollowUps(input)),

  create: protectedProcedure
    .input(z.object({
      surveyId: z.number(),
      customerId: z.number(),
      dueDate: z.number(),
      method: z.enum(["phone", "line", "visit", "email", "other"]).optional(),
      notes: z.string().optional(),
      assignedTo: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await db.createFollowUp({ ...input, createdBy: ctx.user.id });
      if (input.assignedTo && input.assignedTo !== ctx.user.id) {
        await db.createNotification({
          userId: input.assignedTo,
          type: "follow_up_due",
          title: "Follow-up ใหม่",
          message: `คุณมี Follow-up ใหม่ กำหนด ${new Date(input.dueDate).toLocaleDateString("th-TH")}`,
          relatedSurveyId: input.surveyId,
          relatedCustomerId: input.customerId,
        });
      }
      await db.logActivity({ userId: ctx.user.id, action: "create", entityType: "follow_up", entityId: id, details: `สร้าง Follow-up สำหรับงาน #${input.surveyId}` });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["pending", "completed", "overdue", "cancelled"]).optional(),
      result: z.string().optional(),
      notes: z.string().optional(),
      dueDate: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      if (data.status === "completed") {
        (data as any).completedAt = Date.now();
      }
      await db.updateFollowUp(id, data);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "follow_up", entityId: id, details: `อัพเดท Follow-up ID: ${id}${data.status ? ` สถานะ: ${data.status}` : ""}` });
      return { success: true };
    }),
});

// ==================== SHARE LINK ROUTER ====================
const shareLinkRouter = router({
  list: protectedProcedure
    .input(z.object({ surveyId: z.number() }))
    .query(({ input }) => db.getShareLinksBySurvey(input.surveyId)),

  listByType: protectedProcedure
    .input(z.object({ surveyId: z.number(), linkType: z.enum(["survey", "installation"]) }))
    .query(({ input }) => db.getShareLinksBySurveyByType(input.surveyId, input.linkType)),

  create: protectedProcedure
    .input(z.object({
      surveyId: z.number(),
      linkType: z.enum(["survey", "installation"]).default("installation"),
      expiresInDays: z.number().default(7),
      allowPhotos: z.boolean().default(true),
      allowDocuments: z.boolean().default(true),
    }))
    .mutation(async ({ input, ctx }) => {
      const token = nanoid(32);
      const expiresAt = Date.now() + (input.expiresInDays * 24 * 60 * 60 * 1000);
      const id = await db.createShareLink({
        surveyId: input.surveyId,
        token,
        linkType: input.linkType,
        expiresAt,
        allowPhotos: input.allowPhotos,
        allowDocuments: input.allowDocuments,
        createdBy: ctx.user.id,
      });
      const typeLabel = input.linkType === "survey" ? "สำรวจ" : "ติดตั้ง";
      await db.logActivity({ userId: ctx.user.id, action: "create_share_link", entityType: "survey", entityId: input.surveyId, details: `สร้างลิงก์แชร์ (${typeLabel}) สำหรับงาน #${input.surveyId}` });
      return { id, token, linkType: input.linkType };
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.updateShareLink(input.id, { isActive: false });
      return { success: true };
    }),

  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) return { error: "ลิงก์ไม่ถูกต้องหรือถูกยกเลิก" };
      if (link.expiresAt && link.expiresAt < Date.now()) return { error: "ลิงก์หมดอายุแล้ว" };
      await db.incrementShareLinkView(input.token);
      const surveyData = await db.getSurveyWithCustomer(link.surveyId);
      if (!surveyData) return { error: "ไม่พบข้อมูลงานสำรวจ" };
      const photos = link.allowPhotos ? await db.getSurveyPhotos(link.surveyId) : [];
      const documents = link.allowDocuments ? await db.getSurveyDocuments(link.surveyId) : [];
      return { survey: surveyData.survey, customer: surveyData.customer, photos, documents, linkType: link.linkType };
    }),

  // Public upload survey photo (ลิงก์สำรวจ — อัพรูปหน้างาน)
  publicUploadSurveyPhoto: publicProcedure
    .input(z.object({
      token: z.string(),
      surveyId: z.number(),
      fileName: z.string(),
      base64Data: z.string(),
      category: z.string().default("other"),
      caption: z.string().optional(),
      mimeType: z.string().default("image/jpeg"),
    }))
    .mutation(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.linkType !== "survey") throw new TRPCError({ code: "FORBIDDEN", message: "ลิงก์นี้ไม่ใช่ลิงก์สำรวจ" });
      if (link.expiresAt && link.expiresAt < Date.now()) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์หมดอายุ" });
      if (link.surveyId !== input.surveyId) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ตรงกับงาน" });
      const survey = await db.getSurveyById(input.surveyId);
      if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบงานสำรวจ" });
      const buffer = Buffer.from(input.base64Data, "base64");
      const fileKey = `surveys/${input.surveyId}/photos/${Date.now()}-${input.fileName}`;
      const { url, key } = await storagePut(fileKey, buffer, input.mimeType);
      const id = await db.createSurveyPhoto({
        surveyId: input.surveyId,
        customerId: survey.customerId,
        url,
        fileKey: key,
        fileName: input.fileName,
        category: input.category || "other",
        fileSize: buffer.length,
        caption: input.caption,
        uploadedBy: null,
      });
      return { id, url };
    }),

  // Public delete survey photo (ลิงก์สำรวจ)
  publicDeleteSurveyPhoto: publicProcedure
    .input(z.object({ token: z.string(), surveyId: z.number(), id: z.number() }))
    .mutation(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.linkType !== "survey") throw new TRPCError({ code: "FORBIDDEN", message: "ลิงก์นี้ไม่ใช่ลิงก์สำรวจ" });
      if (link.surveyId !== input.surveyId) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ตรงกับงาน" });
      const photo = await db.getSurveyPhotoById(input.id);
      if (photo?.fileKey) {
        try { await storageDelete(photo.fileKey); } catch (e) { console.warn("Failed to delete from S3:", e); }
      }
      await db.deleteSurveyPhoto(input.id);
      return { success: true };
    }),

  // Public update survey technical data (ลิงก์สำรวจ — กรอกข้อมูลเทคนิค)
  publicUpdateSurveyTechnical: publicProcedure
    .input(z.object({
      token: z.string(),
      surveyId: z.number(),
      systemSize: z.string().optional(),
      panelCount: z.number().optional(),
      inverterModel: z.string().optional(),
      panelBrand: z.string().optional(),
      needBattery: z.string().optional(),
      needOptimizer: z.string().optional(),
      systemType: z.enum(["string", "micro", "both"]).optional(),
      surveyNotes: z.string().optional(),
      quotedPrice: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.linkType !== "survey") throw new TRPCError({ code: "FORBIDDEN", message: "ลิงก์นี้ไม่ใช่ลิงก์สำรวจ" });
      if (link.expiresAt && link.expiresAt < Date.now()) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์หมดอายุ" });
      if (link.surveyId !== input.surveyId) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ตรงกับงาน" });
      const { token, surveyId, ...data } = input;
      await db.updateSurvey(surveyId, data);
      return { success: true };
    }),

  // Public update customer info (ลิงก์สำรวจ — กรอกข้อมูลลูกค้า)
  publicUpdateCustomerInfo: publicProcedure
    .input(z.object({
      token: z.string(),
      surveyId: z.number(),
      electricityBill: z.string().optional(),
      roofType: z.string().optional(),
      roofArea: z.string().optional(),
      phaseType: z.enum(["single", "three"]).optional(),
      meterSize: z.string().optional(),
      fullAddress: z.string().optional(),
      subDistrict: z.string().optional(),
      district: z.string().optional(),
      province: z.string().optional(),
      postalCode: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.linkType !== "survey") throw new TRPCError({ code: "FORBIDDEN", message: "ลิงก์นี้ไม่ใช่ลิงก์สำรวจ" });
      if (link.expiresAt && link.expiresAt < Date.now()) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์หมดอายุ" });
      if (link.surveyId !== input.surveyId) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ตรงกับงาน" });
      const surveyData = await db.getSurveyWithCustomer(link.surveyId);
      if (!surveyData) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบข้อมูล" });
      const { token, surveyId, ...custData } = input;
      const cleanData = Object.fromEntries(
        Object.entries(custData).filter(([_, v]) => v !== undefined && v !== null && v !== "")
      );
      if (Object.keys(cleanData).length > 0) {
        await db.updateCustomer(surveyData.customer.id, cleanData);
      }
      return { success: true };
    }),
});

// ==================== NOTIFICATION ROUTER ====================
const notificationRouter = router({
  list: protectedProcedure
    .input(z.object({
      unreadOnly: z.boolean().optional(),
      limit: z.number().optional(),
    }).optional())
    .query(({ input, ctx }) => db.getNotifications(ctx.user.id, input)),

  unreadCount: protectedProcedure
    .query(({ ctx }) => db.getUnreadNotificationCount(ctx.user.id)),

  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input, ctx }) => db.markNotificationRead(input.id, ctx.user.id)),

  markAllRead: protectedProcedure
    .mutation(({ ctx }) => db.markAllNotificationsRead(ctx.user.id)),
});

// ==================== DASHBOARD ROUTER ====================
const dashboardRouter = router({
  stats: protectedProcedure.query(async ({ ctx }) => {
    const scope = await getUserScope(ctx.user);
    return db.getDashboardStats(scope?.surveyIds, scope?.customerIds);
  }),
  recentActivities: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }).optional())
    .query(({ input }) => db.getRecentActivities(input?.limit)),
});

// ==================== CALENDAR ROUTER ====================
const calendarRouter = router({
  events: protectedProcedure
    .input(z.object({
      startDate: z.number(),
      endDate: z.number(),
    }))
    .query(({ input }) => db.getCalendarEvents(input.startDate, input.endDate)),
});

// ==================== CUSTOM STATUS ROUTER ====================
const customStatusRouter = router({
  list: protectedProcedure
    .input(z.object({ type: z.enum(["customer", "survey"]).optional() }).optional())
    .query(({ input }) => db.getCustomStatuses(input?.type)),

  create: protectedProcedure
    .input(z.object({
      type: z.enum(["customer", "survey"]),
      label: z.string().min(1),
      color: z.string().optional(),
      bgColor: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.createCustomStatus(input);
      await db.logActivity({ userId: ctx.user.id, action: "create", entityType: "custom_status", entityId: result.id, details: `สร้างสถานะ: ${input.label} (${input.type})` });
      return result;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      label: z.string().optional(),
      color: z.string().optional(),
      bgColor: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db.updateCustomStatus(id, data);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "custom_status", entityId: id, details: `แก้ไขสถานะ ID: ${id}` });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.deleteCustomStatus(input.id);
      await db.logActivity({ userId: ctx.user.id, action: "delete", entityType: "custom_status", entityId: input.id, details: `ลบสถานะ ID: ${input.id}` });
      return { success: true };
    }),

  bulkDelete: adminProcedure
    .input(z.object({ ids: z.array(z.number()).min(1).max(200) }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.bulkDeleteCustomStatuses(input.ids);
      await db.logActivity({ userId: ctx.user.id, action: "delete", entityType: "custom_status", entityId: input.ids[0], details: `ลบสถานะ ${input.ids.length} รายการ (IDs: ${input.ids.join(", ")})` });
      return result;
    }),

  reorder: protectedProcedure
    .input(z.object({ items: z.array(z.object({ id: z.number(), sortOrder: z.number() })).min(1).max(500) }))
    .mutation(async ({ input, ctx }) => {
      await db.reorderCustomStatuses(input.items);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "custom_status", entityId: input.items[0].id, details: `จัดลำดับสถานะใหม่ (${input.items.length} รายการ)` });
      return { success: true };
    }),

  updateCustomerStatus: protectedProcedure
    .input(z.object({ customerId: z.number(), statusId: z.number().nullable() }))
    .mutation(async ({ input, ctx }) => {
      await db.updateCustomerStatus(input.customerId, input.statusId);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "customer", entityId: input.customerId, details: `เปลี่ยนสถานะลูกค้า ID: ${input.customerId}` });
      return { success: true };
    }),

  updateSurveyStatus: protectedProcedure
    .input(z.object({ surveyId: z.number(), statusId: z.number().nullable() }))
    .mutation(async ({ input, ctx }) => {
      await db.updateSurveyStatus(input.surveyId, input.statusId);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "survey", entityId: input.surveyId, details: `เปลี่ยนสถานะงานสำรวจ ID: ${input.surveyId}` });
      return { success: true };
    }),

  updateInstallationDate: protectedProcedure
    .input(z.object({ surveyId: z.number(), installationDate: z.number().nullable() }))
    .mutation(async ({ input, ctx }) => {
      await db.updateSurveyInstallationDate(input.surveyId, input.installationDate);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "survey", entityId: input.surveyId, details: `อัพเดทวันที่นัดติดตั้ง งาน ID: ${input.surveyId}` });
      return { success: true };
    }),
});

// ==================== STORAGE ROUTER ==
const storageRouter = router({
  stats: protectedProcedure.query(() => db.getStorageStats()),
  s3Usage: protectedProcedure.query(async () => {
    try {
      return await getS3BucketUsage();
    } catch (e: any) {
      console.warn('[S3 Usage] Failed to get bucket usage:', e.message);
      return { totalSize: 0, totalObjects: 0, freeTierLimit: 5368709120, usagePercent: 0, bucketName: '', region: '', error: e.message };
    }
  }),
  listFiles: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(20),
      search: z.string().optional(),
      fileType: z.enum(['all', 'photo', 'document']).optional(),
    }))
    .query(({ input }) => {
      return db.getAllFiles({
        ...input,
        fileType: input.fileType === 'all' ? undefined : input.fileType,
      });
    }),
  deleteFile: protectedProcedure
    .input(z.object({
      id: z.number(),
      type: z.enum(['photo', 'document']),
    }))
    .mutation(async ({ input }) => {
      let file: any;
      if (input.type === 'photo') {
        file = await db.deletePhoto(input.id);
      } else {
        file = await db.deleteDocument(input.id);
      }
      if (!file) throw new TRPCError({ code: 'NOT_FOUND', message: 'ไม่พบไฟล์' });
      // Try to delete from S3
      try {
        await storageDelete(file.fileKey);
      } catch (e) {
        console.warn('[Storage] Failed to delete from S3:', e);
      }
      return { success: true };
    }),
});

// ==================== SOURCES ROUTER ====================
const sourceRouter = router({
  list: protectedProcedure.query(() => db.getSources()),
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), category: z.string().optional() }))
    .mutation(async ({ input }) => {
      const source = await db.getOrCreateSource(input.name, input.category);
      return source;
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteSource(input.id);
      return { success: true };
    }),
});

// ==================== SURVEY ASSIGNMENTS ROUTER ====================
const assignmentRouter = router({
  getBySurvey: protectedProcedure
    .input(z.object({ surveyId: z.number() }))
    .query(({ input }) => db.getSurveyAssignments(input.surveyId)),
});

// ==================== USERS ROUTER ====================
const usersRouter = router({
  list: superadminProcedure.query(() => db.getAllUsers()),

  create: superadminProcedure
    .input(z.object({
      name: z.string().min(1),
      username: z.string().min(3, "ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร"),
      password: z.string().min(4, "รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร"),
      email: z.string().optional(),
      role: z.enum(["user", "admin"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const passwordHash = await bcrypt.hash(input.password, 10);
      const result = await db.createManualUser({
        name: input.name,
        username: input.username,
        passwordHash,
        email: input.email,
        role: input.role,
      });
      await db.logActivity({ userId: ctx.user.id, action: "create", entityType: "user", entityId: result.id, details: `สร้างผู้ใช้: ${input.name} (@${input.username}) (${input.role})` });
      return result;
    }),

  update: superadminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      email: z.string().optional(),
      role: z.enum(["user", "admin"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db.updateUser(id, data);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "user", entityId: id, details: `แก้ไขผู้ใช้ ID:${id}` });
      return { success: true };
    }),

  resetPassword: superadminProcedure
    .input(z.object({
      id: z.number(),
      newPassword: z.string().min(4, "รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร"),
    }))
    .mutation(async ({ input, ctx }) => {
      const passwordHash = await bcrypt.hash(input.newPassword, 10);
      await db.updateUser(input.id, { passwordHash });
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "user", entityId: input.id, details: `รีเซ็ตรหัสผ่านผู้ใช้ ID:${input.id}` });
      return { success: true };
    }),

  delete: superadminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (input.id === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ไม่สามารถลบบัญชีตัวเองได้" });
      }
      await db.deleteUser(input.id);
      await db.logActivity({ userId: ctx.user.id, action: "delete", entityType: "user", entityId: input.id, details: `ลบผู้ใช้ ID:${input.id}` });
      return { success: true };
    }),

  // Public login with username/password
  login: publicProcedure
    .input(z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await db.getUserByUsername(input.username);
      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
      }
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
      }
      // Create session token using the user's openId
      const token = await sdk.createSessionToken(user.openId, { name: user.name || "" });
      // Set session cookie
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      });
      // Update last signed in
      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
      return { success: true, user: { id: user.id, name: user.name, role: user.role } };
    }),
});

// ==================== TEAM MEMBER ROUTER ====================
const teamMemberRouter = router({
  list: protectedProcedure
    .input(z.object({ role: z.string().optional() }).optional())
    .query(({ input }) => db.getTeamMembers(input?.role)),

  listAll: protectedProcedure.query(() => db.getAllTeamMembers()),

  availableUsers: protectedProcedure
    .input(z.object({ currentTeamMemberId: z.number().optional() }).optional())
    .query(({ input }) => db.getAvailableUsersForLinking(input?.currentTeamMemberId)),

  getMyTeamMember: protectedProcedure
    .query(async ({ ctx }) => {
      return db.getTeamMemberByUserId(ctx.user.id);
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().optional(),
      role: z.enum(["admin_sender", "surveyor", "closer"]),
      linkedUserId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.createTeamMember(input);
      await db.logActivity({ userId: ctx.user.id, action: "create", entityType: "team_member", entityId: result.id, details: `เพิ่มสมาชิกทีม: ${input.name} (${input.role})` });
      return result;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      role: z.enum(["admin_sender", "surveyor", "closer"]).optional(),
      isActive: z.boolean().optional(),
      linkedUserId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db.updateTeamMember(id, data);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "team_member", entityId: id, details: `แก้ไขสมาชิกทีม ID: ${id}` });
      const members = await db.getTeamMembers();
      return members.find((m: any) => m.id === id) || { id, ...data };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.deleteTeamMember(input.id);
      await db.logActivity({ userId: ctx.user.id, action: "delete", entityType: "team_member", entityId: input.id, details: `ลบสมาชิกทีม ID: ${input.id}` });
      return { success: true };
    }),

  bulkDelete: adminProcedure
    .input(z.object({ ids: z.array(z.number()).min(1).max(100) }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.bulkDeleteTeamMembers(input.ids);
      await db.logActivity({ userId: ctx.user.id, action: "delete", entityType: "team_member", entityId: input.ids[0], details: `ลบสมาชิกทีม ${input.ids.length} รายการ (IDs: ${input.ids.join(", ")})` });
      return result;
    }),
});

// ==================== TEAM PERFORMANCE ROUTER ====================
const teamPerformanceRouter = router({
  summary: protectedProcedure
    .input(z.object({
      month: z.number().min(1).max(12).optional(),
      year: z.number().optional(),
    }))
    .query(({ input }) => db.getTeamPerformance(input)),
});

// ==================== INSTALLATION ROUTER ====================
const installationRouter = router({
  updateStatus: protectedProcedure
    .input(z.object({
      surveyId: z.number(),
      installationStatus: z.enum(["waiting", "in_progress", "completed", "delivered"]).nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      await db.updateInstallationStatus(input.surveyId, input.installationStatus);
      // If status is completed, also set completedAt
      if (input.installationStatus === "completed" || input.installationStatus === "delivered") {
        await db.updateSurvey(input.surveyId, { completedAt: Date.now() } as any);
      } else {
        // Clear completedAt if not completed/delivered
        await db.updateSurvey(input.surveyId, { completedAt: null } as any);
      }
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "survey", entityId: input.surveyId, details: `เปลี่ยนสถานะติดตั้ง: ${input.installationStatus || 'ไม่มี'}` });
      return { success: true };
    }),

  exportExcel: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      month: z.number().min(1).max(12).optional(),
      year: z.number().optional(),
      province: z.string().optional(),
      district: z.string().optional(),
      installationStatus: z.enum(['all', 'upcoming', 'today', 'overdue', 'completed']).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const scope = await getUserScope(ctx.user);
      const { installationStatus, ...rest } = input;
      const result = await db.getInstallations({ ...rest, installationStatus: installationStatus === 'all' ? undefined : installationStatus, page: 1, limit: 10000, scopedSurveyIds: scope?.surveyIds });
      return result.data;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.deleteSurvey(input.id);
      await db.logActivity({ userId: ctx.user.id, action: "delete", entityType: "survey", entityId: input.id, details: `ลบงานติดตั้ง (survey) ID: ${input.id}` });
      return { success: true };
    }),

  bulkDelete: adminProcedure
    .input(z.object({ ids: z.array(z.number()).min(1).max(100) }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.bulkDeleteSurveys(input.ids);
      await db.logActivity({ userId: ctx.user.id, action: "delete", entityType: "survey", entityId: input.ids[0], details: `ลบงานติดตั้ง ${input.ids.length} รายการ (IDs: ${input.ids.join(", ")})` });
      return result;
    }),

  list: protectedProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(20),
      search: z.string().optional(),
      month: z.number().min(1).max(12).optional(),
      year: z.number().optional(),
      district: z.string().optional(),
      province: z.string().optional(),
      surveyorId: z.number().optional(),
      closerId: z.number().optional(),
      installerTeamId: z.number().optional(),
      installationStatus: z.enum(['all', 'upcoming', 'today', 'overdue', 'completed']).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const scope = await getUserScope(ctx.user);
      const { installationStatus, ...rest } = input;
      return db.getInstallations({ ...rest, installationStatus: installationStatus === 'all' ? undefined : installationStatus, scopedSurveyIds: scope?.surveyIds });
    }),
});

// ==================== DOCUMENT CATEGORY ROUTER ====================
const documentCategoryRouter = router({
  list: publicProcedure
    .query(() => db.getDocumentCategories()),

  create: protectedProcedure
    .input(z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.createDocumentCategory({ ...input, isDefault: false });
      await db.logActivity({ userId: ctx.user.id, action: "create", entityType: "document_category", entityId: result.id, details: `สร้างประเภทเอกสาร: ${input.label}` });
      return result;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      label: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db.updateDocumentCategory(id, data);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "document_category", entityId: id, details: `แก้ไขประเภทเอกสาร ID: ${id}` });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.deleteDocumentCategory(input.id);
      await db.logActivity({ userId: ctx.user.id, action: "delete", entityType: "document_category", entityId: input.id, details: `ลบประเภทเอกสาร ID: ${input.id}` });
      return { success: true };
    }),

  bulkDelete: adminProcedure
    .input(z.object({ ids: z.array(z.number()).min(1).max(200) }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.bulkDeleteDocumentCategories(input.ids);
      await db.logActivity({ userId: ctx.user.id, action: "delete", entityType: "document_category", entityId: input.ids[0], details: `ลบหมวดหมู่เอกสาร ${input.ids.length} รายการ` });
      return result;
    }),

  reorder: protectedProcedure
    .input(z.object({ items: z.array(z.object({ id: z.number(), sortOrder: z.number() })).min(1).max(500) }))
    .mutation(async ({ input, ctx }) => {
      await db.reorderDocumentCategories(input.items);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "document_category", entityId: input.items[0].id, details: `จัดลำดับหมวดหมู่เอกสารใหม่ (${input.items.length} รายการ)` });
      return { success: true };
    }),
});

// ==================== PHOTO CATEGORY ROUTER ==
const photoCategoryRouter = router({
  list: publicProcedure
    .query(() => db.getPhotoCategories()),

  create: protectedProcedure
    .input(z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.createPhotoCategory({ ...input, isDefault: false });
      await db.logActivity({ userId: ctx.user.id, action: "create", entityType: "photo_category", entityId: result.id, details: `สร้างประเภทรูปภาพ: ${input.label}` });
      return result;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      label: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db.updatePhotoCategory(id, data);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "photo_category", entityId: id, details: `แก้ไขประเภทรูปภาพ ID: ${id}` });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.deletePhotoCategory(input.id);
      await db.logActivity({ userId: ctx.user.id, action: "delete", entityType: "photo_category", entityId: input.id, details: `ลบประเภทรูปภาพ ID: ${input.id}` });
      return { success: true };
    }),

  bulkDelete: adminProcedure
    .input(z.object({ ids: z.array(z.number()).min(1).max(200) }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.bulkDeletePhotoCategories(input.ids);
      await db.logActivity({ userId: ctx.user.id, action: "delete", entityType: "photo_category", entityId: input.ids[0], details: `ลบหมวดหมู่รูปสำรวจ ${input.ids.length} รายการ` });
      return result;
    }),

  reorder: protectedProcedure
    .input(z.object({ items: z.array(z.object({ id: z.number(), sortOrder: z.number() })).min(1).max(500) }))
    .mutation(async ({ input, ctx }) => {
      await db.reorderPhotoCategories(input.items);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "photo_category", entityId: input.items[0].id, details: `จัดลำดับหมวดหมู่รูปสำรวจใหม่ (${input.items.length} รายการ)` });
      return { success: true };
    }),
});

// ==================== INSTALLATION PHOTO CATEGORY ROUTER ====================
const installationPhotoCategoryRouter = router({
  list: publicProcedure
    .query(() => db.getInstallationPhotoCategories()),

  create: protectedProcedure
    .input(z.object({
      key: z.string().min(1),
      label: z.string().min(1),
      sortOrder: z.number().optional(),
      isRequired: z.boolean().optional(),
      isConditional: z.boolean().optional(),
      conditionNote: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.createInstallationPhotoCategory({ ...input, isDefault: false });
      await db.logActivity({ userId: ctx.user.id, action: "create", entityType: "installation_photo_category", entityId: result.id, details: `สร้างประเภทรูปติดตั้ง: ${input.label}` });
      return result;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      label: z.string().optional(),
      sortOrder: z.number().optional(),
      isRequired: z.boolean().optional(),
      isConditional: z.boolean().optional(),
      conditionNote: z.string().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db.updateInstallationPhotoCategory(id, data);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "installation_photo_category", entityId: id, details: `แก้ไขประเภทรูปติดตั้ง ID: ${id}` });
      return { success: true };
    }),

  // Validate required categories before delivery submit
  validateForDelivery: publicProcedure
    .input(z.object({ surveyId: z.number() }))
    .query(async ({ input }) => {
      const categories = await db.getInstallationPhotoCategories();
      const photos = await db.getInstallationPhotos(input.surveyId);
      const photoCategoryKeys = new Set(photos.map((p: any) => p.category || "other"));
      const requiredCategories = categories.filter((c: any) => c.isRequired);
      const conditionalCategories = categories.filter((c: any) => c.isConditional);
      const missingRequired = requiredCategories.filter((c: any) => !photoCategoryKeys.has(c.key));
      const missingConditional = conditionalCategories.filter((c: any) => !photoCategoryKeys.has(c.key));
      return {
        totalPhotos: photos.length,
        requiredCount: requiredCategories.length,
        completedRequired: requiredCategories.length - missingRequired.length,
        missingRequired: missingRequired.map((c: any) => ({ key: c.key, label: c.label })),
        missingConditional: missingConditional.map((c: any) => ({ key: c.key, label: c.label, conditionNote: c.conditionNote })),
        isComplete: missingRequired.length === 0,
      };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.deleteInstallationPhotoCategory(input.id);
      await db.logActivity({ userId: ctx.user.id, action: "delete", entityType: "installation_photo_category", entityId: input.id, details: `ลบประเภทรูปติดตั้ง ID: ${input.id}` });
      return { success: true };
    }),

  bulkDelete: adminProcedure
    .input(z.object({ ids: z.array(z.number()).min(1).max(200) }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.bulkDeleteInstallationPhotoCategories(input.ids);
      await db.logActivity({ userId: ctx.user.id, action: "delete", entityType: "installation_photo_category", entityId: input.ids[0], details: `ลบหมวดหมู่รูปติดตั้ง ${input.ids.length} รายการ` });
      return result;
    }),

  reorder: protectedProcedure
    .input(z.object({ items: z.array(z.object({ id: z.number(), sortOrder: z.number() })).min(1).max(500) }))
    .mutation(async ({ input, ctx }) => {
      await db.reorderInstallationPhotoCategories(input.items);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "installation_photo_category", entityId: input.items[0].id, details: `จัดลำดับหมวดหมู่รูปติดตั้งใหม่ (${input.items.length} รายการ)` });
      return { success: true };
    }),
});

// ==================== INSTALLATION PHOTO ROUTER ====================
const installationPhotoRouter = router({
  list: protectedProcedure
    .input(z.object({ surveyId: z.number() }))
    .query(async ({ input }) => {
      return db.getInstallationPhotos(input.surveyId);
    }),

  // Public list for share link
  publicList: publicProcedure
    .input(z.object({ token: z.string(), surveyId: z.number() }))
    .query(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.expiresAt && link.expiresAt < Date.now()) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์หมดอายุ" });
      if (link.surveyId !== input.surveyId) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ตรงกับงาน" });
      return db.getInstallationPhotos(input.surveyId);
    }),

  // Public upload for share link (no login required)
  publicUpload: publicProcedure
    .input(z.object({
      token: z.string(),
      surveyId: z.number(),
      fileName: z.string(),
      fileData: z.string(), // base64
      category: z.string().default("other"),
      caption: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.expiresAt && link.expiresAt < Date.now()) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์หมดอายุ" });
      if (link.surveyId !== input.surveyId) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ตรงกับงาน" });
      const buffer = Buffer.from(input.fileData, "base64");
      const ext = input.fileName.split(".").pop() || "jpg";
      const key = `installations/${input.surveyId}/photos/${Date.now()}_${nanoid(8)}.${ext}`;
      const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const { url } = await storagePut(key, buffer, contentType);
      const result = await db.createInstallationPhoto({
        surveyId: input.surveyId,
        url,
        fileKey: key,
        fileName: input.fileName,
        category: input.category,
        fileSize: buffer.length,
        caption: input.caption || null,
        uploadedBy: null,
      });
      return { id: result.id, url, fileKey: key };
    }),

  // Public delete for share link
  publicDelete: publicProcedure
    .input(z.object({ token: z.string(), surveyId: z.number(), id: z.number() }))
    .mutation(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.surveyId !== input.surveyId) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ตรงกับงาน" });
      const photo = await db.deleteInstallationPhoto(input.id);
      if (photo) {
        try { await storageDelete(photo.fileKey); } catch (e) { console.warn("Failed to delete from S3:", e); }
      }
      return { success: true };
    }),

  upload: protectedProcedure
    .input(z.object({
      surveyId: z.number(),
      fileName: z.string(),
      fileData: z.string(), // base64
      category: z.string().default("other"),
      caption: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.fileData, "base64");
      const ext = input.fileName.split(".").pop() || "jpg";
      const key = `installations/${input.surveyId}/photos/${Date.now()}_${nanoid(8)}.${ext}`;
      const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const { url } = await storagePut(key, buffer, contentType);
      const result = await db.createInstallationPhoto({
        surveyId: input.surveyId,
        url,
        fileKey: key,
        fileName: input.fileName,
        category: input.category,
        fileSize: buffer.length,
        caption: input.caption || null,
        uploadedBy: ctx.user.id,
      });
      await db.logActivity({ userId: ctx.user.id, action: "create", entityType: "installation_photo", entityId: result.id, details: `อัปโหลดรูปติดตั้ง: ${input.fileName} (${input.category})` });
      return { id: result.id, url, fileKey: key };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const photo = await db.deleteInstallationPhoto(input.id);
      if (photo) {
        try { await storageDelete(photo.fileKey); } catch (e) { console.warn("Failed to delete from S3:", e); }
      }
      await db.logActivity({ userId: ctx.user.id, action: "delete", entityType: "installation_photo", entityId: input.id, details: `ลบรูปติดตั้ง ID: ${input.id}` });
      return { success: true };
    }),
});

// ==================== INSTALLER TEAM ROUTER ====================
const installerTeamRouter = router({
  list: protectedProcedure
    .input(z.object({ onlyActive: z.boolean().optional() }).optional())
    .query(({ input }) => db.getInstallerTeams(input?.onlyActive)),

  listActive: publicProcedure
    .query(() => db.getInstallerTeams(true)),

  report: protectedProcedure
    .input(z.object({ month: z.number().optional(), year: z.number().optional() }).optional())
    .query(({ input }) => db.getInstallerTeamReport(input ?? undefined)),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      phone: z.string().optional(),
      note: z.string().optional(),
      color: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.createInstallerTeam(input);
      await db.logActivity({ userId: ctx.user.id, action: "create", entityType: "installer_team", entityId: result.id, details: `สร้างทีมช่าง: ${input.name}` });
      return result;
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      phone: z.string().optional(),
      note: z.string().optional(),
      color: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const result = await db.updateInstallerTeam(id, data);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "installer_team", entityId: id, details: `แก้ไขทีมช่าง ID: ${id}` });
      return result;
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.deleteInstallerTeam(input.id);
      await db.logActivity({ userId: ctx.user.id, action: "delete", entityType: "installer_team", entityId: input.id, details: `ลบทีมช่าง ID: ${input.id}` });
      return result;
    }),
});

// ==================== DELIVERY ROUTER ====================
const deliveryRouter = router({
  info: protectedProcedure
    .input(z.object({ surveyId: z.number() }))
    .query(async ({ input }) => {
      return db.getDeliveryInfo(input.surveyId);
    }),

  // Public info for share link
  publicInfo: publicProcedure
    .input(z.object({ token: z.string(), surveyId: z.number() }))
    .query(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.expiresAt && link.expiresAt < Date.now()) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์หมดอายุ" });
      if (link.surveyId !== input.surveyId) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ตรงกับงาน" });
      return db.getDeliveryInfo(input.surveyId);
    }),

  submit: protectedProcedure
    .input(z.object({ surveyId: z.number(), skipValidation: z.boolean().optional() }))
    .mutation(async ({ input, ctx }) => {
      // Check that there are installation photos
      const photos = await db.getInstallationPhotos(input.surveyId);
      if (photos.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "กรุณาอัปโหลดรูปติดตั้งก่อนส่งมอบงาน" });
      }
      // Validate required categories (unless admin skips)
      if (!input.skipValidation) {
        const categories = await db.getInstallationPhotoCategories();
        const photoCategoryKeys = new Set(photos.map((p: any) => p.category || "other"));
        const missingRequired = categories.filter((c: any) => c.isRequired && !photoCategoryKeys.has(c.key));
        if (missingRequired.length > 0) {
          const names = missingRequired.map((c: any) => c.label).join(", ");
          throw new TRPCError({ code: "BAD_REQUEST", message: `ยังขาดรูปหมวดหมู่ที่จำเป็น: ${names}` });
        }
      }
      const result = await db.submitDelivery(input.surveyId, ctx.user.id);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "delivery", entityId: input.surveyId, details: `ส่งมอบงานติดตั้ง surveyId: ${input.surveyId}` });
      return result;
    }),

  // Public submit for share link (no login required)
  publicSubmit: publicProcedure
    .input(z.object({ token: z.string(), surveyId: z.number() }))
    .mutation(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.expiresAt && link.expiresAt < Date.now()) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์หมดอายุ" });
      if (link.surveyId !== input.surveyId) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ตรงกับงาน" });
      const photos = await db.getInstallationPhotos(input.surveyId);
      if (photos.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "กรุณาอัปโหลดรูปติดตั้งก่อนส่งมอบงาน" });
      }
      // Validate required categories
      const categories = await db.getInstallationPhotoCategories();
      const photoCategoryKeys = new Set(photos.map((p: any) => p.category || "other"));
      const missingRequired = categories.filter((c: any) => c.isRequired && !photoCategoryKeys.has(c.key));
      if (missingRequired.length > 0) {
        const names = missingRequired.map((c: any) => c.label).join(", ");
        throw new TRPCError({ code: "BAD_REQUEST", message: `ยังขาดรูปหมวดหมู่ที่จำเป็น: ${names}` });
      }
      const result = await db.submitDelivery(input.surveyId, null);

      // Notify admin when technician submits delivery via share link
      try {
        const surveyInfo = await db.getSurveyWithCustomer(input.surveyId);
        const customerName = surveyInfo?.customer?.name || `งาน #${input.surveyId}`;
        await notifyOwner({
          title: "ช่างส่งมอบงานติดตั้ง",
          content: `ทีมช่างได้ส่งมอบงานติดตั้งของลูกค้า "${customerName}" (ID: ${input.surveyId}) ผ่าน Share Link แล้ว กรุณาตรวจสอบและอนุมัติ`,
        });
      } catch (e) {
        console.warn("[Delivery] Failed to notify owner:", e);
      }

      return result;
    }),

  approve: adminProcedure
    .input(z.object({ surveyId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.approveDelivery(input.surveyId, ctx.user.id);
      await db.updateInstallationStatus(input.surveyId, "delivered");
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "delivery", entityId: input.surveyId, details: `อนุมัติส่งมอบงาน surveyId: ${input.surveyId}` });
      return result;
    }),

  reject: adminProcedure
    .input(z.object({
      surveyId: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.rejectDelivery(input.surveyId, ctx.user.id, input.reason);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "delivery", entityId: input.surveyId, details: `ปฏิเสธส่งมอบงาน surveyId: ${input.surveyId} เหตุผล: ${input.reason || '-'}` });
      return result;
    }),

  completeInstallation: protectedProcedure
    .input(z.object({ surveyId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // เปลี่ยนสถานะติดตั้งเป็น completed
      await db.updateInstallationStatus(input.surveyId, "completed");
      await db.logActivity({
        userId: ctx.user.id,
        action: "update",
        entityType: "installation",
        entityId: input.surveyId,
        details: `ติดตั้งเสร็จสิ้น surveyId: ${input.surveyId}`,
      });
      // LINE notification
      try {
        const surveyData = await db.getSurveyWithCustomer(input.surveyId);
        const customerName = surveyData?.customer?.name || `งาน #${input.surveyId}`;
        await sendLineNotification(
          "ติดตั้งเสร็จสิ้น",
          `งานติดตั้งของลูกค้า "${customerName}" (ID: ${input.surveyId}) ติดตั้งเสร็จสิ้นแล้ว`
        );
      } catch (e) {
        console.warn("[Installation] Failed to send LINE notification:", e);
      }
      return { success: true };
    }),
});

// ==================== DELIVERY COMMENT ROUTER ====================
const deliveryCommentRouter = router({
  list: protectedProcedure
    .input(z.object({ surveyId: z.number() }))
    .query(async ({ input }) => {
      return db.getDeliveryComments(input.surveyId);
    }),

  add: protectedProcedure
    .input(z.object({
      surveyId: z.number(),
      message: z.string().min(1, "กรุณาระบุข้อความ").max(2000, "ข้อความยาวเกินไป"),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await db.addDeliveryComment({
        surveyId: input.surveyId,
        userId: ctx.user.id,
        message: input.message,
      });
      await db.logActivity({
        userId: ctx.user.id,
        action: "create",
        entityType: "delivery_comment",
        entityId: input.surveyId,
        details: `เพิ่มความคิดเห็นในงานส่งมอบ surveyId: ${input.surveyId}`,
      });
      return { id };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const comment = await db.getDeliveryCommentById(input.id);
      if (!comment) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบความคิดเห็น" });
      // Only admin/superadmin or comment owner can delete
      const isAdmin = ctx.user.role === "admin" || ctx.user.role === "superadmin";
      if (!isAdmin && comment.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "ไม่มีสิทธิ์ลบความคิดเห็นนี้" });
      }
      await db.deleteDeliveryComment(input.id);
      await db.logActivity({
        userId: ctx.user.id,
        action: "delete",
        entityType: "delivery_comment",
        entityId: comment.surveyId,
        details: `ลบความคิดเห็นในงานส่งมอบ commentId: ${input.id}`,
      });
      return { success: true };
    }),
});

// ==================== LINE PARSER ROUTER ====================
const lineParserRouter = router({
  parse: protectedProcedure
    .input(z.object({ text: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const systemPrompt = `คุณเป็น AI ที่ช่วยแยกข้อมูลลูกค้าจากข้อความ LINE chat ภาษาไทย
ให้แยกข้อมูลต่อไปนี้จากข้อความที่ได้รับ:
- name: ชื่อลูกค้า (อาจมีคำนำหน้า คุณ/นาย/นาง/นางสาว)
- phone: เบอร์โทรศัพท์ (ตัวเลข 9-10 หลัก)
- fullAddress: ที่อยู่เต็ม (บ้านเลขที่ ซอย ถนน แขวง/ตำบล)
- district: เขต/อำเภอ
- province: จังหวัด
- postalCode: รหัสไปรษณีย์
- location: ลิงก์ Google Maps หรือพิกัด GPS
- scheduledDate: วันที่นัดสำรวจ (แปลงเป็น DD/MM/YYYY)
- scheduledTime: เวลานัดสำรวจ (แปลงเป็น HH:MM)
- source: แหล่งที่มา/ช่องทาง
- electricityBill: ค่าไฟต่อเดือน (ตัวเลข)
- roofType: ประเภทหลังคา
- phaseType: ระบบไฟ (single หรือ three)
- facebookName: ชื่อ Facebook ของลูกค้า (ชื่อ FB, ชื่อเฟส, Facebook name)
- notes: หมายเหตุ/ข้อมูลเพิ่มเติมอื่นๆ

กฎสำคัญ:
1. ถ้าไม่พบข้อมูลใดให้ใส่ค่าว่าง ""
2. เบอร์โทร: ลบเครื่องหมาย - ออก เก็บเฉพาะตัวเลข
3. ที่อยู่: รวมข้อมูลที่อยู่ทั้งหมดเป็นข้อความเดียว
4. ลิงก์ Google Maps: ดึง URL ที่ขึ้นต้นด้วย https://maps.app.goo.gl/ หรือ https://goo.gl/maps/ หรือ https://www.google.com/maps/
5. วันที่: แปลงจากรูปแบบต่างๆ เช่น 26/03/2026, 26 มี.ค. 2026 เป็น DD/MM/YYYY
6. ข้อความที่ขึ้นต้นด้วย ! หรือ save อาจเป็นรูปแบบเฉพาะของทีม ให้พยายามแยกข้อมูลจากบรรทัดเหล่านั้น
7. ถ้ามีพิกัด GPS (เช่น 13°47'14.5"N 100°29'29.7"E) ให้ใส่ใน location
8. ข้อมูลที่ไม่สามารถจัดหมวดหมู่ได้ ให้ใส่ใน notes`;

      const result = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `แยกข้อมูลลูกค้าจากข้อความ LINE นี้:\n\n${input.text}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "line_customer_data",
            strict: true,
            schema: {
              type: "object",
              properties: {
                name: { type: "string", description: "ชื่อลูกค้า" },
                phone: { type: "string", description: "เบอร์โทรศัพท์" },
                fullAddress: { type: "string", description: "ที่อยู่เต็ม" },
                district: { type: "string", description: "เขต/อำเภอ" },
                province: { type: "string", description: "จังหวัด" },
                postalCode: { type: "string", description: "รหัสไปรษณีย์" },
                location: { type: "string", description: "ลิงก์ Google Maps หรือพิกัด" },
                scheduledDate: { type: "string", description: "วันที่นัดสำรวจ DD/MM/YYYY" },
                scheduledTime: { type: "string", description: "เวลานัดสำรวจ HH:MM" },
                source: { type: "string", description: "แหล่งที่มา" },
                electricityBill: { type: "string", description: "ค่าไฟต่อเดือน" },
                roofType: { type: "string", description: "ประเภทหลังคา" },
                phaseType: { type: "string", description: "ระบบไฟ single/three" },
                facebookName: { type: "string", description: "ชื่อ Facebook" },
                notes: { type: "string", description: "หมายเหตุ" },
              },
              required: ["name", "phone", "fullAddress", "district", "province", "postalCode", "location", "scheduledDate", "scheduledTime", "source", "electricityBill", "roofType", "phaseType", "facebookName", "notes"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = result.choices[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "ไม่สามารถแยกข้อมูลได้" });
      }

      try {
        const parsed = JSON.parse(content);
        return parsed as {
          name: string;
          phone: string;
          fullAddress: string;
          district: string;
          province: string;
          postalCode: string;
          location: string;
          scheduledDate: string;
          scheduledTime: string;
          source: string;
          electricityBill: string;
          roofType: string;
          phaseType: string;
          facebookName: string;
          notes: string;
        };
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "ไม่สามารถแปลงข้อมูลที่ AI ตอบกลับได้" });
      }
    }),
});

// ==================== GALLERY ROUTER ====================
const galleryRouter = router({
  albums: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      teamId: z.number().optional(),
      deliveryStatus: z.string().optional(),
      month: z.number().optional(),
      year: z.number().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }))
    .query(async ({ input }) => {
      return db.getGalleryAlbums(input);
    }),

  allPhotos: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      teamId: z.number().optional(),
      deliveryStatus: z.string().optional(),
      category: z.string().optional(),
      month: z.number().optional(),
      year: z.number().optional(),
      page: z.number().default(1),
      limit: z.number().default(40),
    }))
    .query(async ({ input }) => {
      return db.getGalleryAllPhotos(input);
    }),

  albumPhotos: protectedProcedure
    .input(z.object({ surveyId: z.number() }))
    .query(async ({ input }) => {
      return db.getAlbumPhotosForZip(input.surveyId);
    }),
});

// ==================== LINE SETTINGS ROUTER ====================
const lineSettingsRouter = router({
  // ดึงรายการ groups ที่ bot ถูกเพิ่มเข้าไป
  groups: superadminProcedure.query(async () => {
    return db.getLineGroups();
  }),

  // ดึงรายการ notification targets
  targets: superadminProcedure.query(async () => {
    return db.getLineNotificationTargets();
  }),

  // เพิ่ม notification target
  addTarget: superadminProcedure
    .input(z.object({
      targetType: z.enum(["user", "group"]),
      targetId: z.string().min(1),
      label: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.addLineNotificationTarget({
        targetType: input.targetType,
        targetId: input.targetId,
        label: input.label || null,
        isEnabled: true,
      });
      return { success: true };
    }),

  // อัปเดต target (เปิด/ปิด)
  updateTarget: superadminProcedure
    .input(z.object({
      id: z.number(),
      isEnabled: z.boolean().optional(),
      label: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateLineNotificationTarget(id, data);
      return { success: true };
    }),

  // ลบ target
  deleteTarget: superadminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteLineNotificationTarget(input.id);
      return { success: true };
    }),

  // ทดสอบส่งข้อความ LINE
  testSend: superadminProcedure
    .input(z.object({
      targetId: z.string().min(1),
      message: z.string().default("ทดสอบการส่งข้อความจาก Solar Survey"),
    }))
    .mutation(async ({ input }) => {
      const { sendLineMessage } = await import("./lineNotify");
      const ok = await sendLineMessage(input.targetId, [
        { type: "text", text: `🔔 ทดสอบ\n\n${input.message}` },
      ]);
      return { success: ok };
    }),

  // ทดสอบส่งแจ้งเตือนไปทุก target ที่เปิดอยู่
  testNotifyAll: superadminProcedure
    .mutation(async () => {
      const result = await sendLineNotification(
        "ทดสอบแจ้งเตือน",
        "นี่คือข้อความทดสอบจากระบบ Solar Survey\nหากได้รับข้อความนี้ แสดงว่าระบบแจ้งเตือน LINE ทำงานปกติ"
      );
      return result;
    }),

  // ดึง bot info
  botInfo: superadminProcedure.query(async () => {
    const { ENV } = await import("./_core/env");
    if (!ENV.lineChannelAccessToken) return null;
    try {
      const res = await fetch("https://api.line.me/v2/bot/info", {
        headers: { Authorization: `Bearer ${ENV.lineChannelAccessToken}` },
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }),
});

// ==================== APP ROUTER ====================
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  customer: customerRouter,
  survey: surveyRouter,
  photo: photoRouter,
  document: documentRouter,
  followUp: followUpRouter,
  shareLink: shareLinkRouter,
  notification: notificationRouter,
  dashboard: dashboardRouter,
  calendar: calendarRouter,
  users: usersRouter,
  storage: storageRouter,
  source: sourceRouter,
  assignment: assignmentRouter,
  teamMember: teamMemberRouter,
  teamPerformance: teamPerformanceRouter,
  customStatus: customStatusRouter,
  installation: installationRouter,
  installationPhoto: installationPhotoRouter,
  installationPhotoCategory: installationPhotoCategoryRouter,
  installerTeam: installerTeamRouter,
  delivery: deliveryRouter,
  deliveryComment: deliveryCommentRouter,
  photoCategory: photoCategoryRouter,
  documentCategory: documentCategoryRouter,
  lineParser: lineParserRouter,
  lineSettings: lineSettingsRouter,
  gallery: galleryRouter,
});

export type AppRouter = typeof appRouter;
