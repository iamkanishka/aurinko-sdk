/**
 * Direct API & Auth Resource — Full Test Suite
 */

import { AurinkoClient } from "../client";
import { NotFoundError } from "../errors";
import {
  mockOnce, getRequestBody, getRequestUrl, getRequestMethod, getRequestHeaders,
} from "./helpers";

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

// ─── DirectResource.request ───────────────────────────────────────────────────

describe("Direct — request()", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("prepends /direct to providerPath", async () => {
    const mock = mockOnce(200, { result: "ok" });
    global.fetch = mock;
    await client.direct.request("GET", "/gmail/v1/users/me/messages");
    expect(getRequestUrl(mock)).toContain("/direct/gmail/v1/users/me/messages");
  });

  it("handles providerPath without leading slash", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    await client.direct.request("GET", "me/messages");
    expect(getRequestUrl(mock)).toContain("/direct/me/messages");
  });

  it("passes query params", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    await client.direct.request("GET", "/gmail/v1/users/me/messages", undefined, { maxResults: 10 });
    expect(getRequestUrl(mock)).toContain("maxResults=10");
  });

  it("passes body for POST", async () => {
    const mock = mockOnce(200, { id: "created" });
    global.fetch = mock;
    await client.direct.request("POST", "/me/events", { subject: "Direct event" });
    expect(getRequestMethod(mock)).toBe("POST");
    expect(getRequestBody(mock)).toMatchObject({ subject: "Direct event" });
  });

  it("supports all HTTP methods", async () => {
    for (const method of ["GET", "POST", "PATCH", "PUT", "DELETE"] as const) {
      const mock = mockOnce(200, {});
      global.fetch = mock;
      await client.direct.request(method, "/some/path");
      expect(getRequestMethod(mock)).toBe(method);
    }
  });
});

// ─── DirectResource shorthand methods ────────────────────────────────────────

describe("Direct — get()", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("uses GET method", async () => {
    const mock = mockOnce(200, { messages: [] });
    global.fetch = mock;
    await client.direct.get("/gmail/v1/users/me/messages");
    expect(getRequestMethod(mock)).toBe("GET");
    expect(getRequestUrl(mock)).toContain("/direct/gmail/v1/users/me/messages");
  });

  it("passes query params", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    await client.direct.get("/me/messages", { $top: 5, $filter: "unread" });
    expect(getRequestUrl(mock)).toContain("%24top=5");
  });
});

describe("Direct — post()", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("uses POST method with body", async () => {
    const mock = mockOnce(201, { id: "new" });
    global.fetch = mock;
    await client.direct.post("/me/messages", { subject: "Test" });
    expect(getRequestMethod(mock)).toBe("POST");
    expect(getRequestBody(mock)).toMatchObject({ subject: "Test" });
  });
});

describe("Direct — patch()", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("uses PATCH method", async () => {
    const mock = mockOnce(200, { id: "updated" });
    global.fetch = mock;
    await client.direct.patch("/me/messages/msg-1", { isRead: true });
    expect(getRequestMethod(mock)).toBe("PATCH");
    expect(getRequestUrl(mock)).toContain("/direct/me/messages/msg-1");
  });
});

describe("Direct — put()", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("uses PUT method", async () => {
    const mock = mockOnce(200, { replaced: true });
    global.fetch = mock;
    await client.direct.put("/services/data/v51.0/sobjects/Contact/003x/", { FirstName: "New" });
    expect(getRequestMethod(mock)).toBe("PUT");
  });
});

describe("Direct — delete()", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("uses DELETE method", async () => {
    const mock = mockOnce(204, null);
    global.fetch = mock;
    await client.direct.delete("/me/messages/msg-1");
    expect(getRequestMethod(mock)).toBe("DELETE");
    expect(getRequestUrl(mock)).toContain("/direct/me/messages/msg-1");
  });
});

// ─── Provider-specific helpers ────────────────────────────────────────────────

