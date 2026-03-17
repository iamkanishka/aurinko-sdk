/**
 * Aurinko SDK — Comprehensive Test Suite
 * Covers: all 10 resources, HttpClient, pagination utils, webhook utils, error classes
 */

import { AurinkoClient } from "../client";
import { HttpClient } from "../http/client";
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
import { verifyWebhookSignature, isValidWebhookSignature } from "../utils/webhook";
import { paginate, collectAll, consumeDeltaSync } from "../utils/pagination";
import type { PagedResponse } from "../types";
import { createHmac } from "crypto";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFetchMock(
  responses: Array<{ status: number; body: unknown; headers?: Record<string, string> }>
) {
  let callIndex = 0;
  return jest.fn().mockImplementation(() => {
    const resp = responses[callIndex++] ?? responses[responses.length - 1]!;
    const headers = new Map(Object.entries(resp.headers ?? {}));
    return Promise.resolve({
      ok: resp.status >= 200 && resp.status < 300,
      status: resp.status,
      headers: {
        get: (key: string) => headers.get(key.toLowerCase()) ?? null,
      },
      text: () => Promise.resolve(resp.body === null ? "" : JSON.stringify(resp.body)),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
  });
}

function makeWebhookSignature(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

function freshTimestamp() {
  return String(Math.floor(Date.now() / 1000));
}

// ─── AurinkoClient ────────────────────────────────────────────────────────────

describe("AurinkoClient", () => {
  describe("constructor validation", () => {
    it("throws ConfigurationError when no credentials provided", () => {
      expect(() => new AurinkoClient({})).toThrow(ConfigurationError);
    });

    it("accepts accessToken only", () => {
      expect(() => new AurinkoClient({ accessToken: "token" })).not.toThrow();
    });

    it("accepts clientId + clientSecret only", () => {
      expect(() => new AurinkoClient({ clientId: "id", clientSecret: "secret" })).not.toThrow();
    });

    it("accepts both token and app credentials", () => {
      expect(
        () => new AurinkoClient({ accessToken: "token", clientId: "id", clientSecret: "secret" })
      ).not.toThrow();
    });

    it("throws ConfigurationError for invalid timeoutMs", () => {
      expect(() => new AurinkoClient({ accessToken: "token", timeoutMs: -1 })).toThrow(
        ConfigurationError
      );
    });

    it("throws ConfigurationError for zero timeoutMs", () => {
      expect(() => new AurinkoClient({ accessToken: "token", timeoutMs: 0 })).toThrow(
        ConfigurationError
      );
    });

    it("throws ConfigurationError for negative maxRetries", () => {
      expect(() => new AurinkoClient({ accessToken: "token", maxRetries: -1 })).toThrow(
        ConfigurationError
      );
    });

    it("accepts maxRetries of 0 (no retries)", () => {
      expect(() => new AurinkoClient({ accessToken: "token", maxRetries: 0 })).not.toThrow();
    });

    it("accepts custom baseUrl", () => {
      expect(
        () => new AurinkoClient({ accessToken: "token", baseUrl: "https://custom.example.com/v1" })
      ).not.toThrow();
    });
  });

  describe("factory methods", () => {
    it("withToken creates client with Bearer auth", () => {
      const client = AurinkoClient.withToken("my-token");
      expect(client).toBeInstanceOf(AurinkoClient);
      expect(client.email).toBeDefined();
    });

    it("withAppCredentials creates client with Basic auth", () => {
      const client = AurinkoClient.withAppCredentials("id", "secret");
      expect(client).toBeInstanceOf(AurinkoClient);
      expect(client.auth).toBeDefined();
    });

    it("withFullConfig creates fully-configured client", () => {
      const client = AurinkoClient.withFullConfig({
        accessToken: "token",
        clientId: "id",
        clientSecret: "secret",
        webhookSigningSecret: "webhook-secret",
      });
      expect(client).toBeInstanceOf(AurinkoClient);
    });
  });

  describe("resource mounting", () => {
    let client: AurinkoClient;
    beforeEach(() => {
      client = AurinkoClient.withToken("token");
    });

    it("mounts all 9 expected resources", () => {
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
  });
});

// ─── HttpClient ───────────────────────────────────────────────────────────────

describe("HttpClient", () => {
  let originalFetch: typeof global.fetch;
  beforeEach(() => {
    originalFetch = global.fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("sends Bearer auth header", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { records: [] } }]);
    global.fetch = mockFetch;
    const client = new HttpClient({ accessToken: "my-bearer-token" });
    await client.get("/test");
    const [, init] = mockFetch.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer my-bearer-token",
    });
  });

  it("sends Basic auth header for app-level calls", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: {} }]);
    global.fetch = mockFetch;
    const client = new HttpClient({ clientId: "myId", clientSecret: "mySecret" });
    await client.get("/test", {}, { useAppAuth: true });
    const [, init] = mockFetch.mock.calls[0]!;
    const expected = `Basic ${Buffer.from("myId:mySecret").toString("base64")}`;
    expect((init as RequestInit).headers).toMatchObject({ Authorization: expected });
  });

  it("throws AuthenticationError when no auth credentials", async () => {
    const client = new HttpClient({ clientId: "id" }); // no secret or token
    await expect(client.get("/test")).rejects.toThrow(AuthenticationError);
  });

  it("sends X-Aurinko-SDK header on every request", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: {} }]);
    global.fetch = mockFetch;
    const client = new HttpClient({ accessToken: "t" });
    await client.get("/test");
    const [, init] = mockFetch.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({
      "X-Aurinko-SDK": expect.stringContaining("typescript"),
    });
  });

  it("sends Content-Type for POST with body", async () => {
    const mockFetch = makeFetchMock([{ status: 201, body: { id: "new" } }]);
    global.fetch = mockFetch;
    const client = new HttpClient({ accessToken: "t" });
    await client.post("/test", { name: "hello" });
    const [, init] = mockFetch.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({
      "Content-Type": "application/json",
    });
  });

  it("maps 400 to ValidationError", async () => {
    global.fetch = makeFetchMock([{ status: 400, body: { message: "bad request" } }]);
    const client = new HttpClient({ accessToken: "t" });
    await expect(client.get("/test")).rejects.toThrow(ValidationError);
  });

  it("maps 401 to AuthenticationError", async () => {
    global.fetch = makeFetchMock([{ status: 401, body: { message: "unauthorized" } }]);
    const client = new HttpClient({ accessToken: "t" });
    await expect(client.get("/test")).rejects.toThrow(AuthenticationError);
  });

  it("maps 403 to AuthorizationError", async () => {
    global.fetch = makeFetchMock([{ status: 403, body: { message: "forbidden" } }]);
    const client = new HttpClient({ accessToken: "t" });
    await expect(client.get("/test")).rejects.toThrow(AuthorizationError);
  });

  it("maps 404 to NotFoundError with correct statusCode", async () => {
    global.fetch = makeFetchMock([{ status: 404, body: { message: "not found" } }]);
    const client = new HttpClient({ accessToken: "t" });
    const err = (await client.get("/test").catch((e) => e)) as AurinkoError;

    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.statusCode).toBe(404);
  });

  it("maps 429 to RateLimitError with retryAfter", async () => {
    global.fetch = makeFetchMock([{ status: 429, body: {}, headers: { "retry-after": "60" } }]);
    const client = new HttpClient({ accessToken: "t", maxRetries: 0 });
    const err = (await client.get("/test").catch((e) => e)) as RateLimitError;
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.retryAfter).toBe(60);
  });

  it("maps 500 to ServerError", async () => {
    global.fetch = makeFetchMock([{ status: 500, body: {} }]);
    const client = new HttpClient({ accessToken: "t", maxRetries: 0 });
    await expect(client.get("/test")).rejects.toThrow(ServerError);
  });

  it("maps 502 to ServerError with correct statusCode", async () => {
    global.fetch = makeFetchMock([{ status: 502, body: {} }]);
    const client = new HttpClient({ accessToken: "t", maxRetries: 0 });
    const err = (await client.get("/test").catch((e) => e)) as ServerError;

    expect(err).toBeInstanceOf(ServerError);
    expect(err.statusCode).toBe(502);
  });

  it("retries on 500 and succeeds on second attempt", async () => {
    global.fetch = makeFetchMock([
      { status: 500, body: {} },
      { status: 200, body: { id: "ok" } },
    ]);
    const client = new HttpClient({ accessToken: "t", maxRetries: 2, retryDelayMs: 0 });
    const result = await client.get("/test");
    expect(result).toEqual({ id: "ok" });
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(2);
  });

  it("retries on 503 and succeeds after two retries", async () => {
    global.fetch = makeFetchMock([
      { status: 503, body: {} },
      { status: 503, body: {} },
      { status: 200, body: { data: "good" } },
    ]);
    const client = new HttpClient({ accessToken: "t", maxRetries: 3, retryDelayMs: 0 });
    const result = await client.get("/test");
    expect(result).toEqual({ data: "good" });
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(3);
  });

  it("respects maxRetries limit and throws ServerError", async () => {
    global.fetch = makeFetchMock([{ status: 503, body: {} }]);
    const client = new HttpClient({ accessToken: "t", maxRetries: 2, retryDelayMs: 0 });
    await expect(client.get("/test")).rejects.toThrow(ServerError);
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(3); // 1 + 2 retries
  });

  it("does NOT retry on 400 (non-retryable)", async () => {
    global.fetch = makeFetchMock([{ status: 400, body: {} }]);
    const client = new HttpClient({ accessToken: "t", maxRetries: 3, retryDelayMs: 0 });
    await expect(client.get("/test")).rejects.toThrow(ValidationError);
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);
  });

  it("throws TimeoutError on aborted request", async () => {
    global.fetch = jest
      .fn()
      .mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(
              () => reject(Object.assign(new Error("timeout"), { name: "AbortError" })),
              10
            )
          )
      );
    const client = new HttpClient({ accessToken: "t", timeoutMs: 1 });
    await expect(client.get("/test")).rejects.toThrow(TimeoutError);
  });

  it("builds query string correctly", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: {} }]);
    global.fetch = mockFetch;
    const client = new HttpClient({ accessToken: "t" });
    await client.get("/test", { q: "hello world", limit: 10, active: true });
    const [url] = mockFetch.mock.calls[0]!;
    expect(url as string).toContain("q=hello%20world");
    expect(url as string).toContain("limit=10");
    expect(url as string).toContain("active=true");
  });

  it("excludes undefined values from query string", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: {} }]);
    global.fetch = mockFetch;
    const client = new HttpClient({ accessToken: "t" });
    await client.get("/test", { q: undefined, limit: 5, name: undefined });
    const [url] = mockFetch.mock.calls[0]!;
    expect(url as string).not.toContain("q=");
    expect(url as string).not.toContain("name=");
    expect(url as string).toContain("limit=5");
  });

  it("returns null for 204 No Content", async () => {
    global.fetch = makeFetchMock([{ status: 204, body: null }]);
    const client = new HttpClient({ accessToken: "t" });
    const result = await client.delete("/test");
    expect(result).toBeNull();
  });

  it("serializes JSON body for POST", async () => {
    const mockFetch = makeFetchMock([{ status: 201, body: { id: "new" } }]);
    global.fetch = mockFetch;
    const client = new HttpClient({ accessToken: "t" });
    await client.post("/test", { name: "hello", count: 3 });
    const [, init] = mockFetch.mock.calls[0]!;
    expect((init as RequestInit).body).toBe(JSON.stringify({ name: "hello", count: 3 }));
  });

  it("serializes JSON body for PUT", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: "upd" } }]);
    global.fetch = mockFetch;
    const client = new HttpClient({ accessToken: "t" });
    await client.put("/test", { value: 42 });
    const [, init] = mockFetch.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("PUT");
    expect((init as RequestInit).body).toBe(JSON.stringify({ value: 42 }));
  });

  it("merges custom per-request headers", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: {} }]);
    global.fetch = mockFetch;
    const client = new HttpClient({ accessToken: "t" });
    await client.get("/test", {}, { headers: { "X-Custom-Header": "test-value" } });
    const [, init] = mockFetch.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({
      "X-Custom-Header": "test-value",
    });
  });

  it("getBuffer returns ArrayBuffer", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: {} }]);
    global.fetch = mockFetch;
    const client = new HttpClient({ accessToken: "t" });
    const buffer = await client.getBuffer("/test/attachment");
    expect(buffer).toBeInstanceOf(ArrayBuffer);
  });
});

