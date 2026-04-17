import { eq, and, or, like, desc, gte, lte, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, customers, InsertCustomer, surveys, InsertSurvey, surveyPhotos, InsertSurveyPhoto, surveyDocuments, InsertSurveyDocument, followUps, InsertFollowUp, shareLinks, InsertShareLink, notifications, InsertNotification, activityLog, InsertActivityLog } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function createLocalUser(data: { username: string; passwordHash: string; name: string; role: 'user' | 'admin' | 'superadmin' }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const openId = `local_${data.username}_${Date.now()}`;
  const result = await db.insert(users).values({
    openId,
    username: data.username,
    passwordHash: data.passwordHash,
    name: data.name,
    role: data.role,
    loginMethod: 'local',
  });
  return result[0].insertId;
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function updateUserRole(userId: number, role: 'user' | 'admin' | 'superadmin') {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(users).where(eq(users.id, userId));
}

// ==================== CUSTOMER QUERIES ====================
export async function getCustomers(opts: { search?: string; page?: number; limit?: number; createdBy?: number }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const { search, page = 1, limit = 20, createdBy } = opts;
  const offset = (page - 1) * limit;
  const conditions: any[] = [];
  if (createdBy) conditions.push(eq(customers.createdBy, createdBy));
  if (search) {
    conditions.push(or(
      like(customers.name, `%${search}%`),
      like(customers.phone, `%${search}%`),
      like(customers.email, `%${search}%`)
    ));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const data = await db.select().from(customers).where(whereClause).orderBy(desc(customers.createdAt)).limit(limit).offset(offset);
  const countQ = whereClause
    ? await db.select({ count: sql<number>`count(*)` }).from(customers).where(whereClause)
    : await db.select({ count: sql<number>`count(*)` }).from(customers);
  return { data, total: countQ[0]?.count ?? 0 };
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result[0];
}

export async function createCustomer(data: InsertCustomer) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(customers).values(data);
  return result[0].insertId;
}

export async function updateCustomer(id: number, data: Partial<InsertCustomer>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(customers).set(data).where(eq(customers.id, id));
}

export async function deleteCustomer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(customers).where(eq(customers.id, id));
}

// ==================== SURVEY QUERIES ====================
export async function getSurveys(opts: { customerId?: number; status?: string; assignedTo?: number; page?: number; limit?: number; startDate?: number; endDate?: number }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const { customerId, status, assignedTo, page = 1, limit = 20, startDate, endDate } = opts;
  const offset = (page - 1) * limit;
  const conditions: any[] = [];
  if (customerId) conditions.push(eq(surveys.customerId, customerId));
  if (status) conditions.push(eq(surveys.status, status as any));
  if (assignedTo) conditions.push(eq(surveys.assignedTo, assignedTo));
  if (startDate) conditions.push(gte(surveys.scheduledDate, startDate));
  if (endDate) conditions.push(lte(surveys.scheduledDate, endDate));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const data = await db.select().from(surveys).where(whereClause).orderBy(desc(surveys.createdAt)).limit(limit).offset(offset);
  const countQ = whereClause
    ? await db.select({ count: sql<number>`count(*)` }).from(surveys).where(whereClause)
    : await db.select({ count: sql<number>`count(*)` }).from(surveys);
  return { data, total: countQ[0]?.count ?? 0 };
}

export async function getSurveyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(surveys).where(eq(surveys.id, id)).limit(1);
  return result[0];
}

export async function getSurveyWithCustomer(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({
    survey: surveys,
    customer: customers,
  }).from(surveys)
    .innerJoin(customers, eq(surveys.customerId, customers.id))
    .where(eq(surveys.id, id))
    .limit(1);
  return result[0];
}

export async function createSurvey(data: InsertSurvey) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(surveys).values(data);
  return result[0].insertId;
}

export async function updateSurvey(id: number, data: Partial<InsertSurvey>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(surveys).set(data).where(eq(surveys.id, id));
}

export async function deleteSurvey(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(surveys).where(eq(surveys.id, id));
}

// ==================== SURVEY PHOTOS QUERIES ====================
export async function getSurveyPhotos(surveyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(surveyPhotos).where(eq(surveyPhotos.surveyId, surveyId)).orderBy(desc(surveyPhotos.createdAt));
}

export async function createSurveyPhoto(data: InsertSurveyPhoto) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(surveyPhotos).values(data);
  return result[0].insertId;
}

export async function deleteSurveyPhoto(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(surveyPhotos).where(eq(surveyPhotos.id, id));
}

