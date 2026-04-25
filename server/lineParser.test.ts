import { describe, it, expect, vi, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      role: "admin",
      name: "Test Admin",
      openId: "test-line-parser",
    } as AuthenticatedUser,
  };
}

function createPublicContext(): TrpcContext {
  return { user: null } as TrpcContext;
}

// Mock the LLM module so tests don't call real API
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
const mockedInvokeLLM = vi.mocked(invokeLLM);

describe("LINE Parser Router", () => {
  const authCaller = appRouter.createCaller(createAuthContext());
  const publicCaller = appRouter.createCaller(createPublicContext());

  beforeAll(() => {
    vi.clearAllMocks();
  });

  it("should parse a typical LINE message with customer info", async () => {
    const mockResponse = {
      name: "คุณเอนธรรม",
      phone: "0816158109",
      fullAddress: "85 จรัญสนิทวงศ์ 69 แขวงบางพลัด บางพลัด กรุงเทพมหานคร 10700",
      district: "บางพลัด",
      province: "กรุงเทพมหานคร",
      postalCode: "10700",
      location: "https://maps.app.goo.gl/abc123",
      scheduledDate: "25/04/2026",
      scheduledTime: "12:00",
      source: "LINE",
      electricityBill: "3000",
      roofType: "เมทัลชีท",
      phaseType: "single",
      facebookName: "",
      notes: "",
    };

    mockedInvokeLLM.mockResolvedValueOnce({
      id: "test-id",
      created: Date.now(),
      model: "test-model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify(mockResponse),
          },
          finish_reason: "stop",
        },
      ],
    });

    const result = await authCaller.lineParser.parse({
      text: `save
!25/04/2026
!li
!set
!Tan

!25/04/2026
!12:00

!คุณเอนธรรม
!0816158109
!85 จรัญสนิทวงศ์ 69 แขวงบางพลัด บางพลัด กรุงเทพมหานคร 10700
!https://maps.app.goo.gl/abc123`,
    });

    expect(result.name).toBe("คุณเอนธรรม");
    expect(result.phone).toBe("0816158109");
    expect(result.district).toBe("บางพลัด");
    expect(result.province).toBe("กรุงเทพมหานคร");
    expect(result.location).toContain("maps.app.goo.gl");
    expect(result.scheduledDate).toBe("25/04/2026");
    expect(result.scheduledTime).toBe("12:00");

    // Verify LLM was called with correct structure
    expect(mockedInvokeLLM).toHaveBeenCalledTimes(1);
    const callArgs = mockedInvokeLLM.mock.calls[0][0];
    expect(callArgs.messages).toHaveLength(2);
    expect(callArgs.messages[0].role).toBe("system");
    expect(callArgs.messages[1].role).toBe("user");
    expect(callArgs.response_format).toBeDefined();
  });

  it("should handle minimal LINE message with only name", async () => {
    const mockResponse = {
      name: "สมชาย",
      phone: "",
      fullAddress: "",
      district: "",
      province: "",
      postalCode: "",
      location: "",
      scheduledDate: "",
      scheduledTime: "",
      source: "",
      electricityBill: "",
      roofType: "",
      phaseType: "",
      facebookName: "",
      notes: "",
    };

    mockedInvokeLLM.mockResolvedValueOnce({
      id: "test-id-2",
      created: Date.now(),
      model: "test-model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify(mockResponse),
          },
          finish_reason: "stop",
        },
      ],
    });

    const result = await authCaller.lineParser.parse({ text: "สมชาย" });
    expect(result.name).toBe("สมชาย");
    expect(result.phone).toBe("");
  });

  it("should throw error when LLM returns empty content", async () => {
    mockedInvokeLLM.mockResolvedValueOnce({
      id: "test-id-3",
      created: Date.now(),
      model: "test-model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "",
          },
          finish_reason: "stop",
        },
      ],
    });

    await expect(
      authCaller.lineParser.parse({ text: "some text" })
    ).rejects.toThrow();
  });

  it("should throw error when LLM returns invalid JSON", async () => {
    mockedInvokeLLM.mockResolvedValueOnce({
      id: "test-id-4",
      created: Date.now(),
      model: "test-model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "this is not json",
          },
          finish_reason: "stop",
        },
      ],
    });

    await expect(
      authCaller.lineParser.parse({ text: "some text" })
    ).rejects.toThrow();
  });

  it("should reject empty text input", async () => {
    await expect(
      authCaller.lineParser.parse({ text: "" })
    ).rejects.toThrow();
  });

  it("should require authentication (protected procedure)", async () => {
    await expect(
      publicCaller.lineParser.parse({ text: "test" })
    ).rejects.toThrow();
  });
});