// ─── Email Resource ───────────────────────────────────────────────────────────

describe("EmailResource", () => {
  let client: AurinkoClient;
  const savedFetch = global.fetch;
  afterEach(() => {
    global.fetch = savedFetch;
  });
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("lists messages at /email/messages", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { records: [] } }]);
    global.fetch = mockFetch;
    await client.email.messages.list({ q: "is:unread" });
    const [url] = mockFetch.mock.calls[0]!;
    expect(url as string).toContain("/email/messages");
    expect(url as string).toContain("q=is%3Aunread");
  });

  it("lists messages with pageToken and limit", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { records: [] } }]);
    global.fetch = mockFetch;
    await client.email.messages.list({ pageToken: "tok123", limit: 25 });
    const [url] = mockFetch.mock.calls[0]!;
    expect(url as string).toContain("pageToken=tok123");
    expect(url as string).toContain("limit=25");
  });

  it("lists messages with bodyType and loadBody", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { records: [] } }]);
    global.fetch = mockFetch;
    await client.email.messages.list({ bodyType: "html", loadBody: true });
    const [url] = mockFetch.mock.calls[0]!;
    expect(url as string).toContain("bodyType=html");
    expect(url as string).toContain("loadBody=true");
  });

  it("gets a message by id", async () => {
    global.fetch = makeFetchMock([{ status: 200, body: { id: "msg-1", subject: "Hello" } }]);
    const result = await client.email.messages.get("msg-1");
    expect(result.id).toBe("msg-1");
  });

  it("gets a message with bodyType param", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: "msg-1" } }]);
    global.fetch = mockFetch;
    await client.email.messages.get("msg-1", { bodyType: "text" });
    const [url] = mockFetch.mock.calls[0]!;
    expect(url as string).toContain("bodyType=text");
  });

  it("sends email as POST with bodyType query param", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: "sent-1" } }]);
    global.fetch = mockFetch;
    await client.email.messages.send({
      subject: "Test",
      body: "<p>Hello</p>",
      to: [{ address: "test@example.com" }],
    });
    const [url, init] = mockFetch.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("POST");
    expect(url as string).toContain("bodyType=html");
  });

  it("sends email with plain text bodyType", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: "sent-2" } }]);
    global.fetch = mockFetch;
    await client.email.messages.send({
      subject: "Plain",
      body: "Hello world",
      bodyType: "text",
      to: [{ address: "x@example.com" }],
    });
    const [url] = mockFetch.mock.calls[0]!;
    expect(url as string).toContain("bodyType=text");
  });

  it("updates message unread status via PATCH", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: "msg-1", unread: false } }]);
    global.fetch = mockFetch;
    await client.email.messages.update("msg-1", { unread: false });
    const [url, init] = mockFetch.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("PATCH");
    expect(url as string).toContain("/email/messages/msg-1");
  });

  it("updates message flagged status", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: "msg-2", flagged: true } }]);
    global.fetch = mockFetch;
    await client.email.messages.update("msg-2", { flagged: true });
    const [, init] = mockFetch.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.flagged).toBe(true);
  });

  it("iterates messages across pages (async generator)", async () => {
    let i = 0;
    const pages = [
      { records: [{ id: "a" }, { id: "b" }], nextPageToken: "p2" },
      { records: [{ id: "c" }] },
    ];
    global.fetch = jest.fn().mockImplementation(() => {
      const p = pages[i++]!;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () => Promise.resolve(JSON.stringify(p)),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      });
    });
    const collected: string[] = [];
    for await (const page of client.email.messages.iterate()) {
      collected.push(...page.records.map((r: { id: string }) => r.id));
    }
    expect(collected).toEqual(["a", "b", "c"]);
  });

  it("listAll collects all messages into array", async () => {
    let i = 0;
    const pages = [
      { records: [{ id: "x1" }, { id: "x2" }], nextPageToken: "p2" },
      { records: [{ id: "x3" }] },
    ];
    global.fetch = jest.fn().mockImplementation(() => {
      const p = pages[i++]!;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () => Promise.resolve(JSON.stringify(p)),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      });
    });
    const all = await client.email.messages.listAll();
    expect(all).toHaveLength(3);
    expect(all[0]).toMatchObject({ id: "x1" });
  });

  it("downloads attachment as ArrayBuffer", async () => {
    global.fetch = makeFetchMock([{ status: 200, body: null }]);
    const result = await client.email.attachments.download("msg-1", "att-1");
    expect(result).toMatchObject({ mimeType: "application/octet-stream", name: "att-1" });
    expect(result.data).toBeInstanceOf(ArrayBuffer);
  });

  it("lists drafts", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { records: [{ id: "d1" }] } }]);
    global.fetch = mockFetch;
    const result = await client.email.drafts.list();
    const [url] = mockFetch.mock.calls[0]!;
    expect(url as string).toContain("/email/drafts");
    expect(result.records).toHaveLength(1);
  });

  it("gets a draft by id", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: "d1" } }]);
    global.fetch = mockFetch;
    await client.email.drafts.get("d1");
    const [url] = mockFetch.mock.calls[0]!;
    expect(url as string).toContain("/email/drafts/d1");
  });

  it("creates a draft", async () => {
    const mockFetch = makeFetchMock([{ status: 201, body: { id: "draft-1" } }]);
    global.fetch = mockFetch;
    const draft = await client.email.drafts.create({
      subject: "Draft",
      body: "Hello",
      to: [{ address: "x@example.com" }],
    });
    expect(draft.id).toBe("draft-1");
    const [url, init] = mockFetch.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("POST");
    expect(url as string).toContain("bodyType=html");
  });

  it("updates a draft via PATCH", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: "d1" } }]);
    global.fetch = mockFetch;
    await client.email.drafts.update("d1", { subject: "Updated subject" });
    const [url, init] = mockFetch.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("PATCH");
    expect(url as string).toContain("/email/drafts/d1");
  });

  it("deletes a draft", async () => {
    const mockFetch = makeFetchMock([{ status: 204, body: null }]);
    global.fetch = mockFetch;
    await client.email.drafts.delete("d1");
    const [url, init] = mockFetch.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("DELETE");
    expect(url as string).toContain("/email/drafts/d1");
  });

  it("sends an existing draft", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: "sent-1" } }]);
    global.fetch = mockFetch;
    await client.email.drafts.send("draft-1");
    const [url] = mockFetch.mock.calls[0]!;
    expect(url as string).toContain("/email/drafts/draft-1/send");
  });

  it("lists tracking records", async () => {
    global.fetch = makeFetchMock([{ status: 200, body: { records: [{ id: 1 }] } }]);
    const result = await client.email.tracking.list({ limit: 10 });
    expect(result.records).toHaveLength(1);
  });

  it("gets a tracking record by id", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: 42 } }]);
    global.fetch = mockFetch;
    await client.email.tracking.get(42);
    const [url] = mockFetch.mock.calls[0]!;
    expect(url as string).toContain("/email/tracking/42");
  });

  it("starts email sync", async () => {
    global.fetch = makeFetchMock([
      { status: 200, body: { syncUpdatedToken: "ut", syncDeletedToken: "dt", ready: true } },
    ]);
    const result = await client.email.sync.start({ daysWithin: 30 });
    expect(result.ready).toBe(true);
    expect(result.syncUpdatedToken).toBe("ut");
  });

  it("fetches sync updated pages (multi-page)", async () => {
    const pages = [
      { records: [{ id: "m1" }], nextPageToken: "p2" },
      { records: [{ id: "m2" }], nextDeltaToken: "new-delta" },
    ];
    let i = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      const p = pages[i++]!;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () => Promise.resolve(JSON.stringify(p)),
      });
    });
    const { items, nextDeltaToken } = await client.email.sync.updated("old-delta");
    expect(items).toHaveLength(2);
    expect(nextDeltaToken).toBe("new-delta");
  });

  it("fetches sync deleted ids", async () => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () =>
          Promise.resolve(JSON.stringify({ records: [{ id: "del-1" }], nextDeltaToken: "d2" })),
      })
    );
    const { items, nextDeltaToken } = await client.email.sync.deleted("tok");
    expect(items[0]).toMatchObject({ id: "del-1" });
    expect(nextDeltaToken).toBe("d2");
  });
});

