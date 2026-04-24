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
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      if (data.source) await db.getOrCreateSource(data.source);
      await db.updateCustomer(id, data);
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
        notes: z.string().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
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
      return { successCount, errorCount, errors: errors.slice(0, 10) };
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
      status: z.enum(["pending", "scheduled", "in_progress", "surveyed", "quoted", "negotiating", "won", "lost", "cancelled"]).optional(),
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
      status: z.enum(["pending", "scheduled", "in_progress", "surveyed", "quoted", "negotiating", "won", "lost", "cancelled"]).optional(),
      scheduledDate: z.number().optional(),
      scheduledTime: z.string().optional(),
      assignedTo: z.number().optional(),
      surveyNotes: z.string().optional(),
      systemSize: z.string().optional(),
      panelCount: z.number().optional(),
      inverterModel: z.string().optional(),
      quotedPrice: z.string().optional(),
      panelBrand: z.string().optional(),
      needBattery: z.string().optional(),
      needOptimizer: z.string().optional(),
      systemType: z.enum(["string", "micro", "both"]).optional(),
      adminSenderId: z.number().nullable().optional(),
      surveyorIds: z.array(z.number()).optional(),
      closerId: z.number().nullable().optional(),
      statusId: z.number().nullable().optional(),
      installationDate: z.number().nullable().optional(),
      installationStatus: z.enum(["waiting", "in_progress", "completed", "delivered"]).nullable().optional(),
      installerTeamId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, surveyorIds, ...data } = input;
      const oldSurvey = await db.getSurveyById(id);
      if (data.status === "surveyed" || data.status === "won") {
        (data as any).completedAt = Date.now();
      }
      await db.updateSurvey(id, data);
      // Update assignments if surveyorIds provided
      if (surveyorIds !== undefined || data.adminSenderId !== undefined || data.closerId !== undefined) {
        const currentAssignments = await db.getSurveyAssignments(id);
        const assignments: { userId: number; role: "admin_sender" | "surveyor" | "closer" }[] = [];
        // Admin sender - null means remove, undefined means keep existing
        if (data.adminSenderId === null) {
          // explicitly removed
        } else {
          const adminId = data.adminSenderId || currentAssignments.find(a => a.assignment.role === "admin_sender")?.assignment.userId;
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
        if (data.closerId === null) {
          // explicitly removed
        } else {
          const closerIdVal = data.closerId || currentAssignments.find(a => a.assignment.role === "closer")?.assignment.userId;
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

  create: protectedProcedure
    .input(z.object({
      surveyId: z.number(),
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
        expiresAt,
        allowPhotos: input.allowPhotos,
        allowDocuments: input.allowDocuments,
        createdBy: ctx.user.id,
      });
      await db.logActivity({ userId: ctx.user.id, action: "create_share_link", entityType: "survey", entityId: input.surveyId, details: `สร้างลิงก์แชร์สำหรับงาน #${input.surveyId}` });
      return { id, token };
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
      return { survey: surveyData.survey, customer: surveyData.customer, photos, documents };
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

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().optional(),
      role: z.enum(["admin_sender", "surveyor", "closer"]),
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
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db.updateInstallationPhotoCategory(id, data);
      await db.logActivity({ userId: ctx.user.id, action: "update", entityType: "installation_photo_category", entityId: id, details: `แก้ไขประเภทรูปติดตั้ง ID: ${id}` });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.deleteInstallationPhotoCategory(input.id);
      await db.logActivity({ userId: ctx.user.id, action: "delete", entityType: "installation_photo_category", entityId: input.id, details: `ลบประเภทรูปติดตั้ง ID: ${input.id}` });
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
    .input(z.object({ surveyId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      // Check that there are installation photos
      const photos = await db.getInstallationPhotos(input.surveyId);
      if (photos.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "กรุณาอัปโหลดรูปติดตั้งก่อนส่งมอบงาน" });
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
      return db.submitDelivery(input.surveyId, null);
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
  photoCategory: photoCategoryRouter,
  documentCategory: documentCategoryRouter,
});

export type AppRouter = typeof appRouter;
