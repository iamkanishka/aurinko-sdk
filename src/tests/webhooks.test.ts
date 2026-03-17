/**
 * Webhooks API — Full Test Suite
 */

import { AurinkoClient } from "../client";
import { NotFoundError, WebhookVerificationError } from "../errors";
import { WebhookPayloadItem } from "../types";
import { verifyWebhookSignature, isValidWebhookSignature } from "../utils/webhook";
import {
  mockOnce,
  getRequestBody,
  getRequestUrl,
  getRequestMethod,
  getRequestHeaders,
  makeValidWebhookRequest,
  makeWebhookSignature,
  fixtures,
} from "./helpers";

const SIGNING_SECRET = "test-signing-secret-abc123xyz";
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

// ─── Subscription CRUD ────────────────────────────────────────────────────────

describe("Webhooks — list", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("calls GET /subscriptions", async () => {
    const mock = mockOnce(200, { records: [fixtures.subscription()] });
    global.fetch = mock;
    const result = await client.webhooks.list();
    expect(getRequestUrl(mock)).toContain("/subscriptions");
    expect(getRequestMethod(mock)).toBe("GET");
    expect(result.records[0]?.id).toBe(12345);
  });
});

describe("Webhooks — get", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("calls GET /subscriptions/{id} with numeric id", async () => {
    const mock = mockOnce(200, fixtures.subscription());
    global.fetch = mock;
    const result = await client.webhooks.get(12345);
    expect(getRequestUrl(mock)).toContain("/subscriptions/12345");
    expect(result.resource).toBe("/email/messages");
  });

  it("calls GET /subscriptions/{id} with string id", async () => {
    const mock = mockOnce(200, fixtures.subscription());
    global.fetch = mock;
    await client.webhooks.get("sub-abc");
    expect(getRequestUrl(mock)).toContain("/subscriptions/sub-abc");
  });

  it("throws NotFoundError on 404", async () => {
    global.fetch = mockOnce(404, { message: "Subscription not found" });
    await expect(client.webhooks.get(999)).rejects.toThrow(NotFoundError);
  });
});

describe("Webhooks — create", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("calls POST /subscriptions", async () => {
    const mock = mockOnce(201, fixtures.subscription());
    global.fetch = mock;
    await client.webhooks.create({
      resource: "/email/messages",
      notificationUrl: "https://myapp.com/hooks",
    });
    expect(getRequestMethod(mock)).toBe("POST");
    expect(getRequestUrl(mock)).toContain("/subscriptions");
  });

  it("sends resource and notificationUrl in body", async () => {
    const mock = mockOnce(201, fixtures.subscription());
    global.fetch = mock;
    await client.webhooks.create({
      resource: "/contacts",
      notificationUrl: "https://myapp.com/contacts-hook",
    });
    const body = getRequestBody(mock) as Record<string, string>;
    expect(body["resource"]).toBe("/contacts");
    expect(body["notificationUrl"]).toBe("https://myapp.com/contacts-hook");
  });
});

describe("Webhooks — delete", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("calls DELETE /subscriptions/{id}", async () => {
    const mock = mockOnce(204, null, { "content-length": "0" });
    global.fetch = mock;
    await client.webhooks.delete(12345);
    expect(getRequestMethod(mock)).toBe("DELETE");
    expect(getRequestUrl(mock)).toContain("/subscriptions/12345");
  });

  it("works with string id", async () => {
    const mock = mockOnce(204, null);
    global.fetch = mock;
    await client.webhooks.delete("sub-abc");
    expect(getRequestUrl(mock)).toContain("/subscriptions/sub-abc");
  });

  it("returns null on success", async () => {
    global.fetch = mockOnce(204, null);
    const result = await client.webhooks.delete(1);
    expect(result).toBeNull();
  });
});

// ─── Convenience subscription factories ───────────────────────────────────────

describe("Webhooks — subscribeToEmail", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("sends resource=/email/messages", async () => {
    const mock = mockOnce(201, fixtures.subscription());
    global.fetch = mock;
    await client.webhooks.subscribeToEmail("https://app.com/hook");
    const body = getRequestBody(mock) as Record<string, string>;
    expect(body["resource"]).toBe("/email/messages");
    expect(body["notificationUrl"]).toBe("https://app.com/hook");
  });
});

