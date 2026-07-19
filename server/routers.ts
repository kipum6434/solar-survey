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
import { ENV } from "./_core/env";

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
      sourceGroup: z.string().optional(),
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
      surveyorId: z.number().nullable().optional(),
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
      surveyorId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      // Filter out null/undefined/empty-string values so Drizzle doesn't send them as NULL/empty to DB
      // Keep 'name' even if empty (it's required), keep surveyorId even if null (to allow clearing)
      const keepFields = new Set(["name", "surveyorId"]);
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
      // Sync: when surveyorId changes, update the latest survey's admin_sender assignment
      if (data.surveyorId !== undefined && data.surveyorId !== null) {
        const customerSurveys = (await db.getSurveys({ customerId: id, limit: 1 })).data;
        if (customerSurveys.length > 0) {
          const latestSurvey = customerSurveys[0]; // sorted by createdAt desc
          const currentAssignments = await db.getSurveyAssignments(latestSurvey.id);
          const assignments: { userId: number; role: "admin_sender" | "surveyor" | "closer" }[] = [];
          assignments.push({ userId: data.surveyorId, role: "admin_sender" });
          // Keep existing surveyors and closers
          currentAssignments.filter(a => a.assignment.role !== "admin_sender").forEach(a => {
            assignments.push({ userId: a.assignment.userId, role: a.assignment.role as any });
          });
          await db.setSurveyAssignments(latestSurvey.id, assignments);
        }
      }
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
        surveyorId: z.number().nullable().optional(),
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
      sourceGroup: z.string().optional(),
      district: z.string().optional(),
      province: z.string().optional(),
      sortBy: z.string().optional(),
      sortDirection: z.enum(["asc", "desc"]).optional(),
      filterDate: z.number().optional(),
      filterDateEnd: z.number().optional(),
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
      systemType: z.enum(["string", "micro", "both", "hybrid"]).optional(),
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
      // Sync customer.surveyorId with adminSenderId
      if (surveyData.adminSenderId && surveyData.customerId) {
        await db.updateCustomer(surveyData.customerId, { surveyorId: surveyData.adminSenderId });
      }
      await db.logActivity({ userId: ctx.user.id, action: "create", entityType: "survey", entityId: id, details: `สร้างงานสำรวจ ID: ${id}` });
      // Auto-create share link for survey
      try {
        const token = nanoid(32);
        await db.createShareLink({
          surveyId: id,
          token,
          linkType: "survey",
          expiresAt: null,
          allowPhotos: true,
          allowDocuments: true,
          createdBy: ctx.user.id,
        });
      } catch (e) {
        console.warn("[Survey] Failed to auto-create share link:", e);
      }
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
      systemType: z.enum(["string", "micro", "both", "hybrid"]).nullable().optional(),
      adminSenderId: z.number().nullable().optional(),
      surveyorIds: z.array(z.number()).optional(),
      closerId: z.number().nullable().optional(),
      closerIds: z.array(z.number()).optional(),
      statusId: z.number().nullable().optional(),
      installationDate: z.number().nullable().optional(),
      installationStatus: z.enum(["waiting", "in_progress", "completed", "delivered"]).nullable().optional(),
      installerTeamId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, surveyorIds, closerIds, ...rawData } = input;
      // Sanitize numeric fields before processing
      if (rawData.systemSize !== undefined && rawData.systemSize !== null) {
        const num = parseFloat(rawData.systemSize.replace(/[^0-9.]/g, ""));
        rawData.systemSize = isNaN(num) ? null : String(num);
      }
      if (rawData.panelCount !== undefined && rawData.panelCount !== null) {
        const num = parseInt(String(rawData.panelCount).replace(/[^0-9]/g, ""), 10);
        rawData.panelCount = isNaN(num) ? null : num;
      }
      if (rawData.quotedPrice !== undefined && rawData.quotedPrice !== null) {
        const num = parseFloat(rawData.quotedPrice.replace(/[^0-9.]/g, ""));
        rawData.quotedPrice = isNaN(num) ? null : String(num);
      }
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
      if (data.status === "surveyed" || data.status === "won" || data.status === "follow_up") {
        if (!(data as any).completedAt) (data as any).completedAt = Date.now();
      }
      // If installationStatus is being set to completed/delivered, also set installationCompletedAt
      if ((data as any).installationStatus === "completed" || (data as any).installationStatus === "delivered") {
        (data as any).installationCompletedAt = Date.now();
      }
      try {
        await db.updateSurvey(id, data);
      } catch (e: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง" });
      }
      // Update assignments if surveyorIds/closerIds provided — use rawData for null checks
      if (surveyorIds !== undefined || closerIds !== undefined || rawData.adminSenderId !== undefined || rawData.closerId !== undefined) {
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
        // Closers - support multi-closer via closerIds array
        if (closerIds !== undefined) {
          // closerIds is the new multi-closer array (empty array = remove all closers)
          const uniqueCloserIds = Array.from(new Set(closerIds));
          uniqueCloserIds.forEach(uid => assignments.push({ userId: uid, role: "closer" }));
        } else if (rawData.closerId === null) {
          // explicitly removed (legacy single closer)
        } else if (rawData.closerId) {
          // legacy single closer support
          assignments.push({ userId: rawData.closerId, role: "closer" });
        } else {
          // keep existing closers
          const existingClosers = currentAssignments.filter(a => a.assignment.role === "closer");
          existingClosers.forEach(a => assignments.push({ userId: a.assignment.userId, role: "closer" }));
        }
        await db.setSurveyAssignments(id, assignments);
        // Sync customer.surveyorId when adminSenderId changes
        if (rawData.adminSenderId && oldSurvey?.customerId) {
          await db.updateCustomer(oldSurvey.customerId, { surveyorId: rawData.adminSenderId });
        }
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
      // Auto-create payment when status changes to 'won' (ปิดการขาย) or installationStatus is set (รอติดตั้ง)
      const shouldAutoCreatePayment = 
        (data.status === "won" && oldSurvey && oldSurvey.status !== "won") ||
        ((data as any).installationStatus && oldSurvey && !(oldSurvey as any).installationStatus);
      if (shouldAutoCreatePayment) {
        const existingPayment = await db.getPaymentBySurveyId(id);
        if (!existingPayment) {
          const fullSurvey = await db.getSurveyById(id);
          if (fullSurvey) {
            const contractVal = fullSurvey.quotedPrice ? parseFloat(String(fullSurvey.quotedPrice)) : 0;
            const reason = (data as any).installationStatus ? "สร้างอัตโนมัติจากสถานะรอติดตั้ง" : "สร้างอัตโนมัติจากการปิดการขาย";
            await db.createPayment({
              surveyId: id,
              customerId: fullSurvey.customerId,
              contractValue: contractVal,
              collectedAmount: 0,
              createdBy: ctx.user.id,
              notes: reason,
            });
          }
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
        const surveyorNames = surveyData?.assignments
          ?.filter((a: any) => a.assignment.role === "surveyor")
          .map((a: any) => a.user.name)
          .filter(Boolean)
          .join(", ") || "-";
        // Find share link for this survey to include in notification
        let shareUrlPart = "";
        try {
          const shareLinks = await db.getShareLinksBySurveyByType(input.id, "survey");
          const activeLink = shareLinks.find((l: any) => l.isActive && (!l.expiresAt || l.expiresAt > Date.now()));
          if (activeLink) {
            shareUrlPart = `\n\n🔗 ดูผลสำรวจ: ${ENV.siteUrl}/survey-field/${activeLink.token}`;
          }
        } catch (e) {
          // ignore if share link lookup fails
        }
        const notifContent = `งานสำรวจของลูกค้า "${customerName}" (ID: ${input.id})\nเซลล์/ผู้สำรวจ: ${surveyorNames}\nสำรวจเสร็จสิ้นแล้ว${shareUrlPart}`;
        await notifyOwner({
          title: "สำรวจเสร็จสิ้น",
          content: notifContent,
        });
        // LINE notification
        await sendLineNotification(
          "สำรวจเสร็จสิ้น",
          notifContent
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
        const surveyorNames = surveyData?.assignments
          ?.filter((a: any) => a.assignment.role === "surveyor")
          .map((a: any) => a.user.name)
          .filter(Boolean)
          .join(", ") || "-";
        const shareUrl = `${ENV.siteUrl}/survey-field/${input.token}`;
        const notifContent = `งานสำรวจของลูกค้า "${customerName}" (ID: ${input.surveyId})\nเซลล์/ผู้สำรวจ: ${surveyorNames}\nสำรวจเสร็จสิ้นแล้ว (ผ่าน Share Link)\n\n🔗 ดูผลสำรวจ: ${shareUrl}`;
        await notifyOwner({
          title: "สำรวจเสร็จสิ้น (Share Link)",
          content: notifContent,
        });
        // LINE notification
        await sendLineNotification(
          "สำรวจเสร็จสิ้น (Share Link)",
          notifContent
        );
      } catch (e) {
        console.warn("[Survey] Failed to notify owner:", e);
      }
      return { success: true };
    }),

  // ปิดหน้างาน → เปลี่ยนสถานะเป็น "won" + installationStatus "waiting" (รอการติดตั้ง)
  closeToInstallation: protectedProcedure
    .input(z.object({ id: z.number(), installationDate: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      const survey = await db.getSurveyById(input.id);
      if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบงานสำรวจ" });
      const updateData: any = { status: "won", installationStatus: "waiting", completedAt: Date.now() };
      if (input.installationDate) {
        updateData.installationDate = input.installationDate;
      }
      await db.updateSurvey(input.id, updateData);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "survey", entityId: input.id, details: `นัดติดตั้ง${input.installationDate ? " วันที่ " + new Date(input.installationDate).toLocaleDateString("th-TH") : ""} ID: ${input.id}` });
      return { success: true };
    }),

  // ==================== POSTPONE / CANCEL (Protected - Admin/Backend) ====================
  postponeSurvey: protectedProcedure
    .input(z.object({ id: z.number(), reason: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const survey = await db.getSurveyById(input.id);
      if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบงานสำรวจ" });
      await db.createPostponeCancelLog({
        surveyId: input.id,
        action: "postpone_survey",
        reason: input.reason,
        previousDate: survey.scheduledDate || undefined,
        actionBy: ctx.user.name || "Admin",
        actionByRole: "admin",
      });
      await db.updateSurvey(input.id, { status: "postponed" } as any);
      await db.logActivity({ userId: ctx.user.id, action: "postpone", entityType: "survey", entityId: input.id, details: `เลื่อนสำรวจ: ${input.reason}` });
      // Notify
      try {
        const surveyData = await db.getSurveyWithCustomer(input.id);
        const customerName = surveyData?.customer?.name || `งาน #${input.id}`;
        const notifContent = `⏸️ เลื่อนสำรวจ\nลูกค้า: ${customerName} (ID: ${input.id})\nสาเหตุ: ${input.reason}\nโดย: ${ctx.user.name || "Admin"}\n\n🔗 ดูงาน: ${ENV.siteUrl}/surveys/${input.id}`;
        await notifyOwner({ title: "เลื่อนสำรวจ", content: notifContent });
        await sendLineNotification("เลื่อนสำรวจ", notifContent);
      } catch (e) { console.warn("[Postpone] notify failed:", e); }
      return { success: true };
    }),

  cancelSurvey: protectedProcedure
    .input(z.object({ id: z.number(), reason: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const survey = await db.getSurveyById(input.id);
      if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบงานสำรวจ" });
      await db.createPostponeCancelLog({
        surveyId: input.id,
        action: "cancel_survey",
        reason: input.reason,
        previousDate: survey.scheduledDate || undefined,
        actionBy: ctx.user.name || "Admin",
        actionByRole: "admin",
      });
      await db.updateSurvey(input.id, { status: "cancelled" } as any);
      await db.logActivity({ userId: ctx.user.id, action: "cancel", entityType: "survey", entityId: input.id, details: `ยกเลิกสำรวจ: ${input.reason}` });
      // Notify
      try {
        const surveyData = await db.getSurveyWithCustomer(input.id);
        const customerName = surveyData?.customer?.name || `งาน #${input.id}`;
        const notifContent = `❌ ยกเลิกสำรวจ\nลูกค้า: ${customerName} (ID: ${input.id})\nสาเหตุ: ${input.reason}\nโดย: ${ctx.user.name || "Admin"}\n\n🔗 ดูงาน: ${ENV.siteUrl}/surveys/${input.id}`;
        await notifyOwner({ title: "ยกเลิกสำรวจ", content: notifContent });
        await sendLineNotification("ยกเลิกสำรวจ", notifContent);
      } catch (e) { console.warn("[Cancel] notify failed:", e); }
      return { success: true };
    }),

  postponeInstallation: protectedProcedure
    .input(z.object({ id: z.number(), reason: z.string().min(1), newDate: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      const survey = await db.getSurveyById(input.id);
      if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบงานสำรวจ" });
      await db.createPostponeCancelLog({
        surveyId: input.id,
        action: "postpone_install",
        reason: input.reason,
        previousDate: survey.installationDate || undefined,
        newDate: input.newDate || undefined,
        actionBy: ctx.user.name || "Admin",
        actionByRole: "admin",
      });
      const updateData: any = { installationStatus: "postponed" };
      if (input.newDate) updateData.installationDate = input.newDate;
      await db.updateSurvey(input.id, updateData);
      await db.logActivity({ userId: ctx.user.id, action: "postpone", entityType: "survey", entityId: input.id, details: `เลื่อนติดตั้ง: ${input.reason}${input.newDate ? ` (วันใหม่: ${new Date(input.newDate).toLocaleDateString("th-TH")})` : ""}` });
      // Notify
      try {
        const surveyData = await db.getSurveyWithCustomer(input.id);
        const customerName = surveyData?.customer?.name || `งาน #${input.id}`;
        const newDateStr = input.newDate ? `\nวันติดตั้งใหม่: ${new Date(input.newDate).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}` : "";
        const notifContent = `⏸️ เลื่อนติดตั้ง\nลูกค้า: ${customerName} (ID: ${input.id})\nสาเหตุ: ${input.reason}${newDateStr}\nโดย: ${ctx.user.name || "Admin"}\n\n🔗 ดูงาน: ${ENV.siteUrl}/surveys/${input.id}`;
        await notifyOwner({ title: "เลื่อนติดตั้ง", content: notifContent });
        await sendLineNotification("เลื่อนติดตั้ง", notifContent);
      } catch (e) { console.warn("[Postpone Install] notify failed:", e); }
      return { success: true };
    }),

  cancelInstallation: protectedProcedure
    .input(z.object({ id: z.number(), reason: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const survey = await db.getSurveyById(input.id);
      if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบงานสำรวจ" });
      await db.createPostponeCancelLog({
        surveyId: input.id,
        action: "cancel_install",
        reason: input.reason,
        previousDate: survey.installationDate || undefined,
        actionBy: ctx.user.name || "Admin",
        actionByRole: "admin",
      });
      await db.updateSurvey(input.id, { installationStatus: "cancelled" } as any);
      await db.logActivity({ userId: ctx.user.id, action: "cancel", entityType: "survey", entityId: input.id, details: `ยกเลิกติดตั้ง: ${input.reason}` });
      // Notify
      try {
        const surveyData = await db.getSurveyWithCustomer(input.id);
        const customerName = surveyData?.customer?.name || `งาน #${input.id}`;
        const notifContent = `❌ ยกเลิกติดตั้ง\nลูกค้า: ${customerName} (ID: ${input.id})\nสาเหตุ: ${input.reason}\nโดย: ${ctx.user.name || "Admin"}\n\n🔗 ดูงาน: ${ENV.siteUrl}/surveys/${input.id}`;
        await notifyOwner({ title: "ยกเลิกติดตั้ง", content: notifContent });
        await sendLineNotification("ยกเลิกติดตั้ง", notifContent);
      } catch (e) { console.warn("[Cancel Install] notify failed:", e); }
      return { success: true };
    }),

  // ==================== POSTPONE / CANCEL (Public - Share Link) ====================
  publicPostponeSurvey: publicProcedure
    .input(z.object({ token: z.string(), surveyId: z.number(), reason: z.string().min(1), actionBy: z.string().min(1), actionByRole: z.enum(["admin", "surveyor", "installer"]) }))
    .mutation(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.expiresAt && link.expiresAt < Date.now()) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์หมดอายุ" });
      if (link.surveyId !== input.surveyId) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ตรงกับงาน" });
      const survey = await db.getSurveyById(input.surveyId);
      if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบงานสำรวจ" });
      await db.createPostponeCancelLog({
        surveyId: input.surveyId,
        action: "postpone_survey",
        reason: input.reason,
        previousDate: survey.scheduledDate || undefined,
        actionBy: input.actionBy,
        actionByRole: input.actionByRole,
      });
      await db.updateSurvey(input.surveyId, { status: "postponed" } as any);
      // Notify
      try {
        const surveyData = await db.getSurveyWithCustomer(input.surveyId);
        const customerName = surveyData?.customer?.name || `งาน #${input.surveyId}`;
        const notifContent = `⏸️ เลื่อนสำรวจ (Share Link)\nลูกค้า: ${customerName} (ID: ${input.surveyId})\nสาเหตุ: ${input.reason}\nโดย: ${input.actionBy} (${input.actionByRole})\n\n🔗 ดูงาน: ${ENV.siteUrl}/surveys/${input.surveyId}`;
        await notifyOwner({ title: "เลื่อนสำรวจ", content: notifContent });
        await sendLineNotification("เลื่อนสำรวจ", notifContent);
      } catch (e) { console.warn("[Public Postpone] notify failed:", e); }
      return { success: true };
    }),

  publicCancelSurvey: publicProcedure
    .input(z.object({ token: z.string(), surveyId: z.number(), reason: z.string().min(1), actionBy: z.string().min(1), actionByRole: z.enum(["admin", "surveyor", "installer"]) }))
    .mutation(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.expiresAt && link.expiresAt < Date.now()) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์หมดอายุ" });
      if (link.surveyId !== input.surveyId) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ตรงกับงาน" });
      const survey = await db.getSurveyById(input.surveyId);
      if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบงานสำรวจ" });
      await db.createPostponeCancelLog({
        surveyId: input.surveyId,
        action: "cancel_survey",
        reason: input.reason,
        previousDate: survey.scheduledDate || undefined,
        actionBy: input.actionBy,
        actionByRole: input.actionByRole,
      });
      await db.updateSurvey(input.surveyId, { status: "cancelled" } as any);
      // Notify
      try {
        const surveyData = await db.getSurveyWithCustomer(input.surveyId);
        const customerName = surveyData?.customer?.name || `งาน #${input.surveyId}`;
        const notifContent = `❌ ยกเลิกสำรวจ (Share Link)\nลูกค้า: ${customerName} (ID: ${input.surveyId})\nสาเหตุ: ${input.reason}\nโดย: ${input.actionBy} (${input.actionByRole})\n\n🔗 ดูงาน: ${ENV.siteUrl}/surveys/${input.surveyId}`;
        await notifyOwner({ title: "ยกเลิกสำรวจ", content: notifContent });
        await sendLineNotification("ยกเลิกสำรวจ", notifContent);
      } catch (e) { console.warn("[Public Cancel] notify failed:", e); }
      return { success: true };
    }),

  publicPostponeInstallation: publicProcedure
    .input(z.object({ token: z.string(), surveyId: z.number(), reason: z.string().min(1), actionBy: z.string().min(1), actionByRole: z.enum(["admin", "surveyor", "installer"]), newDate: z.number().optional() }))
    .mutation(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.expiresAt && link.expiresAt < Date.now()) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์หมดอายุ" });
      if (link.surveyId !== input.surveyId) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ตรงกับงาน" });
      const survey = await db.getSurveyById(input.surveyId);
      if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบงานสำรวจ" });
      await db.createPostponeCancelLog({
        surveyId: input.surveyId,
        action: "postpone_install",
        reason: input.reason,
        previousDate: survey.installationDate || undefined,
        newDate: input.newDate || undefined,
        actionBy: input.actionBy,
        actionByRole: input.actionByRole,
      });
      const updateData: any = { installationStatus: "postponed" };
      if (input.newDate) updateData.installationDate = input.newDate;
      await db.updateSurvey(input.surveyId, updateData);
      // Notify
      try {
        const surveyData = await db.getSurveyWithCustomer(input.surveyId);
        const customerName = surveyData?.customer?.name || `งาน #${input.surveyId}`;
        const newDateStr = input.newDate ? `\nวันติดตั้งใหม่: ${new Date(input.newDate).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}` : "";
        const notifContent = `⏸️ เลื่อนติดตั้ง (Share Link)\nลูกค้า: ${customerName} (ID: ${input.surveyId})\nสาเหตุ: ${input.reason}${newDateStr}\nโดย: ${input.actionBy} (${input.actionByRole})\n\n🔗 ดูงาน: ${ENV.siteUrl}/surveys/${input.surveyId}`;
        await notifyOwner({ title: "เลื่อนติดตั้ง", content: notifContent });
        await sendLineNotification("เลื่อนติดตั้ง", notifContent);
      } catch (e) { console.warn("[Public Postpone Install] notify failed:", e); }
      return { success: true };
    }),

  publicCancelInstallation: publicProcedure
    .input(z.object({ token: z.string(), surveyId: z.number(), reason: z.string().min(1), actionBy: z.string().min(1), actionByRole: z.enum(["admin", "surveyor", "installer"]) }))
    .mutation(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.expiresAt && link.expiresAt < Date.now()) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์หมดอายุ" });
      if (link.surveyId !== input.surveyId) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ตรงกับงาน" });
      const survey = await db.getSurveyById(input.surveyId);
      if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบงานสำรวจ" });
      await db.createPostponeCancelLog({
        surveyId: input.surveyId,
        action: "cancel_install",
        reason: input.reason,
        previousDate: survey.installationDate || undefined,
        actionBy: input.actionBy,
        actionByRole: input.actionByRole,
      });
      await db.updateSurvey(input.surveyId, { installationStatus: "cancelled" } as any);
      // Notify
      try {
        const surveyData = await db.getSurveyWithCustomer(input.surveyId);
        const customerName = surveyData?.customer?.name || `งาน #${input.surveyId}`;
        const notifContent = `❌ ยกเลิกติดตั้ง (Share Link)\nลูกค้า: ${customerName} (ID: ${input.surveyId})\nสาเหตุ: ${input.reason}\nโดย: ${input.actionBy} (${input.actionByRole})\n\n🔗 ดูงาน: ${ENV.siteUrl}/surveys/${input.surveyId}`;
        await notifyOwner({ title: "ยกเลิกติดตั้ง", content: notifContent });
        await sendLineNotification("ยกเลิกติดตั้ง", notifContent);
      } catch (e) { console.warn("[Public Cancel Install] notify failed:", e); }
      return { success: true };
    }),

  // ==================== GET POSTPONE/CANCEL LOGS ====================
  getPostponeCancelLogs: protectedProcedure
    .input(z.object({ surveyId: z.number() }))
    .query(({ input }) => db.getPostponeCancelLogs(input.surveyId)),

  publicGetPostponeCancelLogs: publicProcedure
    .input(z.object({ token: z.string(), surveyId: z.number() }))
    .query(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.surveyId !== input.surveyId) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ตรงกับงาน" });
      return db.getPostponeCancelLogs(input.surveyId);
    }),

  // ==================== REOPEN (Admin only) ====================
  reopenSurvey: protectedProcedure
    .input(z.object({ id: z.number(), newStatus: z.enum(["pending", "scheduled"]).default("pending") }))
    .mutation(async ({ input, ctx }) => {
      const survey = await db.getSurveyById(input.id);
      if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบงานสำรวจ" });
      await db.updateSurvey(input.id, { status: input.newStatus } as any);
      await db.logActivity({ userId: ctx.user.id, action: "reopen", entityType: "survey", entityId: input.id, details: `เปิดงานสำรวจใหม่ → ${input.newStatus}` });
      return { success: true };
    }),

  reopenInstallation: protectedProcedure
    .input(z.object({ id: z.number(), newStatus: z.enum(["waiting", "in_progress"]).default("waiting") }))
    .mutation(async ({ input, ctx }) => {
      const survey = await db.getSurveyById(input.id);
      if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบงานสำรวจ" });
      await db.updateSurvey(input.id, { installationStatus: input.newStatus } as any);
      await db.logActivity({ userId: ctx.user.id, action: "reopen", entityType: "survey", entityId: input.id, details: `เปิดงานติดตั้งใหม่ → ${input.newStatus}` });
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

  updateCaption: protectedProcedure
    .input(z.object({ id: z.number(), caption: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await db.updatePhotoCaption(input.id, input.caption);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "photo", entityId: input.id, details: `แก้ไขหมายเหตุรูป ID: ${input.id}` });
      return { success: true };
    }),

  publicUpdateCaption: publicProcedure
    .input(z.object({ token: z.string(), photoId: z.number(), caption: z.string() }))
    .mutation(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.expiresAt && link.expiresAt < Date.now()) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์หมดอายุ" });
      await db.updatePhotoCaption(input.photoId, input.caption);
      return { success: true };
    }),

  reorder: publicProcedure
    .input(z.object({ items: z.array(z.object({ id: z.number(), sortOrder: z.number() })).min(1).max(500) }))
    .mutation(async ({ input }) => {
      await db.reorderSurveyPhotos(input.items);
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

  listWithDetails: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      method: z.string().optional(),
      startDate: z.number().optional(),
      endDate: z.number().optional(),
      search: z.string().optional(),
    }))
    .query(({ input }) => db.getFollowUpsWithDetails(input)),

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

  surveysForFollowUp: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      startDate: z.number().optional(),
      endDate: z.number().optional(),
      page: z.number().default(1),
      limit: z.number().default(50),
      sourceGroup: z.string().optional(),
      assigneeId: z.number().optional(),
      statusFilter: z.string().optional(),
    }))
    .query(({ input }) => db.getSurveysForFollowUp(input)),

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

  advanceRound: protectedProcedure
    .input(z.object({
      surveyId: z.number(),
      customerId: z.number(),
      currentRound: z.number(),
      note: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const nextRound = input.currentRound + 1;
      if (nextRound > 3) throw new TRPCError({ code: 'BAD_REQUEST', message: 'ไม่สามารถเลื่อนเกินครั้งที่ 3 ได้' });
      // Mark current latest follow-up as completed with note
      const latestFu = await db.getLatestFollowUpBySurvey(input.surveyId);
      if (latestFu) {
        await db.updateFollowUp(latestFu.id, { status: 'completed', completedAt: Date.now(), notes: input.note || latestFu.notes });
      }
      // Create new follow-up with next round, due in 2 days
      const dueDate = Date.now() + 2 * 24 * 60 * 60 * 1000;
      const id = await db.createFollowUp({
        surveyId: input.surveyId,
        customerId: input.customerId,
        dueDate,
        createdBy: ctx.user.id,
      });
      const noteText = input.note ? ` (หมายเหตุ: ${input.note})` : '';
      await db.logActivity({ userId: ctx.user.id, action: 'advance_round', entityType: 'follow_up', entityId: id, details: `เลื่อนเป็นติดตามครั้งที่ ${nextRound} สำหรับงาน #${input.surveyId}${noteText}` });
      return { success: true, newRound: nextRound };
    }),

  cancelFollowUp: protectedProcedure
    .input(z.object({
      surveyId: z.number(),
      reason: z.string().min(1, "กรุณาระบุเหตุผล"),
    }))
    .mutation(async ({ input, ctx }) => {
      const survey = await db.getSurveyById(input.surveyId);
      if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบงานสำรวจ" });
      // Log cancellation reason
      await db.createPostponeCancelLog({
        surveyId: input.surveyId,
        action: "cancel_survey",
        reason: input.reason,
        previousDate: survey.scheduledDate || undefined,
        actionBy: ctx.user.name || "Admin",
        actionByRole: "admin",
      });
      // Update survey status to lost (ยกเลิกจากการติดตาม)
      await db.updateSurvey(input.surveyId, { status: "lost" } as any);
      await db.logActivity({ userId: ctx.user.id, action: "cancel_followup", entityType: "survey", entityId: input.surveyId, details: `ยกเลิกติดตาม: ${input.reason}` });
      // Notify
      try {
        const surveyData = await db.getSurveyWithCustomer(input.surveyId);
        const customerName = surveyData?.customer?.name || `งาน #${input.surveyId}`;
        const notifContent = `❌ ยกเลิกติดตาม\nลูกค้า: ${customerName} (ID: ${input.surveyId})\nสาเหตุ: ${input.reason}\nโดย: ${ctx.user.name || "Admin"}\n\n🔗 ดูงาน: ${ENV.siteUrl}/surveys/${input.surveyId}`;
        await notifyOwner({ title: "ยกเลิกติดตาม", content: notifContent });
        await sendLineNotification("ยกเลิกติดตาม", notifContent);
      } catch (e) { console.warn("[CancelFollowUp] notify failed:", e); }
      return { success: true };
    }),

  overdueCount: protectedProcedure
    .query(async () => {
      return db.getOverdueFollowUpCountPerGroup();
    }),
});
// ==================== SHARE LINK ROUTER =====================
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
      // Survey links have no expiry, installation links keep 14-day expiry
      const expiresAt = input.linkType === "survey" ? null : Date.now() + (input.expiresInDays * 24 * 60 * 60 * 1000);
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

  backfillSurveyLinks: adminProcedure
    .mutation(async ({ ctx }) => {
      // Get all survey IDs
      const allSurveys = await db.getSurveys({ page: 1, limit: 9999 });
      let created = 0;
      let skipped = 0;
      for (const survey of allSurveys.data) {
        // Check if this survey already has an active survey-type share link
        const existing = await db.getShareLinksBySurveyByType(survey.id, "survey");
        const hasActive = existing.some((l: any) => l.isActive);
        if (hasActive) {
          skipped++;
          continue;
        }
        // Create share link
        const token = nanoid(32);
        await db.createShareLink({
          surveyId: survey.id,
          token,
          linkType: "survey",
          expiresAt: null,
          allowPhotos: true,
          allowDocuments: true,
          createdBy: ctx.user.id,
        });
        created++;
      }
      await db.logActivity({ userId: ctx.user.id, action: "backfill_share_links", entityType: "system", entityId: 0, details: `Backfill share links: สร้าง ${created} ลิงก์, ข้าม ${skipped} งานที่มีอยู่แล้ว` });
      return { created, skipped, total: allSurveys.data.length };
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
      systemType: z.enum(["string", "micro", "both", "hybrid"]).optional(),
      surveyNotes: z.string().optional(),
      quotedPrice: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.linkType !== "survey") throw new TRPCError({ code: "FORBIDDEN", message: "ลิงก์นี้ไม่ใช่ลิงก์สำรวจ" });
      if (link.expiresAt && link.expiresAt < Date.now()) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์หมดอายุ" });
      if (link.surveyId !== input.surveyId) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ตรงกับงาน" });
      const { token, surveyId, ...rawData } = input;
      // Sanitize numeric fields - strip non-numeric chars (keep dots for decimals)
      const data: any = { ...rawData };
      if (data.systemSize !== undefined) {
        const num = parseFloat(data.systemSize.replace(/[^0-9.]/g, ""));
        data.systemSize = isNaN(num) ? null : String(num);
      }
      if (data.panelCount !== undefined) {
        const num = parseInt(String(data.panelCount).replace(/[^0-9]/g, ""), 10);
        data.panelCount = isNaN(num) ? null : num;
      }
      if (data.quotedPrice !== undefined) {
        const num = parseFloat(data.quotedPrice.replace(/[^0-9.]/g, ""));
        data.quotedPrice = isNaN(num) ? null : String(num);
      }
      try {
        await db.updateSurvey(surveyId, data);
      } catch (e: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง" });
      }
      return { success: true };
    }),

  // Public reorder survey photos (ลิงก์สำรวจ — จัดเรียงรูป)
  publicReorderSurveyPhotos: publicProcedure
    .input(z.object({
      token: z.string(),
      surveyId: z.number(),
      items: z.array(z.object({ id: z.number(), sortOrder: z.number() })).min(1).max(500),
    }))
    .mutation(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.linkType !== "survey") throw new TRPCError({ code: "FORBIDDEN", message: "ลิงก์นี้ไม่ใช่ลิงก์สำรวจ" });
      if (link.surveyId !== input.surveyId) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ตรงกับงาน" });
      await db.reorderSurveyPhotos(input.items);
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
        try {
          await db.updateCustomer(surveyData.customer.id, cleanData);
        } catch (e: any) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง" });
        }
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
  stats: protectedProcedure
    .input(z.object({ month: z.number().optional(), year: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const scope = await getUserScope(ctx.user);
      return db.getDashboardStats(scope?.surveyIds, scope?.customerIds, input?.month, input?.year);
    }),
  recentActivities: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }).optional())
    .query(({ input }) => db.getRecentActivities(input?.limit)),
  groupStats: protectedProcedure
    .input(z.object({ sourceGroup: z.string() }))
    .query(({ input }) => db.getDashboardStatsForGroup(input.sourceGroup)),
});

