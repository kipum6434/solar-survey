import { eq, and, or, like, desc, gte, lte, sql, inArray, not, asc, isNotNull, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, customers, InsertCustomer, surveys, InsertSurvey, surveyPhotos, InsertSurveyPhoto, surveyDocuments, InsertSurveyDocument, followUps, InsertFollowUp, shareLinks, InsertShareLink, notifications, InsertNotification, activityLog, InsertActivityLog, sources, InsertSource, surveyAssignments, InsertSurveyAssignment, teamMembers, InsertTeamMember, customStatuses, InsertCustomStatus, photoCategories, InsertPhotoCategory, documentCategories, InsertDocumentCategory, installationPhotos, InsertInstallationPhoto, installationPhotoCategories, InsertInstallationPhotoCategory, installerTeams, InsertInstallerTeam, deliveryComments, InsertDeliveryComment, lineGroups, InsertLineGroup, lineNotificationTargets, InsertLineNotificationTarget, companySettings, InsertCompanySettings, postponeCancelLogs, InsertPostponeCancelLog, deliveryForms, InsertDeliveryForm, deliveryChecklistTemplates, InsertDeliveryChecklistTemplate, payments, InsertPayment, sourceGroups, InsertSourceGroup, surveyTemplates, InsertSurveyTemplate, surveyTemplateFields, InsertSurveyTemplateField, surveyTemplateData, InsertSurveyTemplateData, paymentCollections, InsertPaymentCollection, technicalFieldDefinitions, InsertTechnicalFieldDefinition, surveyTechnicalValues, InsertSurveyTechnicalValue, documentSettings, InsertDocumentSetting } from "../drizzle/schema";
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
export async function getCustomers(opts: { search?: string; page?: number; limit?: number; month?: number; year?: number; district?: string; province?: string; source?: string; sourceGroup?: string; surveyStatus?: string; scopedCustomerIds?: number[] }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const { search, page = 1, limit = 20, month, year, district, province, source, sourceGroup, surveyStatus, scopedCustomerIds } = opts;
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
  if (sourceGroup) {
    // Dynamic: get source names belonging to this group from the sources table
    const groupSources = await getSourceNamesByGroupName(sourceGroup);
    if (groupSources.length > 0) {
      conditions.push(inArray(customers.source, groupSources));
    } else {
      // No sources in this group - return empty
      conditions.push(sql`1=0`);
    }
  }
  if (month && year) {
    conditions.push(sql`MONTH(${customers.createdAt}) = ${month}`);
    conditions.push(sql`YEAR(${customers.createdAt}) = ${year}`);
  } else if (year) {
    conditions.push(sql`YEAR(${customers.createdAt}) = ${year}`);
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const data = await db.select({
    id: customers.id,
    name: customers.name,
    phone: customers.phone,
    email: customers.email,
    address: customers.address,
    province: customers.province,
    district: customers.district,
    subDistrict: customers.subDistrict,
    postalCode: customers.postalCode,
    latitude: customers.latitude,
    longitude: customers.longitude,
    source: customers.source,
    electricityBill: customers.electricityBill,
    roofType: customers.roofType,
    roofArea: customers.roofArea,
    phaseType: customers.phaseType,
    meterSize: customers.meterSize,
    fullAddress: customers.fullAddress,
    statusId: customers.statusId,
    facebookName: customers.facebookName,
    notes: customers.notes,
    surveyorId: customers.surveyorId,
    surveyorName: teamMembers.name,
    createdBy: customers.createdBy,
    createdAt: customers.createdAt,
    updatedAt: customers.updatedAt,
  }).from(customers).leftJoin(teamMembers, eq(customers.surveyorId, teamMembers.id)).where(whereClause).orderBy(desc(customers.createdAt), desc(customers.id)).limit(limit).offset(offset);
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

async function buildPerformanceResult(db: any, surveyData: any[], surveyIds: number[], tab: "lead" | "commission") {
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

  // Build survey status map
  const surveyStatusMap: Record<number, { status: string; installationStatus: string | null }> = {};
  for (const s of surveyData) {
    surveyStatusMap[s.surveyId] = { status: s.status, installationStatus: s.installationStatus };
  }

  const isWon = (surveyId: number) => {
    const info = surveyStatusMap[surveyId];
    return info?.status === "won" || info?.installationStatus === "completed" || info?.installationStatus === "delivered";
  };
  const isSurveyed = (surveyId: number) => {
    const info = surveyStatusMap[surveyId];
    const st = info?.status;
    return st === "surveyed" || st === "follow_up" || st === "quoted" || st === "negotiating" || st === "won";
  };

  type MemberPerf = { name: string; assignedCount: number; totalCases: number; surveyedCount: number; wonCount: number; closeRate: number };
  const adminSenderMap: Record<number, MemberPerf> = {};
  const surveyorMap: Record<number, MemberPerf> = {};
  const surveysWithSurveyor = new Set<number>();

  for (const a of assignments) {
    const name = a.teamMemberName ?? a.fallbackUserName ?? `ID:${a.userId}`;
    if (a.role === "admin_sender") {
      if (!adminSenderMap[a.userId]) {
        adminSenderMap[a.userId] = { name, assignedCount: 0, totalCases: 0, surveyedCount: 0, wonCount: 0, closeRate: 0 };
      }
      adminSenderMap[a.userId].totalCases++;
      adminSenderMap[a.userId].assignedCount++;
      if (isSurveyed(a.surveyId)) adminSenderMap[a.userId].surveyedCount++;
      if (isWon(a.surveyId)) adminSenderMap[a.userId].wonCount++;
    } else if (a.role === "surveyor") {
      surveysWithSurveyor.add(a.surveyId);
      if (!surveyorMap[a.userId]) {
        surveyorMap[a.userId] = { name, assignedCount: 0, totalCases: 0, surveyedCount: 0, wonCount: 0, closeRate: 0 };
      }
      surveyorMap[a.userId].assignedCount++;
      surveyorMap[a.userId].totalCases++;
      if (isSurveyed(a.surveyId)) surveyorMap[a.userId].surveyedCount++;
      if (isWon(a.surveyId)) surveyorMap[a.userId].wonCount++;
    }
  }

  // Count surveys without surveyor assignment
  const unassignedSurveys = surveyIds.filter(id => !surveysWithSurveyor.has(id));
  if (unassignedSurveys.length > 0) {
    const unassignedPerf: MemberPerf = { name: "ยังไม่ได้มอบหมาย", assignedCount: unassignedSurveys.length, totalCases: unassignedSurveys.length, surveyedCount: 0, wonCount: 0, closeRate: 0 };
    for (const sid of unassignedSurveys) {
      if (isSurveyed(sid)) unassignedPerf.surveyedCount++;
      if (isWon(sid)) unassignedPerf.wonCount++;
    }
    surveyorMap[0] = unassignedPerf;
  }

  const calcRate = (map: Record<number, MemberPerf>) => {
    return Object.entries(map).map(([id, stats]) => ({
      teamMemberId: Number(id),
      ...stats,
      closeRate: tab === "lead"
        ? (stats.surveyedCount > 0 ? Math.round((stats.wonCount / stats.surveyedCount) * 100) : 0)
        : 100,
    })).sort((a, b) => b.totalCases - a.totalCases);
  };

  const totalCases = surveyData.length;
  const totalSurveyed = surveyData.filter((s: any) => isSurveyed(s.surveyId)).length;
  const totalWon = surveyData.filter((s: any) => isWon(s.surveyId)).length;
  const closeRate = tab === "lead"
    ? (totalSurveyed > 0 ? Math.round((totalWon / totalSurveyed) * 100) : 0)
    : 100;

  return {
    adminSenders: calcRate(adminSenderMap),
    surveyors: calcRate(surveyorMap),
    totals: { totalCases, totalSurveyed, totalWon, closeRate },
  };
}

export async function getTeamPerformance(opts: { month?: number; year?: number; tab?: "lead" | "commission" }) {
  const db = await getDb();
  const emptyResult = { adminSenders: [], surveyors: [], totals: { totalCases: 0, totalSurveyed: 0, totalWon: 0, closeRate: 0 } };
  if (!db) return emptyResult;
  const { month, year, tab = "lead" } = opts;

  // Tab 1 (lead): filter by dispatch date (survey_assignments.createdAt for admin_sender role)
  // Tab 2 (commission): filter by installationCompletedAt month (only completed/delivered surveys)
  if (tab === "commission") {
    // Only surveys with installationCompletedAt in the selected period
    const conditions: any[] = [isNotNull(surveys.installationCompletedAt)];
    if (month && year) {
      const startOfMonth = new Date(year, month - 1, 1).getTime();
      const endOfMonth = new Date(year, month, 1).getTime();
      conditions.push(gte(surveys.installationCompletedAt, startOfMonth));
      conditions.push(lte(surveys.installationCompletedAt, endOfMonth));
    } else if (year) {
      const startOfYear = new Date(year, 0, 1).getTime();
      const endOfYear = new Date(year + 1, 0, 1).getTime();
      conditions.push(gte(surveys.installationCompletedAt, startOfYear));
      conditions.push(lte(surveys.installationCompletedAt, endOfYear));
    }
    const whereClause = and(...conditions);
    const surveyData = await db.select({ surveyId: surveys.id, createdAt: surveys.createdAt, status: surveys.status, installationStatus: surveys.installationStatus, installationCompletedAt: surveys.installationCompletedAt }).from(surveys).where(whereClause!);
    const surveyIds = surveyData.map(s => s.surveyId);
    if (surveyIds.length === 0) return emptyResult;
    return buildPerformanceResult(db, surveyData, surveyIds, tab);
  }

  // Tab 1 (lead): filter by dispatch date = survey_assignments.createdAt (when admin sent the survey)
  // This means we first find which surveys were dispatched in the selected month,
  // then calculate performance for those surveys
  let dispatchConditions: any[] = [];
  if (month && year) {
    dispatchConditions.push(sql`MONTH(${surveyAssignments.createdAt}) = ${month}`);
    dispatchConditions.push(sql`YEAR(${surveyAssignments.createdAt}) = ${year}`);
  } else if (year) {
    dispatchConditions.push(sql`YEAR(${surveyAssignments.createdAt}) = ${year}`);
  }
  // Get unique survey IDs that were dispatched (assigned) in the selected period
  const dispatchWhere = dispatchConditions.length > 0 ? and(...dispatchConditions) : undefined;
  const dispatchedAssignments = dispatchWhere
    ? await db.selectDistinct({ surveyId: surveyAssignments.surveyId }).from(surveyAssignments).where(dispatchWhere)
    : await db.selectDistinct({ surveyId: surveyAssignments.surveyId }).from(surveyAssignments);
  const dispatchedSurveyIds = dispatchedAssignments.map(a => a.surveyId);
  if (dispatchedSurveyIds.length === 0) return emptyResult;

  // Now get the survey data for those dispatched surveys
  const surveyData = await db.select({ surveyId: surveys.id, createdAt: surveys.createdAt, status: surveys.status, installationStatus: surveys.installationStatus, installationCompletedAt: surveys.installationCompletedAt }).from(surveys).where(inArray(surveys.id, dispatchedSurveyIds));
  const surveyIds = surveyData.map(s => s.surveyId);
  if (surveyIds.length === 0) return emptyResult;

  return buildPerformanceResult(db, surveyData, surveyIds, tab);
}

export async function getCustomerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select({
    id: customers.id, name: customers.name, phone: customers.phone, email: customers.email,
    address: customers.address, province: customers.province, district: customers.district,
    subDistrict: customers.subDistrict, postalCode: customers.postalCode,
    latitude: customers.latitude, longitude: customers.longitude, source: customers.source,
    electricityBill: customers.electricityBill, roofType: customers.roofType, roofArea: customers.roofArea,
    phaseType: customers.phaseType, meterSize: customers.meterSize, fullAddress: customers.fullAddress,
    statusId: customers.statusId, facebookName: customers.facebookName, notes: customers.notes,
    surveyorId: customers.surveyorId, surveyorName: teamMembers.name,
    createdBy: customers.createdBy, createdAt: customers.createdAt, updatedAt: customers.updatedAt,
  }).from(customers).leftJoin(teamMembers, eq(customers.surveyorId, teamMembers.id)).where(eq(customers.id, id)).limit(1);
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
  return db.select().from(surveyPhotos).where(eq(surveyPhotos.surveyId, surveyId)).orderBy(asc(surveyPhotos.sortOrder), asc(surveyPhotos.id));
}

export async function createSurveyPhoto(data: InsertSurveyPhoto) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Auto-set sortOrder to be after existing photos in same survey+category
  if (data.sortOrder === undefined || data.sortOrder === null) {
    const existing = await db.select({ cnt: sql<number>`count(*)` })
      .from(surveyPhotos)
      .where(and(
        eq(surveyPhotos.surveyId, data.surveyId),
        eq(surveyPhotos.category, data.category || "other")
      ));
    data.sortOrder = existing[0]?.cnt ?? 0;
  }
  const result = await db.insert(surveyPhotos).values(data);
  return result[0].insertId;
}

