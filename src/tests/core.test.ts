/**
 * HttpClient, Errors, Pagination, AurinkoClient — Full Test Suite
 */

import { HttpClient } from "../http/client";
import { AurinkoClient } from "../client";
import {
  AurinkoError,
  AuthenticationError,
  AuthorizationError,
  ConfigurationError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ServerError,
  TimeoutError,
  ValidationError,
  WebhookVerificationError,
} from "../errors";
import { paginate, collectAll, consumeDeltaSync } from "../utils/pagination";
import { makeFetchMock, mockOnce } from "./helpers";

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

// ─────────────────────────────────────────────────────────────────────────────
// AurinkoClient — factory methods & validation
// ─────────────────────────────────────────────────────────────────────────────

describe("AurinkoClient — construction", () => {
  it("withToken creates client with Bearer token", () => {
    const client = AurinkoClient.withToken("my-token");
    expect(client).toBeDefined();
    expect(client.email).toBeDefined();
    expect(client.calendar).toBeDefined();
    expect(client.contacts).toBeDefined();
    expect(client.tasks).toBeDefined();
    expect(client.webhooks).toBeDefined();
    expect(client.booking).toBeDefined();
    expect(client.groupBooking).toBeDefined();
    expect(client.direct).toBeDefined();
    expect(client.auth).toBeDefined();
  });

  it("withToken passes extra config options", () => {
    const client = AurinkoClient.withToken("token", { maxRetries: 5 });
    expect(client).toBeDefined();
  });

  it("withAppCredentials creates client with Basic auth", () => {
    const client = AurinkoClient.withAppCredentials("cid", "csec");
    expect(client).toBeDefined();
  });

  it("withAppCredentials passes extra config options", () => {
    const client = AurinkoClient.withAppCredentials("cid", "csec", { timeoutMs: 5000 });
    expect(client).toBeDefined();
  });

  it("withFullConfig accepts all config fields", () => {
    const client = AurinkoClient.withFullConfig({
      accessToken: "tok",
      clientId: "cid",
      clientSecret: "csec",
      webhookSigningSecret: "wsec",
      maxRetries: 2,
      timeoutMs: 10_000,
    });
    expect(client).toBeDefined();
  });

  it("throws ConfigurationError with no token or app creds", () => {
    expect(() => new AurinkoClient({})).toThrow(ConfigurationError);
  });

  it("throws ConfigurationError with only clientId (no secret)", () => {
    expect(() => new AurinkoClient({ clientId: "only-id" })).toThrow(ConfigurationError);
  });

  it("throws ConfigurationError with only clientSecret (no id)", () => {
    expect(() => new AurinkoClient({ clientSecret: "only-sec" })).toThrow(ConfigurationError);
  });

  it("throws ConfigurationError with timeoutMs <= 0", () => {
    expect(() => new AurinkoClient({ accessToken: "t", timeoutMs: 0 })).toThrow(ConfigurationError);
    expect(() => new AurinkoClient({ accessToken: "t", timeoutMs: -1 })).toThrow(ConfigurationError);
  });

  it("throws ConfigurationError with maxRetries < 0", () => {
    expect(() => new AurinkoClient({ accessToken: "t", maxRetries: -1 })).toThrow(ConfigurationError);
  });

  it("allows maxRetries = 0 (no retries)", () => {
    expect(() => new AurinkoClient({ accessToken: "t", maxRetries: 0 })).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HttpClient — auth headers
// ─────────────────────────────────────────────────────────────────────────────

describe("HttpClient — authentication", () => {
  it("sends Bearer token when accessToken set", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    const http = new HttpClient({ accessToken: "my-bearer-token" });
    await http.get("/test");
    const [, init] = mock.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer my-bearer-token");
  });

  it("sends Basic auth when useAppAuth=true", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    const http = new HttpClient({ clientId: "cid", clientSecret: "csec" });
    await http.get("/test", undefined, { useAppAuth: true });
    const [, init] = mock.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toMatch(/^Basic /);
    const decoded = Buffer.from(headers["Authorization"].replace("Basic ", ""), "base64").toString();
    expect(decoded).toBe("cid:csec");
  });

  it("throws AuthenticationError when no accessToken for Bearer", async () => {
    const http = new HttpClient({ clientId: "cid", clientSecret: "csec" });
    // useAppAuth not set, no accessToken — should throw
    await expect(http.get("/test")).rejects.toThrow(AuthenticationError);
  });

  it("throws AuthenticationError when useAppAuth=true but no app creds", async () => {
    const http = new HttpClient({ accessToken: "tok" }); // no clientId/clientSecret
    await expect(http.get("/test", undefined, { useAppAuth: true })).rejects.toThrow(AuthenticationError);
  });

  it("includes X-Aurinko-SDK header", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    const http = new HttpClient({ accessToken: "tok" });
    await http.get("/test");
    const [, init] = mock.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-Aurinko-SDK"]).toBe("typescript/1.0.0");
  });

  it("includes Content-Type: application/json", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    const http = new HttpClient({ accessToken: "tok" });
    await http.post("/test", { x: 1 });
    const [, init] = mock.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("merges per-request custom headers", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    const http = new HttpClient({ accessToken: "tok" });
    await http.get("/test", undefined, { headers: { "X-Custom": "value" } });
    const [, init] = mock.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-Custom"]).toBe("value");
    expect(headers["Authorization"]).toBeDefined(); // not overwritten
  });

  it("per-request headers can override defaults", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    const http = new HttpClient({ accessToken: "tok" });
    await http.get("/test", undefined, { headers: { "Content-Type": "text/plain" } });
    const [, init] = mock.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("text/plain");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HttpClient — URL building & query strings
// ─────────────────────────────────────────────────────────────────────────────

describe("HttpClient — URL building", () => {
  it("builds URL from base + path", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    const http = new HttpClient({ accessToken: "tok" });
    await http.get("/email/messages");
    const [url] = mock.mock.calls[0]!;
    expect(url as string).toContain("/email/messages");
  });

  it("uses custom baseUrl when provided", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    const http = new HttpClient({ accessToken: "tok", baseUrl: "https://custom.api.io/v2" });
    await http.get("/test");
    const [url] = mock.mock.calls[0]!;
    expect((url as string).startsWith("https://custom.api.io/v2")).toBe(true);
  });

  it("appends query string for GET", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    const http = new HttpClient({ accessToken: "tok" });
    await http.get("/test", { foo: "bar", n: 42 });
    const [url] = mock.mock.calls[0]!;
    expect(url as string).toContain("foo=bar");
    expect(url as string).toContain("n=42");
  });

  it("URL-encodes special characters in query values", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    const http = new HttpClient({ accessToken: "tok" });
    await http.get("/test", { q: "from:alice is:unread" });
    const [url] = mock.mock.calls[0]!;
    expect(url as string).toContain("q=from%3Aalice%20is%3Aunread");
  });

  it("omits undefined values from query string", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    const http = new HttpClient({ accessToken: "tok" });
    await http.get("/test", { q: undefined, limit: 10 });
    const [url] = mock.mock.calls[0]!;
    expect(url as string).not.toContain("q=");
    expect(url as string).toContain("limit=10");
  });

  it("omits null values from query string", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    const http = new HttpClient({ accessToken: "tok" });
    await http.get("/test", { q: null as unknown as string, limit: 5 });
    const [url] = mock.mock.calls[0]!;
    expect(url as string).not.toContain("q=");
  });

  it("handles boolean query values", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    const http = new HttpClient({ accessToken: "tok" });
    await http.get("/test", { active: true, deleted: false });
    const [url] = mock.mock.calls[0]!;
    expect(url as string).toContain("active=true");
    expect(url as string).toContain("deleted=false");
  });

  it("does not append ? when no query params", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    const http = new HttpClient({ accessToken: "tok" });
    await http.get("/test");
    const [url] = mock.mock.calls[0]!;
    expect(url as string).not.toContain("?");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HttpClient — HTTP methods & request body
// ─────────────────────────────────────────────────────────────────────────────

describe("HttpClient — HTTP methods", () => {
  let http: HttpClient;
  beforeEach(() => { http = new HttpClient({ accessToken: "tok" }); });

  it("GET sends no body", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    await http.get("/test");
    const [, init] = mock.mock.calls[0]!;
    expect((init as RequestInit).body).toBeUndefined();
  });

  it("POST sends JSON body", async () => {
    const mock = mockOnce(201, { id: "new" });
    global.fetch = mock;
    await http.post("/test", { name: "test" });
    const [, init] = mock.mock.calls[0]!;
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ name: "test" });
  });

  it("PATCH sends JSON body", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    await http.patch("/test", { status: "updated" });
    const [, init] = mock.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ status: "updated" });
  });

  it("PUT sends JSON body", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    await http.put("/test", { replace: true });
    const [, init] = mock.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("PUT");
  });

  it("DELETE sends no body", async () => {
    const mock = mockOnce(204, null);
    global.fetch = mock;
    await http.delete("/test");
    const [, init] = mock.mock.calls[0]!;
    expect((init as RequestInit).body).toBeUndefined();
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("POST with no body sends undefined body", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    await http.post("/test");
    const [, init] = mock.mock.calls[0]!;
    expect((init as RequestInit).body).toBeUndefined();
  });

  it("POST with query params but no body", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    await http.post("/test", undefined, { foo: "bar" });
    const [url, init] = mock.mock.calls[0]!;
    expect(url as string).toContain("foo=bar");
    expect((init as RequestInit).body).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HttpClient — response handling
// ─────────────────────────────────────────────────────────────────────────────

describe("HttpClient — response handling", () => {
  let http: HttpClient;
  beforeEach(() => { http = new HttpClient({ accessToken: "tok" }); });

  it("returns parsed JSON for 200", async () => {
    global.fetch = mockOnce(200, { id: "abc", value: 42 });
    const result = await http.get<{ id: string; value: number }>("/test");
    expect(result.id).toBe("abc");
    expect(result.value).toBe(42);
  });

  it("returns null for 204 No Content", async () => {
    global.fetch = mockOnce(204, null, { "content-length": "0" });
    const result = await http.delete("/test");
    expect(result).toBeNull();
  });

  it("returns null for empty body (content-length: 0)", async () => {
    global.fetch = mockOnce(200, null, { "content-length": "0" });
    const result = await http.get("/test");
    expect(result).toBeNull();
  });

  it("returns null for empty text body", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: () => Promise.resolve(""),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    });
    const result = await http.get("/test");
    expect(result).toBeNull();
  });

  it("returns ArrayBuffer for getBuffer", async () => {
    const data = new TextEncoder().encode("binary data");
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: () => Promise.resolve(""),
      arrayBuffer: () => Promise.resolve(data.buffer),
    });
    const result = await http.getBuffer("/test");
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it("uses message field from JSON error body", async () => {
    global.fetch = mockOnce(400, { message: "Custom error from API" });
    try {
      await http.get("/test");
      fail("Should have thrown");
    } catch (e) {
      expect((e as Error).message).toBe("Custom error from API");
    }
  });

  it("uses error field from JSON error body as fallback", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      headers: { get: () => null },
      text: () => Promise.resolve(JSON.stringify({ error: "Bad request error" })),
    });
    try {
      await http.get("/test");
    } catch (e) {
      expect((e as Error).message).toBe("Bad request error");
    }
  });

  it("falls back to generic message for non-JSON error body", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: { get: () => null },
      text: () => Promise.resolve("Internal Server Error (plain text)"),
    });
    try {
      await http.get("/test");
    } catch (e) {
      expect(e).toBeInstanceOf(ServerError);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HttpClient — error mapping
// ─────────────────────────────────────────────────────────────────────────────

describe("HttpClient — error mapping", () => {
  let http: HttpClient;
  beforeEach(() => {
    http = new HttpClient({ accessToken: "tok", maxRetries: 0 }); // no retries for fast tests
  });

  it("maps 400 → ValidationError", async () => {
    global.fetch = mockOnce(400, { message: "Bad input" });
    await expect(http.get("/test")).rejects.toThrow(ValidationError);
  });

  it("maps 401 → AuthenticationError", async () => {
    global.fetch = mockOnce(401, { message: "Unauthorized" });
    await expect(http.get("/test")).rejects.toThrow(AuthenticationError);
  });

  it("maps 403 → AuthorizationError", async () => {
    global.fetch = mockOnce(403, { message: "Forbidden" });
    await expect(http.get("/test")).rejects.toThrow(AuthorizationError);
  });

  it("maps 404 → NotFoundError", async () => {
    global.fetch = mockOnce(404, { message: "Not found" });
    await expect(http.get("/test")).rejects.toThrow(NotFoundError);
  });

  it("maps 429 → RateLimitError", async () => {
    global.fetch = mockOnce(429, { message: "Too many requests" });
    await expect(http.get("/test")).rejects.toThrow(RateLimitError);
  });

  it("maps 429 → RateLimitError with retryAfter from header", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: (k: string) => (k === "retry-after" ? "60" : null) },
      text: () => Promise.resolve(JSON.stringify({ message: "Rate limited" })),
    });
    try {
      await http.get("/test");
    } catch (e) {
      expect(e).toBeInstanceOf(RateLimitError);
      expect((e as RateLimitError).retryAfter).toBe(60);
    }
  });

  it("maps 500 → ServerError", async () => {
    global.fetch = mockOnce(500, { message: "Internal Server Error" });
    await expect(http.get("/test")).rejects.toThrow(ServerError);
  });

  it("maps 502 → ServerError", async () => {
    global.fetch = mockOnce(502, { message: "Bad Gateway" });
    await expect(http.get("/test")).rejects.toThrow(ServerError);
  });

  it("maps 503 → ServerError", async () => {
    global.fetch = mockOnce(503, { message: "Service Unavailable" });
    await expect(http.get("/test")).rejects.toThrow(ServerError);
  });

  it("maps 504 → ServerError", async () => {
    global.fetch = mockOnce(504, { message: "Gateway Timeout" });
    await expect(http.get("/test")).rejects.toThrow(ServerError);
  });

  it("maps fetch network error → NetworkError", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network connection refused"));
    await expect(http.get("/test")).rejects.toThrow(NetworkError);
  });

  it("maps AbortError → TimeoutError", async () => {
    const http2 = new HttpClient({ accessToken: "tok", timeoutMs: 1, maxRetries: 0 });
    global.fetch = jest.fn().mockImplementation(() => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          const err = new DOMException("The operation was aborted.", "AbortError");
          reject(err);
        }, 2);
      });
    });
    await expect(http2.get("/test")).rejects.toThrow(TimeoutError);
  });

  it("ServerError carries correct statusCode", async () => {
    global.fetch = mockOnce(503, { message: "Unavailable" });
    try {
      await http.get("/test");
    } catch (e) {
      expect((e as ServerError).statusCode).toBe(503);
    }
  });

  it("all error classes are instanceof AurinkoError", async () => {
    const statusAndClass: Array<[number, new (...args: never[]) => AurinkoError]> = [
      [400, ValidationError],
      [401, AuthenticationError],
      [403, AuthorizationError],
      [404, NotFoundError],
      [500, ServerError],
    ];
    for (const [status, ErrorClass] of statusAndClass) {
      global.fetch = mockOnce(status, { message: "test" });
      try {
        await http.get("/test");
      } catch (e) {
        expect(e).toBeInstanceOf(AurinkoError);
        expect(e).toBeInstanceOf(ErrorClass);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HttpClient — retry logic
// ─────────────────────────────────────────────────────────────────────────────

describe("HttpClient — retries", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("retries on 500 up to maxRetries times", async () => {
    const http = new HttpClient({ accessToken: "tok", maxRetries: 2, retryDelayMs: 1 });
    global.fetch = makeFetchMock([
      { status: 500, body: { message: "err" } },
      { status: 500, body: { message: "err" } },
      { status: 200, body: { ok: true } },
    ]);
    const promise = http.get("/test");
    // advance timers to flush retries
    await jest.runAllTimersAsync();
    const result = await promise;
    expect((result as Record<string, unknown>)["ok"]).toBe(true);
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(3);
  });

  it("retries on 429", async () => {
    const http = new HttpClient({ accessToken: "tok", maxRetries: 1, retryDelayMs: 1 });
    global.fetch = makeFetchMock([
      { status: 429, body: { message: "rate limited" } },
      { status: 200, body: { ok: true } },
    ]);
    const promise = http.get("/test");
    await jest.runAllTimersAsync();
    await promise;
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(2);
  });

  it("retries on 502 and 503", async () => {
    for (const status of [502, 503]) {
      const http = new HttpClient({ accessToken: "tok", maxRetries: 1, retryDelayMs: 1 });
      global.fetch = makeFetchMock([
        { status, body: { message: "err" } },
        { status: 200, body: { ok: true } },
      ]);
      const promise = http.get("/test");
      await jest.runAllTimersAsync();
      await promise;
      expect((global.fetch as jest.Mock).mock.calls).toHaveLength(2);
    }
  });

  it("does NOT retry on 400, 401, 403, 404", async () => {
    for (const status of [400, 401, 403, 404]) {
      const http = new HttpClient({ accessToken: "tok", maxRetries: 3, retryDelayMs: 1 });
      global.fetch = makeFetchMock([{ status, body: { message: "no retry" } }]);
      const promise = http.get("/test");
      await jest.runAllTimersAsync();
      await expect(promise).rejects.toThrow();
      expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);
    }
  });

  it("stops retrying after maxRetries exceeded and throws", async () => {
    const http = new HttpClient({ accessToken: "tok", maxRetries: 2, retryDelayMs: 1 });
    global.fetch = makeFetchMock([
      { status: 500, body: { message: "err" } },
      { status: 500, body: { message: "err" } },
      { status: 500, body: { message: "err" } }, // still failing after 2 retries
    ]);
    const promise = http.get("/test");
    await jest.runAllTimersAsync();
    await expect(promise).rejects.toThrow(ServerError);
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(3);
  });

  it("respects retry-after header on 429", async () => {
    const http = new HttpClient({ accessToken: "tok", maxRetries: 1, retryDelayMs: 100 });
    const mockFetch = makeFetchMock([
      { status: 429, body: { message: "rate limited" }, headers: { "retry-after": "2" } },
      { status: 200, body: { ok: true } },
    ]);
    global.fetch = mockFetch;
    const promise = http.get("/test");
    await jest.runAllTimersAsync();
    await promise;
    expect(mockFetch.mock.calls).toHaveLength(2);
  });

  it("with maxRetries=0 does not retry at all", async () => {
    const http = new HttpClient({ accessToken: "tok", maxRetries: 0 });
    global.fetch = makeFetchMock([{ status: 500, body: { message: "err" } }]);
    const promise = http.get("/test");
    await jest.runAllTimersAsync();
    await expect(promise).rejects.toThrow(ServerError);
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error classes
// ─────────────────────────────────────────────────────────────────────────────

describe("Error classes", () => {
  it("AuthenticationError has correct code and statusCode", () => {
    const err = new AuthenticationError("Unauthorized");
    expect(err.code).toBe("AUTHENTICATION_ERROR");
    expect(err.statusCode).toBe(401);
    expect(err.name).toBe("AuthenticationError");
    expect(err).toBeInstanceOf(AurinkoError);
    expect(err).toBeInstanceOf(Error);
  });

  it("AuthorizationError has correct code and statusCode", () => {
    const err = new AuthorizationError("Forbidden");
    expect(err.code).toBe("AUTHORIZATION_ERROR");
    expect(err.statusCode).toBe(403);
  });

  it("NotFoundError has correct code and statusCode", () => {
    const err = new NotFoundError("Not found");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.statusCode).toBe(404);
  });

  it("ValidationError has correct code and statusCode", () => {
    const err = new ValidationError("Invalid input");
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.statusCode).toBe(400);
  });

  it("RateLimitError stores retryAfter", () => {
    const err = new RateLimitError("Rate limited", 120);
    expect(err.code).toBe("RATE_LIMIT_ERROR");
    expect(err.statusCode).toBe(429);
    expect(err.retryAfter).toBe(120);
  });

  it("RateLimitError retryAfter is undefined when not provided", () => {
    const err = new RateLimitError("Rate limited");
    expect(err.retryAfter).toBeUndefined();
  });

  it("ServerError stores statusCode", () => {
    const err = new ServerError("Server error", 503);
    expect(err.code).toBe("SERVER_ERROR");
    expect(err.statusCode).toBe(503);
  });

  it("TimeoutError has correct code and no statusCode", () => {
    const err = new TimeoutError("Timed out");
    expect(err.code).toBe("TIMEOUT_ERROR");
    expect(err.statusCode).toBeUndefined();
  });

  it("NetworkError has correct code", () => {
    const cause = new Error("connection refused");
    const err = new NetworkError("Network failed", cause);
    expect(err.code).toBe("NETWORK_ERROR");
    expect(err.raw).toBe(cause);
  });

  it("WebhookVerificationError has correct code", () => {
    const err = new WebhookVerificationError("Bad signature");
    expect(err.code).toBe("WEBHOOK_VERIFICATION_FAILED");
    expect(err.statusCode).toBeUndefined();
  });

  it("ConfigurationError has correct code", () => {
    const err = new ConfigurationError("Bad config");
    expect(err.code).toBe("CONFIGURATION_ERROR");
  });

  it("toJSON returns all fields", () => {
    const err = new RateLimitError("Rate limited", 60, '{"error":"rate limit"}');
    const json = err.toJSON();
    expect(json.code).toBe("RATE_LIMIT_ERROR");
    expect(json.message).toBe("Rate limited");
    expect(json.statusCode).toBe(429);
    expect(json.retryAfter).toBe(60);
    expect(json.raw).toBeDefined();
    expect(json.name).toBe("RateLimitError");
  });

  it("all error classes pass instanceof AurinkoError", () => {
    const errors: AurinkoError[] = [
      new AuthenticationError("x"),
      new AuthorizationError("x"),
      new NotFoundError("x"),
      new ValidationError("x"),
      new RateLimitError("x"),
      new ServerError("x", 500),
      new TimeoutError("x"),
      new NetworkError("x"),
      new WebhookVerificationError("x"),
      new ConfigurationError("x"),
    ];
    for (const err of errors) {
      expect(err).toBeInstanceOf(AurinkoError);
      expect(err).toBeInstanceOf(Error);
    }
  });

  it("all error classes pass instanceof their own class", () => {
    expect(new AuthenticationError("x")).toBeInstanceOf(AuthenticationError);
    expect(new AuthorizationError("x")).toBeInstanceOf(AuthorizationError);
    expect(new NotFoundError("x")).toBeInstanceOf(NotFoundError);
    expect(new ValidationError("x")).toBeInstanceOf(ValidationError);
    expect(new RateLimitError("x")).toBeInstanceOf(RateLimitError);
    expect(new ServerError("x", 500)).toBeInstanceOf(ServerError);
    expect(new TimeoutError("x")).toBeInstanceOf(TimeoutError);
    expect(new NetworkError("x")).toBeInstanceOf(NetworkError);
    expect(new WebhookVerificationError("x")).toBeInstanceOf(WebhookVerificationError);
    expect(new ConfigurationError("x")).toBeInstanceOf(ConfigurationError);
  });

  it("errors can be caught as Error", () => {
    try {
      throw new NotFoundError("Contact not found");
    } catch (e) {
      expect(e instanceof Error).toBe(true);
      expect((e as Error).message).toBe("Contact not found");
    }
  });

  it("stores raw error body", () => {
    const raw = '{"message":"Not found","code":404}';
    const err = new NotFoundError("Not found", raw);
    expect(err.raw).toBe(raw);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pagination utilities
// ─────────────────────────────────────────────────────────────────────────────

describe("paginate()", () => {
  let http: HttpClient;
  beforeEach(() => { http = new HttpClient({ accessToken: "tok" }); });

  it("yields single page with no nextPageToken", async () => {
    global.fetch = mockOnce(200, { records: [{ id: "a" }] });
    const pages: string[][] = [];
    for await (const page of paginate<{ id: string }>(http, "/test")) {
      pages.push(page.records.map((r) => r.id));
    }
    expect(pages).toEqual([["a"]]);
  });

  it("yields multiple pages following nextPageToken", async () => {
    global.fetch = makeFetchMock([
      { status: 200, body: { records: [{ id: "a" }], nextPageToken: "p2" } },
      { status: 200, body: { records: [{ id: "b" }, { id: "c" }], nextPageToken: "p3" } },
      { status: 200, body: { records: [{ id: "d" }] } },
    ]);
    const ids: string[] = [];
    for await (const page of paginate<{ id: string }>(http, "/test")) {
      ids.push(...page.records.map((r) => r.id));
    }
    expect(ids).toEqual(["a", "b", "c", "d"]);
  });

  it("passes static query params on every page", async () => {
    const mock = makeFetchMock([
      { status: 200, body: { records: [{ id: "a" }], nextPageToken: "p2" } },
      { status: 200, body: { records: [{ id: "b" }] } },
    ]);
    global.fetch = mock;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of paginate(http, "/test", { q: "active" })) { /* iterate */ }
    for (const call of mock.mock.calls) {
      expect(call[0] as string).toContain("q=active");
    }
  });

  it("passes pageToken on subsequent pages", async () => {
    const mock = makeFetchMock([
      { status: 200, body: { records: [{ id: "a" }], nextPageToken: "page-2-token" } },
      { status: 200, body: { records: [{ id: "b" }] } },
    ]);
    global.fetch = mock;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of paginate(http, "/test")) { /* iterate */ }
    const secondCallUrl = mock.mock.calls[1]![0] as string;
    expect(secondCallUrl).toContain("pageToken=page-2-token");
  });

  it("passes limit option", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of paginate(http, "/test", {}, { limit: 25 })) { break; }
    expect(mock.mock.calls[0]![0] as string).toContain("limit=25");
  });

  it("stops immediately when records is empty (no nextPageToken)", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    const pages: unknown[] = [];
    for await (const p of paginate(http, "/test")) {
      pages.push(p);
    }
    expect(pages).toHaveLength(1);
    expect(mock.mock.calls).toHaveLength(1);
  });
});

describe("collectAll()", () => {
  let http: HttpClient;
  beforeEach(() => { http = new HttpClient({ accessToken: "tok" }); });

  it("collects all items from all pages", async () => {
    global.fetch = makeFetchMock([
      { status: 200, body: { records: [{ id: "1" }, { id: "2" }], nextPageToken: "p2" } },
      { status: 200, body: { records: [{ id: "3" }] } },
    ]);
    const items = await collectAll<{ id: string }>(http, "/test");
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.id)).toEqual(["1", "2", "3"]);
  });

  it("returns empty array for empty first page", async () => {
    global.fetch = mockOnce(200, { records: [] });
    const items = await collectAll(http, "/test");
    expect(items).toEqual([]);
  });

  it("passes query params to paginate", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await collectAll(http, "/test", { status: "active" });
    expect(mock.mock.calls[0]![0] as string).toContain("status=active");
  });
});