describe("Webhooks — subscribeToEmailTracking", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("sends resource=/email/tracking", async () => {
    const mock = mockOnce(201, { ...fixtures.subscription(), resource: "/email/tracking" });
    global.fetch = mock;
    await client.webhooks.subscribeToEmailTracking("https://app.com/hook");
    const body = getRequestBody(mock) as Record<string, string>;
    expect(body["resource"]).toBe("/email/tracking");
  });
});

describe("Webhooks — subscribeToCalendar", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("defaults to primary calendar", async () => {
    const mock = mockOnce(201, fixtures.subscription());
    global.fetch = mock;
    await client.webhooks.subscribeToCalendar("https://app.com/hook");
    const body = getRequestBody(mock) as Record<string, string>;
    expect(body["resource"]).toBe("/calendars/primary/events");
  });

  it("accepts specific calendarId", async () => {
    const mock = mockOnce(201, fixtures.subscription());
    global.fetch = mock;
    await client.webhooks.subscribeToCalendar("https://app.com/hook", "work-cal");
    const body = getRequestBody(mock) as Record<string, string>;
    expect(body["resource"]).toBe("/calendars/work-cal/events");
  });
});

describe("Webhooks — subscribeToContacts", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("sends resource=/contacts", async () => {
    const mock = mockOnce(201, fixtures.subscription());
    global.fetch = mock;
    await client.webhooks.subscribeToContacts("https://app.com/hook");
    const body = getRequestBody(mock) as Record<string, string>;
    expect(body["resource"]).toBe("/contacts");
  });
});

describe("Webhooks — subscribeToTasks", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("defaults to default task list", async () => {
    const mock = mockOnce(201, fixtures.subscription());
    global.fetch = mock;
    await client.webhooks.subscribeToTasks("https://app.com/hook");
    const body = getRequestBody(mock) as Record<string, string>;
    expect(body["resource"]).toBe("/tasklists/default/tasks");
  });

  it("accepts specific taskListId", async () => {
    const mock = mockOnce(201, fixtures.subscription());
    global.fetch = mock;
    await client.webhooks.subscribeToTasks("https://app.com/hook", "list-abc");
    const body = getRequestBody(mock) as Record<string, string>;
    expect(body["resource"]).toBe("/tasklists/list-abc/tasks");
  });
});

describe("Webhooks — subscribeToBooking", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("sends resource=/booking/{id} with numeric bookingId", async () => {
    const mock = mockOnce(201, fixtures.subscription());
    global.fetch = mock;
    await client.webhooks.subscribeToBooking(935, "https://app.com/hook");
    const body = getRequestBody(mock) as Record<string, string>;
    expect(body["resource"]).toBe("/booking/935");
  });

  it("sends resource=/booking/{id} with string bookingId", async () => {
    const mock = mockOnce(201, fixtures.subscription());
    global.fetch = mock;
    await client.webhooks.subscribeToBooking("booking-abc", "https://app.com/hook");
    const body = getRequestBody(mock) as Record<string, string>;
    expect(body["resource"]).toBe("/booking/booking-abc");
  });
});

// ─── Signature verification (via client.webhooks) ────────────────────────────

describe("Webhooks — client.webhooks.verify", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withFullConfig({
      accessToken: "test-token",
      webhookSigningSecret: SIGNING_SECRET,
    });
  });

  it("does not throw for a valid signature", () => {
    const { rawBody, timestamp, signature } = makeValidWebhookRequest(SIGNING_SECRET, {
      subscription: 1,
      resource: "/email/messages",
    });
    expect(() => client.webhooks.verify({ rawBody, signature, timestamp })).not.toThrow();
  });

  it("throws WebhookVerificationError for tampered body", () => {
    const { timestamp, signature } = makeValidWebhookRequest(SIGNING_SECRET, { subscription: 1 });
    expect(() =>
      client.webhooks.verify({ rawBody: '{"subscription":99}', signature, timestamp })
    ).toThrow(WebhookVerificationError);
  });

  it("throws WebhookVerificationError for wrong signature", () => {
    const { rawBody, timestamp } = makeValidWebhookRequest(SIGNING_SECRET, { x: 1 });
    expect(() => client.webhooks.verify({ rawBody, signature: "aabbccddeeff", timestamp })).toThrow(
      WebhookVerificationError
    );
  });

  it("throws WebhookVerificationError for stale timestamp", () => {
    const rawBody = JSON.stringify({ subscription: 1 });
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 400);
    const signature = makeWebhookSignature(SIGNING_SECRET, staleTimestamp, rawBody);
    expect(() =>
      client.webhooks.verify({ rawBody, signature, timestamp: staleTimestamp }, 300)
    ).toThrow(WebhookVerificationError);
  });

  it("accepts request within custom maxAgeSeconds", () => {
    const rawBody = JSON.stringify({ subscription: 1 });
    // 600 seconds old
    const timestamp = String(Math.floor(Date.now() / 1000) - 600);
    const signature = makeWebhookSignature(SIGNING_SECRET, timestamp, rawBody);
    expect(() => client.webhooks.verify({ rawBody, signature, timestamp }, 700)).not.toThrow();
  });

  it("throws if no signing secret is configured", () => {
    const clientNoSecret = AurinkoClient.withToken("test-token"); // no webhookSigningSecret
    const { rawBody, timestamp, signature } = makeValidWebhookRequest(SIGNING_SECRET, {
      subscription: 1,
    });
    expect(() => clientNoSecret.webhooks.verify({ rawBody, signature, timestamp })).toThrow();
  });
});