export async function updatePhotoCaption(id: number, caption: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(surveyPhotos).set({ caption }).where(eq(surveyPhotos.id, id));
}

export async function deleteSurveyPhoto(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(surveyPhotos).where(eq(surveyPhotos.id, id));
}

export async function reorderSurveyPhotos(items: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  for (const item of items) {
    await db.update(surveyPhotos).set({ sortOrder: item.sortOrder }).where(eq(surveyPhotos.id, item.id));
  }
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

export async function getSurveysForFollowUp(opts: { search?: string; startDate?: number; endDate?: number; page?: number; limit?: number; sourceGroup?: string; assigneeId?: number; statusFilter?: string }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 50;
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
  if (opts.sourceGroup) {
    const groupSources = await getSourceNamesByGroupName(opts.sourceGroup);
    if (groupSources.length > 0) {
      conditions.push(inArray(customers.source, groupSources));
    } else {
      conditions.push(sql`1=0`);
    }
  }
  // Filter by assignee (team member)
  if (opts.assigneeId) {
    const assignedSurveyIds = await db.select({ surveyId: surveyAssignments.surveyId })
      .from(surveyAssignments)
      .where(eq(surveyAssignments.userId, opts.assigneeId));
    const ids = assignedSurveyIds.map(r => r.surveyId);
    if (ids.length > 0) {
      conditions.push(inArray(surveys.id, ids));
    } else {
      conditions.push(sql`1=0`);
    }
  }
  // Filter by status (single status)
  if (opts.statusFilter && ['follow_up', 'quoted', 'negotiating'].includes(opts.statusFilter)) {
    // Replace the default OR condition with specific status
    conditions[0] = eq(surveys.status, opts.statusFilter as any);
  }
  const whereClause = and(...conditions);

  // Count total
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(surveys)
    .innerJoin(customers, eq(surveys.customerId, customers.id))
    .where(whereClause);
  const total = Number(countResult[0]?.count ?? 0);

  // Count per-status stats (across all pages)
  const statsResult = await db.select({
    status: surveys.status,
    count: sql<number>`count(*)`
  }).from(surveys)
    .innerJoin(customers, eq(surveys.customerId, customers.id))
    .where(whereClause)
    .groupBy(surveys.status);
  const stats = { follow_up: 0, quoted: 0, negotiating: 0 };
  for (const row of statsResult) {
    const s = row.status as keyof typeof stats;
    if (s in stats) stats[s] = Number(row.count);
  }

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
    .orderBy(desc(surveys.updatedAt))
    .limit(limit)
    .offset((page - 1) * limit);

  // Fetch custom status labels for surveys that have statusId
  const statusIds = rows.map(r => r.survey.statusId).filter(Boolean) as number[];
  const customStatusMap: Record<number, { id: number; label: string; color: string; bgColor: string }> = {};
  if (statusIds.length > 0) {
    const csData = await db.select().from(customStatuses).where(inArray(customStatuses.id, statusIds));
    for (const cs of csData) {
      customStatusMap[cs.id] = { id: cs.id, label: cs.label, color: cs.color, bgColor: cs.bgColor };
    }
  }

  // Fetch latest follow-up for each survey + count total rounds
  const surveyIds = rows.map(r => r.survey.id);
  const followUpMap: Record<number, typeof followUps.$inferSelect> = {};
  const followUpCountMap: Record<number, number> = {};
  if (surveyIds.length > 0) {
    const fuRows = await db.select().from(followUps).where(inArray(followUps.surveyId, surveyIds)).orderBy(desc(followUps.dueDate));
    for (const fu of fuRows) {
      if (!followUpMap[fu.surveyId]) followUpMap[fu.surveyId] = fu;
      followUpCountMap[fu.surveyId] = (followUpCountMap[fu.surveyId] || 0) + 1;
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

  return {
    data: rows.map(r => ({
      survey: r.survey,
      customer: r.customer,
      customStatus: r.survey.statusId ? customStatusMap[r.survey.statusId] || null : null,
      latestFollowUp: followUpMap[r.survey.id] || null,
      followUpCount: followUpCountMap[r.survey.id] || 0,
      assignments: assignmentsMap[r.survey.id] || [],
    })),
    total,
    stats,
  };
}

export async function getOverdueFollowUpCount(sourceGroup?: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  // Surveys in follow_up status where updatedAt is older than 2 days
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const conditions: any[] = [
    eq(surveys.status, "follow_up"),
    lte(surveys.updatedAt, twoDaysAgo),
  ];
  if (sourceGroup) {
    const groupSources = await getSourceNamesByGroupName(sourceGroup);
    if (groupSources.length > 0) {
      conditions.push(inArray(customers.source, groupSources));
    } else {
      return 0;
    }
  }
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(surveys)
    .innerJoin(customers, eq(surveys.customerId, customers.id))
    .where(and(...conditions));
  return Number(result[0]?.count ?? 0);
}

export async function getOverdueFollowUpCountPerGroup(): Promise<{ groupSlug: string; count: number }[]> {
  const db = await getDb();
  if (!db) return [];
  const allGroups = await db.select().from(sourceGroups);
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const results: { groupSlug: string; count: number }[] = [];
  for (const group of allGroups) {
    const slug = group.name.toLowerCase().replace(/\s+/g, "-");
    const groupSources = await getSourceNamesByGroupName(group.name);
    if (groupSources.length === 0) {
      results.push({ groupSlug: slug, count: 0 });
      continue;
    }
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(surveys)
      .innerJoin(customers, eq(surveys.customerId, customers.id))
      .where(and(
        eq(surveys.status, "follow_up"),
        lte(surveys.updatedAt, twoDaysAgo),
        inArray(customers.source, groupSources),
      ));
    results.push({ groupSlug: slug, count: Number(result[0]?.count ?? 0) });
  }
  return results;
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
  // Auto-calculate round based on existing follow-ups for this survey
  const existing = await db.select({ maxRound: sql<number>`COALESCE(MAX(${followUps.round}), 0)` })
    .from(followUps)
    .where(eq(followUps.surveyId, data.surveyId));
  const nextRound = (existing[0]?.maxRound || 0) + 1;
  const result = await db.insert(followUps).values({ ...data, round: nextRound });
  return result[0].insertId;
}

export async function updateFollowUp(id: number, data: Partial<InsertFollowUp>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(followUps).set(data).where(eq(followUps.id, id));
}

export async function getLatestFollowUpBySurvey(surveyId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(followUps)
    .where(eq(followUps.surveyId, surveyId))
    .orderBy(desc(followUps.round))
    .limit(1);
  return result[0] || null;
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
export async function getDashboardStats(scopedSurveyIds?: number[], scopedCustomerIds?: number[], month?: number, year?: number) {
  const db = await getDb();
  if (!db) return { totalCustomers: 0, totalSurveys: 0, pendingSurveys: 0, completedSurveys: 0, wonDeals: 0, pendingFollowUps: 0 };
  // If scoped and empty arrays, return zeros
  if (scopedSurveyIds !== undefined && scopedSurveyIds.length === 0) {
    return { totalCustomers: 0, totalSurveys: 0, pendingSurveys: 0, completedSurveys: 0, wonDeals: 0, pendingFollowUps: 0 };
  }

  // Build date range filter if month/year provided
  let dateStart: Date | undefined;
  let dateEnd: Date | undefined;
  if (month !== undefined && year !== undefined) {
    dateStart = new Date(year, month - 1, 1);
    dateEnd = new Date(year, month, 1); // first day of next month
  } else if (year !== undefined) {
    dateStart = new Date(year, 0, 1);
    dateEnd = new Date(year + 1, 0, 1);
  }

  const custConditions: any[] = [];
  if (scopedCustomerIds !== undefined) {
    if (scopedCustomerIds.length === 0) custConditions.push(sql`1=0`);
    else custConditions.push(inArray(customers.id, scopedCustomerIds));
  }
  if (dateStart && dateEnd) {
    custConditions.push(gte(customers.createdAt, dateStart));
    custConditions.push(lte(customers.createdAt, dateEnd));
  }

  const survConditions: any[] = [];
  if (scopedSurveyIds !== undefined) {
    survConditions.push(inArray(surveys.id, scopedSurveyIds));
  }
  if (dateStart && dateEnd) {
    survConditions.push(gte(surveys.createdAt, dateStart));
    survConditions.push(lte(surveys.createdAt, dateEnd));
  }

  const [custCount] = await db.select({ count: sql<number>`count(*)` }).from(customers).where(custConditions.length > 0 ? and(...custConditions) : undefined);
  const [survCount] = await db.select({ count: sql<number>`count(*)` }).from(surveys).where(survConditions.length > 0 ? and(...survConditions) : undefined);
  const [pendCount] = await db.select({ count: sql<number>`count(*)` }).from(surveys).where(and(...(survConditions.length > 0 ? survConditions : [sql`1=1`]), inArray(surveys.status, ["pending", "scheduled"])));
  const [compCount] = await db.select({ count: sql<number>`count(*)` }).from(surveys).where(and(...(survConditions.length > 0 ? survConditions : [sql`1=1`]), eq(surveys.status, "surveyed")));
  const [wonCount] = await db.select({ count: sql<number>`count(*)` }).from(surveys).where(and(...(survConditions.length > 0 ? survConditions : [sql`1=1`]), eq(surveys.status, "won")));
  // Follow-ups: scope by surveyId if scoped
  const fuConditions: any[] = [eq(followUps.status, "pending")];
  if (scopedSurveyIds !== undefined) {
    fuConditions.push(inArray(followUps.surveyId, scopedSurveyIds));
  }
  if (dateStart && dateEnd) {
    fuConditions.push(gte(followUps.createdAt, dateStart));
    fuConditions.push(lte(followUps.createdAt, dateEnd));
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

export async function getDashboardStatsForGroup(sourceGroup: string) {
  const db = await getDb();
  const empty = { totalCustomers: 0, totalSurveys: 0, pendingSurveys: 0, scheduledSurveys: 0, surveyedSurveys: 0, wonDeals: 0, pendingFollowUps: 0, pendingInstall: 0, installedCount: 0, followUpCount: 0, quotedCount: 0, negotiatingCount: 0 };
  if (!db) return empty;
  const groupSources = await getSourceNamesByGroupName(sourceGroup);
  if (groupSources.length === 0) return empty;
  const custRows = await db.select({ id: customers.id }).from(customers).where(inArray(customers.source, groupSources));
  const custIds = custRows.map(r => r.id);
  if (custIds.length === 0) return empty;
  const survRows = await db.select({ id: surveys.id, status: surveys.status }).from(surveys).where(inArray(surveys.customerId, custIds));
  const totalSurveys = survRows.length;
  const pendingSurveys = survRows.filter(s => s.status === 'pending').length;
  const scheduledSurveys = survRows.filter(s => s.status === 'scheduled').length;
  const surveyedSurveys = survRows.filter(s => s.status === 'surveyed').length;
  const wonDeals = survRows.filter(s => s.status === 'won').length;
  const followUpCount = survRows.filter(s => s.status === 'follow_up').length;
  const quotedCount = survRows.filter(s => s.status === 'quoted').length;
  const negotiatingCount = survRows.filter(s => s.status === 'negotiating').length;
  const survIds = survRows.map(s => s.id);
  let pendingFollowUps = 0;
  let pendingInstall = 0;
  let installedCount = 0;
  if (survIds.length > 0) {
    const [fuCount] = await db.select({ count: sql<number>`count(*)` }).from(followUps).where(and(eq(followUps.status, 'pending'), inArray(followUps.surveyId, survIds)));
    pendingFollowUps = fuCount?.count ?? 0;
    // Count installation statuses
    const [piCount] = await db.select({ count: sql<number>`count(*)` }).from(surveys).where(and(inArray(surveys.id, survIds), eq(surveys.installationStatus, 'waiting')));
    pendingInstall = piCount?.count ?? 0;
    const [icCount] = await db.select({ count: sql<number>`count(*)` }).from(surveys).where(and(inArray(surveys.id, survIds), eq(surveys.installationStatus, 'completed')));
    installedCount = icCount?.count ?? 0;
  }
  return {
    totalCustomers: custIds.length,
    totalSurveys,
    pendingSurveys,
    scheduledSurveys,
    surveyedSurveys,
    wonDeals,
    pendingFollowUps,
    pendingInstall,
    installedCount,
    followUpCount,
    quotedCount,
    negotiatingCount,
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

// ==================== INSTALLATION CALENDAR ====================
export async function getInstallationCalendarEvents(startDate: number, endDate: number) {
  const db = await getDb();
  if (!db) return [];
  const results = await db.select({
    survey: surveys,
    customer: customers,
  }).from(surveys)
    .innerJoin(customers, eq(surveys.customerId, customers.id))
    .where(and(
      isNotNull(surveys.installationDate),
      gte(surveys.installationDate, startDate),
      lte(surveys.installationDate, endDate),
      inArray(surveys.installationStatus, ["waiting", "in_progress", "completed", "delivered"])
    ))
    .orderBy(surveys.installationDate);
  return results;
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
  const allSources = await db.select().from(sources).orderBy(desc(sources.usageCount));
  // Count customers per source using a separate query for accuracy
  const countResult = await db.select({
    source: customers.source,
    count: sql<number>`COUNT(*)`,
  }).from(customers).groupBy(customers.source);
  const countMap = new Map(countResult.map(r => [r.source, Number(r.count)]));
  return allSources.map(s => ({
    ...s,
    customerCount: countMap.get(s.name) || 0,
  }));
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

export async function updateSource(id: number, data: { name?: string; category?: string; groupName?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.groupName !== undefined) updateData.groupName = data.groupName;
  if (Object.keys(updateData).length > 0) {
    await db.update(sources).set(updateData).where(eq(sources.id, id));
  }
}

export async function getSourcesWithStats() {
  // Now just delegates to getSources which includes customerCount
  return getSources();
}

export async function getSourceGroups() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(sourceGroups).orderBy(asc(sourceGroups.sortOrder), asc(sourceGroups.id));
  return result.map(r => r.name);
}

export async function createSourceGroup(name: string) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  // Get max sortOrder
  const maxResult = await db.select({ maxSort: sql<number>`COALESCE(MAX(sortOrder), 0)` }).from(sourceGroups);
  const nextSort = (maxResult[0]?.maxSort ?? 0) + 1;
  await db.insert(sourceGroups).values({ name, sortOrder: nextSort });
  return { name, sortOrder: nextSort };
}

export async function deleteSourceGroup(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB not available');
  // Get the group name first
  const group = await db.select().from(sourceGroups).where(eq(sourceGroups.id, id)).limit(1);
  if (!group.length) throw new Error('Group not found');
  // Set sources in this group to NULL
  await db.update(sources).set({ groupName: null }).where(eq(sources.groupName, group[0].name));
  // Delete the group
  await db.delete(sourceGroups).where(eq(sourceGroups.id, id));
  return { success: true };
}

export async function getSourceGroupsFull() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(sourceGroups).orderBy(asc(sourceGroups.sortOrder), asc(sourceGroups.id));
}

// Get all source names belonging to a specific group (case-insensitive match)
export async function getSourceNamesByGroupName(groupName: string): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ name: sources.name }).from(sources).where(
    sql`LOWER(${sources.groupName}) = LOWER(${groupName})`
  );
  return result.map(r => r.name);
}

export async function getCustomersBySourceId(sourceId: number) {
  const db = await getDb();
  if (!db) return [];
  // First get the source name
  const sourceRow = await db.select().from(sources).where(eq(sources.id, sourceId)).limit(1);
  if (!sourceRow.length) return [];
  const sourceName = sourceRow[0].name;
  return db.select({
    id: customers.id,
    name: customers.name,
    phone: customers.phone,
    address: customers.address,
    province: customers.province,
    district: customers.district,
    createdAt: customers.createdAt,
  }).from(customers).where(eq(customers.source, sourceName)).orderBy(desc(customers.createdAt));
}

export async function getSurveysWithCustomer(opts: { status?: string; assignedTo?: number; adminSenderId?: number; closerId?: number; page?: number; limit?: number; search?: string; month?: number; year?: number; source?: string; sourceGroup?: string; district?: string; province?: string; scopedSurveyIds?: number[]; sortBy?: string; sortDirection?: "asc" | "desc"; filterDate?: number; filterDateEnd?: number }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const { status, assignedTo, adminSenderId, closerId, page = 1, limit = 20, search, month, year, source, sourceGroup, district, province, scopedSurveyIds, filterDate, filterDateEnd } = opts;
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
  if (sourceGroup) {
    const groupSources = await getSourceNamesByGroupName(sourceGroup);
    if (groupSources.length > 0) {
      conditions.push(inArray(customers.source, groupSources));
    } else {
      conditions.push(sql`1=0`);
    }
  }
  if (district) conditions.push(eq(customers.district, district));
  if (province) conditions.push(eq(customers.province, province));
  if (filterDate) {
    // Filter by specific date or date range (timestamps in ms, already adjusted for timezone by frontend)
    conditions.push(gte(surveys.scheduledDate, filterDate));
    if (filterDateEnd) {
      conditions.push(lte(surveys.scheduledDate, filterDateEnd));
    } else {
      // Single day: filterDate is start of day, end is +24h
      conditions.push(lte(surveys.scheduledDate, filterDate + 86400000 - 1));
    }
  } else if (month && year) {
    // Filter by scheduledDate (stored as Unix timestamp ms) with UTC+7 Thailand timezone
    conditions.push(sql`MONTH(FROM_UNIXTIME(${surveys.scheduledDate} / 1000 + 25200)) = ${month}`);
    conditions.push(sql`YEAR(FROM_UNIXTIME(${surveys.scheduledDate} / 1000 + 25200)) = ${year}`);
  } else if (year) {
    conditions.push(sql`YEAR(FROM_UNIXTIME(${surveys.scheduledDate} / 1000 + 25200)) = ${year}`);
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Determine sort order based on sortBy/sortDirection params
  const { sortBy, sortDirection } = opts;
  let orderByClauses: any[] = [desc(surveys.createdAt)]; // default
  if (sortBy && sortDirection) {
    const sortDir = sortDirection === "asc" ? asc : desc;
    const sortMap: Record<string, any> = {
      _scheduledDateTime: surveys.scheduledDate,
      _scheduledDate: surveys.scheduledDate,
      _scheduledTime: surveys.scheduledTime,
      _customerName: customers.name,
      _phone: customers.phone,
      _source: customers.source,
      _districtProvince: customers.district,
      _status: surveys.status,
      _installationDate: surveys.installationDate,
      _surveyNotes: surveys.surveyNotes,
      createdAt: surveys.createdAt,
    };
    const sortColumn = sortMap[sortBy];
    if (sortColumn) {
      // When sorting by date, add secondary sort by time (nulls first, then time asc)
      if (sortBy === "_scheduledDate" || sortBy === "_scheduledDateTime") {
        orderByClauses = [
          sortDir(sortColumn),
          // Within same date: null time first (so user sees "not yet scheduled")
          asc(sql`CASE WHEN ${surveys.scheduledTime} IS NULL OR ${surveys.scheduledTime} = '' THEN 0 ELSE 1 END`),
          // Then sort by time ascending
          asc(surveys.scheduledTime),
        ];
      } else {
        orderByClauses = [sortDir(sortColumn)];
      }
    }
  }

  const data = await db.select({
    survey: surveys,
    customer: customers,
    assignedUser: { id: users.id, name: users.name },
  }).from(surveys)
    .innerJoin(customers, eq(surveys.customerId, customers.id))
    .leftJoin(users, eq(surveys.assignedTo, users.id))
    .where(whereClause)
    .orderBy(...orderByClauses)
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
    // Filter by roles JSON array (new multi-role) OR legacy single role column
    return db.select().from(teamMembers).where(
      and(
        eq(teamMembers.isActive, true),
        or(
          sql`JSON_CONTAINS(${teamMembers.roles}, ${JSON.stringify(role)})`,
          eq(teamMembers.role, role as any)
        )
      )
    ).orderBy(teamMembers.name);
  }
  return db.select().from(teamMembers).where(eq(teamMembers.isActive, true)).orderBy(teamMembers.name);
}

export async function getAllTeamMembers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(teamMembers).orderBy(teamMembers.role, teamMembers.name);
}

export async function createTeamMember(data: { name: string; phone?: string; email?: string; role: "admin_sender" | "surveyor" | "closer"; roles?: string[]; linkedUserId?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { roles: rolesArr, ...rest } = data;
  const rolesJson = rolesArr && rolesArr.length > 0 ? JSON.stringify(rolesArr) : JSON.stringify([data.role]);
  const result = await db.insert(teamMembers).values({ ...rest, roles: rolesJson });
  return { id: result[0].insertId, ...data, roles: rolesJson };
}

export async function updateTeamMember(id: number, data: { name?: string; phone?: string; email?: string; role?: "admin_sender" | "surveyor" | "closer"; roles?: string[]; isActive?: boolean; linkedUserId?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { roles: rolesArr, ...rest } = data;
  const updateData: any = { ...rest };
  if (rolesArr !== undefined) {
    updateData.roles = JSON.stringify(rolesArr);
    // Keep legacy role column in sync (use first role)
    if (rolesArr.length > 0) updateData.role = rolesArr[0];
  }
  await db.update(teamMembers).set(updateData).where(eq(teamMembers.id, id));
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
  const { page = 1, limit = 20, search, month, year, startDate, endDate, district, province, installationStatus, surveyorId, closerId, installerTeamId, scopedSurveyIds, sourceGroup } = opts;
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
  if (startDate && endDate) {
    // Date range filter: convert YYYY-MM-DD to timestamps in Asia/Bangkok timezone
    const startTs = new Date(startDate + 'T00:00:00+07:00').getTime();
    const endTs = new Date(endDate + 'T23:59:59.999+07:00').getTime();
    conditions.push(sql`${surveys.installationDate} >= ${startTs}`);
    conditions.push(sql`${surveys.installationDate} <= ${endTs}`);
  } else if (month && year) {
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
  if (sourceGroup) {
    const groupSources = await getSourceNamesByGroupName(sourceGroup);
    if (groupSources.length > 0) {
      conditions.push(inArray(customers.source, groupSources));
    } else {
      conditions.push(sql`1=0`);
    }
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

export async function withdrawDelivery(surveyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Only allow withdraw if current status is 'submitted'
  const [survey] = await db.select({ deliveryStatus: surveys.deliveryStatus }).from(surveys).where(eq(surveys.id, surveyId));
  if (!survey || survey.deliveryStatus !== "submitted") {
    throw new Error("Cannot withdraw: delivery is not in submitted status");
  }
  await db.update(surveys).set({
    deliveryStatus: "pending",
    deliverySubmittedAt: null,
    deliverySubmittedBy: null,
  }).where(eq(surveys.id, surveyId));
  return { surveyId, deliveryStatus: "pending" };
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


// ==================== COMPANY SETTINGS ====================
export async function getCompanySettings() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(companySettings).limit(1);
  return rows[0] || null;
}

export async function updateCompanySettings(data: Partial<InsertCompanySettings>) {
  const db = await getDb();
  if (!db) return null;
  const existing = await getCompanySettings();
  if (existing) {
    await db.update(companySettings).set(data).where(eq(companySettings.id, existing.id));
    return { ...existing, ...data };
  } else {
    const result = await db.insert(companySettings).values(data as any);
    return { id: Number((result as any)[0].insertId), ...data };
  }
}

// ==================== PENDING APPROVALS ====================
export async function getPendingApprovals(opts: {
  page?: number;
  limit?: number;
  search?: string;
  month?: number;
  year?: number;
  installerTeamId?: number;
  deliveryStatus?: string;
}) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const { page = 1, limit = 50, search, month, year, installerTeamId, deliveryStatus: statusFilter } = opts;
  const offset = (page - 1) * limit;

  const conditions: any[] = [];
  if (statusFilter && statusFilter !== "all") {
    conditions.push(eq(surveys.deliveryStatus, statusFilter as any));
  } else {
    conditions.push(eq(surveys.deliveryStatus, "submitted"));
  }

  if (search) {
    conditions.push(or(
      like(customers.name, `%${search}%`),
      like(customers.phone, `%${search}%`)
    ));
  }
  if (month && year) {
    conditions.push(sql`MONTH(FROM_UNIXTIME(${surveys.deliverySubmittedAt} / 1000 + 25200)) = ${month}`);
    conditions.push(sql`YEAR(FROM_UNIXTIME(${surveys.deliverySubmittedAt} / 1000 + 25200)) = ${year}`);
  } else if (year) {
    conditions.push(sql`YEAR(FROM_UNIXTIME(${surveys.deliverySubmittedAt} / 1000 + 25200)) = ${year}`);
  }
  if (installerTeamId) {
    conditions.push(eq(surveys.installerTeamId, installerTeamId));
  }

  const whereClause = and(...conditions);

  const data = await db.select({
    survey: surveys,
    customer: customers,
  }).from(surveys)
    .innerJoin(customers, eq(surveys.customerId, customers.id))
    .where(whereClause)
    .orderBy(desc(surveys.deliverySubmittedAt), desc(surveys.id))
    .limit(limit)
    .offset(offset);

  // Fetch installer teams
  const installerTeamIds = data.map(d => d.survey.installerTeamId).filter(Boolean) as number[];
  let installerTeamMap: Record<number, { id: number; name: string; phone: string | null; color: string | null }> = {};
  if (installerTeamIds.length > 0) {
    const teamData = await db.select().from(installerTeams).where(inArray(installerTeams.id, installerTeamIds));
    for (const t of teamData) {
      installerTeamMap[t.id] = { id: t.id, name: t.name, phone: t.phone, color: t.color ?? null };
    }
  }

  // Fetch assignments
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

  // Get photo counts per survey
  let photoCountMap: Record<number, number> = {};
  if (surveyIds.length > 0) {
    const photoCounts = await db.select({
      surveyId: installationPhotos.surveyId,
      count: sql<number>`count(*)`,
    }).from(installationPhotos)
      .where(inArray(installationPhotos.surveyId, surveyIds))
      .groupBy(installationPhotos.surveyId);
    for (const pc of photoCounts) {
      photoCountMap[pc.surveyId] = pc.count;
    }
  }

  const countQ = await db.select({ count: sql<number>`count(*)` }).from(surveys).innerJoin(customers, eq(surveys.customerId, customers.id)).where(whereClause);

  return {
    data: data.map(d => ({
      ...d,
      installerTeam: d.survey.installerTeamId ? installerTeamMap[d.survey.installerTeamId] || null : null,
      assignments: assignmentsMap[d.survey.id] || [],
      photoCount: photoCountMap[d.survey.id] || 0,
    })),
    total: Number(countQ[0]?.count || 0),
  };
}

export async function getPendingApprovalCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(surveys)
    .where(eq(surveys.deliveryStatus, "submitted"));
  return Number(result[0]?.count || 0);
}

// ==================== POSTPONE / CANCEL LOGS ====================

export async function createPostponeCancelLog(data: InsertPostponeCancelLog) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(postponeCancelLogs).values(data).$returningId();
  return result;
}

export async function getPostponeCancelLogs(surveyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(postponeCancelLogs)
    .where(eq(postponeCancelLogs.surveyId, surveyId))
    .orderBy(desc(postponeCancelLogs.createdAt));
}


// ==================== DELIVERY FORM QUERIES ====================
export async function createDeliveryForm(data: { surveyId: number; customerId: number; checklistData?: string; createdBy?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(deliveryForms).values({
    surveyId: data.surveyId,
    customerId: data.customerId,
    checklistData: data.checklistData || "[]",
    status: "draft",
    createdBy: data.createdBy,
  });
  return { id: Number(result[0].insertId) };
}

export async function getDeliveryFormBySurveyId(surveyId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(deliveryForms).where(eq(deliveryForms.surveyId, surveyId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateDeliveryFormChecklist(id: number, checklistData: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(deliveryForms).set({ checklistData }).where(eq(deliveryForms.id, id));
}

export async function updateDeliveryFormSignature(id: number, data: { customerSignatureUrl?: string; customerSignatureKey?: string; technicianSignatureUrl?: string; technicianSignatureKey?: string; technicianName?: string; signedAt?: number; status?: "draft" | "signed" | "completed" }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: any = {};
  if (data.customerSignatureUrl !== undefined) updateData.customerSignatureUrl = data.customerSignatureUrl;
  if (data.customerSignatureKey !== undefined) updateData.customerSignatureKey = data.customerSignatureKey;
  if (data.technicianSignatureUrl !== undefined) updateData.technicianSignatureUrl = data.technicianSignatureUrl;
  if (data.technicianSignatureKey !== undefined) updateData.technicianSignatureKey = data.technicianSignatureKey;
  if (data.technicianName !== undefined) updateData.technicianName = data.technicianName;
  if (data.signedAt !== undefined) updateData.signedAt = data.signedAt;
  if (data.status !== undefined) updateData.status = data.status;
  await db.update(deliveryForms).set(updateData).where(eq(deliveryForms.id, id));
}

export async function updateDeliveryFormNotes(id: number, notes: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(deliveryForms).set({ notes }).where(eq(deliveryForms.id, id));
}

export async function updateDeliveryFormPdf(id: number, pdfUrl: string, pdfFileKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(deliveryForms).set({ pdfUrl, pdfFileKey }).where(eq(deliveryForms.id, id));
}

// ==================== DELIVERY CHECKLIST TEMPLATE QUERIES ====================
export async function getChecklistTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(deliveryChecklistTemplates).orderBy(asc(deliveryChecklistTemplates.id));
}

export async function getAllChecklistTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(deliveryChecklistTemplates).orderBy(asc(deliveryChecklistTemplates.id));
}

export async function createChecklistTemplate(data: { name: string; items?: string; isDefault?: boolean; createdBy?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(deliveryChecklistTemplates).values({
    name: data.name,
    items: data.items || "[]",
    isDefault: data.isDefault ?? false,
    createdBy: data.createdBy,
  });
  return { id: Number(result[0].insertId) };
}

export async function updateChecklistTemplate(id: number, data: { name?: string; items?: string; isDefault?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.items !== undefined) updateData.items = data.items;
  if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
  await db.update(deliveryChecklistTemplates).set(updateData).where(eq(deliveryChecklistTemplates.id, id));
}

export async function deleteChecklistTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(deliveryChecklistTemplates).where(eq(deliveryChecklistTemplates.id, id));
}

// ==================== PAYMENT QUERIES ====================
export async function createPayment(data: { surveyId: number; customerId: number; amount?: number; paymentMethod?: string; notes?: string; createdBy?: number; contractValue?: number; collectedAmount?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(payments).values({
    surveyId: data.surveyId,
    customerId: data.customerId,
    amount: data.amount != null ? String(data.amount) : undefined,
    paymentMethod: data.paymentMethod,
    notes: data.notes,
    status: "pending",
    createdBy: data.createdBy,
    contractValue: data.contractValue != null ? String(data.contractValue) : undefined,
    collectedAmount: data.collectedAmount != null ? String(data.collectedAmount) : undefined,
  });
  return { id: Number(result[0].insertId) };
}

export async function getPaymentBySurveyId(surveyId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(payments).where(eq(payments.surveyId, surveyId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getWonSurveysWithoutPayment(opts: { source?: string; sourceInclude?: string[] }) {
  const db = await getDb();
  if (!db) return [];
  // Include surveys with status 'won' OR those with installationStatus set (waiting/in_progress/completed/delivered)
  const conditions: any[] = [
    or(
      eq(surveys.status, "won"),
      isNotNull(surveys.installationStatus)
    )!
  ];
  if (opts.source) conditions.push(eq(customers.source, opts.source));
  if (opts.sourceInclude && opts.sourceInclude.length > 0) {
    conditions.push(inArray(customers.source, opts.sourceInclude));
  }
  const result = await db.select({
    id: surveys.id,
    customerId: surveys.customerId,
    customerName: customers.name,
    customerPhone: customers.phone,
    source: customers.source,
    systemSize: surveys.systemSize,
    quotedPrice: surveys.quotedPrice,
    completedAt: surveys.completedAt,
  }).from(surveys)
    .leftJoin(customers, eq(surveys.customerId, customers.id))
    .leftJoin(payments, eq(surveys.id, payments.surveyId))
    .where(and(...conditions, isNull(payments.id)))
    .orderBy(desc(surveys.completedAt));
  return result.map(r => ({
    ...r,
    systemSize: r.systemSize ? parseFloat(r.systemSize) : null,
    quotedPrice: r.quotedPrice ? parseFloat(String(r.quotedPrice)) : null,
  }));
}

export async function getPayments(opts: { status?: string; page?: number; limit?: number; source?: string; sourceExclude?: string[]; sourceInclude?: string[]; dateFrom?: number; dateTo?: number }) {
  const db = await getDb();
  if (!db) return { data: [], total: 0 };
  const { status, page = 1, limit = 20, source, sourceExclude, sourceInclude, dateFrom, dateTo } = opts;
  const offset = (page - 1) * limit;
  const conditions: any[] = [];
  if (status) conditions.push(eq(payments.status, status as any));
  if (source) conditions.push(eq(customers.source, source));
  if (sourceInclude && sourceInclude.length > 0) {
    conditions.push(inArray(customers.source, sourceInclude));
  }
  if (sourceExclude && sourceExclude.length > 0) {
    conditions.push(or(isNull(customers.source), not(inArray(customers.source, sourceExclude))));
  }
  if (dateFrom) {
    conditions.push(gte(payments.createdAt, new Date(dateFrom)));
  }
  if (dateTo) {
    conditions.push(lte(payments.createdAt, new Date(dateTo)));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const rawData = await db.select({
    id: payments.id,
    surveyId: payments.surveyId,
    customerId: payments.customerId,
    customerName: customers.name,
    customerPhone: customers.phone,
    source: customers.source,
    amount: payments.amount,
    paymentDate: payments.paymentDate,
    paymentMethod: payments.paymentMethod,
    slipUrl: payments.slipUrl,
    notes: payments.notes,
    status: payments.status,
    contractValue: payments.contractValue,
    collectedAmount: payments.collectedAmount,
    systemSize: surveys.systemSize,
    installationStatus: surveys.installationStatus,
    createdAt: payments.createdAt,
  }).from(payments)
    .leftJoin(customers, eq(payments.customerId, customers.id))
    .leftJoin(surveys, eq(payments.surveyId, surveys.id))
    .where(whereClause)
    .orderBy(desc(payments.createdAt))
    .limit(limit).offset(offset);

  // Convert decimal strings to numbers for frontend
  const data = rawData.map(row => ({
    ...row,
    amount: row.amount ? parseFloat(row.amount) : 0,
    contractValue: row.contractValue ? parseFloat(row.contractValue) : 0,
    collectedAmount: row.collectedAmount ? parseFloat(row.collectedAmount) : 0,
    systemSize: row.systemSize ? parseFloat(row.systemSize) : null,
  }));
  
  const countQ = whereClause
    ? await db.select({ count: sql<number>`count(*)` }).from(payments).leftJoin(customers, eq(payments.customerId, customers.id)).where(whereClause)
    : await db.select({ count: sql<number>`count(*)` }).from(payments);
  
  return { data, total: countQ[0]?.count ?? 0 };
}

export async function updatePayment(id: number, data: { amount?: number; paymentDate?: number; paymentMethod?: string; slipUrl?: string; slipFileKey?: string; notes?: string; status?: "pending" | "partial" | "paid" | "overdue"; contractValue?: number; collectedAmount?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateData: any = {};
  if (data.amount !== undefined) updateData.amount = data.amount;
  if (data.paymentDate !== undefined) updateData.paymentDate = data.paymentDate;
  if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod;
  if (data.slipUrl !== undefined) updateData.slipUrl = data.slipUrl;
  if (data.slipFileKey !== undefined) updateData.slipFileKey = data.slipFileKey;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.contractValue !== undefined) updateData.contractValue = data.contractValue;
  if (data.collectedAmount !== undefined) updateData.collectedAmount = data.collectedAmount;
  await db.update(payments).set(updateData).where(eq(payments.id, id));
}

// ==================== SURVEY TEMPLATES ====================
export async function getSurveyTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(surveyTemplates).orderBy(desc(surveyTemplates.createdAt));
}
export async function getSurveyTemplateById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(surveyTemplates).where(eq(surveyTemplates.id, id)).limit(1);
  return rows[0] ?? null;
}
export async function getSurveyTemplateBySourceId(sourceId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(surveyTemplates)
    .where(and(eq(surveyTemplates.sourceId, sourceId), eq(surveyTemplates.isActive, true)))
    .limit(1);
  return rows[0] ?? null;
}
export async function createSurveyTemplate(data: InsertSurveyTemplate) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(surveyTemplates).values(data);
  return { id: result[0].insertId };
}
export async function updateSurveyTemplate(id: number, data: Partial<InsertSurveyTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(surveyTemplates).set(data).where(eq(surveyTemplates.id, id));
}
export async function deleteSurveyTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(surveyTemplateFields).where(eq(surveyTemplateFields.templateId, id));
  await db.delete(surveyTemplateData).where(eq(surveyTemplateData.templateId, id));
  await db.delete(surveyTemplates).where(eq(surveyTemplates.id, id));
}
// ==================== SURVEY TEMPLATE FIELDS ====================
export async function getTemplateFields(templateId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(surveyTemplateFields)
    .where(eq(surveyTemplateFields.templateId, templateId))
    .orderBy(asc(surveyTemplateFields.sortOrder));
}
export async function createTemplateField(data: InsertSurveyTemplateField) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(surveyTemplateFields).values(data);
  return { id: result[0].insertId };
}
export async function updateTemplateField(id: number, data: Partial<InsertSurveyTemplateField>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(surveyTemplateFields).set(data).where(eq(surveyTemplateFields.id, id));
}
export async function deleteTemplateField(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(surveyTemplateData).where(eq(surveyTemplateData.fieldId, id));
  await db.delete(surveyTemplateFields).where(eq(surveyTemplateFields.id, id));
}
export async function reorderTemplateFields(templateId: number, fieldIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  for (let i = 0; i < fieldIds.length; i++) {
    await db.update(surveyTemplateFields)
      .set({ sortOrder: i })
      .where(and(eq(surveyTemplateFields.id, fieldIds[i]), eq(surveyTemplateFields.templateId, templateId)));
  }
}
// ==================== SURVEY TEMPLATE DATA (filled values) ====================
export async function getTemplateDataBySurvey(surveyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(surveyTemplateData)
    .where(eq(surveyTemplateData.surveyId, surveyId));
}
export async function saveTemplateData(surveyId: number, templateId: number, entries: { fieldId: number; value: string | null; otherValue: string | null }[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(surveyTemplateData)
    .where(and(eq(surveyTemplateData.surveyId, surveyId), eq(surveyTemplateData.templateId, templateId)));
  if (entries.length > 0) {
    await db.insert(surveyTemplateData).values(
      entries.map(e => ({ surveyId, templateId, fieldId: e.fieldId, value: e.value, otherValue: e.otherValue }))
    );
  }
}

// ==================== PAYMENT COLLECTIONS (งวดเก็บเงิน) ====================
export async function getPaymentCollections(paymentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(paymentCollections)
    .where(eq(paymentCollections.paymentId, paymentId))
    .orderBy(desc(paymentCollections.collectedAt));
}

export async function createPaymentCollection(data: InsertPaymentCollection) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(paymentCollections).values(data);
  // Update collectedAmount on parent payment
  await recalcPaymentCollected(data.paymentId);
  return { insertId: result[0].insertId };
}

export async function deletePaymentCollection(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [coll] = await db.select().from(paymentCollections).where(eq(paymentCollections.id, id)).limit(1);
  if (!coll) throw new Error("Collection not found");
  await db.delete(paymentCollections).where(eq(paymentCollections.id, id));
  await recalcPaymentCollected(coll.paymentId);
}

async function recalcPaymentCollected(paymentId: number) {
  const db = await getDb();
  if (!db) return;
  const [sumResult] = await db.select({
    total: sql<string>`COALESCE(SUM(${paymentCollections.amount}), 0)`,
  }).from(paymentCollections).where(eq(paymentCollections.paymentId, paymentId));
  const totalCollected = parseFloat(sumResult?.total || "0");
  // Get contract value to determine status
  const [payment] = await db.select({ contractValue: payments.contractValue }).from(payments).where(eq(payments.id, paymentId)).limit(1);
  const contractVal = payment?.contractValue ? parseFloat(String(payment.contractValue)) : 0;
  let newStatus: "pending" | "partial" | "paid" = "pending";
  if (totalCollected > 0 && contractVal > 0 && totalCollected >= contractVal) {
    newStatus = "paid";
  } else if (totalCollected > 0) {
    newStatus = "partial";
  }
  await db.update(payments).set({ collectedAmount: String(totalCollected), status: newStatus }).where(eq(payments.id, paymentId));
}


export async function updatePaymentCollection(id: number, data: { slipUrl?: string | null; slipFileKey?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updateData: any = {};
  if (data.slipUrl !== undefined) updateData.slipUrl = data.slipUrl;
  if (data.slipFileKey !== undefined) updateData.slipFileKey = data.slipFileKey;
  if (Object.keys(updateData).length === 0) return;
  await db.update(paymentCollections).set(updateData).where(eq(paymentCollections.id, id));
}

// ==================== CUSTOM TECHNICAL FIELDS ====================

export async function getTechnicalFieldDefinitions(activeOnly = false) {
  const db = await getDb();
  if (!db) return [];
  const conditions = activeOnly ? eq(technicalFieldDefinitions.isActive, true) : undefined;
  return db.select().from(technicalFieldDefinitions).where(conditions).orderBy(asc(technicalFieldDefinitions.sortOrder));
}

export async function createTechnicalFieldDefinition(data: { label: string; fieldType: string; placeholder?: string; options?: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) return null;
  // Get max sortOrder
  const existing = await db.select({ maxOrder: sql<number>`COALESCE(MAX(sortOrder), 0)` }).from(technicalFieldDefinitions);
  const nextOrder = data.sortOrder ?? ((existing[0]?.maxOrder || 0) + 1);
  const result = await db.insert(technicalFieldDefinitions).values({
    label: data.label,
    fieldType: data.fieldType as any,
    placeholder: data.placeholder || null,
    options: data.options || null,
    sortOrder: nextOrder,
    isActive: true,
    isBuiltIn: false,
    fieldKey: null,
  });
  return { id: result[0].insertId };
}

export async function updateTechnicalFieldDefinition(id: number, data: { label?: string; fieldType?: string; placeholder?: string; options?: string; sortOrder?: number; isActive?: boolean }) {
  const db = await getDb();
  if (!db) return;
  const updates: any = {};
  if (data.label !== undefined) updates.label = data.label;
  if (data.fieldType !== undefined) updates.fieldType = data.fieldType;
  if (data.placeholder !== undefined) updates.placeholder = data.placeholder;
  if (data.options !== undefined) updates.options = data.options;
  if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;
  if (data.isActive !== undefined) updates.isActive = data.isActive;
  await db.update(technicalFieldDefinitions).set(updates).where(eq(technicalFieldDefinitions.id, id));
}

export async function deleteTechnicalFieldDefinition(id: number) {
  const db = await getDb();
  if (!db) return;
  // Only allow deleting non-built-in fields
  const field = await db.select().from(technicalFieldDefinitions).where(eq(technicalFieldDefinitions.id, id));
  if (field.length > 0 && field[0].isBuiltIn) {
    throw new Error("Cannot delete built-in field");
  }
  // Delete associated values
  await db.delete(surveyTechnicalValues).where(eq(surveyTechnicalValues.fieldDefinitionId, id));
  await db.delete(technicalFieldDefinitions).where(eq(technicalFieldDefinitions.id, id));
}

export async function reorderTechnicalFields(orderedIds: number[]) {
  const db = await getDb();
  if (!db) return;
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(technicalFieldDefinitions).set({ sortOrder: i + 1 }).where(eq(technicalFieldDefinitions.id, orderedIds[i]));
  }
}

export async function getSurveyTechnicalValues(surveyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(surveyTechnicalValues).where(eq(surveyTechnicalValues.surveyId, surveyId));
}

export async function setSurveyTechnicalValue(surveyId: number, fieldDefinitionId: number, value: string | null) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(surveyTechnicalValues).where(
    and(eq(surveyTechnicalValues.surveyId, surveyId), eq(surveyTechnicalValues.fieldDefinitionId, fieldDefinitionId))
  );
  if (existing.length > 0) {
    await db.update(surveyTechnicalValues).set({ value }).where(eq(surveyTechnicalValues.id, existing[0].id));
  } else {
    await db.insert(surveyTechnicalValues).values({ surveyId, fieldDefinitionId, value });
  }
}

export async function setSurveyTechnicalValues(surveyId: number, values: { fieldDefinitionId: number; value: string | null }[]) {
  const db = await getDb();
  if (!db) return;
  for (const v of values) {
    await setSurveyTechnicalValue(surveyId, v.fieldDefinitionId, v.value);
  }
}

// ==================== CANCELLED CASES QUERIES ====================
export async function getCancelledSurveys(sourceGroup?: string) {
  const db = await getDb();
  if (!db) return [];
  // Build conditions
  const conditions: any[] = [or(eq(surveys.status, "lost"), eq(surveys.status, "cancelled"))];
  if (sourceGroup) {
    const groupSources = await getSourceNamesByGroupName(sourceGroup);
    if (groupSources.length > 0) {
      conditions.push(inArray(customers.source, groupSources));
    } else {
      return [];
    }
  }
  // Get surveys with status 'lost' or 'cancelled'
  const results = await db.select({
    survey: {
      id: surveys.id,
      status: surveys.status,
      systemSize: surveys.systemSize,
      scheduledDate: surveys.scheduledDate,
      createdAt: surveys.createdAt,
      updatedAt: surveys.updatedAt,
    },
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
    .where(and(...conditions))
    .orderBy(desc(surveys.updatedAt));

  if (results.length === 0) return [];

  const surveyIds = results.map(r => r.survey.id);

  // Get cancellation reasons from postpone_cancel_logs
  const logs = await db.select().from(postponeCancelLogs)
    .where(and(
      inArray(postponeCancelLogs.surveyId, surveyIds),
      eq(postponeCancelLogs.action, "cancel_survey")
    ))
    .orderBy(desc(postponeCancelLogs.createdAt));

  // Get closer (salesperson) assignments
  const assignments = await db.select({
    surveyId: surveyAssignments.surveyId,
    userId: surveyAssignments.userId,
    role: surveyAssignments.role,
  }).from(surveyAssignments)
    .where(and(
      inArray(surveyAssignments.surveyId, surveyIds),
      eq(surveyAssignments.role, "closer")
    ));

  // Get team member names for closers
  const closerUserIds = Array.from(new Set(assignments.map(a => a.userId)));
  let closerNames: Record<number, string> = {};
  if (closerUserIds.length > 0) {
    const members = await db.select({ id: teamMembers.id, name: teamMembers.name })
      .from(teamMembers)
      .where(inArray(teamMembers.id, closerUserIds));
    closerNames = Object.fromEntries(members.map(m => [m.id, m.name]));
  }

  // Map logs by surveyId (latest log per survey)
  const logBySurvey: Record<number, typeof logs[0]> = {};
  for (const log of logs) {
    if (!logBySurvey[log.surveyId]) {
      logBySurvey[log.surveyId] = log;
    }
  }

  // Map closer by surveyId
  const closerBySurvey: Record<number, string> = {};
  for (const a of assignments) {
    closerBySurvey[a.surveyId] = closerNames[a.userId] || `User #${a.userId}`;
  }

  return results.map(r => ({
    ...r,
    cancelLog: logBySurvey[r.survey.id] || null,
    closerName: closerBySurvey[r.survey.id] || null,
  }));
}

export async function getCancelReasonStats(sourceGroup?: string) {
  const db = await getDb();
  if (!db) return [];
  if (sourceGroup) {
    // Filter by sourceGroup: join through surveys → customers → sources
    const groupSources = await getSourceNamesByGroupName(sourceGroup);
    if (groupSources.length === 0) return [];
    const results = await db.select({
      reason: postponeCancelLogs.reason,
      count: sql<number>`COUNT(*)`.as("count"),
    }).from(postponeCancelLogs)
      .innerJoin(surveys, eq(postponeCancelLogs.surveyId, surveys.id))
      .innerJoin(customers, eq(surveys.customerId, customers.id))
      .where(and(
        eq(postponeCancelLogs.action, "cancel_survey"),
        inArray(customers.source, groupSources)
      ))
      .groupBy(postponeCancelLogs.reason)
      .orderBy(desc(sql`count`));
    return results;
  }
  const results = await db.select({
    reason: postponeCancelLogs.reason,
    count: sql<number>`COUNT(*)`.as("count"),
  }).from(postponeCancelLogs)
    .where(eq(postponeCancelLogs.action, "cancel_survey"))
    .groupBy(postponeCancelLogs.reason)
    .orderBy(desc(sql`count`));
  return results;
}

export async function reopenSurvey(surveyId: number) {
  const db = await getDb();
  if (!db) return null;
  await db.update(surveys).set({ status: "follow_up" } as any).where(eq(surveys.id, surveyId));
  return { success: true };
}


// ==================== DOCUMENT SETTINGS ====================
export async function getDocumentSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentSettings).orderBy(asc(documentSettings.id));
}

export async function getDocumentSettingByKey(key: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(documentSettings).where(eq(documentSettings.settingKey, key)).limit(1);
  return rows[0] || null;
}

export async function upsertDocumentSetting(data: { settingKey: string; label: string; documentNumber: string; description?: string }) {
  const db = await getDb();
  if (!db) return null;
  const existing = await getDocumentSettingByKey(data.settingKey);
  if (existing) {
    await db.update(documentSettings).set({
      label: data.label,
      documentNumber: data.documentNumber,
      description: data.description ?? existing.description,
    }).where(eq(documentSettings.id, existing.id));
    return { ...existing, ...data };
  } else {
    const result = await db.insert(documentSettings).values(data as any);
    return { id: Number((result as any)[0].insertId), ...data };
  }
}