// ─── Calendar Resource ────────────────────────────────────────────────────────

describe("CalendarResource", () => {
  let client: AurinkoClient;
  const savedFetch = global.fetch;
  afterEach(() => {
    global.fetch = savedFetch;
  });
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("lists calendars", async () => {
    global.fetch = makeFetchMock([{ status: 200, body: { records: [{ id: "cal-1" }] } }]);
    const result = await client.calendar.list();
    expect(result.records[0]).toMatchObject({ id: "cal-1" });
  });

  it("gets a calendar by id", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: "work" } }]);
    global.fetch = mockFetch;
    await client.calendar.get("work");
    const [url] = mockFetch.mock.calls[0]!;
    expect(url as string).toContain("/calendars/work");
  });

  it("gets the primary calendar via getPrimary", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: "primary", isPrimary: true } }]);
    global.fetch = mockFetch;
    await client.calendar.getPrimary();
    const [url] = mockFetch.mock.calls[0]!;
    expect(url as string).toMatch(/\/calendars\/primary$/);
  });

  it("lists events on primary calendar", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { records: [] } }]);
    global.fetch = mockFetch;
    await client.calendar.primary.list();
    const [url] = mockFetch.mock.calls[0]!;
    expect(url as string).toContain("/calendars/primary/events");
  });

  it("listRange uses /events/range endpoint", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { records: [] } }]);
    global.fetch = mockFetch;
    await client.calendar.primary.listRange("2024-01-01T00:00:00Z", "2024-01-31T23:59:59Z");
    const [url] = mockFetch.mock.calls[0]!;
    expect(url as string).toContain("/events/range");
    expect(url as string).toContain("timeMin=");
    expect(url as string).toContain("timeMax=");
  });

  it("iterates events across pages", async () => {
    let i = 0;
    const pages = [{ records: [{ id: "e1" }], nextPageToken: "p2" }, { records: [{ id: "e2" }] }];
    global.fetch = jest.fn().mockImplementation(() => {
      const p = pages[i++]!;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () => Promise.resolve(JSON.stringify(p)),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      });
    });
    const all: string[] = [];
    for await (const page of client.calendar.primary.iterate()) {
      all.push(...page.records.map((r: { id: string }) => r.id));
    }
    expect(all).toEqual(["e1", "e2"]);
  });

  it("listAll collects all events", async () => {
    let i = 0;
    const pages = [
      { records: [{ id: "e1" }, { id: "e2" }], nextPageToken: "p2" },
      { records: [{ id: "e3" }] },
    ];
    global.fetch = jest.fn().mockImplementation(() => {
      const p = pages[i++]!;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () => Promise.resolve(JSON.stringify(p)),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      });
    });
    const all = await client.calendar.primary.listAll();
    expect(all).toHaveLength(3);
  });

  it("gets a single event by id", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: "evt-abc" } }]);
    global.fetch = mockFetch;
    await client.calendar.primary.get("evt-abc");
    const [url] = mockFetch.mock.calls[0]!;
    expect(url as string).toContain("/events/evt-abc");
  });

  it("creates event on primary calendar", async () => {
    const mockFetch = makeFetchMock([{ status: 201, body: { id: "evt-1" } }]);
    global.fetch = mockFetch;
    await client.calendar.primary.create({
      subject: "Lunch",
      start: { dateTime: "2024-03-01T12:00:00Z" },
      end: { dateTime: "2024-03-01T13:00:00Z" },
    });
    const [url, init] = mockFetch.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("POST");
    expect(url as string).toContain("/calendars/primary/events");
  });

  it("creates event with returnRecord=true", async () => {
    const mockFetch = makeFetchMock([{ status: 201, body: { id: "evt-2" } }]);
    global.fetch = mockFetch;
    await client.calendar.primary.create(
      {
        subject: "Meeting",
        start: { dateTime: "2024-03-01T09:00:00Z" },
        end: { dateTime: "2024-03-01T10:00:00Z" },
      },
      { returnRecord: true }
    );
    const [url] = mockFetch.mock.calls[0]!;
    expect(url as string).toContain("returnRecord=true");
  });

  it("updates event with notifyAttendees param", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: "evt-1" } }]);
    global.fetch = mockFetch;
    await client.calendar.primary.update(
      "evt-1",
      { subject: "New title" },
      { notifyAttendees: true }
    );
    const [url] = mockFetch.mock.calls[0]!;
    expect(url as string).toContain("notifyAttendees=true");
    expect(url as string).toContain("/events/evt-1");
  });

  it("deletes event", async () => {
    const mockFetch = makeFetchMock([{ status: 204, body: null }]);
    global.fetch = mockFetch;
    await client.calendar.primary.delete("evt-1");
    const [, init] = mockFetch.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("deletes event with notifyAttendees=true", async () => {
    const mockFetch = makeFetchMock([{ status: 204, body: null }]);
    global.fetch = mockFetch;
    await client.calendar.primary.delete("evt-1", { notifyAttendees: true });
    const [url] = mockFetch.mock.calls[0]!;
    expect(url as string).toContain("notifyAttendees=true");
  });

  it("queries free/busy", async () => {
    global.fetch = makeFetchMock([
      {
        status: 200,
        body: { timeMin: "2024-01-01T00:00:00Z", timeMax: "2024-01-02T00:00:00Z", intervals: [] },
      },
    ]);
    const result = await client.calendar.primary.freeBusy(
      "2024-01-01T00:00:00Z",
      "2024-01-02T00:00:00Z"
    );
    expect(result.intervals).toEqual([]);
  });

  it("starts calendar sync", async () => {
    global.fetch = makeFetchMock([
      { status: 200, body: { syncUpdatedToken: "t1", syncDeletedToken: "t2", ready: true } },
    ]);
    const result = await client.calendar.primary.sync.start({ timeMin: "2024-01-01T00:00:00Z" });
    expect(result.ready).toBe(true);
  });

  it("fetches sync updated events", async () => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () =>
          Promise.resolve(
            JSON.stringify({ records: [{ id: "evt-up" }], nextDeltaToken: "delta2" })
          ),
      })
    );
    const { items, nextDeltaToken } = await client.calendar.primary.sync.updated("delta1");
    expect(items[0]).toMatchObject({ id: "evt-up" });
    expect(nextDeltaToken).toBe("delta2");
  });

  it("fetches sync deleted event ids", async () => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () =>
          Promise.resolve(JSON.stringify({ records: [{ id: "del-evt" }], nextDeltaToken: "d3" })),
      })
    );
    const { items } = await client.calendar.primary.sync.deleted("delta1");
    expect(items[0]).toMatchObject({ id: "del-evt" });
  });

  it("accesses calendar by specific ID", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { records: [] } }]);
    global.fetch = mockFetch;
    await client.calendar.forCalendar("work-cal").list();
    const [url] = mockFetch.mock.calls[0]!;
    expect(url as string).toContain("/calendars/work-cal/events");
  });

  it("URL-encodes calendar ID with spaces", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { records: [] } }]);
    global.fetch = mockFetch;
    await client.calendar.forCalendar("cal with spaces").list();
    const [url] = mockFetch.mock.calls[0]!;
    expect(url as string).toContain("cal%20with%20spaces");
  });
});

