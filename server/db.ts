import { eq, and, or, like, desc, gte, lte, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, customers, InsertCustomer, surveys, InsertSurvey, surveyPhotos, InsertSurveyPhoto, surveyDocuments, InsertSurveyDocument, followUps, InsertFollowUp, shareLinks, InsertShareLink, notifications, InsertNotification, activityLog, InsertActivityLog, sources, InsertSource, surveyAssignments, InsertSurveyAssignment, teamMembers, InsertTeamMember } from "../drizzle/schema";
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
      values.role = 'superadmin';
      updateSet.role = 'superadmin';
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

// ==================== CUSTOMER QUERIES ====================
export async function getCustomers(opts: { search?: string; page?: number; limit?: number; month?: number; year?: number }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const { search, page = 1, limit = 20, month, year } = opts;
  const offset = (page - 1) * limit;
  const conditions: any[] = [];
  if (search) {
    conditions.push(or(
      like(customers.name, `%${search}%`),
      like(customers.phone, `%${search}%`),
      like(customers.email, `%${search}%`)
    ));
  }
  if (month && year) {
    conditions.push(sql`MONTH(${customers.createdAt}) = ${month}`);
    conditions.push(sql`YEAR(${customers.createdAt}) = ${year}`);
  } else if (year) {
    conditions.push(sql`YEAR(${customers.createdAt}) = ${year}`);
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
  if (!result[0]) return undefined;
  // Fetch assignments with user info
  const assignmentRows = await db.select({
    assignment: surveyAssignments,
    user: { id: users.id, name: users.name, role: users.role },
  }).from(surveyAssignments)
    .leftJoin(users, eq(surveyAssignments.userId, users.id))
    .where(eq(surveyAssignments.surveyId, id))
    .orderBy(surveyAssignments.createdAt);
  return { ...result[0], assignments: assignmentRows };
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
export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { totalCustomers: 0, totalSurveys: 0, pendingSurveys: 0, completedSurveys: 0, wonDeals: 0, pendingFollowUps: 0 };
  const [custCount] = await db.select({ count: sql<number>`count(*)` }).from(customers);
  const [survCount] = await db.select({ count: sql<number>`count(*)` }).from(surveys);
  const [pendCount] = await db.select({ count: sql<number>`count(*)` }).from(surveys).where(inArray(surveys.status, ["pending", "scheduled"]));
  const [compCount] = await db.select({ count: sql<number>`count(*)` }).from(surveys).where(eq(surveys.status, "surveyed"));
  const [wonCount] = await db.select({ count: sql<number>`count(*)` }).from(surveys).where(eq(surveys.status, "won"));
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
export async function getCalendarEvents(startDate: number, endDate: number) {
  const db = await getDb();
  if (!db) return { surveys: [], followUps: [] };
  const surveyEvents = await db.select({
    survey: surveys,
    customer: customers,
  }).from(surveys)
    .innerJoin(customers, eq(surveys.customerId, customers.id))
    .where(and(
      gte(surveys.scheduledDate, startDate),
      lte(surveys.scheduledDate, endDate)
    ))
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
  return db.select({
    id: users.id,
    openId: users.openId,
    name: users.name,
    email: users.email,
    username: users.username,
    role: users.role,
    loginMethod: users.loginMethod,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(desc(users.createdAt));
}

export async function createManualUser(data: { name: string; email?: string; username: string; passwordHash: string; role: "user" | "admin" }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Check if username already exists
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, data.username)).limit(1);
  if (existing.length > 0) throw new Error("ชื่อผู้ใช้นี้ถูกใช้แล้ว");
  const openId = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const result = await db.insert(users).values({
    openId,
    name: data.name,
    email: data.email || null,
    username: data.username,
    passwordHash: data.passwordHash,
    role: data.role,
    loginMethod: "manual",
    lastSignedIn: new Date(),
  });
  return { id: Number(result[0].insertId), openId };
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserRole(id: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ role }).where(eq(users.id, id));
}

export async function updateUser(id: number, data: { name?: string; email?: string; role?: "user" | "admin"; passwordHash?: string }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updateSet: Record<string, unknown> = {};
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.email !== undefined) updateSet.email = data.email || null;
  if (data.role !== undefined) updateSet.role = data.role;
  if (data.passwordHash !== undefined) updateSet.passwordHash = data.passwordHash;
  if (Object.keys(updateSet).length === 0) return;
  await db.update(users).set(updateSet).where(eq(users.id, id));
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(users).where(eq(users.id, id));
}

// ==================== SOURCES QUERIES ====================
export async function getSources() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sources).orderBy(desc(sources.usageCount));
}

export async function getOrCreateSource(name: string, category?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existing = await db.select().from(sources).where(eq(sources.name, trimmed)).limit(1);
  if (existing.length > 0) {
    await db.update(sources).set({ usageCount: sql`${sources.usageCount} + 1` }).where(eq(sources.id, existing[0].id));
    return existing[0];
  }
  const result = await db.insert(sources).values({ name: trimmed, category: category || null });
  return { id: result[0].insertId, name: trimmed, category, usageCount: 1 };
}

