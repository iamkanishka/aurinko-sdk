/**
 * Contacts API — Full Test Suite
 */

import { AurinkoClient } from "../client";
import { NotFoundError, ValidationError } from "../errors";
import {
  makeFetchMock,
  mockOnce,
  getRequestBody,
  getRequestUrl,
  getRequestMethod,
  getRequestHeaders,
  makeDeltaSyncFetch,
  fixtures,
} from "./helpers";

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

// ─── list ─────────────────────────────────────────────────────────────────────

describe("Contacts — list", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("calls GET /contacts", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.contacts.list();
    expect(getRequestUrl(mock)).toContain("/contacts");
    expect(getRequestMethod(mock)).toBe("GET");
  });

  it("passes q search param", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.contacts.list({ q: "alice" });
    expect(getRequestUrl(mock)).toContain("q=alice");
  });

  it("passes limit param", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.contacts.list({ limit: 20 });
    expect(getRequestUrl(mock)).toContain("limit=20");
  });

  it("passes pageToken for pagination", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.contacts.list({ pageToken: "tok-abc" });
    expect(getRequestUrl(mock)).toContain("pageToken=tok-abc");
  });

  it("returns typed PagedResponse with contacts", async () => {
    const contact = fixtures.contact();
    global.fetch = mockOnce(200, { records: [contact], nextPageToken: "p2" });
    const result = await client.contacts.list();
    expect(result.records[0]?.id).toBe("contact-abc123");
    expect(result.nextPageToken).toBe("p2");
  });

  it("sends Bearer auth header", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.contacts.list();
    expect(getRequestHeaders(mock)["Authorization"]).toBe("Bearer test-token");
  });
});

// ─── iterate ──────────────────────────────────────────────────────────────────

describe("Contacts — iterate", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("yields all pages until no nextPageToken", async () => {
    global.fetch = makeFetchMock([
      { status: 200, body: { records: [{ id: "c1" }], nextPageToken: "p2" } },
      { status: 200, body: { records: [{ id: "c2" }] } },
    ]);
    const pages: string[][] = [];
    for await (const page of client.contacts.iterate()) {
      pages.push(page.records.map((c) => c.id));
    }
    expect(pages).toEqual([["c1"], ["c2"]]);
  });

  it("passes query params across pages", async () => {
    const mock = makeFetchMock([{ status: 200, body: { records: [] } }]);
    global.fetch = mock;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of client.contacts.iterate({ q: "bob" })) {
      break;
    }
    expect(getRequestUrl(mock)).toContain("q=bob");
  });

  it("passes limit option", async () => {
    const mock = makeFetchMock([{ status: 200, body: { records: [] } }]);
    global.fetch = mock;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of client.contacts.iterate({ limit: 50 })) {
      break;
    }
    expect(getRequestUrl(mock)).toContain("limit=50");
  });

  it("does not include pageToken in first query", async () => {
    const mock = makeFetchMock([{ status: 200, body: { records: [] } }]);
    global.fetch = mock;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of client.contacts.iterate()) {
      break;
    }
    expect(getRequestUrl(mock)).not.toContain("pageToken=");
  });
});

// ─── listAll ──────────────────────────────────────────────────────────────────

describe("Contacts — listAll", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("flattens all pages into a flat array", async () => {
    global.fetch = makeFetchMock([
      { status: 200, body: { records: [{ id: "c1" }, { id: "c2" }], nextPageToken: "p2" } },
      { status: 200, body: { records: [{ id: "c3" }] } },
    ]);
    const all = await client.contacts.listAll();
    expect(all).toHaveLength(3);
    expect(all.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
  });

  it("returns empty array when no contacts", async () => {
    global.fetch = mockOnce(200, { records: [] });
    const all = await client.contacts.listAll();
    expect(all).toEqual([]);
  });
});

// ─── get ──────────────────────────────────────────────────────────────────────

describe("Contacts — get", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("calls GET /contacts/{id}", async () => {
    const contact = fixtures.contact();
    const mock = mockOnce(200, contact);
    global.fetch = mock;
    const result = await client.contacts.get("contact-abc123");
    expect(getRequestUrl(mock)).toContain("/contacts/contact-abc123");
    expect(result.id).toBe("contact-abc123");
  });

  it("URL-encodes ID with special characters", async () => {
    const mock = mockOnce(200, { id: "id==abc" });
    global.fetch = mock;
    await client.contacts.get("id==abc");
    expect(getRequestUrl(mock)).toContain("/contacts/id%3D%3Dabc");
  });

  it("throws NotFoundError on 404", async () => {
    global.fetch = mockOnce(404, { message: "Contact not found" });
    await expect(client.contacts.get("ghost")).rejects.toThrow(NotFoundError);
  });

  it("returns full contact with nested fields", async () => {
    const contact = fixtures.contact();
    global.fetch = mockOnce(200, contact);
    const result = await client.contacts.get("contact-abc123");
    expect(result.name?.givenName).toBe("John");
    expect(result.emailAddresses?.[0]?.address).toBe("john@example.com");
  });
});