// ─── Contacts Resource ────────────────────────────────────────────────────────

describe("ContactsResource", () => {
  let client: AurinkoClient;
  const savedFetch = global.fetch;
  afterEach(() => {
    global.fetch = savedFetch;
  });
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("lists contacts", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { records: [{ id: "c-1" }] } }]);
    global.fetch = mockFetch;
    const result = await client.contacts.list();
    expect(url(mockFetch)).toContain("/contacts");
    expect(result.records).toHaveLength(1);
  });

  it("lists contacts with query params", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { records: [] } }]);
    global.fetch = mockFetch;
    await client.contacts.list({ limit: 20, pageToken: "tok" });
    expect(url(mockFetch)).toContain("limit=20");
    expect(url(mockFetch)).toContain("pageToken=tok");
  });

  it("gets a contact by id", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: "c-99" } }]);
    global.fetch = mockFetch;
    await client.contacts.get("c-99");
    expect(url(mockFetch)).toContain("/contacts/c-99");
  });

  it("creates a contact", async () => {
    const mockFetch = makeFetchMock([{ status: 201, body: { id: "c-1" } }]);
    global.fetch = mockFetch;
    await client.contacts.create({
      name: { givenName: "Jane", familyName: "Doe" },
      emailAddresses: [{ address: "jane@example.com", type: "work" }],
    });
    expect(method(mockFetch)).toBe("POST");
    expect(url(mockFetch)).toContain("/contacts");
  });

  it("updates contact with If-Match header", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: "c-1" } }]);
    global.fetch = mockFetch;
    await client.contacts.update("c-1", "etag-value-123", { notes: "VIP" });
    const [, init] = mockFetch.mock.calls[0]!;
    expect((init as RequestInit).headers).toMatchObject({ "If-Match": "etag-value-123" });
    expect((init as RequestInit).method).toBe("PATCH");
  });

  it("deletes a contact", async () => {
    const mockFetch = makeFetchMock([{ status: 204, body: null }]);
    global.fetch = mockFetch;
    await client.contacts.delete("c-1");
    expect(method(mockFetch)).toBe("DELETE");
    expect(url(mockFetch)).toContain("/contacts/c-1");
  });

  it("iterates contacts across pages", async () => {
    let i = 0;
    const pages = [{ records: [{ id: "c1" }], nextPageToken: "p2" }, { records: [{ id: "c2" }] }];
    global.fetch = jest.fn().mockImplementation(() => {
      const p = pages[i++]!;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () => Promise.resolve(JSON.stringify(p)),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      });
    });
    const ids: string[] = [];
    for await (const page of client.contacts.iterate()) {
      ids.push(...page.records.map((c: { id: string }) => c.id));
    }
    expect(ids).toEqual(["c1", "c2"]);
  });

  it("listAll collects all contacts", async () => {
    let i = 0;
    const pages = [
      { records: [{ id: "c1" }, { id: "c2" }], nextPageToken: "p2" },
      { records: [{ id: "c3" }] },
    ];
    global.fetch = jest.fn().mockImplementation(() => {
      const p = pages[i++]!;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () => Promise.resolve(JSON.stringify(p)),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      });
    });
    const all = await client.contacts.listAll();
    expect(all).toHaveLength(3);
  });

  it("starts contacts sync", async () => {
    global.fetch = makeFetchMock([
      { status: 200, body: { syncUpdatedToken: "cu1", syncDeletedToken: "cd1", ready: true } },
    ]);
    const result = await client.contacts.sync.start();
    expect(result.syncUpdatedToken).toBe("cu1");
  });

  it("fetches sync updated contacts", async () => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () =>
          Promise.resolve(
            JSON.stringify({ records: [{ id: "c-updated" }], nextDeltaToken: "dt2" })
          ),
      })
    );
    const { items, nextDeltaToken } = await client.contacts.sync.updated("dt1");
    expect(items).toHaveLength(1);
    expect(nextDeltaToken).toBe("dt2");
  });

  it("fetches sync deleted contact ids", async () => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () =>
          Promise.resolve(JSON.stringify({ records: [{ id: "c-del" }], nextDeltaToken: "dt3" })),
      })
    );
    const { items } = await client.contacts.sync.deleted("dt2");
    expect(items[0]).toMatchObject({ id: "c-del" });
  });
});

// ─── Tasks Resource ───────────────────────────────────────────────────────────

describe("TasksResource", () => {
  let client: AurinkoClient;
  const savedFetch = global.fetch;
  afterEach(() => {
    global.fetch = savedFetch;
  });
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("lists all task lists", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { records: [{ id: "tl-1" }] } }]);
    global.fetch = mockFetch;
    const result = await client.tasks.lists.list();
    expect(url(mockFetch)).toContain("/tasklists");
    expect(result.records).toHaveLength(1);
  });

  it("gets a task list by id", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: "tl-2" } }]);
    global.fetch = mockFetch;
    await client.tasks.lists.get("tl-2");
    expect(url(mockFetch)).toContain("/tasklists/tl-2");
  });

  it("gets default task list", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: "default" } }]);
    global.fetch = mockFetch;
    await client.tasks.lists.getDefault();
    expect(url(mockFetch)).toContain("/tasklists/default");
  });

  it("creates a task list", async () => {
    const mockFetch = makeFetchMock([{ status: 201, body: { id: "tl-new", name: "Shopping" } }]);
    global.fetch = mockFetch;
    const result = await client.tasks.lists.create({ name: "Shopping" });
    expect(result.id).toBe("tl-new");
    expect(method(mockFetch)).toBe("POST");
  });

  it("updates a task list", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: "tl-1" } }]);
    global.fetch = mockFetch;
    await client.tasks.lists.update("tl-1", { name: "Renamed" });
    expect(method(mockFetch)).toBe("PATCH");
    expect(url(mockFetch)).toContain("/tasklists/tl-1");
  });

  it("deletes a task list", async () => {
    const mockFetch = makeFetchMock([{ status: 204, body: null }]);
    global.fetch = mockFetch;
    await client.tasks.lists.delete("tl-1");
    expect(method(mockFetch)).toBe("DELETE");
  });

  it("lists tasks in default list", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { records: [{ id: "t-1" }] } }]);
    global.fetch = mockFetch;
    await client.tasks.default.list();
    expect(url(mockFetch)).toContain("/tasklists/default/tasks");
  });

  it("gets a task by id", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: "t-99" } }]);
    global.fetch = mockFetch;
    await client.tasks.default.get("t-99");
    expect(url(mockFetch)).toContain("/tasklists/default/tasks/t-99");
  });

  it("creates a task in default list", async () => {
    const mockFetch = makeFetchMock([{ status: 201, body: { id: "t-1", title: "Buy milk" } }]);
    global.fetch = mockFetch;
    const result = await client.tasks.default.create({ title: "Buy milk", importance: "high" });
    expect(result.id).toBe("t-1");
    expect(method(mockFetch)).toBe("POST");
    expect(url(mockFetch)).toContain("/tasklists/default/tasks");
  });

  it("creates a task with due date", async () => {
    const mockFetch = makeFetchMock([{ status: 201, body: { id: "t-2" } }]);
    global.fetch = mockFetch;
    await client.tasks.default.create({ title: "Deadline task", due: "2024-12-31T23:59:59Z" });
    const [, init] = mockFetch.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.due).toBe("2024-12-31T23:59:59Z");
  });

  it("updates a task", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: "t-1", status: "completed" } }]);
    global.fetch = mockFetch;
    await client.tasks.forList("default").update("t-1", { status: "completed" });
    expect(method(mockFetch)).toBe("PATCH");
    expect(url(mockFetch)).toContain("/tasklists/default/tasks/t-1");
  });

  it("deletes a task", async () => {
    const mockFetch = makeFetchMock([{ status: 204, body: null }]);
    global.fetch = mockFetch;
    await client.tasks.default.delete("t-1");
    expect(method(mockFetch)).toBe("DELETE");
    expect(url(mockFetch)).toContain("/tasklists/default/tasks/t-1");
  });

  it("iterates tasks across pages", async () => {
    let i = 0;
    const pages = [{ records: [{ id: "t1" }], nextPageToken: "p2" }, { records: [{ id: "t2" }] }];
    global.fetch = jest.fn().mockImplementation(() => {
      const p = pages[i++]!;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () => Promise.resolve(JSON.stringify(p)),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      });
    });
    const all: string[] = [];
    for await (const page of client.tasks.default.iterate()) {
      all.push(...page.records.map((t: { id: string }) => t.id));
    }
    expect(all).toEqual(["t1", "t2"]);
  });

  it("listAll collects all tasks", async () => {
    let i = 0;
    const pages = [
      { records: [{ id: "t1" }, { id: "t2" }], nextPageToken: "p2" },
      { records: [{ id: "t3" }] },
    ];
    global.fetch = jest.fn().mockImplementation(() => {
      const p = pages[i++]!;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () => Promise.resolve(JSON.stringify(p)),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      });
    });
    const all = await client.tasks.default.listAll();
    expect(all).toHaveLength(3);
  });

  it("starts tasks sync", async () => {
    global.fetch = makeFetchMock([
      { status: 200, body: { syncUpdatedToken: "tu1", syncDeletedToken: "td1", ready: true } },
    ]);
    const result = await client.tasks.default.sync.start({
      skipCompletedBeforeDate: "2024-01-01T00:00:00Z",
    });
    expect(result.ready).toBe(true);
  });

  it("fetches sync updated tasks", async () => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () =>
          Promise.resolve(JSON.stringify({ records: [{ id: "t-upd" }], nextDeltaToken: "dt2" })),
      })
    );
    const { items, nextDeltaToken } = await client.tasks.default.sync.updated("dt1");
    expect(items).toHaveLength(1);
    expect(nextDeltaToken).toBe("dt2");
  });

  it("fetches sync deleted task ids", async () => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () =>
          Promise.resolve(JSON.stringify({ records: [{ id: "t-del" }], nextDeltaToken: "dt3" })),
      })
    );
    const { items } = await client.tasks.default.sync.deleted("dt2");
    expect(items[0]).toMatchObject({ id: "t-del" });
  });

  it("forList uses specific list id in path", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { records: [] } }]);
    global.fetch = mockFetch;
    await client.tasks.forList("my-custom-list").list();
    expect(url(mockFetch)).toContain("/tasklists/my-custom-list/tasks");
  });
});