describe("Direct — gmail()", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("prepends /direct/gmail/v1 to gmailPath", async () => {
    const mock = mockOnce(200, { messages: [] });
    global.fetch = mock;
    await client.direct.gmail("GET", "/users/me/messages");
    expect(getRequestUrl(mock)).toContain("/direct/gmail/v1/users/me/messages");
  });

  it("handles gmailPath without leading slash", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    await client.direct.gmail("GET", "users/me/profile");
    expect(getRequestUrl(mock)).toContain("/direct/gmail/v1/users/me/profile");
  });

  it("sends body for POST", async () => {
    const mock = mockOnce(200, { id: "draft-1" });
    global.fetch = mock;
    await client.direct.gmail("POST", "/users/me/drafts", { message: { raw: "abc" } });
    expect(getRequestMethod(mock)).toBe("POST");
    expect(getRequestBody(mock)).toMatchObject({ message: { raw: "abc" } });
  });

  it("passes query params", async () => {
    const mock = mockOnce(200, { messages: [] });
    global.fetch = mock;
    await client.direct.gmail("GET", "/users/me/messages", undefined, { maxResults: 100 });
    expect(getRequestUrl(mock)).toContain("maxResults=100");
  });

  it("supports all HTTP methods", async () => {
    for (const method of ["GET", "POST", "PATCH", "PUT", "DELETE"] as const) {
      const mock = mockOnce(200, {});
      global.fetch = mock;
      await client.direct.gmail(method, "/users/me/messages");
      expect(getRequestMethod(mock)).toBe(method);
    }
  });
});

describe("Direct — graph()", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("prepends /direct to graphPath (no gmail/v1 prefix)", async () => {
    const mock = mockOnce(200, { value: [] });
    global.fetch = mock;
    await client.direct.graph("GET", "/me/messages");
    expect(getRequestUrl(mock)).toContain("/direct/me/messages");
    expect(getRequestUrl(mock)).not.toContain("/gmail/v1");
  });

  it("handles graphPath without leading slash", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    await client.direct.graph("GET", "me/calendarView");
    expect(getRequestUrl(mock)).toContain("/direct/me/calendarView");
  });

  it("sends body for POST to Graph", async () => {
    const mock = mockOnce(201, { id: "new-event" });
    global.fetch = mock;
    await client.direct.graph("POST", "/me/events", { subject: "Team Sync" });
    expect(getRequestBody(mock)).toMatchObject({ subject: "Team Sync" });
  });
});

describe("Direct — salesforce()", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("test-token"); });

  it("prepends /direct/services/data/{version} to sfPath", async () => {
    const mock = mockOnce(200, { objectDescribe: {} });
    global.fetch = mock;
    await client.direct.salesforce("GET", "/sobjects/Contact/describe/");
    expect(getRequestUrl(mock)).toContain("/direct/services/data/v51.0/sobjects/Contact/describe/");
  });

  it("uses default API version v51.0", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    await client.direct.salesforce("GET", "/sobjects");
    expect(getRequestUrl(mock)).toContain("v51.0");
  });

  it("accepts custom API version", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    await client.direct.salesforce("GET", "/sobjects", undefined, "v58.0");
    expect(getRequestUrl(mock)).toContain("v58.0");
    expect(getRequestUrl(mock)).not.toContain("v51.0");
  });

  it("handles sfPath without leading slash", async () => {
    const mock = mockOnce(200, {});
    global.fetch = mock;
    await client.direct.salesforce("GET", "sobjects/Account");
    expect(getRequestUrl(mock)).toContain("/sobjects/Account");
  });

  it("sends POST body for Salesforce", async () => {
    const mock = mockOnce(201, { id: "001x", success: true });
    global.fetch = mock;
    await client.direct.salesforce("POST", "/sobjects/Contact", { FirstName: "Jane", LastName: "Doe" });
    const body = getRequestBody(mock) as Record<string, string>;
    expect(body["FirstName"]).toBe("Jane");
  });
});

// ─── AuthResource ─────────────────────────────────────────────────────────────

describe("Auth — initiateOAuth", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withAppCredentials("app-id", "app-secret");
  });

  it("calls GET /auth/authorize with Basic auth", async () => {
    const mock = mockOnce(200, {
      authorizationUrl: "https://accounts.google.com/o/oauth2/auth?...",
    });
    global.fetch = mock;
    const result = await client.auth.initiateOAuth({
      serviceType: "Google",
      scopes: ["Mail.Read", "Calendars.ReadWrite"],
      returnUrl: "https://myapp.com/oauth/callback",
    });
    expect(getRequestUrl(mock)).toContain("/auth/authorize");
    expect(getRequestMethod(mock)).toBe("GET");
    expect(getRequestHeaders(mock)["Authorization"]).toMatch(/^Basic /);
    expect(result.authorizationUrl).toContain("accounts.google.com");
  });

  it("passes all params as query string", async () => {
    const mock = mockOnce(200, { authorizationUrl: "https://..." });
    global.fetch = mock;
    await client.auth.initiateOAuth({
      serviceType: "O365",
      scopes: ["Mail.Read"],
      returnUrl: "https://myapp.com/callback",
    });
    expect(getRequestUrl(mock)).toContain("serviceType=O365");
    expect(getRequestUrl(mock)).toContain("returnUrl=");
  });
});

