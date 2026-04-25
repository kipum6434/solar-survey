import { describe, it, expect } from "vitest";

describe("LINE Messaging API Credentials", () => {
  it("should have LINE_CHANNEL_ACCESS_TOKEN configured", () => {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    expect(token).toBeDefined();
    expect(token!.length).toBeGreaterThan(10);
  });

  it("should have LINE_USER_ID configured", () => {
    const userId = process.env.LINE_USER_ID;
    expect(userId).toBeDefined();
    expect(userId!).toMatch(/^U[0-9a-f]{32}$/);
  });

  it("should validate LINE token by calling profile API", async () => {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) {
      console.warn("Skipping LINE API test - no token configured");
      return;
    }

    const response = await fetch("https://api.line.me/v2/bot/info", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // 200 = valid token, bot info returned
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty("userId");
    console.log("LINE Bot info:", JSON.stringify(data, null, 2));
  });
});