// ─── Webhooks Resource ────────────────────────────────────────────────────────

describe("WebhooksResource", () => {
  let client: AurinkoClient;
  const savedFetch = global.fetch;
  const SIGNING_SECRET = "test-webhook-secret-abc123";
  afterEach(() => {
    global.fetch = savedFetch;
  });
  beforeEach(() => {
    client = AurinkoClient.withFullConfig({
      accessToken: "test-token",
      webhookSigningSecret: SIGNING_SECRET,
    });
  });

  it("lists subscriptions", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { records: [{ id: 1 }] } }]);
    global.fetch = mockFetch;
    const result = await client.webhooks.list();
    expect(url(mockFetch)).toContain("/subscriptions");
    expect(result.records).toHaveLength(1);
  });

  it("gets a subscription by id", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: 5 } }]);
    global.fetch = mockFetch;
    await client.webhooks.get(5);
    expect(url(mockFetch)).toContain("/subscriptions/5");
  });

  it("creates a custom subscription", async () => {
    const mockFetch = makeFetchMock([{ status: 201, body: { id: 10, resource: "/contacts" } }]);
    global.fetch = mockFetch;
    await client.webhooks.create({
      resource: "/contacts",
      notificationUrl: "https://myapp.com/hooks",
    });
    const [, init] = mockFetch.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.resource).toBe("/contacts");
  });

  it("subscribeToEmail sets correct resource", async () => {
    const mockFetch = makeFetchMock([
      { status: 201, body: { id: 1, resource: "/email/messages" } },
    ]);
    global.fetch = mockFetch;
    const sub = await client.webhooks.subscribeToEmail("https://myapp.com/hooks");
    expect(sub.resource).toBe("/email/messages");
    const [, init] = mockFetch.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.notificationUrl).toBe("https://myapp.com/hooks");
  });

  it("subscribeToEmailTracking sets /email/tracking resource", async () => {
    const mockFetch = makeFetchMock([
      { status: 201, body: { id: 2, resource: "/email/tracking" } },
    ]);
    global.fetch = mockFetch;
    const sub = await client.webhooks.subscribeToEmailTracking("https://myapp.com/hooks");
    expect(sub.resource).toBe("/email/tracking");
  });

  it("subscribeToCalendar defaults to primary", async () => {
    const mockFetch = makeFetchMock([
      { status: 201, body: { id: 3, resource: "/calendars/primary/events" } },
    ]);
    global.fetch = mockFetch;
    await client.webhooks.subscribeToCalendar("https://myapp.com/hooks");
    const [, init] = mockFetch.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.resource).toBe("/calendars/primary/events");
  });

  it("subscribeToCalendar uses provided calendarId", async () => {
    const mockFetch = makeFetchMock([
      { status: 201, body: { id: 4, resource: "/calendars/work/events" } },
    ]);
    global.fetch = mockFetch;
    await client.webhooks.subscribeToCalendar("https://myapp.com/hooks", "work");
    const [, init] = mockFetch.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.resource).toBe("/calendars/work/events");
  });

  it("subscribeToContacts uses /contacts resource", async () => {
    const mockFetch = makeFetchMock([{ status: 201, body: { id: 5, resource: "/contacts" } }]);
    global.fetch = mockFetch;
    const sub = await client.webhooks.subscribeToContacts("https://myapp.com/hooks");
    expect(sub.resource).toBe("/contacts");
  });

  it("subscribeToTasks defaults to default list", async () => {
    const mockFetch = makeFetchMock([
      { status: 201, body: { id: 6, resource: "/tasklists/default/tasks" } },
    ]);
    global.fetch = mockFetch;
    await client.webhooks.subscribeToTasks("https://myapp.com/hooks");
    const [, init] = mockFetch.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.resource).toBe("/tasklists/default/tasks");
  });

  it("subscribeToTasks uses provided taskListId", async () => {
    const mockFetch = makeFetchMock([
      { status: 201, body: { id: 7, resource: "/tasklists/my-list/tasks" } },
    ]);
    global.fetch = mockFetch;
    await client.webhooks.subscribeToTasks("https://myapp.com/hooks", "my-list");
    const [, init] = mockFetch.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.resource).toBe("/tasklists/my-list/tasks");
  });

  it("subscribeToBooking uses /booking/:id resource", async () => {
    const mockFetch = makeFetchMock([{ status: 201, body: { id: 8, resource: "/booking/42" } }]);
    global.fetch = mockFetch;
    await client.webhooks.subscribeToBooking(42, "https://myapp.com/hooks");
    const [, init] = mockFetch.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.resource).toBe("/booking/42");
  });

  it("deletes subscription by numeric id", async () => {
    global.fetch = makeFetchMock([{ status: 204, body: null }]);
    await client.webhooks.delete(123);
    const [u, init] = (global.fetch as jest.Mock).mock.calls[0]!;
    expect(u as string).toContain("/subscriptions/123");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("verifies valid webhook signature without throwing", () => {
    const body = JSON.stringify({ subscription: 1 });
    const timestamp = freshTimestamp();
    const signature = makeWebhookSignature(SIGNING_SECRET, timestamp, body);
    expect(() => client.webhooks.verify({ rawBody: body, signature, timestamp })).not.toThrow();
  });

  it("throws WebhookVerificationError on invalid signature", () => {
    const timestamp = freshTimestamp();
    expect(() =>
      client.webhooks.verify({ rawBody: "{}", signature: "bad-sig", timestamp })
    ).toThrow(WebhookVerificationError);
  });

  it("throws on stale timestamp", () => {
    const body = "{}";
    const stale = String(Math.floor(Date.now() / 1000) - 400);
    const sig = makeWebhookSignature(SIGNING_SECRET, stale, body);
    expect(() =>
      client.webhooks.verify({ rawBody: body, signature: sig, timestamp: stale }, 300)
    ).toThrow(WebhookVerificationError);
  });

  it("verify throws when no signing secret configured", () => {
    const noSecretClient = AurinkoClient.withToken("tok");
    expect(() =>
      noSecretClient.webhooks.verify({
        rawBody: "{}",
        signature: "sig",
        timestamp: freshTimestamp(),
      })
    ).toThrow();
  });

  it("isValid returns false when no signing secret configured", () => {
    const noSecretClient = AurinkoClient.withToken("tok");
    expect(
      noSecretClient.webhooks.isValid({
        rawBody: "{}",
        signature: "sig",
        timestamp: freshTimestamp(),
      })
    ).toBe(false);
  });

  it("parseAndVerify returns parsed notification", () => {
    const notification = { subscription: 42, resource: "/email/messages", accountId: 1 };
    const body = JSON.stringify(notification);
    const timestamp = freshTimestamp();
    const signature = makeWebhookSignature(SIGNING_SECRET, timestamp, body);
    const result = client.webhooks.parseAndVerify(body, signature, timestamp);
    expect(result.subscription).toBe(42);
    expect(result.resource).toBe("/email/messages");
  });

  it("parseAndVerify throws on invalid signature", () => {
    expect(() => client.webhooks.parseAndVerify("{}", "bad-sig", freshTimestamp())).toThrow(
      WebhookVerificationError
    );
  });

  it("isValid returns true for valid signature", () => {
    const body = "{}";
    const timestamp = freshTimestamp();
    const sig = makeWebhookSignature(SIGNING_SECRET, timestamp, body);
    expect(client.webhooks.isValid({ rawBody: body, signature: sig, timestamp })).toBe(true);
  });

  it("isValid returns false for invalid signature", () => {
    expect(
      client.webhooks.isValid({ rawBody: "{}", signature: "bad", timestamp: freshTimestamp() })
    ).toBe(false);
  });
});