// ==================== SURVEY DOCUMENTS QUERIES ====================
export async function getSurveyDocuments(surveyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(surveyDocuments).where(eq(surveyDocuments.surveyId, surveyId)).orderBy(desc(surveyDocuments.createdAt));
}

export async function createSurveyDocument(data: InsertSurveyDocument) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(surveyDocuments).values(data);
  return result[0].insertId;
}

export async function deleteSurveyDocument(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(surveyDocuments).where(eq(surveyDocuments.id, id));
}

// ==================== FOLLOW UP QUERIES ====================
export async function getFollowUps(opts: { surveyId?: number; customerId?: number; status?: string; assignedTo?: number; startDate?: number; endDate?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (opts.surveyId) conditions.push(eq(followUps.surveyId, opts.surveyId));
  if (opts.customerId) conditions.push(eq(followUps.customerId, opts.customerId));
  if (opts.status) conditions.push(eq(followUps.status, opts.status as any));
  if (opts.assignedTo) conditions.push(eq(followUps.assignedTo, opts.assignedTo));
  if (opts.startDate) conditions.push(gte(followUps.dueDate, opts.startDate));
  if (opts.endDate) conditions.push(lte(followUps.dueDate, opts.endDate));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(followUps).where(whereClause).orderBy(followUps.dueDate);
}

export async function createFollowUp(data: InsertFollowUp) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(followUps).values(data);
  return result[0].insertId;
}

export async function updateFollowUp(id: number, data: Partial<InsertFollowUp>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(followUps).set(data).where(eq(followUps.id, id));
}

// ==================== SHARE LINKS QUERIES ====================
export async function getShareLinkByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(shareLinks).where(eq(shareLinks.token, token)).limit(1);
  return result[0];
}

export async function getShareLinksBySurvey(surveyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareLinks).where(eq(shareLinks.surveyId, surveyId)).orderBy(desc(shareLinks.createdAt));
}

export async function createShareLink(data: InsertShareLink) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(shareLinks).values(data);
  return result[0].insertId;
}

export async function updateShareLink(id: number, data: Partial<InsertShareLink>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(shareLinks).set(data).where(eq(shareLinks.id, id));
}

export async function incrementShareLinkView(token: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(shareLinks).set({ viewCount: sql`${shareLinks.viewCount} + 1` }).where(eq(shareLinks.token, token));
}

// ==================== NOTIFICATIONS QUERIES ====================
export async function getNotifications(userId: number, opts?: { unreadOnly?: boolean; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [eq(notifications.userId, userId)];
  if (opts?.unreadOnly) conditions.push(eq(notifications.isRead, false));
  return db.select().from(notifications).where(and(...conditions)).orderBy(desc(notifications.createdAt)).limit(opts?.limit ?? 50);
}

export async function createNotification(data: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(notifications).values(data);
}

export async function markNotificationRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return result[0]?.count ?? 0;
}

// ==================== ACTIVITY LOG QUERIES ====================
export async function logActivity(data: InsertActivityLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLog).values(data);
}

export async function getRecentActivities(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit);
}

// ==================== DASHBOARD STATS ====================
export async function getDashboardStats(userId?: number) {
  const db = await getDb();
  if (!db) return { totalCustomers: 0, totalSurveys: 0, pendingSurveys: 0, completedSurveys: 0, wonDeals: 0, pendingFollowUps: 0 };
  const custWhere = userId ? eq(customers.createdBy, userId) : undefined;
  const survWhere = userId ? or(eq(surveys.assignedTo, userId), eq(surveys.createdBy, userId)) : undefined;
  const [custCount] = custWhere ? await db.select({ count: sql<number>`count(*)` }).from(customers).where(custWhere) : await db.select({ count: sql<number>`count(*)` }).from(customers);
  const [survCount] = survWhere ? await db.select({ count: sql<number>`count(*)` }).from(surveys).where(survWhere) : await db.select({ count: sql<number>`count(*)` }).from(surveys);
  const [pendCount] = survWhere ? await db.select({ count: sql<number>`count(*)` }).from(surveys).where(and(survWhere, inArray(surveys.status, ["pending", "scheduled"]))) : await db.select({ count: sql<number>`count(*)` }).from(surveys).where(inArray(surveys.status, ["pending", "scheduled"]));
  const [compCount] = survWhere ? await db.select({ count: sql<number>`count(*)` }).from(surveys).where(and(survWhere, eq(surveys.status, "surveyed"))) : await db.select({ count: sql<number>`count(*)` }).from(surveys).where(eq(surveys.status, "surveyed"));
  const [wonCount] = survWhere ? await db.select({ count: sql<number>`count(*)` }).from(surveys).where(and(survWhere, eq(surveys.status, "won"))) : await db.select({ count: sql<number>`count(*)` }).from(surveys).where(eq(surveys.status, "won"));
  const [fuCount] = await db.select({ count: sql<number>`count(*)` }).from(followUps).where(eq(followUps.status, "pending"));
  return {
    totalCustomers: custCount?.count ?? 0,
    totalSurveys: survCount?.count ?? 0,
    pendingSurveys: pendCount?.count ?? 0,
    completedSurveys: compCount?.count ?? 0,
    wonDeals: wonCount?.count ?? 0,
    pendingFollowUps: fuCount?.count ?? 0,
  };
}

