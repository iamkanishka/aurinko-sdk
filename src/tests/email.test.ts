/**
 * Email API — Full Test Suite
 */

import { AurinkoClient } from "../client";
import { HttpClient } from "../http/client";
import { NotFoundError, ValidationError } from "../errors";
import {
  makeFetchMock, mockOnce, getRequestBody, getRequestUrl,
  getRequestMethod, getRequestHeaders, makeDeltaSyncFetch,
  fixtures,
} from "./helpers";

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

describe("Email — messages.list", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("calls GET /email/messages", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.email.messages.list();
    expect(getRequestUrl(mock)).toContain("/email/messages");
    expect(getRequestMethod(mock)).toBe("GET");
  });

  it("passes q filter as query param", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.email.messages.list({ q: "from:alice is:unread" });
    expect(getRequestUrl(mock)).toContain("q=from%3Aalice%20is%3Aunread");
  });

  it("passes bodyType query param", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.email.messages.list({ bodyType: "text" });
    expect(getRequestUrl(mock)).toContain("bodyType=text");
  });

  it("passes limit param", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.email.messages.list({ limit: 50 });
    expect(getRequestUrl(mock)).toContain("limit=50");
  });

  it("passes pageToken for pagination", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.email.messages.list({ pageToken: "next-page-xyz" });
    expect(getRequestUrl(mock)).toContain("pageToken=next-page-xyz");
  });

  it("returns typed PagedResponse", async () => {
    const msg = fixtures.emailMessage();
    global.fetch = mockOnce(200, { records: [msg], nextPageToken: "p2" });
    const result = await client.email.messages.list();
    expect(result.records[0]?.id).toBe("msg-abc123");
    expect(result.nextPageToken).toBe("p2");
  });

  it("includes loadBody param", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.email.messages.list({ loadBody: true });
    expect(getRequestUrl(mock)).toContain("loadBody=true");
  });

  it("includes includeHeaders param", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.email.messages.list({ includeHeaders: true });
    expect(getRequestUrl(mock)).toContain("includeHeaders=true");
  });

  it("sends Bearer auth header", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.email.messages.list();
    expect(getRequestHeaders(mock)["Authorization"]).toBe("Bearer test-token");
  });
});

describe("Email — messages.get", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("calls GET /email/messages/{id}", async () => {
    const msg = fixtures.emailMessage();
    const mock = mockOnce(200, msg);
    global.fetch = mock;
    const result = await client.email.messages.get("msg-abc123");
    expect(getRequestUrl(mock)).toContain("/email/messages/msg-abc123");
    expect(result.id).toBe("msg-abc123");
  });

  it("URL-encodes message ID with special chars", async () => {
    const mock = mockOnce(200, { id: "abc==xyz" });
    global.fetch = mock;
    await client.email.messages.get("abc==xyz");
    expect(getRequestUrl(mock)).toContain("/email/messages/abc%3D%3Dxyz");
  });

  it("passes bodyType param", async () => {
    const mock = mockOnce(200, fixtures.emailMessage());
    global.fetch = mock;
    await client.email.messages.get("msg-1", { bodyType: "text" });
    expect(getRequestUrl(mock)).toContain("bodyType=text");
  });

  it("throws NotFoundError on 404", async () => {
    global.fetch = mockOnce(404, { message: "Message not found" });
    await expect(client.email.messages.get("nonexistent")).rejects.toThrow(NotFoundError);
  });
});