// ─── Booking Resource ─────────────────────────────────────────────────────────

describe("BookingResource", () => {
  let client: AurinkoClient;
  const savedFetch = global.fetch;
  afterEach(() => {
    global.fetch = savedFetch;
  });
  beforeEach(() => {
    client = AurinkoClient.withFullConfig({
      accessToken: "test-token",
      clientId: "app-id",
      clientSecret: "app-secret",
    });
  });

  it("lists booking profiles", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { records: [{ id: 1 }] } }]);
    global.fetch = mockFetch;
    const result = await client.booking.listProfiles();
    expect(url(mockFetch)).toContain("/book/account/profiles");
    expect(result.records).toHaveLength(1);
  });

  it("gets a booking profile", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: 5 } }]);
    global.fetch = mockFetch;
    await client.booking.getProfile(5);
    expect(url(mockFetch)).toContain("/book/account/profiles/5");
  });

  it("creates booking profile", async () => {
    const mockFetch = makeFetchMock([
      { status: 201, body: { id: 1, name: "Demo Call", durationMinutes: 30 } },
    ]);
    global.fetch = mockFetch;
    const profile = await client.booking.createProfile({ name: "Demo Call", durationMinutes: 30 });
    expect(profile.id).toBe(1);
    expect(method(mockFetch)).toBe("POST");
  });

  it("updates a booking profile", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: 1 } }]);
    global.fetch = mockFetch;
    await client.booking.updateProfile(1, { name: "Updated" });
    expect(method(mockFetch)).toBe("PATCH");
    expect(url(mockFetch)).toContain("/book/account/profiles/1");
  });

  it("deletes a booking profile", async () => {
    const mockFetch = makeFetchMock([{ status: 204, body: null }]);
    global.fetch = mockFetch;
    await client.booking.deleteProfile(1);
    expect(method(mockFetch)).toBe("DELETE");
    expect(url(mockFetch)).toContain("/book/account/profiles/1");
  });

  it("getAvailability uses Basic (app) auth", async () => {
    const mockFetch = makeFetchMock([
      {
        status: 200,
        body: { items: [{ start: "2024-03-01T14:00:00Z", end: "2024-03-01T14:30:00Z" }] },
      },
    ]);
    global.fetch = mockFetch;
    const avail = await client.booking.getAvailability(1);
    expect(avail.items).toHaveLength(1);
    const [, init] = mockFetch.mock.calls[0]!;
    const authHeader = (init as RequestInit).headers as Record<string, string>;
    expect(authHeader["Authorization"]).toMatch(/^Basic /);
  });

  it("books a meeting", async () => {
    const mockFetch = makeFetchMock([
      { status: 200, body: { eventId: "evt-booked", bookingId: 99 } },
    ]);
    global.fetch = mockFetch;
    const result = await client.booking.book(1, {
      time: { start: "2024-03-01T14:00:00Z", end: "2024-03-01T14:30:00Z" },
      name: "Jane Doe",
      email: "jane@example.com",
    });
    expect(result.bookingId).toBe(99);
    expect(url(mockFetch)).toContain("/book/account/profiles/1/meeting");
  });

  it("books with substitution data", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { eventId: "e", bookingId: 100 } }]);
    global.fetch = mockFetch;
    await client.booking.book(1, {
      time: { start: "2024-03-01T14:00:00Z", end: "2024-03-01T14:30:00Z" },
      name: "Alice",
      email: "alice@example.com",
      substitutionData: { comments: "Looking forward to it!" },
    });
    const [, init] = mockFetch.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.substitutionData.comments).toBe("Looking forward to it!");
  });
});

// ─── Group Booking Resource ───────────────────────────────────────────────────

describe("GroupBookingResource", () => {
  let client: AurinkoClient;
  const savedFetch = global.fetch;
  afterEach(() => {
    global.fetch = savedFetch;
  });
  beforeEach(() => {
    client = AurinkoClient.withAppCredentials("app-id", "app-secret");
  });

  it("listProfiles uses app auth", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { records: [{ id: 1 }] } }]);
    global.fetch = mockFetch;
    await client.groupBooking.listProfiles();
    const [, init] = mockFetch.mock.calls[0]!;
    const authHeader = (init as RequestInit).headers as Record<string, string>;
    expect(authHeader["Authorization"]).toMatch(/^Basic /);
  });

  it("gets a group profile by id", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: 10 } }]);
    global.fetch = mockFetch;
    await client.groupBooking.getProfile(10);
    expect(url(mockFetch)).toContain("/book/group/profiles/10");
  });

  it("creates group profile", async () => {
    global.fetch = makeFetchMock([{ status: 201, body: { id: 10 } }]);
    const result = await client.groupBooking.createProfile({
      name: "Team Call",
      durationMinutes: 45,
    });
    expect(result.id).toBe(10);
  });

  it("updates group profile", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: 10 } }]);
    global.fetch = mockFetch;
    await client.groupBooking.updateProfile(10, { name: "Updated" });
    expect(method(mockFetch)).toBe("PATCH");
    expect(url(mockFetch)).toContain("/book/group/profiles/10");
  });

  it("deletes group profile", async () => {
    const mockFetch = makeFetchMock([{ status: 204, body: null }]);
    global.fetch = mockFetch;
    await client.groupBooking.deleteProfile(10);
    expect(method(mockFetch)).toBe("DELETE");
    expect(url(mockFetch)).toContain("/book/group/profiles/10");
  });

  it("attaches accounts to profile", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: null }]);
    global.fetch = mockFetch;
    await client.groupBooking.attachAccounts(10, { accountIds: [1, 2, 3] });
    expect(url(mockFetch)).toContain("/attachAccounts");
    const [, init] = mockFetch.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.accountIds).toEqual([1, 2, 3]);
  });

  it("attaches groups with required=one", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: null }]);
    global.fetch = mockFetch;
    await client.groupBooking.attachGroups(10, {
      groups: [{ extId: "team-east", accountIds: [1, 2], required: "one" }],
    });
    expect(url(mockFetch)).toContain("/attachGroups");
    const [, init] = mockFetch.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.groups[0].required).toBe("one");
  });

  it("attaches groups with required=all", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: null }]);
    global.fetch = mockFetch;
    await client.groupBooking.attachGroups(10, {
      groups: [{ extId: "team-west", accountIds: [3, 4], required: "all" }],
    });
    const [, init] = mockFetch.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.groups[0].required).toBe("all");
  });

  it("getAvailability with required=all", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { items: [] } }]);
    global.fetch = mockFetch;
    await client.groupBooking.getAvailability(10, "all");
    expect(url(mockFetch)).toContain("required=all");
  });

  it("getAvailability defaults to required=one", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { items: [] } }]);
    global.fetch = mockFetch;
    await client.groupBooking.getAvailability(10);
    expect(url(mockFetch)).toContain("required=one");
  });

  it("getAvailability with offset for large groups", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { items: [] } }]);
    global.fetch = mockFetch;
    await client.groupBooking.getAvailability(10, "one", { offset: 10 });
    expect(url(mockFetch)).toContain("offset=10");
  });

  it("books a group meeting", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { eventId: "evt-grp", bookingId: 55 } }]);
    global.fetch = mockFetch;
    const result = await client.groupBooking.book(10, "one", {
      time: { start: "2024-03-01T14:00:00Z", end: "2024-03-01T14:45:00Z" },
      name: "Alice",
      email: "alice@example.com",
      groupXids: ["team-east"],
    });
    expect(result.bookingId).toBe(55);
    expect(url(mockFetch)).toContain("/book/group/profiles/10/meeting");
    expect(url(mockFetch)).toContain("required=one");
  });
});

// ─── Auth Resource ────────────────────────────────────────────────────────────