describe("Auth — exchangeCode", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withAppCredentials("app-id", "app-secret");
  });

  it("calls POST /auth/token", async () => {
    const mock = mockOnce(200, {
      accessToken: "acc-tok-abc",
      accountId: 123,
      serviceType: "Google",
    });
    global.fetch = mock;
    const result = await client.auth.exchangeCode({ code: "oauth-code-xyz" });
    expect(getRequestMethod(mock)).toBe("POST");
    expect(getRequestUrl(mock)).toContain("/auth/token");
    expect(result.accessToken).toBe("acc-tok-abc");
    expect(result.accountId).toBe(123);
  });

  it("uses Basic app auth", async () => {
    const mock = mockOnce(200, { accessToken: "t", accountId: 1, serviceType: "Google" });
    global.fetch = mock;
    await client.auth.exchangeCode({ code: "c" });
    expect(getRequestHeaders(mock)["Authorization"]).toMatch(/^Basic /);
  });

  it("sends code in request body", async () => {
    const mock = mockOnce(200, { accessToken: "t", accountId: 1, serviceType: "Google" });
    global.fetch = mock;
    await client.auth.exchangeCode({ code: "my-auth-code-abc" });
    const body = getRequestBody(mock) as Record<string, string>;
    expect(body["code"]).toBe("my-auth-code-abc");
  });
});

describe("Auth — listAccounts", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withAppCredentials("app-id", "app-secret");
  });

  it("calls GET /accounts with Basic auth", async () => {
    const mock = mockOnce(200, { records: [{ id: 1, serviceType: "Google" }] });
    global.fetch = mock;
    const result = await client.auth.listAccounts();
    expect(getRequestUrl(mock)).toContain("/accounts");
    expect(getRequestMethod(mock)).toBe("GET");
    expect(getRequestHeaders(mock)["Authorization"]).toMatch(/^Basic /);
    expect(result.records[0]?.id).toBe(1);
  });

  it("passes pagination params", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.auth.listAccounts({ pageToken: "tok-p2", limit: 50 });
    expect(getRequestUrl(mock)).toContain("pageToken=tok-p2");
    expect(getRequestUrl(mock)).toContain("limit=50");
  });
});

describe("Auth — getAccount", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withAppCredentials("app-id", "app-secret");
  });

  it("calls GET /accounts/{id}", async () => {
    const mock = mockOnce(200, { id: 42, serviceType: "Google", email: "user@gmail.com" });
    global.fetch = mock;
    const result = await client.auth.getAccount(42);
    expect(getRequestUrl(mock)).toContain("/accounts/42");
    expect(result.id).toBe(42);
  });

  it("throws NotFoundError on 404", async () => {
    global.fetch = mockOnce(404, { message: "Account not found" });
    await expect(client.auth.getAccount(999)).rejects.toThrow(NotFoundError);
  });

  it("uses Basic auth", async () => {
    const mock = mockOnce(200, { id: 1, serviceType: "O365" });
    global.fetch = mock;
    await client.auth.getAccount(1);
    expect(getRequestHeaders(mock)["Authorization"]).toMatch(/^Basic /);
  });
});

describe("Auth — deleteAccount", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withAppCredentials("app-id", "app-secret");
  });

  it("calls DELETE /accounts/{id}", async () => {
    const mock = mockOnce(204, null, { "content-length": "0" });
    global.fetch = mock;
    await client.auth.deleteAccount(42);
    expect(getRequestMethod(mock)).toBe("DELETE");
    expect(getRequestUrl(mock)).toContain("/accounts/42");
  });

  it("uses Basic auth for deletion", async () => {
    const mock = mockOnce(204, null);
    global.fetch = mock;
    await client.auth.deleteAccount(1);
    expect(getRequestHeaders(mock)["Authorization"]).toMatch(/^Basic /);
  });

  it("returns null on success", async () => {
    global.fetch = mockOnce(204, null);
    const result = await client.auth.deleteAccount(1);
    expect(result).toBeNull();
  });
});