// ─── create ───────────────────────────────────────────────────────────────────

describe("Contacts — create", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("calls POST /contacts", async () => {
    const mock = mockOnce(201, fixtures.contact());
    global.fetch = mock;
    await client.contacts.create({
      name: { givenName: "John", familyName: "Smith" },
    });
    expect(getRequestMethod(mock)).toBe("POST");
    expect(getRequestUrl(mock)).toContain("/contacts");
  });

  it("sends name in request body", async () => {
    const mock = mockOnce(201, fixtures.contact());
    global.fetch = mock;
    await client.contacts.create({
      name: { givenName: "Jane", familyName: "Doe" },
    });
    const body = getRequestBody(mock) as Record<string, unknown>;
    expect((body["name"] as Record<string, unknown>)["givenName"]).toBe("Jane");
  });

  it("sends email addresses in body", async () => {
    const mock = mockOnce(201, fixtures.contact());
    global.fetch = mock;
    await client.contacts.create({
      emailAddresses: [{ address: "jane@example.com", type: "work" }],
    });
    const body = getRequestBody(mock) as Record<string, unknown>;
    const emails = body["emailAddresses"] as Array<Record<string, string>>;
    expect(emails[0]?.address).toBe("jane@example.com");
    expect(emails[0]?.type).toBe("work");
  });

  it("sends phone numbers in body", async () => {
    const mock = mockOnce(201, fixtures.contact());
    global.fetch = mock;
    await client.contacts.create({
      phoneNumbers: [{ number: "+1-555-9999", type: "mobile" }],
    });
    const body = getRequestBody(mock) as Record<string, unknown>;
    const phones = body["phoneNumbers"] as Array<Record<string, string>>;
    expect(phones[0]?.number).toBe("+1-555-9999");
  });

  it("sends company info in body", async () => {
    const mock = mockOnce(201, fixtures.contact());
    global.fetch = mock;

    await client.contacts.create({
      company: { companyName: "Acme Corp", jobTitle: "Engineer" },
    });

    const body = getRequestBody(mock) as Record<string, unknown>;

    expect((body["company"] as Record<string, unknown>)["companyName"]).toBe("Acme Corp");
  });

  it("sends notes in body", async () => {
    const mock = mockOnce(201, fixtures.contact());
    global.fetch = mock;
    await client.contacts.create({ notes: "VIP customer" });
    expect(getRequestBody(mock)).toMatchObject({ notes: "VIP customer" });
  });

  it("throws ValidationError on 400", async () => {
    global.fetch = mockOnce(400, { message: "Invalid email address" });
    await expect(
      client.contacts.create({ emailAddresses: [{ address: "not-an-email" }] })
    ).rejects.toThrow(ValidationError);
  });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe("Contacts — update", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("calls PATCH /contacts/{id}", async () => {
    const mock = mockOnce(200, fixtures.contact());
    global.fetch = mock;
    await client.contacts.update("contact-abc123", '"etag-v1"', { notes: "Updated" });
    expect(getRequestMethod(mock)).toBe("PATCH");
    expect(getRequestUrl(mock)).toContain("/contacts/contact-abc123");
  });

  it("sends If-Match header with etag value", async () => {
    const mock = mockOnce(200, fixtures.contact());
    global.fetch = mock;
    await client.contacts.update("contact-abc123", '"etag-v1"', { notes: "Updated" });
    expect(getRequestHeaders(mock)["If-Match"]).toBe('"etag-v1"');
  });

  it("sends updated fields in body", async () => {
    const mock = mockOnce(200, fixtures.contact());
    global.fetch = mock;
    await client.contacts.update("cid", '"etag"', {
      name: { givenName: "Bobby" },
      notes: "High priority",
    });
    const body = getRequestBody(mock) as Record<string, unknown>;
    expect((body["name"] as Record<string, unknown>)["givenName"]).toBe("Bobby");
    expect(body["notes"]).toBe("High priority");
  });

  it("URL-encodes contact ID with special chars", async () => {
    const mock = mockOnce(200, fixtures.contact());
    global.fetch = mock;
    await client.contacts.update("id/special==", '"etag"', { notes: "x" });
    expect(getRequestUrl(mock)).toContain("/contacts/id%2Fspecial%3D%3D");
  });

  it("does not lose custom headers when merging with If-Match", async () => {
    const mock = mockOnce(200, fixtures.contact());
    global.fetch = mock;
    await client.contacts.update(
      "cid",
      '"etag"',
      { notes: "x" },
      { headers: { "X-Extra": "extra-value" } }
    );
    const headers = getRequestHeaders(mock);
    expect(headers["If-Match"]).toBe('"etag"');
    expect(headers["X-Extra"]).toBe("extra-value");
  });
});

// ─── delete ───────────────────────────────────────────────────────────────────