describe("AuthResource", () => {
  let client: AurinkoClient;
  const savedFetch = global.fetch;
  afterEach(() => {
    global.fetch = savedFetch;
  });
  beforeEach(() => {
    client = AurinkoClient.withAppCredentials("app-id", "app-secret");
  });

  it("initiateOAuth uses app auth", async () => {
    const mockFetch = makeFetchMock([
      { status: 200, body: { authorizationUrl: "https://accounts.google.com/..." } },
    ]);
    global.fetch = mockFetch;
    const result = await client.auth.initiateOAuth({
      serviceType: "Google",
      scopes: ["Mail.Read"],
      returnUrl: "https://myapp.com/callback",
    });
    expect(result.authorizationUrl).toContain("google.com");
    const [, init] = mockFetch.mock.calls[0]!;
    const authHeader = (init as RequestInit).headers as Record<string, string>;
    expect(authHeader["Authorization"]).toMatch(/^Basic /);
  });

  it("exchangeCode returns access token", async () => {
    global.fetch = makeFetchMock([
      { status: 200, body: { accessToken: "acc-tok-123", accountId: 42 } },
    ]);
    const result = await client.auth.exchangeCode({ code: "oauth-code-xyz" });
    expect(result.accessToken).toBe("acc-tok-123");
    expect(result.accountId).toBe(42);
  });

  it("listAccounts hits /accounts", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { records: [{ id: 1 }] } }]);
    global.fetch = mockFetch;
    const result = await client.auth.listAccounts();
    expect(url(mockFetch)).toContain("/accounts");
    expect(result.records[0]).toMatchObject({ id: 1 });
  });

  it("getAccount hits /accounts/:id", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { id: 7 } }]);
    global.fetch = mockFetch;
    const result = await client.auth.getAccount(7);
    expect(result.id).toBe(7);
    expect(url(mockFetch)).toContain("/accounts/7");
  });

  it("deleteAccount uses DELETE method", async () => {
    const mockFetch = makeFetchMock([{ status: 204, body: null }]);
    global.fetch = mockFetch;
    await client.auth.deleteAccount(7);
    expect(method(mockFetch)).toBe("DELETE");
    expect(url(mockFetch)).toContain("/accounts/7");
  });
});

// ─── Direct API Resource ──────────────────────────────────────────────────────

describe("DirectResource", () => {
  let client: AurinkoClient;
  const savedFetch = global.fetch;
  afterEach(() => {
    global.fetch = savedFetch;
  });
  beforeEach(() => {
    client = AurinkoClient.withToken("token");
  });

  it("generic GET routes to /direct/path", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: {} }]);
    global.fetch = mockFetch;
    await client.direct.get("/some/provider/path");
    expect(url(mockFetch)).toContain("/direct/some/provider/path");
  });

  it("generic DELETE routes correctly", async () => {
    const mockFetch = makeFetchMock([{ status: 204, body: null }]);
    global.fetch = mockFetch;
    await client.direct.delete("/some/resource/123");
    expect(method(mockFetch)).toBe("DELETE");
  });

  it("generic POST with body", async () => {
    const mockFetch = makeFetchMock([{ status: 201, body: { id: "new" } }]);
    global.fetch = mockFetch;
    await client.direct.post("/some/create", { name: "test" });
    expect(method(mockFetch)).toBe("POST");
    expect((mockFetch.mock.calls[0]![1] as RequestInit).body).toBe(
      JSON.stringify({ name: "test" })
    );
  });

  it("generic PATCH with body", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: {} }]);
    global.fetch = mockFetch;
    await client.direct.patch("/some/update/1", { field: "value" });
    expect(method(mockFetch)).toBe("PATCH");
  });

  it("generic PUT with body", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: {} }]);
    global.fetch = mockFetch;
    await client.direct.put("/some/replace/1", { full: "object" });
    expect(method(mockFetch)).toBe("PUT");
  });

  it("gmail helper routes to /direct/gmail/v1/*", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { messages: [] } }]);
    global.fetch = mockFetch;
    await client.direct.gmail("GET", "/users/me/messages");
    expect(url(mockFetch)).toContain("/direct/gmail/v1/users/me/messages");
  });

  it("gmail helper normalizes missing leading slash", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: {} }]);
    global.fetch = mockFetch;
    await client.direct.gmail("GET", "users/me/profile");
    expect(url(mockFetch)).toContain("/direct/gmail/v1/users/me/profile");
  });

  it("graph helper routes to /direct/me/*", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: { value: [] } }]);
    global.fetch = mockFetch;
    await client.direct.graph("GET", "/me/messages");
    expect(url(mockFetch)).toContain("/direct/me/messages");
  });

  it("graph POST sends body", async () => {
    const mockFetch = makeFetchMock([{ status: 201, body: { id: "event-id" } }]);
    global.fetch = mockFetch;
    await client.direct.graph("POST", "/me/events", { subject: "Meeting" });
    expect(method(mockFetch)).toBe("POST");
    const body = JSON.parse((mockFetch.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.subject).toBe("Meeting");
  });

  it("salesforce helper routes to /direct/services/data/v51.0/*", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: {} }]);
    global.fetch = mockFetch;
    await client.direct.salesforce("GET", "/sobjects/Contact/describe/");
    expect(url(mockFetch)).toContain("/direct/services/data/v51.0/sobjects/Contact/describe/");
  });

  it("salesforce helper accepts custom api version", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: {} }]);
    global.fetch = mockFetch;
    await client.direct.salesforce("GET", "/sobjects/Account", undefined, "v55.0");
    expect(url(mockFetch)).toContain("/direct/services/data/v55.0/sobjects/Account");
  });

  it("generic request passes query params", async () => {
    const mockFetch = makeFetchMock([{ status: 200, body: {} }]);
    global.fetch = mockFetch;
    await client.direct.request("GET", "/search", undefined, { q: "test", limit: 10 });
    expect(url(mockFetch)).toContain("q=test");
    expect(url(mockFetch)).toContain("limit=10");
  });
});

// ─── Webhook Utility Functions ────────────────────────────────────────────────

describe("verifyWebhookSignature", () => {
  const secret = "super-secret-key";

  it("passes with valid signature and fresh timestamp", () => {
    const body = '{"subscription":1}';
    const timestamp = freshTimestamp();
    const sig = makeWebhookSignature(secret, timestamp, body);
    expect(() =>
      verifyWebhookSignature({ rawBody: body, signature: sig, timestamp }, secret)
    ).not.toThrow();
  });

  it("throws on tampered body", () => {
    const timestamp = freshTimestamp();
    const sig = makeWebhookSignature(secret, timestamp, '{"subscription":1}');
    expect(() =>
      verifyWebhookSignature({ rawBody: '{"subscription":2}', signature: sig, timestamp }, secret)
    ).toThrow(WebhookVerificationError);
  });

  it("throws when signing secret is empty", () => {
    expect(() =>
      verifyWebhookSignature({ rawBody: "{}", signature: "sig", timestamp: "123" }, "")
    ).toThrow(WebhookVerificationError);
  });

  it("throws when signature is missing", () => {
    expect(() =>
      verifyWebhookSignature({ rawBody: "{}", signature: "", timestamp: freshTimestamp() }, secret)
    ).toThrow(WebhookVerificationError);
  });

  it("throws when timestamp is missing", () => {
    expect(() =>
      verifyWebhookSignature({ rawBody: "{}", signature: "sig", timestamp: "" }, secret)
    ).toThrow(WebhookVerificationError);
  });

  it("throws on invalid (non-numeric) timestamp", () => {
    expect(() =>
      verifyWebhookSignature({ rawBody: "{}", signature: "sig", timestamp: "not-a-number" }, secret)
    ).toThrow(WebhookVerificationError);
  });

  it("throws on stale timestamp exceeding maxAgeSeconds", () => {
    const body = "{}";
    const staleTs = String(Math.floor(Date.now() / 1000) - 600);
    const sig = makeWebhookSignature(secret, staleTs, body);
    expect(() =>
      verifyWebhookSignature({ rawBody: body, signature: sig, timestamp: staleTs }, secret, 300)
    ).toThrow(WebhookVerificationError);
  });

  it("passes with custom maxAgeSeconds if within range", () => {
    const body = "{}";
    const ts = String(Math.floor(Date.now() / 1000) - 50);
    const sig = makeWebhookSignature(secret, ts, body);
    expect(() =>
      verifyWebhookSignature({ rawBody: body, signature: sig, timestamp: ts }, secret, 3600)
    ).not.toThrow();
  });

  it("different-length signature fails gracefully", () => {
    const timestamp = freshTimestamp();
    expect(() =>
      verifyWebhookSignature({ rawBody: "{}", signature: "short", timestamp }, secret)
    ).toThrow(WebhookVerificationError);
  });
});

describe("isValidWebhookSignature", () => {
  const secret = "test-secret";

  it("returns true for valid signature", () => {
    const body = "{}";
    const timestamp = freshTimestamp();
    const sig = makeWebhookSignature(secret, timestamp, body);
    expect(isValidWebhookSignature({ rawBody: body, signature: sig, timestamp }, secret)).toBe(
      true
    );
  });

  it("returns false for invalid signature", () => {
    expect(
      isValidWebhookSignature(
        { rawBody: "{}", signature: "wrong", timestamp: freshTimestamp() },
        secret
      )
    ).toBe(false);
  });

  it("returns false for empty secret", () => {
    expect(isValidWebhookSignature({ rawBody: "{}", signature: "sig", timestamp: "123" }, "")).toBe(
      false
    );
  });

  it("returns false for stale timestamp", () => {
    const body = "{}";
    const staleTs = String(Math.floor(Date.now() / 1000) - 400);
    const sig = makeWebhookSignature(secret, staleTs, body);
    expect(
      isValidWebhookSignature({ rawBody: body, signature: sig, timestamp: staleTs }, secret, 300)
    ).toBe(false);
  });

  it("never throws — always returns false on error", () => {
    expect(() =>
      isValidWebhookSignature({ rawBody: "", signature: "", timestamp: "" }, "")
    ).not.toThrow();
  });
});