// ==================== CALENDAR ROUTER ====================
const calendarRouter = router({
  events: protectedProcedure
    .input(z.object({
      startDate: z.number(),
      endDate: z.number(),
    }))
    .query(({ input }) => db.getCalendarEvents(input.startDate, input.endDate)),

  installationEvents: protectedProcedure
    .input(z.object({
      startDate: z.number(),
      endDate: z.number(),
    }))
    .query(({ input }) => db.getInstallationCalendarEvents(input.startDate, input.endDate)),
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
  listWithStats: protectedProcedure.query(() => db.getSourcesWithStats()),
  listGroups: protectedProcedure.query(() => db.getSourceGroups()),
  sourceNamesByGroup: protectedProcedure.query(async () => {
    const allSources = await db.getSources();
    const result: Record<string, string[]> = {};
    for (const s of allSources) {
      const group = (s as any).groupName;
      if (group) {
        if (!result[group]) result[group] = [];
        result[group].push(s.name);
      }
    }
    return result;
  }),
  getCustomersBySource: protectedProcedure
    .input(z.object({ sourceId: z.number() }))
    .query(({ input }) => db.getCustomersBySourceId(input.sourceId)),
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), category: z.string().optional() }))
    .mutation(async ({ input }) => {
      const source = await db.getOrCreateSource(input.name, input.category);
      return source;
    }),
  update: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().optional(), category: z.string().optional(), groupName: z.string().nullable().optional() }))
    .mutation(async ({ input }) => {
      await db.updateSource(input.id, { name: input.name, category: input.category, groupName: input.groupName });
      return { success: true };
    }),
  createGroup: adminProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return await db.createSourceGroup(input.name);
    }),
  deleteGroup: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return await db.deleteSourceGroup(input.id);
    }),
  listGroupsFull: protectedProcedure.query(() => db.getSourceGroupsFull()),
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
      role: z.enum(["user", "admin", "warehouse"]),
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
      role: z.enum(["user", "admin", "warehouse"]).optional(),
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
      roles: z.array(z.enum(["admin_sender", "surveyor", "closer"])).optional(),
      linkedUserId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // If roles array provided, use it; otherwise fall back to single role
      const rolesArr = input.roles && input.roles.length > 0 ? input.roles : [input.role];
      const result = await db.createTeamMember({ ...input, roles: rolesArr });
      await db.logActivity({ userId: ctx.user.id, action: "create", entityType: "team_member", entityId: result.id, details: `เพิ่มสมาชิกทีม: ${input.name} (${rolesArr.join(", ")})` });
      return result;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      role: z.enum(["admin_sender", "surveyor", "closer"]).optional(),
      roles: z.array(z.enum(["admin_sender", "surveyor", "closer"])).optional(),
      isActive: z.boolean().optional(),
      linkedUserId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      // If roles provided, also update the legacy role column
      if (data.roles && data.roles.length > 0 && !data.role) {
        data.role = data.roles[0] as any;
      }
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
      tab: z.enum(["lead", "commission"]).optional(),
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
      // If status is completed/delivered, set installationCompletedAt
      if (input.installationStatus === "completed" || input.installationStatus === "delivered") {
        await db.updateSurvey(input.surveyId, { installationCompletedAt: Date.now() } as any);
      } else {
        // Clear installationCompletedAt if not completed/delivered
        await db.updateSurvey(input.surveyId, { installationCompletedAt: null } as any);
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
      startDate: z.string().optional(), // YYYY-MM-DD format for date range filter
      endDate: z.string().optional(), // YYYY-MM-DD format for date range filter
      district: z.string().optional(),
      province: z.string().optional(),
      surveyorId: z.number().optional(),
      closerId: z.number().optional(),
      installerTeamId: z.number().optional(),
      installationStatus: z.enum(['all', 'upcoming', 'today', 'overdue', 'completed']).optional(),
      sourceGroup: z.string().optional(),
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
  pendingCount: protectedProcedure
    .query(async () => {
      return db.getPendingApprovalCount();
    }),
  list: protectedProcedure
    .input(z.object({
      page: z.number().optional(),
      limit: z.number().optional(),
      search: z.string().optional(),
      month: z.number().optional(),
      year: z.number().optional(),
      installerTeamId: z.number().optional(),
      deliveryStatus: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.getPendingApprovals(input ?? {});
    }),
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
    .input(z.object({
      token: z.string(),
      surveyId: z.number(),
      technicianSignature: z.string().optional(), // base64 data URL
      technicianName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.expiresAt && link.expiresAt < Date.now()) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์หมดอายุ" });
      if (link.surveyId !== input.surveyId) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ตรงกับงาน" });
      const photos = await db.getInstallationPhotos(input.surveyId);
      if (photos.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "กรุณาอัพโหลดรูปติดตั้งก่อนส่งมอบงาน" });
      }
      // Validate required categories
      const categories = await db.getInstallationPhotoCategories();
      const photoCategoryKeys = new Set(photos.map((p: any) => p.category || "other"));
      const missingRequired = categories.filter((c: any) => c.isRequired && !photoCategoryKeys.has(c.key));
      if (missingRequired.length > 0) {
        const names = missingRequired.map((c: any) => c.label).join(", ");
        throw new TRPCError({ code: "BAD_REQUEST", message: `ยังขาดรูปหมวดหมู่ที่จำเป็น: ${names}` });
      }

      // Save technician signature if provided
      if (input.technicianSignature) {
        const form = await db.getDeliveryFormBySurveyId(input.surveyId);
        if (form) {
          const base64Data = input.technicianSignature.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");
          const key = `signatures/${input.surveyId}_technician_${Date.now()}_${nanoid(6)}.png`;
          const { url } = await storagePut(key, buffer, "image/png");
          await db.updateDeliveryFormSignature(form.id, {
            technicianSignatureUrl: url,
            technicianSignatureKey: key,
            technicianName: input.technicianName || "ช่างติดตั้ง",
          });
        }
      }

      const result = await db.submitDelivery(input.surveyId, null);

      // Notify admin when technician submits delivery via share link
      try {
        const surveyInfo = await db.getSurveyWithCustomer(input.surveyId);
        const customerName = surveyInfo?.customer?.name || `งาน #${input.surveyId}`;
        await notifyOwner({
          title: "ช่างส่งมอบงานติดตั้ง",
          content: `ทีมช่างได้ส่งมอบงานติดตั้งของลูกค้า "${customerName}" (ID: ${input.surveyId}) ผ่าน Share Link แล้ว กรุณาตรวจสอบและอนุมัติ\n\n🔗 ดูงาน: ${ENV.siteUrl}/surveys/${input.surveyId}`,
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

  // Withdraw delivery (technician can undo submit to edit photos)
  withdraw: protectedProcedure
    .input(z.object({ surveyId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const result = await db.withdrawDelivery(input.surveyId);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "delivery", entityId: input.surveyId, details: `ถอนส่งมอบงาน surveyId: ${input.surveyId}` });
      return result;
    }),

  // Public withdraw for share link (no login required)
  publicWithdraw: publicProcedure
    .input(z.object({ token: z.string(), surveyId: z.number() }))
    .mutation(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.expiresAt && link.expiresAt < Date.now()) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์หมดอายุ" });
      if (link.surveyId !== input.surveyId) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ตรงกับงาน" });
      const result = await db.withdrawDelivery(input.surveyId);
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
        const surveyorNames = surveyData?.assignments
          ?.filter((a: any) => a.assignment.role === "surveyor")
          .map((a: any) => a.user.name)
          .filter(Boolean)
          .join(", ") || "-";
        await sendLineNotification(
          "ติดตั้งเสร็จสิ้น",
          `งานติดตั้งของลูกค้า "${customerName}" (ID: ${input.surveyId})\nเซลล์/ผู้สำรวจ: ${surveyorNames}\nติดตั้งเสร็จสิ้นแล้ว\n\n🔗 ดูงาน: ${ENV.siteUrl}/surveys/${input.surveyId}`
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

// ==================== DOCUMENT SETTINGS ROUTER ====================
const documentSettingsRouter = router({
  list: protectedProcedure.query(async () => {
    return db.getDocumentSettings();
  }),

  getByKey: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const setting = await db.getDocumentSettingByKey(input.key);
      return setting;
    }),

  upsert: adminProcedure
    .input(z.object({
      settingKey: z.string().min(1),
      label: z.string().min(1),
      documentNumber: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await db.upsertDocumentSetting(input);
      return result;
    }),
});

// ==================== COMPANY SETTINGS ROUTER ====================
const companySettingsRouter = router({
  get: publicProcedure.query(async () => {
    const settings = await db.getCompanySettings();
    return settings || { id: 0, companyName: "", phone: "", address: "", logoUrl: null, logoFileKey: null, photoBorderColor: "#d4d4d4", disclaimerText: null };
  }),

  update: adminProcedure
    .input(z.object({
      companyName: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      photoBorderColor: z.string().optional(),
      disclaimerText: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await db.updateCompanySettings(input);
      return result;
    }),

  uploadLogo: adminProcedure
    .input(z.object({
      base64Data: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input }) => {
      // Validate file size (max 2MB)
      const buffer = Buffer.from(input.base64Data, "base64");
      if (buffer.length > 2 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ไฟล์โลโก้ต้องมีขนาดไม่เกิน 2MB" });
      }
      
      // Delete old logo if exists
      const existing = await db.getCompanySettings();
      if (existing?.logoFileKey) {
        try { await storageDelete(existing.logoFileKey); } catch { /* ignore */ }
      }
      
      const ext = input.fileName.split(".").pop() || "png";
      const key = `company/logo_${Date.now()}_${nanoid(8)}.${ext}`;
      const contentType = input.mimeType || "image/png";
      const { url } = await storagePut(key, buffer, contentType);
      
      await db.updateCompanySettings({ logoUrl: url, logoFileKey: key });
      return { url, key };
    }),

  deleteLogo: adminProcedure.mutation(async () => {
    const existing = await db.getCompanySettings();
    if (existing?.logoFileKey) {
      try { await storageDelete(existing.logoFileKey); } catch { /* ignore */ }
    }
    await db.updateCompanySettings({ logoUrl: null, logoFileKey: null });
    return { success: true };
  }),
});

// ==================== DELIVERY FORM ROUTER ====================
const deliveryFormRouter = router({
  get: protectedProcedure
    .input(z.object({ surveyId: z.number() }))
    .query(async ({ input }) => {
      const form = await db.getDeliveryFormBySurveyId(input.surveyId);
      if (!form) return null;
      return {
        ...form,
        checklistItems: form.checklistData ? JSON.parse(form.checklistData) : [],
      };
    }),

  create: protectedProcedure
    .input(z.object({
      surveyId: z.number(),
      checklistItems: z.array(z.object({ templateId: z.number().optional(), label: z.string(), checked: z.boolean() })).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Get survey to find customerId
      const survey = await db.getSurveyById(input.surveyId);
      if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบงานสำรวจ" });
      const checklistData = JSON.stringify(input.checklistItems || []);
      return db.createDeliveryForm({
        surveyId: input.surveyId,
        customerId: survey.customerId,
        checklistData,
        createdBy: ctx.user.id,
      });
    }),

  updateChecklist: protectedProcedure
    .input(z.object({
      id: z.number(),
      checklistItems: z.array(z.object({ templateId: z.number().optional(), label: z.string(), checked: z.boolean() })),
    }))
    .mutation(async ({ input }) => {
      await db.updateDeliveryFormChecklist(input.id, JSON.stringify(input.checklistItems));
      return { success: true };
    }),

  saveSignature: protectedProcedure
    .input(z.object({
      surveyId: z.number(),
      type: z.enum(["customer", "technician"]),
      signatureData: z.string(), // base64 data URL
    }))
    .mutation(async ({ input, ctx }) => {
      const form = await db.getDeliveryFormBySurveyId(input.surveyId);
      if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบใบส่งมอบงาน" });
      
      // Upload signature to S3
      const base64Data = input.signatureData.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const key = `signatures/${form.surveyId}_${input.type}_${Date.now()}_${nanoid(6)}.png`;
      const { url } = await storagePut(key, buffer, "image/png");
      
      const updateData: any = {};
      if (input.type === "customer") {
        updateData.customerSignatureUrl = url;
        updateData.customerSignatureKey = key;
      } else {
        updateData.technicianSignatureUrl = url;
        updateData.technicianSignatureKey = key;
        updateData.technicianName = ctx.user.name || "ช่าง";
      }
      
      // Check if both signatures exist after this update
      const hasCustomerSig = input.type === "customer" ? true : !!form.customerSignatureUrl;
      const hasTechSig = input.type === "technician" ? true : !!form.technicianSignatureUrl;
      if (hasCustomerSig && hasTechSig) {
        updateData.status = "signed";
        updateData.signedAt = Date.now();
      }
      
      await db.updateDeliveryFormSignature(form.id, updateData);
      return { success: true, url };
    }),

  updateNotes: protectedProcedure
    .input(z.object({ id: z.number(), notes: z.string() }))
    .mutation(async ({ input }) => {
      await db.updateDeliveryFormNotes(input.id, input.notes);
      return { success: true };
    }),

  list: protectedProcedure.query(async () => {
    return db.listDeliveryForms();
  }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteDeliveryForm(input.id);
      return { success: true };
    }),

  bulkDelete: adminProcedure
    .input(z.object({ ids: z.array(z.number()).min(1).max(100) }))
    .mutation(async ({ input }) => {
      return db.bulkDeleteDeliveryForms(input.ids);
    }),

  // ==================== HANDOVER PROCEDURES ====================
  updateSelectedPhotos: protectedProcedure
    .input(z.object({ id: z.number(), photoIds: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      await db.updateDeliveryFormSelectedPhotos(input.id, JSON.stringify(input.photoIds));
      return { success: true };
    }),

  updateCustomSections: protectedProcedure
    .input(z.object({
      id: z.number(),
      sections: z.array(z.object({ title: z.string(), content: z.string() })),
    }))
    .mutation(async ({ input }) => {
      await db.updateDeliveryFormCustomSections(input.id, JSON.stringify(input.sections));
      return { success: true };
    }),

  generateHandoverLink: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const form = await db.getDeliveryFormById(input.id);
      if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบใบส่งมอบงาน" });
      // Generate or reuse existing token
      const token = form.handoverToken || nanoid(32);
      await db.generateHandoverToken(input.id, token);
      return { token };
    }),

  // Public: get handover data by token (no auth required)
  getByHandoverToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const form = await db.getDeliveryFormByToken(input.token);
      if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้องหรือหมดอายุ" });
      // Get customer + survey info
      const survey = await db.getSurveyById(form.surveyId);
      const customer = survey ? await db.getCustomerById(survey.customerId) : null;
      // Get selected photos
      let photos: any[] = [];
      if (form.selectedPhotoIds) {
        const photoIds: number[] = JSON.parse(form.selectedPhotoIds);
        if (photoIds.length > 0) {
          const allPhotos = await db.getInstallationPhotos(form.surveyId);
          photos = allPhotos.filter((p: any) => photoIds.includes(p.id));
        }
      }
      // Parse checklist and custom sections
      const checklistItems = form.checklistData ? JSON.parse(form.checklistData) : [];
      const customSections = form.customSections ? JSON.parse(form.customSections) : [];
      // Get template names for grouping
      const templates = await db.getChecklistTemplates();
      const templateNameMap: Record<number, string> = {};
      for (const t of templates) {
        templateNameMap[t.id] = t.name;
      }
      // Get disclaimer text
      const settings = await db.getCompanySettings();
      return {
        id: form.id,
        status: form.status,
        customerName: customer?.name || "",
        customerPhone: customer?.phone || "",
        customerAddress: customer?.fullAddress || customer?.address || "",
        systemSize: survey?.systemSize || "",
        panelBrand: survey?.panelBrand || "",
        inverterModel: survey?.inverterModel || "",
        panelCount: survey?.panelCount || "",
        phaseType: customer?.phaseType || "",
        roofType: customer?.roofType || "",
        checklistItems,
        customSections,
        templateNameMap,
        disclaimerText: settings?.disclaimerText || null,
        photos,
        notes: form.notes || "",
        customerSignatureUrl: form.customerSignatureUrl,
        customerSignerName: form.customerSignerName,
        signedAt: form.signedAt,
        technicianSignatureUrl: form.technicianSignatureUrl,
        technicianName: form.technicianName,
      };
    }),

  // Public: customer signs the handover document
  publicSignHandover: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      signatureData: z.string(), // base64 data URL
      signerName: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const form = await db.getDeliveryFormByToken(input.token);
      if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (form.status === "signed" || form.status === "completed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "เอกสารนี้ถูกเซ็นไปแล้ว" });
      }
      // Upload signature to S3
      const base64Data = input.signatureData.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const key = `signatures/handover_${form.id}_customer_${Date.now()}_${nanoid(6)}.png`;
      const { url } = await storagePut(key, buffer, "image/png");
      await db.signDeliveryFormByCustomer(form.id, {
        customerSignatureUrl: url,
        customerSignatureKey: key,
        customerSignerName: input.signerName,
      });
      return { success: true };
    }),

  // Get full handover data for admin preview/edit
  getHandoverData: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const form = await db.getDeliveryFormById(input.id);
      if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบใบส่งมอบงาน" });
      const survey = await db.getSurveyById(form.surveyId);
      const customer = survey ? await db.getCustomerById(survey.customerId) : null;
      const allPhotos = await db.getInstallationPhotos(form.surveyId);
      const selectedPhotoIds: number[] = form.selectedPhotoIds ? JSON.parse(form.selectedPhotoIds) : [];
      const checklistItems = form.checklistData ? JSON.parse(form.checklistData) : [];
      const customSections = form.customSections ? JSON.parse(form.customSections) : [];
      // Get template names for grouping
      const templates = await db.getChecklistTemplates();
      const templateNameMap: Record<number, string> = {};
      for (const t of templates) {
        templateNameMap[t.id] = t.name;
      }
      // Get disclaimer text
      const settings = await db.getCompanySettings();
      return {
        form,
        survey,
        customer,
        allPhotos,
        selectedPhotoIds,
        checklistItems,
        customSections,
        templateNameMap,
        disclaimerText: settings?.disclaimerText || null,
      };
    }),
});

