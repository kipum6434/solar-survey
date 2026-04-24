/**
 * Data Scoping Helper
 * 
 * เซลล์ (role = "user") จะเห็นเฉพาะงานที่ตัวเองเกี่ยวข้อง:
 * - งานสำรวจ: ที่ตัวเองเป็นคนสำรวจ (surveyor)
 * - งานติดตั้ง: ที่ตัวเองเป็นคนปิดงาน (closer)
 * - ลูกค้า: ที่เกี่ยวข้องกับงานของตัวเอง
 * - แดชบอร์ด: สถิติเฉพาะงานของตัวเอง
 * 
 * admin/superadmin เห็นทั้งหมดเหมือนเดิม
 * 
 * Mapping: users.id → team_members.linkedUserId → survey_assignments.userId (= team_members.id)
 */

import { eq, inArray, or } from "drizzle-orm";
import { teamMembers, surveyAssignments, surveys } from "../drizzle/schema";
import { getDb } from "./db";

export interface ScopeUser {
  id: number;
  role: "user" | "admin" | "superadmin";
}

/**
 * หา team_member IDs ที่ linked กับ user นี้
 */
export async function getLinkedTeamMemberIds(userId: number): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const members = await db.select({ id: teamMembers.id })
    .from(teamMembers)
    .where(eq(teamMembers.linkedUserId, userId));
  return members.map(m => m.id);
}

/**
 * หา survey IDs ที่ user (เซลล์) เกี่ยวข้อง
 * - เป็น surveyor หรือ closer ใน survey_assignments
 */
export async function getScopedSurveyIds(teamMemberIds: number[]): Promise<number[]> {
  if (teamMemberIds.length === 0) return [];
  const db = await getDb();
  if (!db) return [];
  const assignments = await db.selectDistinct({ surveyId: surveyAssignments.surveyId })
    .from(surveyAssignments)
    .where(
      inArray(surveyAssignments.userId, teamMemberIds)
    );
  return assignments.map(a => a.surveyId);
}

/**
 * หา survey IDs ที่ user เป็น surveyor
 */
export async function getSurveyorSurveyIds(teamMemberIds: number[]): Promise<number[]> {
  if (teamMemberIds.length === 0) return [];
  const db = await getDb();
  if (!db) return [];
  const assignments = await db.selectDistinct({ surveyId: surveyAssignments.surveyId })
    .from(surveyAssignments)
    .where(
      inArray(surveyAssignments.userId, teamMemberIds)
    );
  return assignments.map(a => a.surveyId);
}

/**
 * หา survey IDs ที่ user เป็น closer (สำหรับงานติดตั้ง)
 */
export async function getCloserSurveyIds(teamMemberIds: number[]): Promise<number[]> {
  if (teamMemberIds.length === 0) return [];
  const db = await getDb();
  if (!db) return [];
  const assignments = await db.selectDistinct({ surveyId: surveyAssignments.surveyId })
    .from(surveyAssignments)
    .where(
      inArray(surveyAssignments.userId, teamMemberIds)
    );
  return assignments.map(a => a.surveyId);
}

/**
 * หา customer IDs ที่เกี่ยวข้องกับ survey ของ user
 */
export async function getScopedCustomerIds(surveyIds: number[]): Promise<number[]> {
  if (surveyIds.length === 0) return [];
  const db = await getDb();
  if (!db) return [];
  const result = await db.selectDistinct({ customerId: surveys.customerId })
    .from(surveys)
    .where(inArray(surveys.id, surveyIds));
  return result.map(r => r.customerId);
}

/**
 * ตรวจสอบว่า user ต้องถูก scope หรือไม่
 * admin/superadmin = ไม่ต้อง scope (เห็นทั้งหมด)
 * user = ต้อง scope
 */
export function needsScoping(user: ScopeUser): boolean {
  return user.role === "user";
}

/**
 * Main helper: คืน scope data สำหรับ user
 * ถ้าเป็น admin/superadmin จะคืน null (ไม่ต้อง scope)
 * ถ้าเป็น user จะคืน { surveyIds, customerIds, teamMemberIds }
 */
export async function getUserScope(user: ScopeUser): Promise<{
  teamMemberIds: number[];
  surveyIds: number[];
  customerIds: number[];
} | null> {
  if (!needsScoping(user)) return null;
  
  const teamMemberIds = await getLinkedTeamMemberIds(user.id);
  const surveyIds = await getScopedSurveyIds(teamMemberIds);
  const customerIds = await getScopedCustomerIds(surveyIds);
  
  return { teamMemberIds, surveyIds, customerIds };
}