describe("consumeDeltaSync()", () => {
  let http: HttpClient;
  beforeEach(() => { http = new HttpClient({ accessToken: "tok" }); });

  it("returns items and nextDeltaToken from single page", async () => {
    global.fetch = mockOnce(200, {
      records: [{ id: "a" }, { id: "b" }],
      nextDeltaToken: "final-delta",
    });
    const { items, nextDeltaToken } = await consumeDeltaSync<{ id: string }>(http, "/sync", "init");
    expect(items).toHaveLength(2);
    expect(nextDeltaToken).toBe("final-delta");
  });

  it("follows nextPageToken before stopping at nextDeltaToken", async () => {
    global.fetch = makeFetchMock([
      { status: 200, body: { records: [{ id: "p1-a" }], nextPageToken: "page-2" } },
      { status: 200, body: { records: [{ id: "p2-a" }, { id: "p2-b" }], nextDeltaToken: "dt-final" } },
    ]);
    const { items, nextDeltaToken } = await consumeDeltaSync<{ id: string }>(http, "/sync", "init");
    expect(items).toHaveLength(3);
    expect(nextDeltaToken).toBe("dt-final");
  });

  it("uses deltaToken on first request, pageToken on subsequent", async () => {
    const mock = makeFetchMock([
      { status: 200, body: { records: [], nextPageToken: "p2" } },
      { status: 200, body: { records: [], nextDeltaToken: "dt" } },
    ]);
    global.fetch = mock;
    await consumeDeltaSync(http, "/sync", "my-delta-token");
    expect(mock.mock.calls[0]![0] as string).toContain("deltaToken=my-delta-token");
    expect(mock.mock.calls[1]![0] as string).toContain("pageToken=p2");
    expect(mock.mock.calls[1]![0] as string).not.toContain("deltaToken=");
  });

  it("throws when no nextDeltaToken is ever returned", async () => {
    global.fetch = mockOnce(200, { records: [{ id: "a" }] }); // no nextPageToken, no nextDeltaToken
    await expect(consumeDeltaSync(http, "/sync", "token")).rejects.toThrow("nextDeltaToken");
  });

  it("passes limit option", async () => {
    const mock = mockOnce(200, { records: [], nextDeltaToken: "tok" });
    global.fetch = mock;
    await consumeDeltaSync(http, "/sync", "delta", {}, { limit: 100 });
    expect(mock.mock.calls[0]![0] as string).toContain("limit=100");
  });

  it("passes static query params on all pages", async () => {
    const mock = makeFetchMock([
      { status: 200, body: { records: [], nextPageToken: "p2" } },
      { status: 200, body: { records: [], nextDeltaToken: "dt" } },
    ]);
    global.fetch = mock;
    await consumeDeltaSync(http, "/sync", "init", { type: "full" });
    for (const call of mock.mock.calls) {
      expect(call[0] as string).toContain("type=full");
    }
  });

  it("handles 3+ pages before nextDeltaToken", async () => {
    global.fetch = makeFetchMock([
      { status: 200, body: { records: [{ id: "1" }], nextPageToken: "p2" } },
      { status: 200, body: { records: [{ id: "2" }], nextPageToken: "p3" } },
      { status: 200, body: { records: [{ id: "3" }], nextDeltaToken: "final" } },
    ]);
    const { items, nextDeltaToken } = await consumeDeltaSync<{ id: string }>(http, "/sync", "init");
    expect(items).toHaveLength(3);
    expect(nextDeltaToken).toBe("final");
  });

  it("handles empty records on all pages gracefully", async () => {
    global.fetch = makeFetchMock([
      { status: 200, body: { records: [], nextPageToken: "p2" } },
      { status: 200, body: { records: [], nextDeltaToken: "dt" } },
    ]);
    const { items } = await consumeDeltaSync(http, "/sync", "init");
    expect(items).toEqual([]);
  });
});