// ==================== CHECKLIST TEMPLATE ROUTER ====================
const checklistTemplateRouter = router({
  list: protectedProcedure.query(async () => {
    return db.getChecklistTemplates();
  }),

  listAll: adminProcedure.query(async () => {
    return db.getAllChecklistTemplates();
  }),

  create: adminProcedure
    .input(z.object({ name: z.string().min(1), items: z.string().optional(), isDefault: z.boolean().optional() }))
    .mutation(async ({ input, ctx }) => {
      return db.createChecklistTemplate({ ...input, createdBy: ctx.user.id });
    }),

  update: adminProcedure
    .input(z.object({ id: z.number(), name: z.string().optional(), items: z.string().optional(), isDefault: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateChecklistTemplate(id, data);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteChecklistTemplate(input.id);
      return { success: true };
    }),
});

// ==================== PAYMENT ROUTER ====================
const paymentRouter = router({
  get: protectedProcedure
    .input(z.object({ surveyId: z.number() }))
    .query(async ({ input }) => {
      return db.getPaymentBySurveyId(input.surveyId);
    }),

  create: protectedProcedure
    .input(z.object({
      surveyId: z.number(),
      amount: z.number().optional(),
      paymentMethod: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const survey = await db.getSurveyById(input.surveyId);
      if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบงานสำรวจ" });
      return db.createPayment({
        ...input,
        customerId: survey.customerId,
        createdBy: ctx.user.id,
      });
    }),

  list: protectedProcedure
    .input(z.object({ status: z.string().optional(), page: z.number().optional(), limit: z.number().optional(), source: z.string().optional(), sourceExclude: z.array(z.string()).optional(), sourceInclude: z.array(z.string()).optional(), dateFrom: z.number().optional(), dateTo: z.number().optional() }))
    .query(async ({ input }) => {
      return db.getPayments(input);
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      amount: z.number().optional(),
      paymentDate: z.number().optional(),
      paymentMethod: z.string().optional(),
      notes: z.string().optional(),
      status: z.enum(["pending", "partial", "paid", "overdue"]).optional(),
      contractValue: z.number().optional(),
      collectedAmount: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updatePayment(id, data);
      return { success: true };
    }),

  uploadSlip: protectedProcedure
    .input(z.object({
      id: z.number(),
      base64Data: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64Data, "base64");
      if (buffer.length > 5 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ไฟล์ต้องมีขนาดไม่เกิน 5MB" });
      }
      const ext = input.fileName.split(".").pop() || "jpg";
      const key = `payment-slips/${input.id}_${Date.now()}_${nanoid(6)}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await db.updatePayment(input.id, { slipUrl: url, slipFileKey: key, status: "paid", paymentDate: Date.now() });
      return { success: true, url };
    }),

  confirm: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.updatePayment(input.id, { status: "paid" });
      return { success: true };
    }),

  // Get surveys with status 'won' that don't have a payment record yet
  wonSurveysWithoutPayment: protectedProcedure
    .input(z.object({ source: z.string().optional(), sourceInclude: z.array(z.string()).optional() }))
    .query(async ({ input }) => {
      return db.getWonSurveysWithoutPayment(input);
    }),

  // Create payment from Finance page (select a won survey)
  createFromFinance: protectedProcedure
    .input(z.object({
      surveyId: z.number(),
      contractValue: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const survey = await db.getSurveyById(input.surveyId);
      if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบงานสำรวจ" });
      // Check if payment already exists
      const existing = await db.getPaymentBySurveyId(input.surveyId);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "มีรายการเก็บเงินสำหรับงานนี้แล้ว" });
      const contractVal = input.contractValue ?? (survey.quotedPrice ? parseFloat(String(survey.quotedPrice)) : 0);
      return db.createPayment({
        surveyId: input.surveyId,
        customerId: survey.customerId,
        contractValue: contractVal,
        collectedAmount: 0,
        createdBy: ctx.user.id,
        notes: input.notes || "สร้างจากหน้าการเงิน",
      });
    }),

  // ==================== PAYMENT COLLECTIONS (งวดเก็บเงิน) ====================
  listCollections: protectedProcedure
    .input(z.object({ paymentId: z.number() }))
    .query(async ({ input }) => {
      return db.getPaymentCollections(input.paymentId);
    }),

  addCollection: protectedProcedure
    .input(z.object({
      paymentId: z.number(),
      amount: z.number(),
      note: z.string().optional(),
      collectedAt: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      return db.createPaymentCollection({
        paymentId: input.paymentId,
        amount: String(input.amount),
        note: input.note || null,
        collectedAt: input.collectedAt,
        createdBy: ctx.user.id,
      });
    }),

  deleteCollection: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deletePaymentCollection(input.id);
      return { success: true };
    }),

  uploadCollectionSlip: protectedProcedure
    .input(z.object({
      collectionId: z.number(),
      base64Data: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64Data, "base64");
      if (buffer.length > 5 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "ไฟล์ต้องมีขนาดไม่เกิน 5MB" });
      }
      const ext = input.fileName.split(".").pop() || "jpg";
      const key = `collection-slips/${input.collectionId}_${Date.now()}_${nanoid(6)}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await db.updatePaymentCollection(input.collectionId, { slipUrl: url, slipFileKey: key });
      return { success: true, url };
    }),

  deleteCollectionSlip: protectedProcedure
    .input(z.object({ collectionId: z.number() }))
    .mutation(async ({ input }) => {
      await db.updatePaymentCollection(input.collectionId, { slipUrl: null, slipFileKey: null });
      return { success: true };
    }),
});

// ==================== SURVEY TEMPLATE ROUTER ====================
const surveyTemplateRouter = router({
  list: protectedProcedure.query(async () => {
    return db.getSurveyTemplates();
  }),
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const template = await db.getSurveyTemplateById(input.id);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      const fields = await db.getTemplateFields(input.id);
      return { ...template, fields };
    }),
  getBySourceId: protectedProcedure
    .input(z.object({ sourceId: z.number() }))
    .query(async ({ input }) => {
      const template = await db.getSurveyTemplateBySourceId(input.sourceId);
      if (!template) return null;
      const fields = await db.getTemplateFields(template.id);
      return { ...template, fields };
    }),
  getBySourceName: protectedProcedure
    .input(z.object({ sourceName: z.string() }))
    .query(async ({ input }) => {
      const allSources = await db.getSources();
      const source = allSources.find((s: any) => s.name === input.sourceName);
      if (!source) return null;
      const template = await db.getSurveyTemplateBySourceId(source.id);
      if (!template) return null;
      const fields = await db.getTemplateFields(template.id);
      return { ...template, fields };
    }),
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      sourceId: z.number().nullable().optional(),
      pdfHeaderTitle: z.string().optional(),
      pdfHeaderSubtitle: z.string().optional(),
      pdfLogoUrl: z.string().optional(),
      pdfLogoFileKey: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      return db.createSurveyTemplate({ ...input, createdBy: ctx.user.id });
    }),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      sourceId: z.number().nullable().optional(),
      pdfHeaderTitle: z.string().nullable().optional(),
      pdfHeaderSubtitle: z.string().nullable().optional(),
      pdfLogoUrl: z.string().nullable().optional(),
      pdfLogoFileKey: z.string().nullable().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateSurveyTemplate(id, data);
      return { success: true };
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteSurveyTemplate(input.id);
      return { success: true };
    }),
  uploadLogo: adminProcedure
    .input(z.object({
      templateId: z.number(),
      fileName: z.string(),
      base64: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64, "base64");
      const fileKey = `template-logos/${input.templateId}-${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);
      await db.updateSurveyTemplate(input.templateId, { pdfLogoUrl: url, pdfLogoFileKey: fileKey });
      return { url, fileKey };
    }),
  addField: adminProcedure
    .input(z.object({
      templateId: z.number(),
      fieldName: z.string().min(1),
      fieldLabel: z.string().min(1),
      fieldType: z.enum(["text", "number", "textarea", "select", "checkbox", "checkbox_group", "radio", "date", "distance", "yes_no", "section_header"]),
      fieldOptions: z.string().nullable().optional(),
      hasOtherOption: z.boolean().optional(),
      placeholder: z.string().optional(),
      defaultValue: z.string().optional(),
      required: z.boolean().optional(),
      sectionGroup: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      return db.createTemplateField(input);
    }),
  updateField: adminProcedure
    .input(z.object({
      id: z.number(),
      fieldName: z.string().min(1).optional(),
      fieldLabel: z.string().min(1).optional(),
      fieldType: z.enum(["text", "number", "textarea", "select", "checkbox", "checkbox_group", "radio", "date", "distance", "yes_no", "section_header"]).optional(),
      fieldOptions: z.string().nullable().optional(),
      hasOtherOption: z.boolean().optional(),
      placeholder: z.string().nullable().optional(),
      defaultValue: z.string().nullable().optional(),
      required: z.boolean().optional(),
      sectionGroup: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateTemplateField(id, data);
      return { success: true };
    }),
  deleteField: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteTemplateField(input.id);
      return { success: true };
    }),
  reorderFields: adminProcedure
    .input(z.object({
      templateId: z.number(),
      fieldIds: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      await db.reorderTemplateFields(input.templateId, input.fieldIds);
      return { success: true };
    }),
  getData: protectedProcedure
    .input(z.object({ surveyId: z.number() }))
    .query(async ({ input }) => {
      return db.getTemplateDataBySurvey(input.surveyId);
    }),
  saveData: protectedProcedure
    .input(z.object({
      surveyId: z.number(),
      templateId: z.number(),
      entries: z.array(z.object({
        fieldId: z.number(),
        value: z.string().nullable(),
        otherValue: z.string().nullable(),
      })),
    }))
    .mutation(async ({ input }) => {
      await db.saveTemplateData(input.surveyId, input.templateId, input.entries);
      return { success: true };
    }),

  // ==================== PUBLIC (Share Link) ====================
  publicGetBySourceName: publicProcedure
    .input(z.object({ token: z.string(), sourceName: z.string() }))
    .query(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.expiresAt && link.expiresAt < Date.now()) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์หมดอายุ" });
      const allSources = await db.getSources();
      const source = allSources.find((s: any) => s.name === input.sourceName);
      if (!source) return null;
      const template = await db.getSurveyTemplateBySourceId(source.id);
      if (!template) return null;
      const fields = await db.getTemplateFields(template.id);
      return { ...template, fields };
    }),
  publicGetData: publicProcedure
    .input(z.object({ token: z.string(), surveyId: z.number() }))
    .query(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.surveyId !== input.surveyId) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ตรงกับงาน" });
      return db.getTemplateDataBySurvey(input.surveyId);
    }),
  publicSaveData: publicProcedure
    .input(z.object({
      token: z.string(),
      surveyId: z.number(),
      templateId: z.number(),
      entries: z.array(z.object({
        fieldId: z.number(),
        value: z.string().nullable(),
        otherValue: z.string().nullable(),
      })),
    }))
    .mutation(async ({ input }) => {
      const link = await db.getShareLinkByToken(input.token);
      if (!link || !link.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ถูกต้อง" });
      if (link.surveyId !== input.surveyId) throw new TRPCError({ code: "NOT_FOUND", message: "ลิงก์ไม่ตรงกับงาน" });
      await db.saveTemplateData(input.surveyId, input.templateId, input.entries);
      return { success: true };
    }),
});

// ==================== TECHNICAL FIELD ROUTER ====================
const technicalFieldRouter = router({
  list: protectedProcedure
    .input(z.object({ activeOnly: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      return db.getTechnicalFieldDefinitions(input?.activeOnly ?? false);
    }),
  create: adminProcedure
    .input(z.object({
      label: z.string().min(1),
      fieldType: z.enum(["text", "number", "select", "textarea"]),
      placeholder: z.string().optional(),
      options: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return db.createTechnicalFieldDefinition(input);
    }),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      label: z.string().optional(),
      fieldType: z.enum(["text", "number", "select", "textarea"]).optional(),
      placeholder: z.string().optional(),
      options: z.string().optional(),
      sortOrder: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateTechnicalFieldDefinition(id, data);
      return { success: true };
    }),
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteTechnicalFieldDefinition(input.id);
      return { success: true };
    }),
  reorder: adminProcedure
    .input(z.object({ orderedIds: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      await db.reorderTechnicalFields(input.orderedIds);
      return { success: true };
    }),
  getValues: protectedProcedure
    .input(z.object({ surveyId: z.number() }))
    .query(async ({ input }) => {
      return db.getSurveyTechnicalValues(input.surveyId);
    }),
  setValues: protectedProcedure
    .input(z.object({
      surveyId: z.number(),
      values: z.array(z.object({
        fieldDefinitionId: z.number(),
        value: z.string().nullable(),
      })),
    }))
    .mutation(async ({ input }) => {
      await db.setSurveyTechnicalValues(input.surveyId, input.values);
      return { success: true };
    }),
});

// ==================== CANCELLED CASES ROUTER ====================
const cancelledCasesRouter = router({
  list: protectedProcedure
    .input(z.object({ sourceGroup: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return db.getCancelledSurveys(input?.sourceGroup);
    }),
  stats: protectedProcedure
    .input(z.object({ sourceGroup: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return db.getCancelReasonStats(input?.sourceGroup);
    }),
  exportExcel: protectedProcedure
    .input(z.object({ sourceGroup: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const data = await db.getCancelledSurveys(input?.sourceGroup);
      return data.map(item => ({
        customerName: item.customer.name,
        phone: item.customer.phone || "-",
        province: item.customer.province || "-",
        source: item.customer.source || "-",
        reason: item.cancelLog?.reason || "ไม่ระบุ",
        detail: item.cancelLog?.reason || "-",
        closerName: item.closerName || "-",
        cancelDate: item.cancelLog?.createdAt ? new Date(item.cancelLog.createdAt).toLocaleDateString("th-TH") : (item.survey.updatedAt ? new Date(item.survey.updatedAt).toLocaleDateString("th-TH") : "-"),
      }));
    }),
  reopen: protectedProcedure
    .input(z.object({ surveyId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const survey = await db.getSurveyById(input.surveyId);
      if (!survey) throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบงานสำรวจ" });
      if (survey.status !== "lost" && survey.status !== "cancelled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "งานนี้ไม่ได้อยู่ในสถานะยกเลิก" });
      }
      await db.reopenSurvey(input.surveyId);
      await db.logActivity({ userId: ctx.user.id, action: "reopen_survey", entityType: "survey", entityId: input.surveyId, details: `เปิดเคสใหม่จากสถานะยกเลิก` });
      // Notify
      try {
        const surveyData = await db.getSurveyWithCustomer(input.surveyId);
        const customerName = surveyData?.customer?.name || `งาน #${input.surveyId}`;
        const notifContent = `🔄 เปิดเคสใหม่\nลูกค้า: ${customerName} (ID: ${input.surveyId})\nโดย: ${ctx.user.name || "Admin"}\n\n🔗 ดูงาน: ${ENV.siteUrl}/surveys/${input.surveyId}`;
        await notifyOwner({ title: "เปิดเคสใหม่", content: notifContent });
        await sendLineNotification("เปิดเคสใหม่", notifContent);
      } catch (e) { console.warn("[ReopenSurvey] notify failed:", e); }
      return { success: true };
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
  companySettings: companySettingsRouter,
  documentSettings: documentSettingsRouter,
  deliveryForm: deliveryFormRouter,
  checklistTemplate: checklistTemplateRouter,
  payment: paymentRouter,
  surveyTemplate: surveyTemplateRouter,
  technicalField: technicalFieldRouter,
  cancelledCases: cancelledCasesRouter,
  util: router({
    proxyImage: publicProcedure
      .input(z.object({ url: z.string().url() }))
      .mutation(async ({ input }) => {
        try {
          const response = await fetch(input.url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const buffer = await response.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = Buffer.from(binary, "binary").toString("base64");
          const contentType = response.headers.get("content-type") || "image/jpeg";
          return { data: `data:${contentType};base64,${base64}`, width: 0, height: 0 };
        } catch (e) {
          return null;
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