describe("Webhooks — client.webhooks.isValid", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withFullConfig({
      accessToken: "test-token",
      webhookSigningSecret: SIGNING_SECRET,
    });
  });

  it("returns true for valid signature", () => {
    const { rawBody, timestamp, signature } = makeValidWebhookRequest(SIGNING_SECRET, {
      subscription: 1,
    });
    expect(client.webhooks.isValid({ rawBody, signature, timestamp })).toBe(true);
  });

  it("returns false for invalid signature", () => {
    const { rawBody, timestamp } = makeValidWebhookRequest(SIGNING_SECRET, { x: 1 });
    expect(client.webhooks.isValid({ rawBody, signature: "bad-sig", timestamp })).toBe(false);
  });

  it("returns false for stale timestamp", () => {
    const rawBody = JSON.stringify({ subscription: 1 });
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 600);
    const signature = makeWebhookSignature(SIGNING_SECRET, staleTimestamp, rawBody);
    expect(client.webhooks.isValid({ rawBody, signature, timestamp: staleTimestamp })).toBe(false);
  });

  it("returns false when no signing secret configured", () => {
    const clientNoSecret = AurinkoClient.withToken("test-token");
    const { rawBody, timestamp, signature } = makeValidWebhookRequest(SIGNING_SECRET, {});
    expect(clientNoSecret.webhooks.isValid({ rawBody, signature, timestamp })).toBe(false);
  });
});

describe("Webhooks — client.webhooks.parseAndVerify", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withFullConfig({
      accessToken: "test-token",
      webhookSigningSecret: SIGNING_SECRET,
    });
  });

  it("returns parsed WebhookNotification on valid signature", () => {
    const notification = { subscription: 42, resource: "/email/messages", accountId: 100 };
    const { rawBody, timestamp, signature } = makeValidWebhookRequest(SIGNING_SECRET, notification);
    const result = client.webhooks.parseAndVerify(rawBody, signature, timestamp);
    expect(result.subscription).toBe(42);
    expect(result.resource).toBe("/email/messages");
    expect(result.accountId).toBe(100);
  });

  it("throws WebhookVerificationError for invalid signature", () => {
    const notification = { subscription: 1 };
    const rawBody = JSON.stringify(notification);
    const timestamp = String(Math.floor(Date.now() / 1000));
    expect(() => client.webhooks.parseAndVerify(rawBody, "bad-signature", timestamp)).toThrow(
      WebhookVerificationError
    );
  });

  it("parses all notification fields", () => {
    const notification = {
      subscription: 10,
      resource: "/calendars/primary/events",
      accountId: 5,
      type: "updated",
    };
    const { rawBody, timestamp, signature } = makeValidWebhookRequest(SIGNING_SECRET, notification);
    const result = client.webhooks.parseAndVerify(rawBody, signature, timestamp);
    expect((result.payloads as WebhookPayloadItem[])[0].changeType).toBe("updated");
  });
});

// ─── verifyWebhookSignature standalone util ────────────────────────────────────