// ==================== CALENDAR QUERIES ====================
export async function getCalendarEvents(startDate: number, endDate: number, userId?: number) {
  const db = await getDb();
  if (!db) return { surveys: [], followUps: [] };
  const surveyConditions: any[] = [
    gte(surveys.scheduledDate, startDate),
    lte(surveys.scheduledDate, endDate)
  ];
  if (userId) surveyConditions.push(or(eq(surveys.assignedTo, userId), eq(surveys.createdBy, userId)));
  const surveyEvents = await db.select({
    survey: surveys,
    customer: customers,
  }).from(surveys)
    .innerJoin(customers, eq(surveys.customerId, customers.id))
    .where(and(...surveyConditions))
    .orderBy(surveys.scheduledDate);
  const followUpEvents = await db.select({
    followUp: followUps,
    customer: customers,
  }).from(followUps)
    .innerJoin(customers, eq(followUps.customerId, customers.id))
    .where(and(
      gte(followUps.dueDate, startDate),
      lte(followUps.dueDate, endDate)
    ))
    .orderBy(followUps.dueDate);
  return { surveys: surveyEvents, followUps: followUpEvents };
}

// ==================== STORAGE STATS ====================
export async function getStorageStats() {
  const db = await getDb();
  if (!db) return { totalPhotos: 0, totalDocuments: 0, totalPhotoSize: 0, totalDocumentSize: 0 };
  const [photoStats] = await db.select({
    count: sql<number>`count(*)`,
    totalSize: sql<number>`COALESCE(SUM(fileSize), 0)`,
  }).from(surveyPhotos);
  const [docStats] = await db.select({
    count: sql<number>`count(*)`,
    totalSize: sql<number>`COALESCE(SUM(fileSize), 0)`,
  }).from(surveyDocuments);
  return {
    totalPhotos: photoStats?.count ?? 0,
    totalDocuments: docStats?.count ?? 0,
    totalPhotoSize: Number(photoStats?.totalSize ?? 0),
    totalDocumentSize: Number(docStats?.totalSize ?? 0),
  };
}

export async function getSurveyPhotoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(surveyPhotos).where(eq(surveyPhotos.id, id)).limit(1);
  return result[0];
}

export async function getSurveyDocumentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(surveyDocuments).where(eq(surveyDocuments.id, id)).limit(1);
  return result[0];
}

// ==================== USER QUERIES ====================
export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: users.id, name: users.name, email: users.email, username: users.username, role: users.role, lastSignedIn: users.lastSignedIn, openId: users.openId }).from(users);
}

export async function getSurveysWithCustomer(opts: { status?: string; assignedTo?: number; page?: number; limit?: number; search?: string; userScope?: number }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const { status, assignedTo, page = 1, limit = 20, search, userScope } = opts;
  const offset = (page - 1) * limit;
  const conditions: any[] = [];
  if (status) conditions.push(eq(surveys.status, status as any));
  if (assignedTo) conditions.push(eq(surveys.assignedTo, assignedTo));
  if (userScope) conditions.push(or(eq(surveys.assignedTo, userScope), eq(surveys.createdBy, userScope)));
  if (search) {
    conditions.push(or(
      like(customers.name, `%${search}%`),
      like(customers.phone, `%${search}%`)
    ));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const data = await db.select({
    survey: surveys,
    customer: customers,
  }).from(surveys)
    .innerJoin(customers, eq(surveys.customerId, customers.id))
    .where(whereClause)
    .orderBy(desc(surveys.createdAt))
    .limit(limit)
    .offset(offset);
  const countQ = whereClause
    ? await db.select({ count: sql<number>`count(*)` }).from(surveys).innerJoin(customers, eq(surveys.customerId, customers.id)).where(whereClause)
    : await db.select({ count: sql<number>`count(*)` }).from(surveys);
  return { data, total: countQ[0]?.count ?? 0 };
}
