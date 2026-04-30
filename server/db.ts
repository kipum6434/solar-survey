import { eq, and, or, like, desc, gte, lte, sql, inArray, asc, isNotNull, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, customers, InsertCustomer, surveys, InsertSurvey, surveyPhotos, InsertSurveyPhoto, surveyDocuments, InsertSurveyDocument, followUps, InsertFollowUp, shareLinks, InsertShareLink, notifications, InsertNotification, activityLog, InsertActivityLog, sources, InsertSource, surveyAssignments, InsertSurveyAssignment, teamMembers, InsertTeamMember, customStatuses, InsertCustomStatus, photoCategories, InsertPhotoCategory, documentCategories, InsertDocumentCategory, installationPhotos, InsertInstallationPhoto, installationPhotoCategories, InsertInstallationPhotoCategory, installerTeams, InsertInstallerTeam, deliveryComments, InsertDeliveryComment, lineGroups, InsertLineGroup, lineNotificationTargets, InsertLineNotificationTarget } from "../drizzle/schema";
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
export async function getCustomers(opts: { search?: string; page?: number; limit?: number; month?: number; year?: number; district?: string; province?: string; source?: string; surveyStatus?: string; scopedCustomerIds?: number[] }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const { search, page = 1, limit = 20, month, year, district, province, source, surveyStatus, scopedCustomerIds } = opts;
  const offset = (page - 1) * limit;
  const conditions: any[] = [];
  // Data scoping: เซลล์เห็นเฉพาะลูกค้าที่เกี่ยวข้องกับงานของตัวเอง
  if (scopedCustomerIds !== undefined) {
    if (scopedCustomerIds.length === 0) return { data: [], total: 0 };
    conditions.push(inArray(customers.id, scopedCustomerIds));
  }
  if (search) {
    conditions.push(or(
      like(customers.name, `%${search}%`),
      like(customers.phone, `%${search}%`),
      like(customers.email, `%${search}%`)
    ));
  }
  if (district) conditions.push(eq(customers.district, district));
  if (province) conditions.push(eq(customers.province, province));
  if (source) conditions.push(eq(customers.source, source));
  if (month && year) {
    conditions.push(sql`MONTH(${customers.createdAt}) = ${month}`);
    conditions.push(sql`YEAR(${customers.createdAt}) = ${year}`);
  } else if (year) {
    conditions.push(sql`YEAR(${customers.createdAt}) = ${year}`);
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const data = await db.select().from(customers).where(whereClause).orderBy(desc(customers.createdAt), desc(customers.id)).limit(limit).offset(offset);
  const countQ = whereClause
    ? await db.select({ count: sql<number>`count(*)` }).from(customers).where(whereClause)
    : await db.select({ count: sql<number>`count(*)` }).from(customers);

  // Compute customer survey status for each customer
  const customerIds = data.map(c => c.id);
  let statusMap: Record<number, string> = {};
  if (customerIds.length > 0) {
    const surveyData = await db.select({
      customerId: surveys.customerId,
      status: surveys.status,
    }).from(surveys).where(inArray(surveys.customerId, customerIds));
    // Group by customer
    const grouped: Record<number, string[]> = {};
    for (const s of surveyData) {
      if (!grouped[s.customerId]) grouped[s.customerId] = [];
      grouped[s.customerId].push(s.status);
    }
    for (const cId of customerIds) {
      const statuses = grouped[cId] || [];
      if (statuses.length === 0) {
        statusMap[cId] = "no_survey";
      } else if (statuses.some(s => s === "won")) {
        statusMap[cId] = "won";
      } else if (statuses.some(s => s === "surveyed" || s === "quoted" || s === "negotiating")) {
        statusMap[cId] = "surveyed";
      } else if (statuses.some(s => s === "scheduled" || s === "in_progress")) {
        statusMap[cId] = "scheduled";
      } else if (statuses.every(s => s === "lost" || s === "cancelled")) {
        statusMap[cId] = "lost";
      } else {
        statusMap[cId] = "pending";
      }
    }
  }

  // Filter by surveyStatus if provided
  let filteredData = data;
  if (surveyStatus) {
    filteredData = data.filter(c => statusMap[c.id] === surveyStatus);
  }

  // Also fetch custom status info for customers that have statusId
  const statusIds = filteredData.map(c => c.statusId).filter(Boolean) as number[];
  let customStatusMap: Record<number, { id: number; label: string; color: string; bgColor: string }> = {};
  if (statusIds.length > 0) {
    const customStatusData = await db.select().from(customStatuses).where(inArray(customStatuses.id, statusIds));
    for (const cs of customStatusData) {
      customStatusMap[cs.id] = { id: cs.id, label: cs.label, color: cs.color, bgColor: cs.bgColor };
    }
  }

  return { data: filteredData.map(c => ({ ...c, surveyStatus: statusMap[c.id] || "no_survey", customStatus: c.statusId ? customStatusMap[c.statusId] || null : null })), total: surveyStatus ? filteredData.length : (countQ[0]?.count ?? 0) };
}

export async function getCustomerDistinctValues() {
  const db = await getDb();
  if (!db) return { districts: [], provinces: [], sources: [] };
  const districtRows = await db.selectDistinct({ value: customers.district }).from(customers).where(sql`${customers.district} IS NOT NULL AND ${customers.district} != ''`);
  const provinceRows = await db.selectDistinct({ value: customers.province }).from(customers).where(sql`${customers.province} IS NOT NULL AND ${customers.province} != ''`);
  const sourceRows = await db.selectDistinct({ value: customers.source }).from(customers).where(sql`${customers.source} IS NOT NULL AND ${customers.source} != ''`);
  return {
    districts: districtRows.map(r => r.value).filter(Boolean) as string[],
    provinces: provinceRows.map(r => r.value).filter(Boolean) as string[],
    sources: sourceRows.map(r => r.value).filter(Boolean) as string[],
  };
}

export async function getTeamPerformance(opts: { month?: number; year?: number }) {
  const db = await getDb();
  if (!db) return [];
  const { month, year } = opts;
  const conditions: any[] = [];
  if (month && year) {
    conditions.push(sql`MONTH(${surveys.createdAt}) = ${month}`);
    conditions.push(sql`YEAR(${surveys.createdAt}) = ${year}`);
  } else if (year) {
    conditions.push(sql`YEAR(${surveys.createdAt}) = ${year}`);
  }
  // Get all survey assignments with survey info
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const surveyData = whereClause
    ? await db.select({ surveyId: surveys.id, createdAt: surveys.createdAt, status: surveys.status }).from(surveys).where(whereClause)
    : await db.select({ surveyId: surveys.id, createdAt: surveys.createdAt, status: surveys.status }).from(surveys);
  const surveyIds = surveyData.map(s => s.surveyId);
  if (surveyIds.length === 0) return [];
  // Get all assignments for these surveys
  const assignments = await db.select({
    surveyId: surveyAssignments.surveyId,
    userId: surveyAssignments.userId,
    role: surveyAssignments.role,
    teamMemberName: teamMembers.name,
    teamMemberRole: teamMembers.role,
    fallbackUserName: users.name,
  }).from(surveyAssignments)
    .leftJoin(teamMembers, eq(surveyAssignments.userId, teamMembers.id))
    .leftJoin(users, eq(surveyAssignments.userId, users.id))
    .where(inArray(surveyAssignments.surveyId, surveyIds));
  // Count per team member - each assignment counts as 1 regardless of co-assignment
  const memberStats: Record<number, { name: string; role: string; surveyCount: number; completedCount: number }> = {};
  const surveyStatusMap: Record<number, string> = {};
  for (const s of surveyData) surveyStatusMap[s.surveyId] = s.status;
  for (const a of assignments) {
    if (!memberStats[a.userId]) {
      memberStats[a.userId] = {
        name: a.teamMemberName ?? a.fallbackUserName ?? `ID:${a.userId}`,
        role: a.teamMemberRole ?? a.role,
        surveyCount: 0,
        completedCount: 0,
      };
    }
    memberStats[a.userId].surveyCount++;
    const surveyStatus = surveyStatusMap[a.surveyId];
    if (surveyStatus === "surveyed" || surveyStatus === "quoted" || surveyStatus === "negotiating" || surveyStatus === "won") {
      memberStats[a.userId].completedCount++;
    }
  }
  return Object.entries(memberStats).map(([id, stats]) => ({ teamMemberId: Number(id), ...stats }));
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

export async function bulkDeleteCustomers(ids: number[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (ids.length === 0) return { deleted: 0 };
  // Get all surveys for these customers
  const customerSurveys = await db.select({ id: surveys.id }).from(surveys).where(inArray(surveys.customerId, ids));
  const surveyIds = customerSurveys.map(s => s.id);
  // Delete related data
  if (surveyIds.length > 0) {
    await db.delete(surveyAssignments).where(inArray(surveyAssignments.surveyId, surveyIds));
    await db.delete(surveyPhotos).where(inArray(surveyPhotos.surveyId, surveyIds));
    await db.delete(surveyDocuments).where(inArray(surveyDocuments.surveyId, surveyIds));
    await db.delete(followUps).where(inArray(followUps.surveyId, surveyIds));
    await db.delete(shareLinks).where(inArray(shareLinks.surveyId, surveyIds));
    await db.delete(notifications).where(inArray(notifications.relatedSurveyId, surveyIds));
    await db.delete(surveys).where(inArray(surveys.id, surveyIds));
  }
  // Delete customers
  await db.delete(customers).where(inArray(customers.id, ids));
  return { deleted: ids.length };
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
  const data = await db.select().from(surveys).where(whereClause).orderBy(desc(surveys.createdAt), desc(surveys.id)).limit(limit).offset(offset);
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
  // Fetch assignments with team member info (fallback to users for legacy data)
  const assignmentRows = await db.select({
    assignment: surveyAssignments,
    teamMemberId: teamMembers.id,
    teamMemberName: teamMembers.name,
    teamMemberRole: teamMembers.role,
    fallbackUserId: users.id,
    fallbackUserName: users.name,
  }).from(surveyAssignments)
    .leftJoin(teamMembers, eq(surveyAssignments.userId, teamMembers.id))
    .leftJoin(users, eq(surveyAssignments.userId, users.id))
    .where(eq(surveyAssignments.surveyId, id))
    .orderBy(surveyAssignments.createdAt);
  const assignments = assignmentRows.map(r => ({
    assignment: r.assignment,
    user: {
      id: r.teamMemberId ?? r.fallbackUserId ?? r.assignment.userId,
      name: r.teamMemberName ?? r.fallbackUserName ?? null,
      role: r.teamMemberRole ?? r.assignment.role,
    },
  }));
  // Fetch custom status if survey has statusId
  let customStatus: { id: number; label: string; color: string; bgColor: string } | null = null;
  if (result[0].survey.statusId) {
    const csRows = await db.select().from(customStatuses).where(eq(customStatuses.id, result[0].survey.statusId)).limit(1);
    if (csRows[0]) {
      customStatus = { id: csRows[0].id, label: csRows[0].label, color: csRows[0].color, bgColor: csRows[0].bgColor };
    }
  }
  return { ...result[0], assignments, customStatus };
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

export async function getSurveysForFollowUp(opts: { search?: string; startDate?: number; endDate?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [
    or(
      eq(surveys.status, "follow_up"),
      eq(surveys.status, "quoted"),
      eq(surveys.status, "negotiating")
    )
  ];
  if (opts.search) {
    conditions.push(
      or(
        like(customers.name, `%${opts.search}%`),
        like(customers.phone, `%${opts.search}%`),
        like(surveys.surveyNotes, `%${opts.search}%`)
      )
    );
  }
  if (opts.startDate) conditions.push(gte(surveys.updatedAt, new Date(opts.startDate)));
  if (opts.endDate) conditions.push(lte(surveys.updatedAt, new Date(opts.endDate)));
  const whereClause = and(...conditions);
  const rows = await db.select({
    survey: surveys,
    customer: {
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      province: customers.province,
      district: customers.district,
      source: customers.source,
    },
  }).from(surveys)
    .innerJoin(customers, eq(surveys.customerId, customers.id))
    .where(whereClause)
    .orderBy(desc(surveys.updatedAt));

  // Fetch custom status labels for surveys that have statusId
  const statusIds = rows.map(r => r.survey.statusId).filter(Boolean) as number[];
  const customStatusMap: Record<number, { id: number; label: string; color: string; bgColor: string }> = {};
  if (statusIds.length > 0) {
    const csData = await db.select().from(customStatuses).where(inArray(customStatuses.id, statusIds));
    for (const cs of csData) {
      customStatusMap[cs.id] = { id: cs.id, label: cs.label, color: cs.color, bgColor: cs.bgColor };
    }
  }

  // Fetch latest follow-up for each survey
  const surveyIds = rows.map(r => r.survey.id);
  const followUpMap: Record<number, typeof followUps.$inferSelect> = {};
  if (surveyIds.length > 0) {
    const fuRows = await db.select().from(followUps).where(inArray(followUps.surveyId, surveyIds)).orderBy(desc(followUps.dueDate));
    for (const fu of fuRows) {
      if (!followUpMap[fu.surveyId]) followUpMap[fu.surveyId] = fu;
    }
  }

  // Fetch assignments
  const assignmentsMap: Record<number, { role: string; name: string }[]> = {};
  if (surveyIds.length > 0) {
    const assignRows = await db.select({
      surveyId: surveyAssignments.surveyId,
      role: surveyAssignments.role,
      teamMemberName: teamMembers.name,
      userName: users.name,
    }).from(surveyAssignments)
      .leftJoin(teamMembers, eq(surveyAssignments.userId, teamMembers.id))
      .leftJoin(users, eq(surveyAssignments.userId, users.id))
      .where(inArray(surveyAssignments.surveyId, surveyIds));
    for (const a of assignRows) {
      if (!assignmentsMap[a.surveyId]) assignmentsMap[a.surveyId] = [];
      assignmentsMap[a.surveyId].push({ role: a.role, name: a.teamMemberName || a.userName || "" });
    }
  }

  return rows.map(r => ({
    survey: r.survey,
    customer: r.customer,
    customStatus: r.survey.statusId ? customStatusMap[r.survey.statusId] || null : null,
    latestFollowUp: followUpMap[r.survey.id] || null,
    assignments: assignmentsMap[r.survey.id] || [],
  }));
}

export async function getFollowUpsWithDetails(opts: { status?: string; method?: string; startDate?: number; endDate?: number; search?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (opts.status) conditions.push(eq(followUps.status, opts.status as any));
  if (opts.method) conditions.push(eq(followUps.method, opts.method as any));
  if (opts.startDate) conditions.push(gte(followUps.dueDate, opts.startDate));
  if (opts.endDate) conditions.push(lte(followUps.dueDate, opts.endDate));
  if (opts.search) {
    conditions.push(
      or(
        like(customers.name, `%${opts.search}%`),
        like(customers.phone, `%${opts.search}%`),
        like(followUps.notes, `%${opts.search}%`)
      )
    );
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select({
    followUp: followUps,
    customer: {
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      province: customers.province,
      district: customers.district,
    },
    survey: {
      id: surveys.id,
      status: surveys.status,
      systemSize: surveys.systemSize,
    },
  }).from(followUps)
    .innerJoin(customers, eq(followUps.customerId, customers.id))
    .innerJoin(surveys, eq(followUps.surveyId, surveys.id))
    .where(whereClause)
    .orderBy(followUps.dueDate);
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

export async function getShareLinksBySurveyByType(surveyId: number, linkType: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareLinks).where(and(eq(shareLinks.surveyId, surveyId), eq(shareLinks.linkType, linkType))).orderBy(desc(shareLinks.createdAt));
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
export async function getDashboardStats(scopedSurveyIds?: number[], scopedCustomerIds?: number[]) {
  const db = await getDb();
  if (!db) return { totalCustomers: 0, totalSurveys: 0, pendingSurveys: 0, completedSurveys: 0, wonDeals: 0, pendingFollowUps: 0 };
  // If scoped and empty arrays, return zeros
  if (scopedSurveyIds !== undefined && scopedSurveyIds.length === 0) {
    return { totalCustomers: 0, totalSurveys: 0, pendingSurveys: 0, completedSurveys: 0, wonDeals: 0, pendingFollowUps: 0 };
  }
  const custConditions: any[] = [];
  if (scopedCustomerIds !== undefined) {
    if (scopedCustomerIds.length === 0) custConditions.push(sql`1=0`);
    else custConditions.push(inArray(customers.id, scopedCustomerIds));
  }
  const survConditions: any[] = [];
  if (scopedSurveyIds !== undefined) {
    survConditions.push(inArray(surveys.id, scopedSurveyIds));
  }
  const [custCount] = await db.select({ count: sql<number>`count(*)` }).from(customers).where(custConditions.length > 0 ? and(...custConditions) : undefined);
  const [survCount] = await db.select({ count: sql<number>`count(*)` }).from(surveys).where(survConditions.length > 0 ? and(...survConditions) : undefined);
  const [pendCount] = await db.select({ count: sql<number>`count(*)` }).from(surveys).where(and(...survConditions, inArray(surveys.status, ["pending", "scheduled"])));
  const [compCount] = await db.select({ count: sql<number>`count(*)` }).from(surveys).where(and(...survConditions, eq(surveys.status, "surveyed")));
  const [wonCount] = await db.select({ count: sql<number>`count(*)` }).from(surveys).where(and(...survConditions, eq(surveys.status, "won")));
  // Follow-ups: scope by surveyId if scoped
  const fuConditions: any[] = [eq(followUps.status, "pending")];
  if (scopedSurveyIds !== undefined) {
    fuConditions.push(inArray(followUps.surveyId, scopedSurveyIds));
  }
  const [fuCount] = await db.select({ count: sql<number>`count(*)` }).from(followUps).where(and(...fuConditions));
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
  // Join with both team_members (primary) and users (fallback for legacy data)
  const rows = await db.select({
    assignment: surveyAssignments,
    teamMemberId: teamMembers.id,
    teamMemberName: teamMembers.name,
    teamMemberRole: teamMembers.role,
    fallbackUserId: users.id,
    fallbackUserName: users.name,
  }).from(surveyAssignments)
    .leftJoin(teamMembers, eq(surveyAssignments.userId, teamMembers.id))
    .leftJoin(users, eq(surveyAssignments.userId, users.id))
    .where(eq(surveyAssignments.surveyId, surveyId))
    .orderBy(surveyAssignments.createdAt);
  // Return unified format: prefer team_members, fallback to users
  return rows.map(r => ({
    assignment: r.assignment,
    user: {
      id: r.teamMemberId ?? r.fallbackUserId ?? r.assignment.userId,
      name: r.teamMemberName ?? r.fallbackUserName ?? null,
      role: r.teamMemberRole ?? r.assignment.role,
    },
  }));
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

export async function getSurveysWithCustomer(opts: { status?: string; assignedTo?: number; adminSenderId?: number; closerId?: number; page?: number; limit?: number; search?: string; month?: number; year?: number; source?: string; district?: string; province?: string; scopedSurveyIds?: number[] }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const { status, assignedTo, adminSenderId, closerId, page = 1, limit = 20, search, month, year, source, district, province, scopedSurveyIds } = opts;
  const offset = (page - 1) * limit;

  // If filtering by team member (any role), find matching survey IDs first
  let filteredSurveyIds: number[] | null = null;
  if (assignedTo || adminSenderId || closerId) {
    const assignConditions: any[] = [];
    if (assignedTo) assignConditions.push(and(eq(surveyAssignments.userId, assignedTo), eq(surveyAssignments.role, "surveyor")));
    if (adminSenderId) assignConditions.push(and(eq(surveyAssignments.userId, adminSenderId), eq(surveyAssignments.role, "admin_sender")));
    if (closerId) assignConditions.push(and(eq(surveyAssignments.userId, closerId), eq(surveyAssignments.role, "closer")));
    const matchingAssignments = await db.selectDistinct({ surveyId: surveyAssignments.surveyId })
      .from(surveyAssignments)
      .where(assignConditions.length === 1 ? assignConditions[0] : or(...assignConditions));
    filteredSurveyIds = matchingAssignments.map(a => a.surveyId);
    if (filteredSurveyIds.length === 0) return { data: [], total: 0 };
  }

  const conditions: any[] = [];
  // Data scoping: เซลล์เห็นเฉพาะงานสำรวจที่ตัวเองถูก assign
  if (scopedSurveyIds !== undefined) {
    if (scopedSurveyIds.length === 0) return { data: [], total: 0 };
    conditions.push(inArray(surveys.id, scopedSurveyIds));
  }
  if (filteredSurveyIds) conditions.push(inArray(surveys.id, filteredSurveyIds));
  if (status) conditions.push(eq(surveys.status, status as any));
  if (search) {
    conditions.push(or(
      like(customers.name, `%${search}%`),
      like(customers.phone, `%${search}%`)
    ));
  }
  if (source) conditions.push(eq(customers.source, source));
  if (district) conditions.push(eq(customers.district, district));
  if (province) conditions.push(eq(customers.province, province));
  if (month && year) {
    // Filter by scheduledDate (stored as Unix timestamp ms) with UTC+7 Thailand timezone
    conditions.push(sql`MONTH(FROM_UNIXTIME(${surveys.scheduledDate} / 1000 + 25200)) = ${month}`);
    conditions.push(sql`YEAR(FROM_UNIXTIME(${surveys.scheduledDate} / 1000 + 25200)) = ${year}`);
  } else if (year) {
    conditions.push(sql`YEAR(FROM_UNIXTIME(${surveys.scheduledDate} / 1000 + 25200)) = ${year}`);
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
      teamMemberName: teamMembers.name,
      fallbackUserName: users.name,
    }).from(surveyAssignments)
      .leftJoin(teamMembers, eq(surveyAssignments.userId, teamMembers.id))
      .leftJoin(users, eq(surveyAssignments.userId, users.id))
      .where(inArray(surveyAssignments.surveyId, surveyIds));
    for (const a of allAssignments) {
      if (!assignmentsMap[a.surveyId]) assignmentsMap[a.surveyId] = [];
      assignmentsMap[a.surveyId].push({ role: a.role, userName: a.teamMemberName ?? a.fallbackUserName });
    }
  }
  const countQ = whereClause
    ? await db.select({ count: sql<number>`count(*)` }).from(surveys).innerJoin(customers, eq(surveys.customerId, customers.id)).where(whereClause)
    : await db.select({ count: sql<number>`count(*)` }).from(surveys);
  // Fetch custom status info for surveys that have statusId
  const surveyStatusIds = data.map(d => d.survey.statusId).filter(Boolean) as number[];
  let surveyCustomStatusMap: Record<number, { id: number; label: string; color: string; bgColor: string }> = {};
  if (surveyStatusIds.length > 0) {
    const customStatusData = await db.select().from(customStatuses).where(inArray(customStatuses.id, surveyStatusIds));
    for (const cs of customStatusData) {
      surveyCustomStatusMap[cs.id] = { id: cs.id, label: cs.label, color: cs.color, bgColor: cs.bgColor };
    }
  }
  return { data: data.map(d => ({ ...d, assignments: assignmentsMap[d.survey.id] || [], customStatus: d.survey.statusId ? surveyCustomStatusMap[d.survey.statusId] || null : null })), total: countQ[0]?.count ?? 0 };
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

export async function createTeamMember(data: { name: string; phone?: string; email?: string; role: "admin_sender" | "surveyor" | "closer"; linkedUserId?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(teamMembers).values(data);
  return { id: result[0].insertId, ...data };
}

export async function updateTeamMember(id: number, data: { name?: string; phone?: string; email?: string; role?: "admin_sender" | "surveyor" | "closer"; isActive?: boolean; linkedUserId?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(teamMembers).set(data).where(eq(teamMembers.id, id));
}

export async function getTeamMemberByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(teamMembers).where(and(eq(teamMembers.linkedUserId, userId), eq(teamMembers.isActive, true))).limit(1);
  return rows[0] ?? null;
}

export async function getAvailableUsersForLinking(currentTeamMemberId?: number) {
  const db = await getDb();
  if (!db) return [];
  // Get all user IDs that are already linked to a team member
  const linkedRows = await db.select({ linkedUserId: teamMembers.linkedUserId }).from(teamMembers).where(and(isNotNull(teamMembers.linkedUserId), eq(teamMembers.isActive, true)));
  const linkedUserIds = linkedRows.map(r => r.linkedUserId!).filter(Boolean);
  // If editing, exclude current team member's linked user from the "taken" list
  if (currentTeamMemberId) {
    const currentMember = await db.select().from(teamMembers).where(eq(teamMembers.id, currentTeamMemberId)).limit(1);
    if (currentMember[0]?.linkedUserId) {
      const idx = linkedUserIds.indexOf(currentMember[0].linkedUserId);
      if (idx > -1) linkedUserIds.splice(idx, 1);
    }
  }
  // Get all users, mark which are available
  const allUsers = await db.select({ id: users.id, name: users.name, username: users.username, role: users.role }).from(users).orderBy(users.name);
  return allUsers.map(u => ({ ...u, isLinked: linkedUserIds.includes(u.id) }));
}

export async function deleteTeamMember(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(teamMembers).where(eq(teamMembers.id, id));
}

export async function bulkDeleteTeamMembers(ids: number[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (ids.length === 0) return { deleted: 0 };
  await db.delete(teamMembers).where(inArray(teamMembers.id, ids));
  return { deleted: ids.length };
}

export async function bulkDeleteSurveys(ids: number[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (ids.length === 0) return { deleted: 0 };
  // Delete related data first
  await db.delete(surveyAssignments).where(inArray(surveyAssignments.surveyId, ids));
  await db.delete(surveyPhotos).where(inArray(surveyPhotos.surveyId, ids));
  await db.delete(surveyDocuments).where(inArray(surveyDocuments.surveyId, ids));
  await db.delete(followUps).where(inArray(followUps.surveyId, ids));
  await db.delete(shareLinks).where(inArray(shareLinks.surveyId, ids));
  await db.delete(notifications).where(inArray(notifications.relatedSurveyId, ids));
  await db.delete(surveys).where(inArray(surveys.id, ids));
  return { deleted: ids.length };
}

// ==================== CUSTOM STATUSES QUERIES ====================
export async function getCustomStatuses(type?: "customer" | "survey") {
  const db = await getDb();
  if (!db) return [];
  if (type) {
    return db.select().from(customStatuses).where(eq(customStatuses.type, type)).orderBy(asc(customStatuses.sortOrder));
  }
  return db.select().from(customStatuses).orderBy(asc(customStatuses.sortOrder));
}

export async function createCustomStatus(data: { type: "customer" | "survey"; label: string; color?: string; bgColor?: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(customStatuses).values({
    type: data.type,
    label: data.label,
    color: data.color || "#6b7280",
    bgColor: data.bgColor || "#f3f4f6",
    sortOrder: data.sortOrder || 0,
  });
  return { id: result[0].insertId };
}

export async function updateCustomStatus(id: number, data: { label?: string; color?: string; bgColor?: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updateSet: Record<string, unknown> = {};
  if (data.label !== undefined) updateSet.label = data.label;
  if (data.color !== undefined) updateSet.color = data.color;
  if (data.bgColor !== undefined) updateSet.bgColor = data.bgColor;
  if (data.sortOrder !== undefined) updateSet.sortOrder = data.sortOrder;
  if (Object.keys(updateSet).length === 0) return;
  await db.update(customStatuses).set(updateSet).where(eq(customStatuses.id, id));
}

export async function reorderCustomStatuses(items: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  for (const item of items) {
    await db.update(customStatuses).set({ sortOrder: item.sortOrder }).where(eq(customStatuses.id, item.id));
  }
}

export async function deleteCustomStatus(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Clear references in customers and surveys
  await db.update(customers).set({ statusId: null }).where(eq(customers.statusId, id));
  await db.update(surveys).set({ statusId: null }).where(eq(surveys.statusId, id));
  await db.delete(customStatuses).where(eq(customStatuses.id, id));
}

export async function bulkDeleteCustomStatuses(ids: number[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Clear references in customers and surveys
  await db.update(customers).set({ statusId: null }).where(inArray(customers.statusId, ids));
  await db.update(surveys).set({ statusId: null }).where(inArray(surveys.statusId, ids));
  await db.delete(customStatuses).where(inArray(customStatuses.id, ids));
  return { deleted: ids.length };
}

export async function updateCustomerStatus(customerId: number, statusId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(customers).set({ statusId }).where(eq(customers.id, customerId));
}

export async function updateSurveyStatus(surveyId: number, statusId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(surveys).set({ statusId }).where(eq(surveys.id, surveyId));
}

export async function updateSurveyInstallationDate(surveyId: number, installationDate: number | null) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(surveys).set({ installationDate }).where(eq(surveys.id, surveyId));
}

export async function updateInstallationStatus(surveyId: number, installationStatus: string | null) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(surveys).set({ installationStatus: installationStatus as any }).where(eq(surveys.id, surveyId));
}

// ==================== INSTALLATIONS QUERIES ====================
export async function getInstallations(opts: any) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const { page = 1, limit = 20, search, month, year, district, province, installationStatus, surveyorId, closerId, installerTeamId, scopedSurveyIds } = opts;
  const offset = (page - 1) * limit;

  // Data scoping: เซลล์เห็นเฉพาะงานติดตั้งที่ตัวเองเกี่ยวข้อง
  if (scopedSurveyIds !== undefined && scopedSurveyIds.length === 0) return { data: [], total: 0 };

  // Only show surveys that have installationDate set (closed deals with installation scheduled)
  const conditions: any[] = [isNotNull(surveys.installationDate)];
  if (scopedSurveyIds !== undefined) {
    conditions.push(inArray(surveys.id, scopedSurveyIds));
  }
  if (search) {
    conditions.push(or(
      like(customers.name, `%${search}%`),
      like(customers.phone, `%${search}%`)
    ));
  }
  if (district) conditions.push(eq(customers.district, district));
  if (province) conditions.push(eq(customers.province, province));
  if (month && year) {
    // Filter by installation month/year (UTC+7 Thailand: +25200 seconds)
    conditions.push(sql`MONTH(FROM_UNIXTIME(${surveys.installationDate} / 1000 + 25200)) = ${month}`);
    conditions.push(sql`YEAR(FROM_UNIXTIME(${surveys.installationDate} / 1000 + 25200)) = ${year}`);
  } else if (year) {
    conditions.push(sql`YEAR(FROM_UNIXTIME(${surveys.installationDate} / 1000 + 25200)) = ${year}`);
  }
  // Filter by surveyor/closer
  if (surveyorId) {
    conditions.push(sql`${surveys.id} IN (SELECT surveyId FROM survey_assignments WHERE role = 'surveyor' AND userId = ${surveyorId})`);
  }
  if (closerId) {
    conditions.push(sql`${surveys.id} IN (SELECT surveyId FROM survey_assignments WHERE role = 'closer' AND userId = ${closerId})`);
  }
  if (installerTeamId) {
    conditions.push(eq(surveys.installerTeamId, installerTeamId));
  }
  // installationStatus: upcoming (future), today, overdue (past, not completed), completed
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
  if (installationStatus === 'upcoming') {
    conditions.push(sql`${surveys.installationDate} > ${todayEnd.getTime()}`);
  } else if (installationStatus === 'today') {
    conditions.push(sql`${surveys.installationDate} >= ${todayStart.getTime()} AND ${surveys.installationDate} <= ${todayEnd.getTime()}`);
  } else if (installationStatus === 'overdue') {
    conditions.push(sql`${surveys.installationDate} < ${todayStart.getTime()}`);
    conditions.push(isNull(surveys.completedAt));
  } else if (installationStatus === 'completed') {
    conditions.push(isNotNull(surveys.completedAt));
  }

  const whereClause = and(...conditions);
  const data = await db.select({
    survey: surveys,
    customer: customers,
  }).from(surveys)
    .innerJoin(customers, eq(surveys.customerId, customers.id))
    .where(whereClause)
    .orderBy(asc(surveys.installationDate), desc(surveys.id))
    .limit(limit)
    .offset(offset);

  // Fetch assignments for all surveys
  const surveyIds = data.map(d => d.survey.id);
  let assignmentsMap: Record<number, { role: string; userName: string | null }[]> = {};
  if (surveyIds.length > 0) {
    const allAssignments = await db.select({
      surveyId: surveyAssignments.surveyId,
      role: surveyAssignments.role,
      teamMemberName: teamMembers.name,
      fallbackUserName: users.name,
    }).from(surveyAssignments)
      .leftJoin(teamMembers, eq(surveyAssignments.userId, teamMembers.id))
      .leftJoin(users, eq(surveyAssignments.userId, users.id))
      .where(inArray(surveyAssignments.surveyId, surveyIds));
    for (const a of allAssignments) {
      if (!assignmentsMap[a.surveyId]) assignmentsMap[a.surveyId] = [];
      assignmentsMap[a.surveyId].push({ role: a.role, userName: a.teamMemberName ?? a.fallbackUserName });
    }
  }

  // Fetch installer teams
  const installerTeamIds = data.map(d => d.survey.installerTeamId).filter(Boolean) as number[];
  let installerTeamMap: Record<number, { id: number; name: string; phone: string | null; color: string | null }> = {};
  if (installerTeamIds.length > 0) {
    const teamData = await db.select().from(installerTeams).where(inArray(installerTeams.id, installerTeamIds));
    for (const t of teamData) {
      installerTeamMap[t.id] = { id: t.id, name: t.name, phone: t.phone, color: t.color ?? null };
    }
  }

  // Fetch custom status
  const surveyStatusIds = data.map(d => d.survey.statusId).filter(Boolean) as number[];
  let surveyCustomStatusMap: Record<number, { id: number; label: string; color: string; bgColor: string }> = {};
  if (surveyStatusIds.length > 0) {
    const customStatusData = await db.select().from(customStatuses).where(inArray(customStatuses.id, surveyStatusIds));
    for (const cs of customStatusData) {
      surveyCustomStatusMap[cs.id] = { id: cs.id, label: cs.label, color: cs.color, bgColor: cs.bgColor };
    }
  }

  const countQ = await db.select({ count: sql<number>`count(*)` }).from(surveys).innerJoin(customers, eq(surveys.customerId, customers.id)).where(whereClause);

  return {
    data: data.map(d => ({
      ...d,
      assignments: assignmentsMap[d.survey.id] || [],
      customStatus: d.survey.statusId ? surveyCustomStatusMap[d.survey.statusId] || null : null,
      installerTeam: d.survey.installerTeamId ? installerTeamMap[d.survey.installerTeamId] || null : null,
    })),
    total: countQ[0]?.count ?? 0,
  };
}

// ==================== FILE MANAGEMENT QUERIES ====================
export async function getAllFiles(opts: { page?: number; limit?: number; search?: string; fileType?: string }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const { page = 1, limit = 20, search, fileType } = opts;
  const offset = (page - 1) * limit;

  // Get photos
  const photoConditions: any[] = [];
  if (search) {
    photoConditions.push(or(
      like(customers.name, `%${search}%`),
      like(surveyPhotos.fileName, `%${search}%`),
      like(surveyPhotos.caption, `%${search}%`)
    ));
  }

  const photosQuery = db.select({
    id: surveyPhotos.id,
    type: sql<string>`'photo'`.as('type'),
    url: surveyPhotos.url,
    fileKey: surveyPhotos.fileKey,
    fileName: surveyPhotos.fileName,
    fileSize: surveyPhotos.fileSize,
    category: surveyPhotos.category,
    caption: surveyPhotos.caption,
    surveyId: surveyPhotos.surveyId,
    customerId: surveyPhotos.customerId,
    customerName: customers.name,
    customerPhone: customers.phone,
    createdAt: surveyPhotos.createdAt,
  }).from(surveyPhotos)
    .innerJoin(customers, eq(surveyPhotos.customerId, customers.id))
    .where(photoConditions.length > 0 ? and(...photoConditions) : undefined);

  // Get documents
  const docConditions: any[] = [];
  if (search) {
    docConditions.push(or(
      like(customers.name, `%${search}%`),
      like(surveyDocuments.fileName, `%${search}%`)
    ));
  }

  const docsQuery = db.select({
    id: surveyDocuments.id,
    type: sql<string>`'document'`.as('type'),
    url: surveyDocuments.url,
    fileKey: surveyDocuments.fileKey,
    fileName: surveyDocuments.fileName,
    fileSize: surveyDocuments.fileSize,
    category: surveyDocuments.fileType,
    caption: sql<string>`NULL`.as('caption'),
    surveyId: surveyDocuments.surveyId,
    customerId: surveyDocuments.customerId,
    customerName: customers.name,
    customerPhone: customers.phone,
    createdAt: surveyDocuments.createdAt,
  }).from(surveyDocuments)
    .innerJoin(customers, eq(surveyDocuments.customerId, customers.id))
    .where(docConditions.length > 0 ? and(...docConditions) : undefined);

  if (fileType === 'photo') {
    const photos = await photosQuery.orderBy(desc(surveyPhotos.createdAt), desc(surveyPhotos.id)).limit(limit).offset(offset);
    const countQ = await db.select({ count: sql<number>`count(*)` }).from(surveyPhotos)
      .innerJoin(customers, eq(surveyPhotos.customerId, customers.id))
      .where(photoConditions.length > 0 ? and(...photoConditions) : undefined);
    return { data: photos, total: countQ[0]?.count ?? 0 };
  } else if (fileType === 'document') {
    const docs = await docsQuery.orderBy(desc(surveyDocuments.createdAt), desc(surveyDocuments.id)).limit(limit).offset(offset);
    const countQ = await db.select({ count: sql<number>`count(*)` }).from(surveyDocuments)
      .innerJoin(customers, eq(surveyDocuments.customerId, customers.id))
      .where(docConditions.length > 0 ? and(...docConditions) : undefined);
    return { data: docs, total: countQ[0]?.count ?? 0 };
  } else {
    // All files - get both and merge
    const photos = await photosQuery;
    const docs = await docsQuery;
    const allFiles = [...photos, ...docs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = allFiles.length;
    const paged = allFiles.slice(offset, offset + limit);
    return { data: paged, total };
  }
}

export async function deletePhoto(photoId: number) {
  const db = await getDb();
  if (!db) return null;
  const [photo] = await db.select().from(surveyPhotos).where(eq(surveyPhotos.id, photoId));
  if (!photo) return null;
  await db.delete(surveyPhotos).where(eq(surveyPhotos.id, photoId));
  return photo;
}

export async function deleteDocument(docId: number) {
  const db = await getDb();
  if (!db) return null;
  const [doc] = await db.select().from(surveyDocuments).where(eq(surveyDocuments.id, docId));
  if (!doc) return null;
  await db.delete(surveyDocuments).where(eq(surveyDocuments.id, docId));
  return doc;
}

// ==================== Photo Categories ====================

export async function getPhotoCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(photoCategories).orderBy(asc(photoCategories.sortOrder), asc(photoCategories.id));
}

export async function createPhotoCategory(data: InsertPhotoCategory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(photoCategories).values(data).$returningId();
  return result;
}

export async function updatePhotoCategory(id: number, data: Partial<InsertPhotoCategory>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(photoCategories).set(data).where(eq(photoCategories.id, id));
}

export async function deletePhotoCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [cat] = await db.select().from(photoCategories).where(eq(photoCategories.id, id));
  if (!cat) throw new Error("Category not found");
  // Protect only the 'other' category from deletion
  if (cat.key === 'other') throw new Error("Cannot delete the 'other' category");
  await db.delete(photoCategories).where(eq(photoCategories.id, id));
  return cat;
}


export async function reorderPhotoCategories(items: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  for (const item of items) {
    await db.update(photoCategories).set({ sortOrder: item.sortOrder }).where(eq(photoCategories.id, item.id));
  }
}

export async function bulkDeletePhotoCategories(ids: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Protect 'other' category
  const cats = await db.select().from(photoCategories).where(inArray(photoCategories.id, ids));
  const safeIds = cats.filter(c => c.key !== 'other').map(c => c.id);
  if (safeIds.length === 0) return { deleted: 0 };
  await db.delete(photoCategories).where(inArray(photoCategories.id, safeIds));
  return { deleted: safeIds.length };
}

// ==================== Document Categories ====================

export async function getDocumentCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentCategories).orderBy(asc(documentCategories.sortOrder), asc(documentCategories.id));
}

export async function createDocumentCategory(data: InsertDocumentCategory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(documentCategories).values(data).$returningId();
  return result;
}

export async function updateDocumentCategory(id: number, data: Partial<InsertDocumentCategory>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(documentCategories).set(data).where(eq(documentCategories.id, id));
}

export async function deleteDocumentCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [cat] = await db.select().from(documentCategories).where(eq(documentCategories.id, id));
  if (!cat) throw new Error("Category not found");
  // Protect only the 'other' category from deletion
  if (cat.key === 'other') throw new Error("Cannot delete the 'other' category");
  await db.delete(documentCategories).where(eq(documentCategories.id, id));
  return cat;
}

export async function reorderDocumentCategories(items: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  for (const item of items) {
    await db.update(documentCategories).set({ sortOrder: item.sortOrder }).where(eq(documentCategories.id, item.id));
  }
}

export async function bulkDeleteDocumentCategories(ids: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const cats = await db.select().from(documentCategories).where(inArray(documentCategories.id, ids));
  const safeIds = cats.filter(c => c.key !== 'other').map(c => c.id);
  if (safeIds.length === 0) return { deleted: 0 };
  await db.delete(documentCategories).where(inArray(documentCategories.id, safeIds));
  return { deleted: safeIds.length };
}

// ==================== Installation Photo Categories ====================

export async function getInstallationPhotoCategories() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(installationPhotoCategories).orderBy(asc(installationPhotoCategories.sortOrder), asc(installationPhotoCategories.id));
}

export async function createInstallationPhotoCategory(data: InsertInstallationPhotoCategory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(installationPhotoCategories).values(data).$returningId();
  return result;
}

export async function updateInstallationPhotoCategory(id: number, data: Partial<InsertInstallationPhotoCategory>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(installationPhotoCategories).set(data).where(eq(installationPhotoCategories.id, id));
}

export async function deleteInstallationPhotoCategory(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [cat] = await db.select().from(installationPhotoCategories).where(eq(installationPhotoCategories.id, id));
  if (!cat) throw new Error("Category not found");
  if (cat.key === 'other') throw new Error("Cannot delete the 'other' category");
  await db.delete(installationPhotoCategories).where(eq(installationPhotoCategories.id, id));
  return cat;
}

export async function reorderInstallationPhotoCategories(items: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  for (const item of items) {
    await db.update(installationPhotoCategories).set({ sortOrder: item.sortOrder }).where(eq(installationPhotoCategories.id, item.id));
  }
}

export async function bulkDeleteInstallationPhotoCategories(ids: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const cats = await db.select().from(installationPhotoCategories).where(inArray(installationPhotoCategories.id, ids));
  const safeIds = cats.filter(c => c.key !== 'other').map(c => c.id);
  if (safeIds.length === 0) return { deleted: 0 };
  await db.delete(installationPhotoCategories).where(inArray(installationPhotoCategories.id, safeIds));
  return { deleted: safeIds.length };
}

// ==================== Installation Photos ====================

export async function getInstallationPhotos(surveyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(installationPhotos).where(eq(installationPhotos.surveyId, surveyId)).orderBy(asc(installationPhotos.createdAt));
}

export async function createInstallationPhoto(data: InsertInstallationPhoto) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(installationPhotos).values(data).$returningId();
  return result;
}

export async function deleteInstallationPhoto(photoId: number) {
  const db = await getDb();
  if (!db) return null;
  const [photo] = await db.select().from(installationPhotos).where(eq(installationPhotos.id, photoId));
  if (!photo) return null;
  await db.delete(installationPhotos).where(eq(installationPhotos.id, photoId));
  return photo;
}

// ==================== Delivery Submission ====================

export async function submitDelivery(surveyId: number, userId: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = Date.now();
  await db.update(surveys).set({
    deliveryStatus: "submitted",
    deliverySubmittedAt: now,
    deliverySubmittedBy: userId,
  }).where(eq(surveys.id, surveyId));
  return { surveyId, deliveryStatus: "submitted", deliverySubmittedAt: now };
}

export async function approveDelivery(surveyId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = Date.now();
  await db.update(surveys).set({
    deliveryStatus: "approved",
    deliveryApprovedAt: now,
    deliveryApprovedBy: userId,
    completedAt: now,
  }).where(eq(surveys.id, surveyId));
  return { surveyId, deliveryStatus: "approved", deliveryApprovedAt: now };
}

export async function rejectDelivery(surveyId: number, userId: number, reason?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(surveys).set({
    deliveryStatus: "rejected",
    deliveryRejectionReason: reason || null,
  }).where(eq(surveys.id, surveyId));
  return { surveyId, deliveryStatus: "rejected" };
}

export async function getDeliveryInfo(surveyId: number) {
  const db = await getDb();
  if (!db) return null;
  const [survey] = await db.select({
    id: surveys.id,
    deliveryStatus: surveys.deliveryStatus,
    deliverySubmittedAt: surveys.deliverySubmittedAt,
    deliverySubmittedBy: surveys.deliverySubmittedBy,
    deliveryApprovedAt: surveys.deliveryApprovedAt,
    deliveryApprovedBy: surveys.deliveryApprovedBy,
    deliveryRejectionReason: surveys.deliveryRejectionReason,
    completedAt: surveys.completedAt,
  }).from(surveys).where(eq(surveys.id, surveyId));
  return survey || null;
}

// ==================== INSTALLER TEAMS ====================
export async function getInstallerTeams(onlyActive = false) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (onlyActive) conditions.push(eq(installerTeams.isActive, true));
  const rows = conditions.length > 0
    ? await db.select().from(installerTeams).where(and(...conditions)).orderBy(asc(installerTeams.name))
    : await db.select().from(installerTeams).orderBy(asc(installerTeams.name));
  return rows;
}

export async function createInstallerTeam(data: InsertInstallerTeam) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(installerTeams).values(data).$returningId();
  return { id: result.id };
}

export async function updateInstallerTeam(id: number, data: Partial<InsertInstallerTeam>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(installerTeams).set(data).where(eq(installerTeams.id, id));
  return { id };
}

export async function deleteInstallerTeam(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(installerTeams).where(eq(installerTeams.id, id));
  return { id };
}

export async function getInstallerTeamById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [team] = await db.select().from(installerTeams).where(eq(installerTeams.id, id));
  return team || null;
}

// ==================== INSTALLER TEAM REPORT ====================
export async function getInstallerTeamReport(opts?: { month?: number; year?: number }) {
  const db = await getDb();
  if (!db) return [];

  // Get all teams
  const teams = await db.select().from(installerTeams).orderBy(installerTeams.name);

  // Get all surveys that have installationDate (i.e. assigned to installation)
  const allSurveys = await db
    .select({
      id: surveys.id,
      installerTeamId: surveys.installerTeamId,
      installationStatus: surveys.installationStatus,
      installationDate: surveys.installationDate,
      deliveryStatus: surveys.deliveryStatus,
      systemSize: surveys.systemSize,
    })
    .from(surveys)
    .where(isNotNull(surveys.installationDate));

  // Filter by month/year if provided (use UTC+7 Thailand timezone)
  const filtered = allSurveys.filter((s) => {
    if (!s.installationDate) return false;
    if (opts?.month !== undefined && opts?.year !== undefined) {
      // Convert to Thailand time by adding 7 hours offset
      const d = new Date(s.installationDate + 7 * 60 * 60 * 1000);
      return d.getUTCMonth() + 1 === opts.month && d.getUTCFullYear() === opts.year;
    }
    if (opts?.year !== undefined) {
      const d = new Date(s.installationDate + 7 * 60 * 60 * 1000);
      return d.getUTCFullYear() === opts.year;
    }
    return true;
  });

  // Build report per team
  const report = teams.map((team) => {
    const teamSurveys = filtered.filter((s) => s.installerTeamId === team.id);
    const waiting = teamSurveys.filter((s) => s.installationStatus === "waiting").length;
    const inProgress = teamSurveys.filter((s) => s.installationStatus === "in_progress").length;
    const completed = teamSurveys.filter((s) => s.installationStatus === "completed" || s.installationStatus === "delivered").length;
    const deliveryPending = teamSurveys.filter((s) => s.deliveryStatus === "pending").length;
    const deliverySubmitted = teamSurveys.filter((s) => s.deliveryStatus === "submitted").length;
    const deliveryApproved = teamSurveys.filter((s) => s.deliveryStatus === "approved").length;
    const deliveryRejected = teamSurveys.filter((s) => s.deliveryStatus === "rejected").length;
    const totalKw = teamSurveys.reduce((sum, s) => sum + (s.systemSize ? Number(s.systemSize) : 0), 0);

    return {
      teamId: team.id,
      teamName: team.name,
      teamColor: team.color,
      phone: team.phone,
      isActive: team.isActive,
      totalJobs: teamSurveys.length,
      waiting,
      inProgress,
      completed,
      deliveryPending,
      deliverySubmitted,
      deliveryApproved,
      deliveryRejected,
      totalKw: Math.round(totalKw * 100) / 100,
    };
  });

  // Also add "unassigned" row
  const unassigned = filtered.filter((s) => !s.installerTeamId);
  if (unassigned.length > 0) {
    const waiting = unassigned.filter((s) => s.installationStatus === "waiting").length;
    const inProgress = unassigned.filter((s) => s.installationStatus === "in_progress").length;
    const completed = unassigned.filter((s) => s.installationStatus === "completed" || s.installationStatus === "delivered").length;
    const deliveryPending = unassigned.filter((s) => s.deliveryStatus === "pending").length;
    const deliverySubmitted = unassigned.filter((s) => s.deliveryStatus === "submitted").length;
    const deliveryApproved = unassigned.filter((s) => s.deliveryStatus === "approved").length;
    const deliveryRejected = unassigned.filter((s) => s.deliveryStatus === "rejected").length;
    const totalKw = unassigned.reduce((sum, s) => sum + (s.systemSize ? Number(s.systemSize) : 0), 0);

    report.push({
      teamId: 0,
      teamName: "ยังไม่ได้มอบหมาย",
      teamColor: null,
      phone: null,
      isActive: true,
      totalJobs: unassigned.length,
      waiting,
      inProgress,
      completed,
      deliveryPending,
      deliverySubmitted,
      deliveryApproved,
      deliveryRejected,
      totalKw: Math.round(totalKw * 100) / 100,
    });
  }

  return report;
}


// ==================== DELIVERY COMMENTS ====================

export async function addDeliveryComment(data: { surveyId: number; userId: number; message: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(deliveryComments).values(data);
  return result[0].insertId;
}

export async function getDeliveryComments(surveyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({
      id: deliveryComments.id,
      surveyId: deliveryComments.surveyId,
      userId: deliveryComments.userId,
      message: deliveryComments.message,
      createdAt: deliveryComments.createdAt,
      userName: users.name,
    })
    .from(deliveryComments)
    .leftJoin(users, eq(deliveryComments.userId, users.id))
    .where(eq(deliveryComments.surveyId, surveyId))
    .orderBy(desc(deliveryComments.createdAt));
  return rows;
}

export async function deleteDeliveryComment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(deliveryComments).where(eq(deliveryComments.id, id));
}

export async function getDeliveryCommentById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(deliveryComments).where(eq(deliveryComments.id, id));
  return rows[0] || null;
}

// ==================== Gallery ====================

export async function getGalleryAlbums(opts: {
  search?: string;
  teamId?: number;
  deliveryStatus?: string;
  month?: number;
  year?: number;
  page?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return { albums: [], total: 0 };

  const conditions: any[] = [];
  // Only show surveys that have installation photos or are in installation status
  conditions.push(isNotNull(surveys.installationStatus));

  if (opts.search) {
    conditions.push(
      or(
        like(customers.name, `%${opts.search}%`),
        like(customers.phone, `%${opts.search}%`),
        like(customers.address, `%${opts.search}%`)
      )
    );
  }
  if (opts.teamId) {
    conditions.push(eq(surveys.installerTeamId, opts.teamId));
  }
  if (opts.deliveryStatus) {
    conditions.push(eq(surveys.deliveryStatus, opts.deliveryStatus as any));
  }
  if (opts.month && opts.year) {
    // Filter by installationDate (stored as Unix timestamp ms) with UTC+7 Thailand timezone
    conditions.push(sql`MONTH(FROM_UNIXTIME(${surveys.installationDate} / 1000 + 25200)) = ${opts.month}`);
    conditions.push(sql`YEAR(FROM_UNIXTIME(${surveys.installationDate} / 1000 + 25200)) = ${opts.year}`);
  } else if (opts.year) {
    conditions.push(sql`YEAR(FROM_UNIXTIME(${surveys.installationDate} / 1000 + 25200)) = ${opts.year}`);
  }

  const page = opts.page || 1;
  const limit = opts.limit || 20;
  const offset = (page - 1) * limit;

  // Count total
  const [countResult] = await db
    .select({ count: sql<number>`count(distinct ${surveys.id})` })
    .from(surveys)
    .innerJoin(customers, eq(surveys.customerId, customers.id))
    .where(and(...conditions));

  const total = countResult?.count || 0;

  // Get albums — avoid GROUP BY issues with ONLY_FULL_GROUP_BY by using subqueries
  const albumRows = await db
    .select({
      surveyId: surveys.id,
      customerName: customers.name,
      customerPhone: customers.phone,
      customerAddress: customers.address,
      province: customers.province,
      installationDate: surveys.installationDate,
      installationStatus: surveys.installationStatus,
      deliveryStatus: surveys.deliveryStatus,
      installerTeamId: surveys.installerTeamId,
      photoCount: sql<number>`(SELECT COUNT(*) FROM installation_photos WHERE installation_photos.surveyId = ${surveys.id})`,
      latestPhotoAt: sql<number>`(SELECT MAX(UNIX_TIMESTAMP(installation_photos.createdAt)) * 1000 FROM installation_photos WHERE installation_photos.surveyId = ${surveys.id})`,
    })
    .from(surveys)
    .innerJoin(customers, eq(surveys.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(
      desc(sql`(SELECT MAX(UNIX_TIMESTAMP(installation_photos.createdAt)) FROM installation_photos WHERE installation_photos.surveyId = ${surveys.id})`),
      desc(surveys.installationDate)
    )
    .limit(limit)
    .offset(offset);

  // Get cover photos (first photo of each album)
  const surveyIds = albumRows.map(a => a.surveyId);
  let coverMap: Record<number, string> = {};
  if (surveyIds.length > 0) {
    const covers = await db
      .select({
        surveyId: installationPhotos.surveyId,
        url: installationPhotos.url,
        id: installationPhotos.id,
      })
      .from(installationPhotos)
      .where(inArray(installationPhotos.surveyId, surveyIds))
      .orderBy(asc(installationPhotos.createdAt));
    
    for (const c of covers) {
      if (!coverMap[c.surveyId]) {
        coverMap[c.surveyId] = c.url;
      }
    }
  }

  // Get team names
  let teamMap: Record<number, { name: string; color: string | null }> = {};
  const teamIds = Array.from(new Set(albumRows.map(a => a.installerTeamId).filter((id): id is number => id !== null && id !== undefined)));
  if (teamIds.length > 0) {
    const teams = await db
      .select({ id: installerTeams.id, name: installerTeams.name, color: installerTeams.color })
      .from(installerTeams)
      .where(inArray(installerTeams.id, teamIds));
    for (const t of teams) {
      teamMap[t.id] = { name: t.name, color: t.color };
    }
  }

  const albums = albumRows.map(a => ({
    surveyId: a.surveyId,
    customerName: a.customerName,
    customerPhone: a.customerPhone,
    customerAddress: a.customerAddress,
    province: a.province,
    installationDate: a.installationDate,
    installationStatus: a.installationStatus,
    deliveryStatus: a.deliveryStatus,
    installerTeamId: a.installerTeamId,
    teamName: a.installerTeamId ? teamMap[a.installerTeamId]?.name || null : null,
    teamColor: a.installerTeamId ? teamMap[a.installerTeamId]?.color || null : null,
    photoCount: Number(a.photoCount) || 0,
    latestPhotoAt: a.latestPhotoAt ? Number(a.latestPhotoAt) : null,
    coverUrl: coverMap[a.surveyId] || null,
  }));

  return { albums, total };
}

export async function getGalleryAllPhotos(opts: {
  search?: string;
  teamId?: number;
  deliveryStatus?: string;
  category?: string;
  month?: number;
  year?: number;
  page?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return { photos: [], total: 0 };

  const conditions: any[] = [];

  if (opts.search) {
    conditions.push(
      or(
        like(customers.name, `%${opts.search}%`),
        like(customers.phone, `%${opts.search}%`)
      )
    );
  }
  if (opts.teamId) {
    conditions.push(eq(surveys.installerTeamId, opts.teamId));
  }
  if (opts.deliveryStatus) {
    conditions.push(eq(surveys.deliveryStatus, opts.deliveryStatus as any));
  }
  if (opts.category) {
    conditions.push(eq(installationPhotos.category, opts.category));
  }
  if (opts.month && opts.year) {
    conditions.push(sql`MONTH(FROM_UNIXTIME(${surveys.installationDate} / 1000 + 25200)) = ${opts.month}`);
    conditions.push(sql`YEAR(FROM_UNIXTIME(${surveys.installationDate} / 1000 + 25200)) = ${opts.year}`);
  } else if (opts.year) {
    conditions.push(sql`YEAR(FROM_UNIXTIME(${surveys.installationDate} / 1000 + 25200)) = ${opts.year}`);
  }

  const page = opts.page || 1;
  const limit = opts.limit || 40;
  const offset = (page - 1) * limit;

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(${installationPhotos.id})` })
    .from(installationPhotos)
    .innerJoin(surveys, eq(installationPhotos.surveyId, surveys.id))
    .innerJoin(customers, eq(surveys.customerId, customers.id))
    .where(whereClause);

  const total = countResult?.count || 0;

  const photos = await db
    .select({
      id: installationPhotos.id,
      surveyId: installationPhotos.surveyId,
      url: installationPhotos.url,
      fileKey: installationPhotos.fileKey,
      fileName: installationPhotos.fileName,
      category: installationPhotos.category,
      fileSize: installationPhotos.fileSize,
      caption: installationPhotos.caption,
      createdAt: installationPhotos.createdAt,
      customerName: customers.name,
      customerPhone: customers.phone,
      province: customers.province,
      deliveryStatus: surveys.deliveryStatus,
      installerTeamId: surveys.installerTeamId,
    })
    .from(installationPhotos)
    .innerJoin(surveys, eq(installationPhotos.surveyId, surveys.id))
    .innerJoin(customers, eq(surveys.customerId, customers.id))
    .where(whereClause)
    .orderBy(desc(installationPhotos.createdAt))
    .limit(limit)
    .offset(offset);

  // Get team names
  const teamIds = Array.from(new Set(photos.map(p => p.installerTeamId).filter((id): id is number => id !== null && id !== undefined)));
  let teamMap: Record<number, string> = {};
  if (teamIds.length > 0) {
    const teams = await db
      .select({ id: installerTeams.id, name: installerTeams.name })
      .from(installerTeams)
      .where(inArray(installerTeams.id, teamIds));
    for (const t of teams) {
      teamMap[t.id] = t.name;
    }
  }

  return {
    photos: photos.map(p => ({
      ...p,
      teamName: p.installerTeamId ? teamMap[p.installerTeamId] || null : null,
    })),
    total,
  };
}

export async function getAlbumPhotosForZip(surveyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: installationPhotos.id,
      url: installationPhotos.url,
      fileKey: installationPhotos.fileKey,
      fileName: installationPhotos.fileName,
      category: installationPhotos.category,
    })
    .from(installationPhotos)
    .where(eq(installationPhotos.surveyId, surveyId))
    .orderBy(asc(installationPhotos.category), asc(installationPhotos.createdAt));
}

// ==================== LINE GROUPS ====================
export async function getLineGroups() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(lineGroups).orderBy(desc(lineGroups.joinedAt));
}

export async function upsertLineGroup(groupId: string, groupName?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(lineGroups).values({ groupId, groupName: groupName || null }).onDuplicateKeyUpdate({
    set: { groupName: groupName || sql`groupName`, isActive: true },
  });
}

export async function deleteLineGroup(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(lineGroups).where(eq(lineGroups.id, id));
}

// ==================== LINE NOTIFICATION TARGETS ====================
export async function getLineNotificationTargets() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(lineNotificationTargets).orderBy(asc(lineNotificationTargets.id));
}

export async function addLineNotificationTarget(data: InsertLineNotificationTarget) {
  const db = await getDb();
  if (!db) return;
  await db.insert(lineNotificationTargets).values(data);
}

export async function updateLineNotificationTarget(id: number, data: Partial<InsertLineNotificationTarget>) {
  const db = await getDb();
  if (!db) return;
  await db.update(lineNotificationTargets).set(data).where(eq(lineNotificationTargets.id, id));
}

export async function deleteLineNotificationTarget(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(lineNotificationTargets).where(eq(lineNotificationTargets.id, id));
}

// ==================== DUPLICATE CUSTOMER DETECTION ====================

/**
 * Normalize phone: strip dashes, spaces, dots
 */
function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\.]/g, "");
}

/**
 * Check if a phone number already exists in the customers table.
 * Returns the matching customer(s) if found.
 * @param phone - The phone number to check
 * @param excludeId - Optional customer ID to exclude (for edit mode)
 */
export async function checkDuplicateByPhone(phone: string, excludeId?: number) {
  const db = await getDb();
  if (!db) return [];
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 3) return [];

  // Search for phone numbers that match after normalization
  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
    })
    .from(customers)
    .where(
      sql`REPLACE(REPLACE(REPLACE(${customers.phone}, '-', ''), ' ', ''), '.', '') = ${normalized}`
    );

  // Exclude the current customer if editing
  if (excludeId) {
    return rows.filter((r) => r.id !== excludeId);
  }
  return rows;
}

/**
 * Check multiple phone numbers for duplicates in batch.
 * Returns a map of phone -> matching customers.
 */
export async function checkDuplicatePhones(phones: string[]) {
  const db = await getDb();
  if (!db) return new Map<string, { id: number; name: string; phone: string | null }[]>();

  const result = new Map<string, { id: number; name: string; phone: string | null }[]>();
  const normalizedPhones = phones
    .map((p) => ({ original: p, normalized: normalizePhone(p) }))
    .filter((p) => p.normalized.length >= 3);

  if (normalizedPhones.length === 0) return result;

  // Get all customers with phones
  const allCustomersWithPhone = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
    })
    .from(customers)
    .where(isNotNull(customers.phone));

  // Build a map of normalized phone -> customer rows
  const existingMap = new Map<string, { id: number; name: string; phone: string | null }[]>();
  for (const c of allCustomersWithPhone) {
    if (!c.phone) continue;
    const norm = normalizePhone(c.phone);
    if (!existingMap.has(norm)) existingMap.set(norm, []);
    existingMap.get(norm)!.push(c);
  }

  // Check each input phone
  for (const { original, normalized } of normalizedPhones) {
    const matches = existingMap.get(normalized);
    if (matches && matches.length > 0) {
      result.set(original, matches);
    }
  }

  return result;
}