// ─── Pagination Utilities ─────────────────────────────────────────────────────

describe("Pagination utilities", () => {
  const savedFetch = global.fetch;
  afterEach(() => {
    global.fetch = savedFetch;
  });

  function makePagedFetch(pages: Array<{ records: number[]; nextPageToken?: string }>) {
    let i = 0;
    return jest.fn().mockImplementation(() => {
      const page = pages[i++] ?? pages[pages.length - 1]!;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () => Promise.resolve(JSON.stringify(page)),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      });
    });
  }

  it("paginate yields single page", async () => {
    global.fetch = makePagedFetch([{ records: [1, 2, 3] }]);
    const http = new HttpClient({ accessToken: "t" });
    const pages: number[][] = [];
    for await (const page of paginate<number>(http, "/test")) {
      pages.push(page.records);
    }
    expect(pages).toEqual([[1, 2, 3]]);
  });

  it("paginate iterates two pages", async () => {
    global.fetch = makePagedFetch([
      { records: [1, 2], nextPageToken: "page2" },
      { records: [3, 4] },
    ]);
    const http = new HttpClient({ accessToken: "t" });
    const pages: number[][] = [];
    for await (const page of paginate<number>(http, "/test")) {
      pages.push(page.records);
    }
    expect(pages).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("paginate iterates three pages", async () => {
    global.fetch = makePagedFetch([
      { records: [1], nextPageToken: "p2" },
      { records: [2], nextPageToken: "p3" },
      { records: [3] },
    ]);
    const http = new HttpClient({ accessToken: "t" });
    const all: number[] = [];
    for await (const page of paginate<number>(http, "/test")) {
      all.push(...page.records);
    }
    expect(all).toEqual([1, 2, 3]);
  });

  it("paginate handles empty records", async () => {
    global.fetch = makePagedFetch([{ records: [] }]);
    const http = new HttpClient({ accessToken: "t" });
    const pages: number[][] = [];
    for await (const page of paginate<number>(http, "/test")) {
      pages.push(page.records);
    }
    expect(pages).toHaveLength(1);
    expect(pages[0]).toEqual([]);
  });

  it("collectAll flattens pages", async () => {
    global.fetch = makePagedFetch([{ records: [10, 20], nextPageToken: "p2" }, { records: [30] }]);
    const http = new HttpClient({ accessToken: "t" });
    const all = await collectAll<number>(http, "/test");
    expect(all).toEqual([10, 20, 30]);
  });

  it("collectAll returns empty array for empty page", async () => {
    global.fetch = makePagedFetch([{ records: [] }]);
    const http = new HttpClient({ accessToken: "t" });
    expect(await collectAll<number>(http, "/test")).toEqual([]);
  });

  it("consumeDeltaSync single page with nextDeltaToken", async () => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () =>
          Promise.resolve(
            JSON.stringify({ records: [{ id: "a" }, { id: "b" }], nextDeltaToken: "delta-new" })
          ),
      })
    );
    const http = new HttpClient({ accessToken: "t" });
    const { items, nextDeltaToken } = await consumeDeltaSync<{ id: string }>(
      http,
      "/test/sync",
      "delta-old"
    );
    expect(items).toHaveLength(2);
    expect(nextDeltaToken).toBe("delta-new");
  });

  it("consumeDeltaSync follows multiple pages", async () => {
    const pages: Array<PagedResponse<{ id: string }>> = [
      { records: [{ id: "a" }, { id: "b" }], nextPageToken: "p2" },
      { records: [{ id: "c" }], nextDeltaToken: "new-delta-token" },
    ];
    let i = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      const p = pages[i++]!;
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () => Promise.resolve(JSON.stringify(p)),
      });
    });
    const http = new HttpClient({ accessToken: "t" });
    const { items, nextDeltaToken } = await consumeDeltaSync<{ id: string }>(
      http,
      "/test/sync",
      "original-delta"
    );
    expect(items).toHaveLength(3);
    expect(nextDeltaToken).toBe("new-delta-token");
  });

  it("consumeDeltaSync passes deltaToken on first request", async () => {
    const mockFetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () => Promise.resolve(JSON.stringify({ records: [], nextDeltaToken: "dt2" })),
      })
    );
    global.fetch = mockFetch;
    const http = new HttpClient({ accessToken: "t" });
    await consumeDeltaSync(http, "/test/sync", "my-delta-token");
    expect(url(mockFetch)).toContain("deltaToken=my-delta-token");
  });

  it("consumeDeltaSync throws if no nextDeltaToken ever returned", async () => {
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () => Promise.resolve(JSON.stringify({ records: [{ id: "a" }] })),
      })
    );
    const http = new HttpClient({ accessToken: "t" });
    await expect(consumeDeltaSync(http, "/test/sync", "tok")).rejects.toThrow("nextDeltaToken");
  });
});

// ─── Error Classes ────────────────────────────────────────────────────────────

describe("Error classes", () => {
  it("AurinkoError has correct shape and toJSON", () => {
    const raw = { detail: "x" };
    const err = new AurinkoError({
      code: "UNKNOWN_ERROR",
      message: "oops",
      statusCode: 500,
      requestId: "req-1",
      retryAfter: 30,
      raw,
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("UNKNOWN_ERROR");
    expect(err.statusCode).toBe(500);
    expect(err.requestId).toBe("req-1");
    expect(err.retryAfter).toBe(30);
    expect(err.raw).toBe(raw);
    expect(err.toJSON()).toMatchObject({
      code: "UNKNOWN_ERROR",
      statusCode: 500,
      requestId: "req-1",
    });
    expect(err.name).toBe("AurinkoError");
  });

  it("AuthenticationError instanceof hierarchy", () => {
    const err = new AuthenticationError("bad token");
    expect(err).toBeInstanceOf(AurinkoError);
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("AUTHENTICATION_ERROR");
    expect(err.name).toBe("AuthenticationError");
  });

  it("AuthorizationError", () => {
    const err = new AuthorizationError("forbidden");
    expect(err).toBeInstanceOf(AurinkoError);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("AUTHORIZATION_ERROR");
  });

  it("NotFoundError", () => {
    const err = new NotFoundError("not found");
    expect(err).toBeInstanceOf(AurinkoError);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
  });

  it("ValidationError", () => {
    const err = new ValidationError("bad input");
    expect(err).toBeInstanceOf(AurinkoError);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("VALIDATION_ERROR");
  });

  it("RateLimitError with retryAfter", () => {
    const err = new RateLimitError("too many requests", 120);
    expect(err.retryAfter).toBe(120);
    expect(err.code).toBe("RATE_LIMIT_ERROR");
    expect(err.statusCode).toBe(429);
  });

  it("RateLimitError without retryAfter", () => {
    const err = new RateLimitError("rate limited");
    expect(err.retryAfter).toBeUndefined();
  });

  it("ServerError stores statusCode", () => {
    const err = new ServerError("internal error", 503);
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe("SERVER_ERROR");
  });

  it("TimeoutError has no statusCode", () => {
    const err = new TimeoutError("timed out");
    expect(err.statusCode).toBeUndefined();
    expect(err.code).toBe("TIMEOUT_ERROR");
    expect(err.name).toBe("TimeoutError");
  });

  it("NetworkError stores cause in raw", () => {
    const cause = new Error("connection refused");
    const err = new NetworkError("network failure", cause);
    expect(err.raw).toBe(cause);
    expect(err.code).toBe("NETWORK_ERROR");
    expect(err.statusCode).toBeUndefined();
  });

  it("WebhookVerificationError", () => {
    const err = new WebhookVerificationError("sig mismatch");
    expect(err.code).toBe("WEBHOOK_VERIFICATION_FAILED");
    expect(err).toBeInstanceOf(AurinkoError);
  });

  it("ConfigurationError", () => {
    const err = new ConfigurationError("missing config");
    expect(err.code).toBe("CONFIGURATION_ERROR");
    expect(err).toBeInstanceOf(AurinkoError);
  });

  it("all error classes are instanceof AurinkoError and Error", () => {
    const errors = [
      new AuthenticationError(""),
      new AuthorizationError(""),
      new NotFoundError(""),
      new ValidationError(""),
      new RateLimitError(""),
      new ServerError("", 500),
      new TimeoutError(""),
      new NetworkError(""),
      new WebhookVerificationError(""),
      new ConfigurationError(""),
    ];
    for (const err of errors) {
      expect(err).toBeInstanceOf(AurinkoError);
      expect(err).toBeInstanceOf(Error);
    }
  });

  it("instanceof checks are exclusive across siblings", () => {
    const authErr = new AuthenticationError("test");
    expect(authErr instanceof AuthorizationError).toBe(false);
    expect(authErr instanceof NotFoundError).toBe(false);
  });
});

// ─── Mini URL/method helpers used above ──────────────────────────────────────
function url(mockFetch: jest.Mock): string {
  return mockFetch.mock.calls[0]![0] as string;
}

function method(mockFetch: jest.Mock): string {
  return ((mockFetch.mock.calls[0]![1] as RequestInit).method ?? "GET") as string;
}
