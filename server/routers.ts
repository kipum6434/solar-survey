import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, superadminProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import { storagePut, storageDelete, storageGet } from "./storage";
import { SignJWT } from "jose";
import { ENV } from "./_core/env";
import * as db from "./db";

const LOCAL_SESSION_COOKIE = "local_session";

async function createLocalSessionToken(userId: number): Promise<string> {
  const secret = new TextEncoder().encode(ENV.cookieSecret);
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

// Helper to refresh photo URLs with presigned URLs
async function refreshPhotoUrls(photos: any[]) {
  return Promise.all(photos.map(async (p: any) => {
    if (p.fileKey) {
      try {
        const { url } = await storageGet(p.fileKey);
        return { ...p, url };
      } catch { return p; }
    }
    return p;
  }));
}

// Helper to refresh document URLs with presigned URLs
async function refreshDocUrls(docs: any[]) {
  return Promise.all(docs.map(async (d: any) => {
    if (d.fileKey) {
      try {
        const { url } = await storageGet(d.fileKey);
        return { ...d, url };
      } catch { return d; }
    }
    return d;
  }));
}

// ==================== CUSTOMER ROUTER ====================
const customerRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
    }))
    .query(({ input, ctx }) => {
      // Role-based: normal users see only their own customers
      const userId = (ctx.user.role === 'admin' || ctx.user.role === 'superadmin') ? undefined : ctx.user.id;
      return db.getCustomers({ ...input, createdBy: userId });
    }),

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
      source: z.enum(["walk_in", "telesale", "facebook", "line", "website", "referral", "other"]).optional(),
      electricityBill: z.string().optional(),
      roofType: z.string().optional(),
      roofArea: z.string().optional(),
      phaseType: z.enum(["single", "three"]).optional(),
      meterSize: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
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
      source: z.enum(["walk_in", "telesale", "facebook", "line", "website", "referral", "other"]).optional(),
      electricityBill: z.string().optional(),
      roofType: z.string().optional(),
      roofArea: z.string().optional(),
      phaseType: z.enum(["single", "three"]).optional(),
      meterSize: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
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
});