describe("Email — messages.send", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("calls POST /email/messages", async () => {
    const mock = mockOnce(200, fixtures.emailMessage());
    global.fetch = mock;
    await client.email.messages.send({
      subject: "Hello",
      body: "<p>Hi</p>",
      to: [{ address: "bob@example.com" }],
    });
    expect(getRequestMethod(mock)).toBe("POST");
    expect(getRequestUrl(mock)).toContain("/email/messages");
  });

  it("defaults to bodyType=html in query string", async () => {
    const mock = mockOnce(200, fixtures.emailMessage());
    global.fetch = mock;
    await client.email.messages.send({
      subject: "Hi", body: "text", to: [{ address: "a@b.com" }],
    });
    expect(getRequestUrl(mock)).toContain("bodyType=html");
  });

  it("allows overriding bodyType to text", async () => {
    const mock = mockOnce(200, fixtures.emailMessage());
    global.fetch = mock;
    await client.email.messages.send({
      subject: "Hi", body: "plain text", bodyType: "text",
      to: [{ address: "a@b.com" }],
    });
    expect(getRequestUrl(mock)).toContain("bodyType=text");
  });

  it("sends tracking options in body", async () => {
    const mock = mockOnce(200, fixtures.emailMessage());
    global.fetch = mock;
    await client.email.messages.send({
      subject: "Campaign email",
      body: "<p>Click here</p>",
      to: [{ address: "user@example.com" }],
      tracking: {
        opens: true,
        threadReplies: true,
        trackOpensAfterSendDelay: 10,
        context: "campaign-2024",
        customDomainAlias: "tracking.myapp.com",
      },
    });
    const body = getRequestBody(mock) as Record<string, unknown>;
    expect((body["tracking"] as Record<string, unknown>)["opens"]).toBe(true);
    expect((body["tracking"] as Record<string, unknown>)["context"]).toBe("campaign-2024");
  });

  it("sends cc and bcc fields", async () => {
    const mock = mockOnce(200, fixtures.emailMessage());
    global.fetch = mock;
    await client.email.messages.send({
      subject: "Meeting",
      body: "Content",
      to: [{ address: "to@example.com" }],
      cc: [{ address: "cc@example.com" }],
      bcc: [{ address: "bcc@example.com" }],
    });
    const body = getRequestBody(mock) as Record<string, unknown>;
    expect(Array.isArray(body["cc"])).toBe(true);
    expect(Array.isArray(body["bcc"])).toBe(true);
  });

  it("throws ValidationError on 400", async () => {
    global.fetch = mockOnce(400, { message: "Invalid recipient" });
    await expect(
      client.email.messages.send({ subject: "x", body: "y", to: [] })
    ).rejects.toThrow(ValidationError);
  });
});

describe("Email — messages.update", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("calls PATCH /email/messages/{id}", async () => {
    const mock = mockOnce(200, fixtures.emailMessage());
    global.fetch = mock;
    await client.email.messages.update("msg-1", { unread: false });
    expect(getRequestMethod(mock)).toBe("PATCH");
    expect(getRequestUrl(mock)).toContain("/email/messages/msg-1");
  });

  it("sends unread=false in body", async () => {
    const mock = mockOnce(200, fixtures.emailMessage());
    global.fetch = mock;
    await client.email.messages.update("msg-1", { unread: false });
    expect(getRequestBody(mock)).toMatchObject({ unread: false });
  });

  it("can flag a message", async () => {
    const mock = mockOnce(200, { ...fixtures.emailMessage(), flagged: true });
    global.fetch = mock;
    const result = await client.email.messages.update("msg-1", { flagged: true });
    expect(result.flagged).toBe(true);
  });
});

describe("Email — messages.iterate", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("yields all pages until no nextPageToken", async () => {
    global.fetch = makeFetchMock([
      { status: 200, body: { records: [{ id: "m1" }], nextPageToken: "p2" } },
      { status: 200, body: { records: [{ id: "m2" }] } },
    ]);
    const pages: string[][] = [];
    for await (const page of client.email.messages.iterate()) {
      pages.push(page.records.map((r) => r.id));
    }
    expect(pages).toEqual([["m1"], ["m2"]]);
  });

  it("passes q filter across pages", async () => {
    const mock = makeFetchMock([
      { status: 200, body: { records: [] } },
    ]);
    global.fetch = mock;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of client.email.messages.iterate({ q: "subject:invoice" })) { break; }
    expect(getRequestUrl(mock)).toContain("subject%3Ainvoice");
  });
});

describe("Email — messages.listAll", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("flattens all pages into array", async () => {
    global.fetch = makeFetchMock([
      { status: 200, body: { records: [{ id: "a" }, { id: "b" }], nextPageToken: "p2" } },
      { status: 200, body: { records: [{ id: "c" }] } },
    ]);
    const all = await client.email.messages.listAll();
    expect(all).toHaveLength(3);
    expect(all.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });
});

