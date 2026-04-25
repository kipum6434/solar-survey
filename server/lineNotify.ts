/**
 * LINE Messaging API helper
 * Sends push messages to users/groups via LINE Messaging API
 */
import { ENV } from "./_core/env";
import { getLineNotificationTargets } from "./db";

const LINE_API_URL = "https://api.line.me/v2/bot/message/push";

interface LineMessage {
  type: "text";
  text: string;
}

/**
 * Send a push message to a specific LINE user or group
 */
export async function sendLineMessage(
  targetId: string,
  messages: LineMessage[]
): Promise<boolean> {
  if (!ENV.lineChannelAccessToken) {
    console.warn("[LINE] No channel access token configured");
    return false;
  }

  try {
    const response = await fetch(LINE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.lineChannelAccessToken}`,
      },
      body: JSON.stringify({
        to: targetId,
        messages,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(`[LINE] Push message failed (${response.status}): ${detail}`);
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[LINE] Error sending message:", error);
    return false;
  }
}

/**
 * Send a notification to all enabled LINE targets (users + groups)
 * This is the main function to call from procedures
 */
export async function sendLineNotification(
  title: string,
  content: string
): Promise<{ sent: number; failed: number }> {
  const targets = await getLineNotificationTargets();
  const enabledTargets = targets.filter((t) => t.isEnabled);

  if (enabledTargets.length === 0) {
    // Fallback: send to owner user ID
    if (ENV.lineUserId) {
      const ok = await sendLineMessage(ENV.lineUserId, [
        { type: "text", text: `🔔 ${title}\n\n${content}` },
      ]);
      return { sent: ok ? 1 : 0, failed: ok ? 0 : 1 };
    }
    console.warn("[LINE] No notification targets configured");
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const target of enabledTargets) {
    const ok = await sendLineMessage(target.targetId, [
      { type: "text", text: `🔔 ${title}\n\n${content}` },
    ]);
    if (ok) sent++;
    else failed++;
  }

  return { sent, failed };
}