// ==================== SURVEY ROUTER ====================
const surveyRouter = router({
  list: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      assignedTo: z.number().optional(),
      page: z.number().default(1),
      limit: z.number().default(20),
      search: z.string().optional(),
    }))
    .query(({ input, ctx }) => {
      // Role-based: normal users see only surveys assigned to them or created by them
      const isAdminOrSuper = ctx.user.role === 'admin' || ctx.user.role === 'superadmin';
      const scopedInput = isAdminOrSuper ? input : { ...input, userScope: ctx.user.id };
      return db.getSurveysWithCustomer(scopedInput);
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
    }))
    .mutation(async ({ input, ctx }) => {
      const status = input.scheduledDate ? "scheduled" : (input.status || "pending");
      const id = await db.createSurvey({ ...input, status, createdBy: ctx.user.id });
      await db.logActivity({ userId: ctx.user.id, action: "create", entityType: "survey", entityId: id, details: `สร้างงานสำรวจ ID: ${id}` });
      if (input.assignedTo && input.assignedTo !== ctx.user.id) {
        await db.createNotification({
          userId: input.assignedTo,
          type: "new_assignment",
          title: "งานสำรวจใหม่",
          message: `คุณได้รับมอบหมายงานสำรวจใหม่ #${id}`,
          relatedSurveyId: id,
          relatedCustomerId: input.customerId,
        });
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
      estimatedCost: z.string().optional(),
      quotedPrice: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const oldSurvey = await db.getSurveyById(id);
      if (data.status === "surveyed" || data.status === "won") {
        (data as any).completedAt = Date.now();
      }
      await db.updateSurvey(id, data);
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
});

// ==================== PHOTO ROUTER ====================
const photoRouter = router({
  list: protectedProcedure
    .input(z.object({ surveyId: z.number() }))
    .query(async ({ input }) => {
      const photos = await db.getSurveyPhotos(input.surveyId);
      return refreshPhotoUrls(photos);
    }),

  upload: protectedProcedure
    .input(z.object({
      surveyId: z.number(),
      customerId: z.number(),
      fileName: z.string(),
      category: z.enum(["roof_overview", "roof_detail", "electrical_panel", "meter", "inverter_location", "surroundings", "other"]).optional(),
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
    .query(async ({ input }) => {
      const docs = await db.getSurveyDocuments(input.surveyId);
      return refreshDocUrls(docs);
    }),

  upload: protectedProcedure
    .input(z.object({
      surveyId: z.number(),
      customerId: z.number(),
      fileName: z.string(),
      fileType: z.enum(["quotation", "simulation", "contract", "other"]).optional(),
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
      allowDocuments: z.boolean().default(false),
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

      // Photos: refresh URLs with presigned URLs
      let photos: any[] = [];
      if (link.allowPhotos) {
        const rawPhotos = await db.getSurveyPhotos(link.surveyId);
        photos = await refreshPhotoUrls(rawPhotos);
      }

      // Documents: only simulation docs (NEVER quotation), refresh URLs
      let documents: any[] = [];
      if (link.allowDocuments) {
        const rawDocs = await db.getSurveyDocuments(link.surveyId);
        // Filter out quotation documents - installers should NOT see pricing
        const filteredDocs = rawDocs.filter((d: any) => d.fileType !== 'quotation');
        documents = await refreshDocUrls(filteredDocs);
      }

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
  stats: protectedProcedure.query(({ ctx }) => {
    const isAdminOrSuper = ctx.user.role === 'admin' || ctx.user.role === 'superadmin';
    return db.getDashboardStats(isAdminOrSuper ? undefined : ctx.user.id);
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
    .query(({ input, ctx }) => {
      const isAdminOrSuper = ctx.user.role === 'admin' || ctx.user.role === 'superadmin';
      return db.getCalendarEvents(input.startDate, input.endDate, isAdminOrSuper ? undefined : ctx.user.id);
    }),
});

// ==================== STORAGE ROUTER ====================
const storageRouter = router({
  stats: protectedProcedure.query(() => db.getStorageStats()),
});

// ==================== USERS ROUTER ====================
const usersRouter = router({
  list: adminProcedure.query(() => db.getAllUsers()),

  create: adminProcedure
    .input(z.object({
      username: z.string().min(3),
      password: z.string().min(6),
      name: z.string().min(1),
      role: z.enum(["user", "admin", "superadmin"]).default("user"),
    }))
    .mutation(async ({ input, ctx }) => {
      // Only superadmin can create admin/superadmin users
      if ((input.role === 'admin' || input.role === 'superadmin') && ctx.user.role !== 'superadmin') {
        throw new Error("เฉพาะ Superadmin เท่านั้นที่สร้าง Admin/Superadmin ได้");
      }
      const existing = await db.getUserByUsername(input.username);
      if (existing) throw new Error("Username นี้ถูกใช้แล้ว");
      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash(input.password, 10);
      const id = await db.createLocalUser({
        username: input.username,
        passwordHash,
        name: input.name,
        role: input.role,
      });
      await db.logActivity({ userId: ctx.user.id, action: "create_user", entityType: "user", entityId: id, details: `สร้างผู้ใช้: ${input.name} (${input.username})` });
      return { id };
    }),

  updateRole: adminProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(["user", "admin", "superadmin"]),
    }))
    .mutation(async ({ input, ctx }) => {
      if ((input.role === 'superadmin') && ctx.user.role !== 'superadmin') {
        throw new Error("เฉพาะ Superadmin เท่านั้นที่เปลี่ยน role เป็น Superadmin ได้");
      }
      await db.updateUserRole(input.userId, input.role);
      return { success: true };
    }),

  resetPassword: adminProcedure
    .input(z.object({
      userId: z.number(),
      newPassword: z.string().min(6),
    }))
    .mutation(async ({ input }) => {
      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash(input.newPassword, 10);
      await db.updateUserPassword(input.userId, passwordHash);
      return { success: true };
    }),

  delete: superadminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.user.id) throw new Error("ไม่สามารถลบตัวเองได้");
      await db.deleteUser(input.userId);
      return { success: true };
    }),
});

// ==================== APP ROUTER ====================
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    login: publicProcedure
      .input(z.object({
        username: z.string(),
        password: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserByUsername(input.username);
        if (!user || !user.passwordHash) {
          throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
        }
        const bcrypt = await import("bcryptjs");
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
          throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
        }
        // Update last signed in
        const dbInstance = await db.getDb();
        if (dbInstance) {
          const { users } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await dbInstance.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
        }
        // Create local session token
        const token = await createLocalSessionToken(user.id);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(LOCAL_SESSION_COOKIE, token, {
          ...cookieOptions,
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });
        return { success: true, user: { id: user.id, name: user.name, role: user.role } };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie(LOCAL_SESSION_COOKIE, { ...cookieOptions, maxAge: -1 });
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
});

export type AppRouter = typeof appRouter;