describe("Email — attachments", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("downloads attachment at correct URL", async () => {
    const mock = makeFetchMock([{ status: 200, body: "binary-data" }]);
    global.fetch = mock;
    const result = await client.email.attachments.download("msg-1", "att-1");
    expect(getRequestUrl(mock)).toContain("/email/messages/msg-1/attachments/att-1");
    expect(result.data).toBeInstanceOf(ArrayBuffer);
  });

  it("URL-encodes message and attachment IDs", async () => {
    const mock = makeFetchMock([{ status: 200, body: "" }]);
    global.fetch = mock;
    await client.email.attachments.download("msg==1", "att/xyz");
    expect(getRequestUrl(mock)).toContain("msg%3D%3D1");
    expect(getRequestUrl(mock)).toContain("att%2Fxyz");
  });
});

describe("Email — drafts", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("lists drafts at GET /email/drafts", async () => {
    const mock = mockOnce(200, { records: [{ id: "d1" }] });
    global.fetch = mock;
    const result = await client.email.drafts.list();
    expect(getRequestUrl(mock)).toContain("/email/drafts");
    expect(result.records[0]?.id).toBe("d1");
  });

  it("gets a draft by ID", async () => {
    const mock = mockOnce(200, { id: "d1", message: fixtures.emailMessage() });
    global.fetch = mock;
    const draft = await client.email.drafts.get("d1");
    expect(getRequestUrl(mock)).toContain("/email/drafts/d1");
    expect(draft.id).toBe("d1");
  });

  it("creates draft with html bodyType default", async () => {
    const mock = mockOnce(201, { id: "d2" });
    global.fetch = mock;
    await client.email.drafts.create({
      subject: "Draft subject",
      body: "<p>Content</p>",
      to: [{ address: "x@y.com" }],
    });
    expect(getRequestMethod(mock)).toBe("POST");
    expect(getRequestUrl(mock)).toContain("bodyType=html");
  });

  it("creates draft with text bodyType", async () => {
    const mock = mockOnce(201, { id: "d3" });
    global.fetch = mock;
    await client.email.drafts.create({
      subject: "Plain Draft",
      body: "Just text",
      bodyType: "text",
      to: [{ address: "x@y.com" }],
    });
    expect(getRequestUrl(mock)).toContain("bodyType=text");
  });

  it("updates a draft via PATCH", async () => {
    const mock = mockOnce(200, { id: "d1" });
    global.fetch = mock;
    await client.email.drafts.update("d1", { subject: "Updated Subject" });
    expect(getRequestMethod(mock)).toBe("PATCH");
    expect(getRequestUrl(mock)).toContain("/email/drafts/d1");
    expect(getRequestBody(mock)).toMatchObject({ subject: "Updated Subject" });
  });

  it("deletes a draft", async () => {
    const mock = mockOnce(204, null, { "content-length": "0" });
    global.fetch = mock;
    await client.email.drafts.delete("d1");
    expect(getRequestMethod(mock)).toBe("DELETE");
    expect(getRequestUrl(mock)).toContain("/email/drafts/d1");
  });

  it("sends a draft at POST /email/drafts/{id}/send", async () => {
    const mock = mockOnce(200, fixtures.emailMessage());
    global.fetch = mock;
    const result = await client.email.drafts.send("d1");
    expect(getRequestUrl(mock)).toContain("/email/drafts/d1/send");
    expect(getRequestMethod(mock)).toBe("POST");
    expect(result.id).toBeDefined();
  });
});