// ==================== SURVEY ASSIGNMENTS QUERIES ====================
export async function getSurveyAssignments(surveyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    assignment: surveyAssignments,
    user: { id: users.id, name: users.name, role: users.role },
  }).from(surveyAssignments)
    .leftJoin(users, eq(surveyAssignments.userId, users.id))
    .where(eq(surveyAssignments.surveyId, surveyId))
    .orderBy(surveyAssignments.createdAt);
}

export async function setSurveyAssignments(surveyId: number, assignments: { userId: number; role: "admin_sender" | "surveyor" | "closer" }[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Delete existing assignments for this survey
  await db.delete(surveyAssignments).where(eq(surveyAssignments.surveyId, surveyId));
  // Insert new assignments
  if (assignments.length > 0) {
    await db.insert(surveyAssignments).values(
      assignments.map(a => ({ surveyId, userId: a.userId, role: a.role }))
    );
  }
}

export async function addSurveyAssignment(data: InsertSurveyAssignment) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(surveyAssignments).values(data);
  return result[0].insertId;
}

export async function deleteSource(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(sources).where(eq(sources.id, id));
}

export async function getSurveysWithCustomer(opts: { status?: string; assignedTo?: number; adminSenderId?: number; closerId?: number; page?: number; limit?: number; search?: string; month?: number; year?: number; source?: string }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const { status, assignedTo, adminSenderId, closerId, page = 1, limit = 20, search, month, year, source } = opts;
  const offset = (page - 1) * limit;
  const conditions: any[] = [];
  if (status) conditions.push(eq(surveys.status, status as any));
  if (assignedTo) conditions.push(eq(surveys.assignedTo, assignedTo));
  if (adminSenderId) conditions.push(eq(surveys.adminSenderId, adminSenderId));
  if (closerId) conditions.push(eq(surveys.closerId, closerId));
  if (search) {
    conditions.push(or(
      like(customers.name, `%${search}%`),
      like(customers.phone, `%${search}%`)
    ));
  }
  if (source) conditions.push(eq(customers.source, source));
  if (month && year) {
    conditions.push(sql`MONTH(${surveys.createdAt}) = ${month}`);
    conditions.push(sql`YEAR(${surveys.createdAt}) = ${year}`);
  } else if (year) {
    conditions.push(sql`YEAR(${surveys.createdAt}) = ${year}`);
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const data = await db.select({
    survey: surveys,
    customer: customers,
    assignedUser: { id: users.id, name: users.name },
  }).from(surveys)
    .innerJoin(customers, eq(surveys.customerId, customers.id))
    .leftJoin(users, eq(surveys.assignedTo, users.id))
    .where(whereClause)
    .orderBy(desc(surveys.createdAt))
    .limit(limit)
    .offset(offset);
  // Fetch assignments for all surveys in result
  const surveyIds = data.map(d => d.survey.id);
  let assignmentsMap: Record<number, { role: string; userName: string | null }[]> = {};
  if (surveyIds.length > 0) {
    const allAssignments = await db.select({
      surveyId: surveyAssignments.surveyId,
      role: surveyAssignments.role,
      userName: users.name,
    }).from(surveyAssignments)
      .leftJoin(users, eq(surveyAssignments.userId, users.id))
      .where(inArray(surveyAssignments.surveyId, surveyIds));
    for (const a of allAssignments) {
      if (!assignmentsMap[a.surveyId]) assignmentsMap[a.surveyId] = [];
      assignmentsMap[a.surveyId].push({ role: a.role, userName: a.userName });
    }
  }
  const countQ = whereClause
    ? await db.select({ count: sql<number>`count(*)` }).from(surveys).innerJoin(customers, eq(surveys.customerId, customers.id)).where(whereClause)
    : await db.select({ count: sql<number>`count(*)` }).from(surveys);
  return { data: data.map(d => ({ ...d, assignments: assignmentsMap[d.survey.id] || [] })), total: countQ[0]?.count ?? 0 };
}

// ==================== TEAM MEMBERS QUERIES ====================
export async function getTeamMembers(role?: string) {
  const db = await getDb();
  if (!db) return [];
  if (role) {
    return db.select().from(teamMembers).where(and(eq(teamMembers.role, role as any), eq(teamMembers.isActive, true))).orderBy(teamMembers.name);
  }
  return db.select().from(teamMembers).where(eq(teamMembers.isActive, true)).orderBy(teamMembers.name);
}

export async function getAllTeamMembers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(teamMembers).orderBy(teamMembers.role, teamMembers.name);
}

export async function createTeamMember(data: { name: string; phone?: string; email?: string; role: "admin_sender" | "surveyor" | "closer" }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(teamMembers).values(data);
  return { id: result[0].insertId, ...data };
}

export async function updateTeamMember(id: number, data: { name?: string; phone?: string; email?: string; role?: "admin_sender" | "surveyor" | "closer"; isActive?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(teamMembers).set(data).where(eq(teamMembers.id, id));
}

export async function deleteTeamMember(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(teamMembers).where(eq(teamMembers.id, id));
}
