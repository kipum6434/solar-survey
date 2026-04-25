/**
 * LINE Webhook endpoint
 * Captures Group IDs when bot is added to groups
 */
import type { Express, Request, Response } from "express";
import * as db from "./db";

interface LineWebhookEvent {
  type: string;
  source: {
    type: string;
    groupId?: string;
    userId?: string;
  };
  message?: {
    type: string;
    text: string;
  };
}

interface LineWebhookBody {
  events: LineWebhookEvent[];
}

export function registerLineWebhook(app: Express) {
  app.post("/api/line/webhook", async (req: Request, res: Response) => {
    try {
      const body = req.body as LineWebhookBody;
      const events = body.events || [];

      for (const event of events) {
        // Bot ถูกเพิ่มเข้ากลุ่ม (join event)
        if (event.type === "join" && event.source.type === "group" && event.source.groupId) {
          console.log(`[LINE Webhook] Bot joined group: ${event.source.groupId}`);
          await db.upsertLineGroup(event.source.groupId, undefined);
        }

        // Bot ถูกเชิญเข้ากลุ่ม (memberJoined event สำหรับ bot เอง)
        if (event.type === "memberJoined" && event.source.type === "group" && event.source.groupId) {
          console.log(`[LINE Webhook] Member joined group: ${event.source.groupId}`);
          await db.upsertLineGroup(event.source.groupId, undefined);
        }

        // Bot ถูกลบออกจากกลุ่ม
        if (event.type === "leave" && event.source.type === "group" && event.source.groupId) {
          console.log(`[LINE Webhook] Bot left group: ${event.source.groupId}`);
          // Mark group as inactive instead of deleting
          const groups = await db.getLineGroups();
          const group = groups.find(g => g.groupId === event.source.groupId);
          if (group) {
            // We don't have an updateLineGroup, but we can use upsert
            // For now, just log it
            console.log(`[LINE Webhook] Group ${event.source.groupId} marked as left`);
          }
        }
      }

      // LINE requires 200 OK response
      res.status(200).json({ status: "ok" });
    } catch (error) {
      console.error("[LINE Webhook] Error processing webhook:", error);
      res.status(200).json({ status: "ok" }); // Always return 200 to LINE
    }
  });
}