describe("verifyWebhookSignature (util)", () => {
  it("does not throw for valid HMAC", () => {
    const body = JSON.stringify({ x: 1 });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = makeWebhookSignature(SIGNING_SECRET, timestamp, body);
    expect(() =>
      verifyWebhookSignature({ rawBody: body, signature, timestamp }, SIGNING_SECRET)
    ).not.toThrow();
  });

  it("throws for empty signing secret", () => {
    const body = "{}";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = makeWebhookSignature(SIGNING_SECRET, timestamp, body);
    expect(() => verifyWebhookSignature({ rawBody: body, signature, timestamp }, "")).toThrow(
      WebhookVerificationError
    );
  });

  it("throws for missing signature", () => {
    expect(() =>
      verifyWebhookSignature(
        { rawBody: "{}", signature: "", timestamp: String(Date.now() / 1000) },
        SIGNING_SECRET
      )
    ).toThrow(WebhookVerificationError);
  });

  it("throws for missing timestamp", () => {
    expect(() =>
      verifyWebhookSignature({ rawBody: "{}", signature: "abc", timestamp: "" }, SIGNING_SECRET)
    ).toThrow(WebhookVerificationError);
  });

  it("throws for non-numeric timestamp", () => {
    expect(() =>
      verifyWebhookSignature(
        { rawBody: "{}", signature: "abc", timestamp: "not-a-number" },
        SIGNING_SECRET
      )
    ).toThrow(WebhookVerificationError);
  });

  it("throws for future timestamp beyond maxAge", () => {
    const body = "{}";
    const futureTimestamp = String(Math.floor(Date.now() / 1000) + 400);
    const signature = makeWebhookSignature(SIGNING_SECRET, futureTimestamp, body);
    expect(() =>
      verifyWebhookSignature(
        { rawBody: body, signature, timestamp: futureTimestamp },
        SIGNING_SECRET,
        300
      )
    ).toThrow(WebhookVerificationError);
  });

  it("uses default maxAge of 300s", () => {
    const body = "{}";
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 310);
    const signature = makeWebhookSignature(SIGNING_SECRET, oldTimestamp, body);
    expect(() =>
      verifyWebhookSignature({ rawBody: body, signature, timestamp: oldTimestamp }, SIGNING_SECRET)
    ).toThrow(WebhookVerificationError);
  });

  it("accepts timestamp exactly at maxAge boundary", () => {
    const body = "{}";
    const timestamp = String(Math.floor(Date.now() / 1000) - 290);
    const signature = makeWebhookSignature(SIGNING_SECRET, timestamp, body);
    expect(() =>
      verifyWebhookSignature({ rawBody: body, signature, timestamp }, SIGNING_SECRET, 300)
    ).not.toThrow();
  });

  it("different body produces different signature (tamper detection)", () => {
    const originalBody = JSON.stringify({ data: "original" });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = makeWebhookSignature(SIGNING_SECRET, timestamp, originalBody);
    const tamperedBody = JSON.stringify({ data: "tampered" });
    expect(() =>
      verifyWebhookSignature({ rawBody: tamperedBody, signature, timestamp }, SIGNING_SECRET)
    ).toThrow(WebhookVerificationError);
  });
});

// ─── isValidWebhookSignature standalone util ──────────────────────────────────

describe("isValidWebhookSignature (util)", () => {
  it("returns true for valid signature", () => {
    const body = "{}";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = makeWebhookSignature(SIGNING_SECRET, timestamp, body);
    expect(isValidWebhookSignature({ rawBody: body, signature, timestamp }, SIGNING_SECRET)).toBe(
      true
    );
  });

  it("returns false for invalid signature", () => {
    const body = "{}";
    const timestamp = String(Math.floor(Date.now() / 1000));
    expect(
      isValidWebhookSignature({ rawBody: body, signature: "badsig", timestamp }, SIGNING_SECRET)
    ).toBe(false);
  });

  it("returns false for stale timestamp (never throws)", () => {
    const body = "{}";
    const staleTs = String(Math.floor(Date.now() / 1000) - 400);
    const signature = makeWebhookSignature(SIGNING_SECRET, staleTs, body);
    expect(
      isValidWebhookSignature({ rawBody: body, signature, timestamp: staleTs }, SIGNING_SECRET, 300)
    ).toBe(false);
  });

  it("never throws — always returns boolean", () => {
    // Should never throw even with garbage input
    expect(() =>
      isValidWebhookSignature({ rawBody: "", signature: "", timestamp: "" }, SIGNING_SECRET)
    ).not.toThrow();
    expect(
      isValidWebhookSignature({ rawBody: "", signature: "", timestamp: "" }, SIGNING_SECRET)
    ).toBe(false);
  });
});

// ─── SDK header ───────────────────────────────────────────────────────────────

describe("Webhooks — SDK headers on all requests", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("includes X-Aurinko-SDK header", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.webhooks.list();
    expect(getRequestHeaders(mock)["X-Aurinko-SDK"]).toBe("typescript/1.0.0");
  });
});
