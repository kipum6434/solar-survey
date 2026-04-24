import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      role: "admin",
      name: "Admin User",
      openId: "admin-test-comment",
    } as AuthenticatedUser,
  };
}

function createUserContext(): TrpcContext {
  return {
    user: {
      id: 2,
      role: "user",
      name: "Regular User",
      openId: "user-test-comment",
    } as AuthenticatedUser,
  };
}

function createUser2Context(): TrpcContext {
  return {
    user: {
      id: 3,
      role: "user",
      name: "Another User",
      openId: "user2-test-comment",
    } as AuthenticatedUser,
  };
}

describe("Round 38: Delivery Comment System", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const userCaller = appRouter.createCaller(createUserContext());
  const user2Caller = appRouter.createCaller(createUser2Context());

  let testSurveyId: number;

  beforeAll(async () => {
    // Create test customer and survey
    const customer = await adminCaller.customer.create({
      name: "ลูกค้าทดสอบ Comment " + Date.now(),
      phone: "0811111111",
      source: "ทดสอบ",
    });

    const survey = await adminCaller.survey.create({
      customerId: customer.id,
      surveyDate: Date.now(),
      surveyTime: "09:00",
    });
    testSurveyId = survey.id;
  });

  describe("deliveryComment.add", () => {
    it("should add a comment as admin", async () => {
      const result = await adminCaller.deliveryComment.add({
        surveyId: testSurveyId,
        message: "ทดสอบความคิดเห็นจาก admin",
      });
      expect(result).toHaveProperty("id");
      expect(typeof result.id).toBe("number");
    });

    it("should add a comment as regular user", async () => {
      const result = await userCaller.deliveryComment.add({
        surveyId: testSurveyId,
        message: "ทดสอบความคิดเห็นจาก user",
      });
      expect(result).toHaveProperty("id");
    });

    it("should reject empty message", async () => {
      await expect(
        adminCaller.deliveryComment.add({
          surveyId: testSurveyId,
          message: "",
        })
      ).rejects.toThrow();
    });

    it("should reject message exceeding 2000 characters", async () => {
      await expect(
        adminCaller.deliveryComment.add({
          surveyId: testSurveyId,
          message: "x".repeat(2001),
        })
      ).rejects.toThrow();
    });
  });

  describe("deliveryComment.list", () => {
    it("should list comments for a survey", async () => {
      const comments = await adminCaller.deliveryComment.list({ surveyId: testSurveyId });
      expect(Array.isArray(comments)).toBe(true);
      expect(comments.length).toBeGreaterThanOrEqual(2);
    });

    it("should include userName in comment data", async () => {
      const comments = await adminCaller.deliveryComment.list({ surveyId: testSurveyId });
      // At least one comment should have userName
      const hasUserName = comments.some((c: any) => c.userName !== null && c.userName !== undefined);
      expect(hasUserName).toBe(true);
    });

    it("should return comments ordered by newest first", async () => {
      const comments = await adminCaller.deliveryComment.list({ surveyId: testSurveyId });
      if (comments.length >= 2) {
        const dates = comments.map((c: any) => new Date(c.createdAt).getTime());
        expect(dates[0]).toBeGreaterThanOrEqual(dates[1]);
      }
    });

    it("should return empty array for survey with no comments", async () => {
      // Create a new survey with no comments
      const customer = await adminCaller.customer.create({
        name: "ลูกค้าไม่มี comment " + Date.now(),
        phone: "0822222222",
        source: "ทดสอบ",
      });
      const survey = await adminCaller.survey.create({
        customerId: customer.id,
        surveyDate: Date.now(),
        surveyTime: "10:00",
      });
      const comments = await adminCaller.deliveryComment.list({ surveyId: survey.id });
      expect(comments).toEqual([]);
    });
  });

  describe("deliveryComment.delete", () => {
    it("should allow admin to delete any comment", async () => {
      // User adds a comment
      const { id } = await userCaller.deliveryComment.add({
        surveyId: testSurveyId,
        message: "comment ที่ admin จะลบ",
      });
      // Admin deletes it
      const result = await adminCaller.deliveryComment.delete({ id });
      expect(result).toEqual({ success: true });
    });

    it("should allow comment owner to delete own comment", async () => {
      const { id } = await userCaller.deliveryComment.add({
        surveyId: testSurveyId,
        message: "comment ที่ user จะลบเอง",
      });
      const result = await userCaller.deliveryComment.delete({ id });
      expect(result).toEqual({ success: true });
    });

    it("should reject non-owner non-admin from deleting", async () => {
      const { id } = await userCaller.deliveryComment.add({
        surveyId: testSurveyId,
        message: "comment ที่ user2 ไม่ควรลบได้",
      });
      await expect(
        user2Caller.deliveryComment.delete({ id })
      ).rejects.toThrow(/ไม่มีสิทธิ์/);
    });

    it("should reject deleting non-existent comment", async () => {
      await expect(
        adminCaller.deliveryComment.delete({ id: 999999 })
      ).rejects.toThrow(/ไม่พบ/);
    });
  });
});