describe("Email — tracking", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("lists tracking records", async () => {
    const mock = mockOnce(200, { records: [{ id: 1, eventType: "open" }] });
    global.fetch = mock;
    const result = await client.email.tracking.list();
    expect(getRequestUrl(mock)).toContain("/email/tracking");
    expect(result.records[0]?.id).toBe(1);
  });

  it("lists tracking with limit", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.email.tracking.list({ limit: 25 });
    expect(getRequestUrl(mock)).toContain("limit=25");
  });

  it("gets a single tracking record by ID", async () => {
    const mock = mockOnce(200, { id: 42, eventType: "reply" });
    global.fetch = mock;
    const result = await client.email.tracking.get(42);
    expect(getRequestUrl(mock)).toContain("/email/tracking/42");
    expect(result.id).toBe(42);
  });
});

describe("Email — sync", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("starts sync with daysWithin param", async () => {
    const mock = mockOnce(200, fixtures.syncStartResponse());
    global.fetch = mock;
    const result = await client.email.sync.start({ daysWithin: 30 });
    expect(getRequestMethod(mock)).toBe("POST");
    expect(getRequestUrl(mock)).toContain("daysWithin=30");
    expect(result.ready).toBe(true);
    expect(result.syncUpdatedToken).toBe("sync-updated-token-abc");
  });

  it("starts sync with awaitReady=false", async () => {
    const mock = mockOnce(200, { ...fixtures.syncStartResponse(), ready: false });
    global.fetch = mock;
    const result = await client.email.sync.start({ awaitReady: false });
    expect(getRequestUrl(mock)).toContain("awaitReady=false");
    expect(result.ready).toBe(false);
  });

  it("fetches updated messages with delta token", async () => {
    global.fetch = makeDeltaSyncFetch([
      { records: [{ id: "m1" }, { id: "m2" }], nextPageToken: "p2" },
      { records: [{ id: "m3" }], nextDeltaToken: "new-delta-token" },
    ]);
    const { items, nextDeltaToken } =
      await client.email.sync.updated("original-delta-token");
    expect(items).toHaveLength(3);
    expect(nextDeltaToken).toBe("new-delta-token");
  });

  it("fetches deleted message IDs with delta token", async () => {
    global.fetch = makeDeltaSyncFetch([
      { records: [{ id: "dead-1" }], nextDeltaToken: "del-delta" },
    ]);
    const { items, nextDeltaToken } =
      await client.email.sync.deleted("delete-token");
    expect(items[0]?.id).toBe("dead-1");
    expect(nextDeltaToken).toBe("del-delta");
  });

  it("sync.updated passes deltaToken as query param on first request", async () => {
    const mock = makeDeltaSyncFetch([
      { records: [], nextDeltaToken: "fresh-token" },
    ]);
    global.fetch = mock;
    await client.email.sync.updated("my-delta-abc");
    expect(getRequestUrl(mock)).toContain("deltaToken=my-delta-abc");
  });

  it("sync.updated follows pageToken on subsequent requests", async () => {
    const mock = makeDeltaSyncFetch([
      { records: [{ id: "a" }], nextPageToken: "page-token-2" },
      { records: [{ id: "b" }], nextDeltaToken: "final-delta" },
    ]);
    global.fetch = mock;
    await client.email.sync.updated("initial-delta");
    // Second call should use pageToken, not deltaToken
    expect(getRequestUrl(mock, 1)).toContain("pageToken=page-token-2");
    expect(getRequestUrl(mock, 1)).not.toContain("deltaToken=");
  });

  it("throws if sync never returns nextDeltaToken", async () => {
    global.fetch = mockOnce(200, { records: [] }); // no token returned
    await expect(
      client.email.sync.updated("token")
    ).rejects.toThrow("nextDeltaToken");
  });
});

describe("Email — per-request options", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("merges custom headers into request", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.email.messages.list(
      {},
      { headers: { "X-Custom-Header": "my-value" } }
    );
    expect(getRequestHeaders(mock)["X-Custom-Header"]).toBe("my-value");
  });

  it("respects AbortSignal cancellation", async () => {
    const controller = new AbortController();
    global.fetch = jest.fn().mockImplementation(
      (_url: string, init: RequestInit) => {
        return new Promise((_, reject) => {
          const signal = init.signal as AbortSignal | null;
          signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        });
      }
    );
    controller.abort();
    await expect(
      client.email.messages.list({}, { signal: controller.signal })
    ).rejects.toThrow();
  });
});