describe("Contacts — delete", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("calls DELETE /contacts/{id}", async () => {
    const mock = mockOnce(204, null, { "content-length": "0" });
    global.fetch = mock;
    await client.contacts.delete("contact-abc123");
    expect(getRequestMethod(mock)).toBe("DELETE");
    expect(getRequestUrl(mock)).toContain("/contacts/contact-abc123");
  });

  it("returns null on 204", async () => {
    global.fetch = mockOnce(204, null, { "content-length": "0" });
    const result = await client.contacts.delete("cid");
    expect(result).toBeNull();
  });

  it("throws NotFoundError on 404", async () => {
    global.fetch = mockOnce(404, { message: "Not found" });
    await expect(client.contacts.delete("ghost")).rejects.toThrow(NotFoundError);
  });

  it("URL-encodes ID", async () => {
    const mock = mockOnce(204, null);
    global.fetch = mock;
    await client.contacts.delete("id==abc");
    expect(getRequestUrl(mock)).toContain("/contacts/id%3D%3Dabc");
  });
});

// ─── sync ─────────────────────────────────────────────────────────────────────

describe("Contacts — sync", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withToken("test-token");
  });

  it("starts sync with POST /contacts/sync", async () => {
    const mock = mockOnce(200, fixtures.syncStartResponse());
    global.fetch = mock;
    const result = await client.contacts.sync.start();
    expect(getRequestMethod(mock)).toBe("POST");
    expect(getRequestUrl(mock)).toContain("/contacts/sync");
    expect(result.syncUpdatedToken).toBe("sync-updated-token-abc");
    expect(result.ready).toBe(true);
  });

  it("starts sync with awaitReady param", async () => {
    const mock = mockOnce(200, { ...fixtures.syncStartResponse(), ready: false });
    global.fetch = mock;
    const result = await client.contacts.sync.start({ awaitReady: false });
    expect(getRequestUrl(mock)).toContain("awaitReady=false");
    expect(result.ready).toBe(false);
  });

  it("fetches updated contacts across multiple pages", async () => {
    global.fetch = makeDeltaSyncFetch([
      { records: [{ id: "c1" }, { id: "c2" }], nextPageToken: "p2" },
      { records: [{ id: "c3" }], nextDeltaToken: "new-contacts-delta" },
    ]);
    const { items, nextDeltaToken } = await client.contacts.sync.updated("init-delta");
    expect(items).toHaveLength(3);
    expect(nextDeltaToken).toBe("new-contacts-delta");
  });

  it("passes deltaToken on first updated request", async () => {
    const mock = makeDeltaSyncFetch([{ records: [], nextDeltaToken: "tok" }]);
    global.fetch = mock;
    await client.contacts.sync.updated("my-contact-delta");
    expect(getRequestUrl(mock)).toContain("deltaToken=my-contact-delta");
  });

  it("passes pageToken on subsequent updated pages", async () => {
    const mock = makeDeltaSyncFetch([
      { records: [{ id: "c1" }], nextPageToken: "page-2" },
      { records: [{ id: "c2" }], nextDeltaToken: "final" },
    ]);
    global.fetch = mock;
    await client.contacts.sync.updated("delta");
    expect(getRequestUrl(mock, 1)).toContain("pageToken=page-2");
    expect(getRequestUrl(mock, 1)).not.toContain("deltaToken=");
  });

  it("fetches deleted contact IDs", async () => {
    global.fetch = makeDeltaSyncFetch([
      { records: [{ id: "del-1" }, { id: "del-2" }], nextDeltaToken: "del-delta" },
    ]);
    const { items, nextDeltaToken } = await client.contacts.sync.deleted("del-init");
    expect(items).toHaveLength(2);
    expect(items[0]?.id).toBe("del-1");
    expect(nextDeltaToken).toBe("del-delta");
  });

  it("passes limit option to updated sync", async () => {
    const mock = makeDeltaSyncFetch([{ records: [], nextDeltaToken: "tok" }]);
    global.fetch = mock;
    await client.contacts.sync.updated("delta", { limit: 10 });
    expect(getRequestUrl(mock)).toContain("limit=10");
  });

  it("passes limit option to deleted sync", async () => {
    const mock = makeDeltaSyncFetch([{ records: [], nextDeltaToken: "tok" }]);
    global.fetch = mock;
    await client.contacts.sync.deleted("delta", { limit: 5 });
    expect(getRequestUrl(mock)).toContain("limit=5");
  });

  it("throws if updated sync returns no nextDeltaToken", async () => {
    global.fetch = mockOnce(200, { records: [] });
    await expect(client.contacts.sync.updated("delta")).rejects.toThrow("nextDeltaToken");
  });

  it("throws if deleted sync returns no nextDeltaToken", async () => {
    global.fetch = mockOnce(200, { records: [] });
    await expect(client.contacts.sync.deleted("delta")).rejects.toThrow("nextDeltaToken");
  });
});
