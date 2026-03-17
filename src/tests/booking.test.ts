/**
 * Booking & Group Booking API — Full Test Suite
 */

import { AurinkoClient } from "../client";
import { AuthenticationError, NotFoundError } from "../errors";
import {
  mockOnce, getRequestBody, getRequestUrl, getRequestMethod, getRequestHeaders,
  makeFetchMock, fixtures,
} from "./helpers";

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

// ─── BookingResource ──────────────────────────────────────────────────────────

describe("Booking — listProfiles", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withFullConfig({
      accessToken: "test-token",
      clientId: "app-id",
      clientSecret: "app-secret",
    });
  });

  it("calls GET /book/account/profiles", async () => {
    const mock = mockOnce(200, { records: [fixtures.bookingProfile()] });
    global.fetch = mock;
    const result = await client.booking.listProfiles();
    expect(getRequestUrl(mock)).toContain("/book/account/profiles");
    expect(getRequestMethod(mock)).toBe("GET");
    expect(result.records[0]?.id).toBe(42);
  });

  it("passes pageToken and limit params", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.booking.listProfiles({ pageToken: "tok-1", limit: 20 });
    expect(getRequestUrl(mock)).toContain("pageToken=tok-1");
    expect(getRequestUrl(mock)).toContain("limit=20");
  });
});

describe("Booking — getProfile", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withFullConfig({
      accessToken: "test-token",
      clientId: "app-id",
      clientSecret: "app-secret",
    });
  });

  it("calls GET /book/account/profiles/{id}", async () => {
    const mock = mockOnce(200, fixtures.bookingProfile());
    global.fetch = mock;
    const result = await client.booking.getProfile(42);
    expect(getRequestUrl(mock)).toContain("/book/account/profiles/42");
    expect(result.id).toBe(42);
  });

  it("throws NotFoundError on 404", async () => {
    global.fetch = mockOnce(404, { message: "Profile not found" });
    await expect(client.booking.getProfile(999)).rejects.toThrow(NotFoundError);
  });
});

describe("Booking — createProfile", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withFullConfig({
      accessToken: "test-token",
      clientId: "app-id",
      clientSecret: "app-secret",
    });
  });

  it("calls POST /book/account/profiles", async () => {
    const mock = mockOnce(201, fixtures.bookingProfile());
    global.fetch = mock;
    const result = await client.booking.createProfile({
      name: "30-min Call",
      durationMinutes: 30,
    });
    expect(getRequestMethod(mock)).toBe("POST");
    expect(getRequestUrl(mock)).toContain("/book/account/profiles");
    expect(result.id).toBe(42);
  });

  it("sends all profile fields in body", async () => {
    const mock = mockOnce(201, fixtures.bookingProfile());
    global.fetch = mock;
    await client.booking.createProfile({
      name: "Demo Call",
      durationMinutes: 45,
      subject: "Product Demo",
      availabilityStep: 30,
      workHours: {
        monday: [{ start: "09:00", end: "17:00" }],
        tuesday: [{ start: "09:00", end: "17:00" }],
      },
    });
    const body = getRequestBody(mock) as Record<string, unknown>;
    expect(body["name"]).toBe("Demo Call");
    expect(body["durationMinutes"]).toBe(45);
    expect(body["subject"]).toBe("Product Demo");
    expect(body["availabilityStep"]).toBe(30);
  });

  it("sends description with template variables", async () => {
    const mock = mockOnce(201, fixtures.bookingProfile());
    global.fetch = mock;
    await client.booking.createProfile({
      name: "Call",
      durationMinutes: 30,
      description: "Hi {{name}}, here is the join link: {{meetingLink}}",
    });
    const body = getRequestBody(mock) as Record<string, string>;
    expect(body["description"]).toContain("{{name}}");
  });
});

describe("Booking — updateProfile", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withFullConfig({
      accessToken: "test-token",
      clientId: "app-id",
      clientSecret: "app-secret",
    });
  });

  it("calls PATCH /book/account/profiles/{id}", async () => {
    const mock = mockOnce(200, { ...fixtures.bookingProfile(), name: "Updated Call" });
    global.fetch = mock;
    const result = await client.booking.updateProfile(42, { name: "Updated Call" });
    expect(getRequestMethod(mock)).toBe("PATCH");
    expect(getRequestUrl(mock)).toContain("/book/account/profiles/42");
    expect(result.name).toBe("Updated Call");
  });

  it("sends partial update fields", async () => {
    const mock = mockOnce(200, fixtures.bookingProfile());
    global.fetch = mock;
    await client.booking.updateProfile(42, { durationMinutes: 60, availabilityStep: 15 });
    const body = getRequestBody(mock) as Record<string, unknown>;
    expect(body["durationMinutes"]).toBe(60);
    expect(body["availabilityStep"]).toBe(15);
  });
});

describe("Booking — deleteProfile", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withFullConfig({
      accessToken: "test-token",
      clientId: "app-id",
      clientSecret: "app-secret",
    });
  });

  it("calls DELETE /book/account/profiles/{id}", async () => {
    const mock = mockOnce(204, null, { "content-length": "0" });
    global.fetch = mock;
    await client.booking.deleteProfile(42);
    expect(getRequestMethod(mock)).toBe("DELETE");
    expect(getRequestUrl(mock)).toContain("/book/account/profiles/42");
  });
});

describe("Booking — getAvailability", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withFullConfig({
      accessToken: "test-token",
      clientId: "app-id",
      clientSecret: "app-secret",
    });
  });

  it("calls GET /book/account/profiles/{id}/meeting", async () => {
    const mock = mockOnce(200, { items: [fixtures.availabilitySlot()] });
    global.fetch = mock;
    const result = await client.booking.getAvailability(42);
    expect(getRequestUrl(mock)).toContain("/book/account/profiles/42/meeting");
    expect(result.items).toHaveLength(1);
  });

  it("uses Basic auth (app-level auth)", async () => {
    const mock = mockOnce(200, { items: [] });
    global.fetch = mock;
    await client.booking.getAvailability(42);
    expect(getRequestHeaders(mock)["Authorization"]).toMatch(/^Basic /);
  });

  it("throws AuthenticationError if no app credentials", async () => {
    const clientNoApp = AurinkoClient.withToken("only-bearer-no-app-creds");
    global.fetch = mockOnce(200, { items: [] });
    await expect(clientNoApp.booking.getAvailability(1)).rejects.toThrow(AuthenticationError);
  });
});

describe("Booking — book", () => {
  let client: AurinkoClient;
  beforeEach(() => {
    client = AurinkoClient.withFullConfig({
      accessToken: "test-token",
      clientId: "app-id",
      clientSecret: "app-secret",
    });
  });

  it("calls POST /book/account/profiles/{id}/meeting", async () => {
    const mock = mockOnce(200, { eventId: "evt-booked", bookingId: 99 });
    global.fetch = mock;
    const result = await client.booking.book(42, {
      time: { start: "2024-06-01T14:00:00Z", end: "2024-06-01T14:30:00Z" },
      name: "Jane Doe",
      email: "jane@example.com",
    });
    expect(getRequestMethod(mock)).toBe("POST");
    expect(getRequestUrl(mock)).toContain("/book/account/profiles/42/meeting");
    expect(result.bookingId).toBe(99);
  });

  it("sends time, name, email in body", async () => {
    const mock = mockOnce(200, { bookingId: 1, eventId: "e1" });
    global.fetch = mock;
    await client.booking.book(42, {
      time: { start: "2024-06-01T14:00:00Z", end: "2024-06-01T14:30:00Z" },
      name: "John Smith",
      email: "john@example.com",
    });
    const body = getRequestBody(mock) as Record<string, unknown>;
    expect((body["time"] as Record<string, string>)["start"]).toBe("2024-06-01T14:00:00Z");
    expect(body["name"]).toBe("John Smith");
    expect(body["email"]).toBe("john@example.com");
  });

  it("sends substitutionData for template variables", async () => {
    const mock = mockOnce(200, { bookingId: 1, eventId: "e1" });
    global.fetch = mock;
    await client.booking.book(42, {
      time: { start: "2024-06-01T14:00:00Z", end: "2024-06-01T14:30:00Z" },
      name: "Jane",
      email: "jane@example.com",
      substitutionData: { comments: "Looking forward to it!" },
    });
    const body = getRequestBody(mock) as Record<string, unknown>;
    expect(
      (body["substitutionData"] as Record<string, string>)["comments"]
    ).toBe("Looking forward to it!");
  });
});

// ─── GroupBookingResource ─────────────────────────────────────────────────────

describe("GroupBooking — listProfiles", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withAppCredentials("app-id", "app-secret"); });

  it("calls GET /book/group/profiles with Basic auth", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.groupBooking.listProfiles();
    expect(getRequestUrl(mock)).toContain("/book/group/profiles");
    expect(getRequestHeaders(mock)["Authorization"]).toMatch(/^Basic /);
  });

  it("passes pagination params", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.groupBooking.listProfiles({ pageToken: "pt1", limit: 15 });
    expect(getRequestUrl(mock)).toContain("pageToken=pt1");
    expect(getRequestUrl(mock)).toContain("limit=15");
  });
});

describe("GroupBooking — getProfile", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withAppCredentials("app-id", "app-secret"); });

  it("calls GET /book/group/profiles/{id}", async () => {
    const mock = mockOnce(200, { id: 10 });
    global.fetch = mock;
    const result = await client.groupBooking.getProfile(10);
    expect(getRequestUrl(mock)).toContain("/book/group/profiles/10");
    expect(result.id).toBe(10);
  });
});

describe("GroupBooking — createProfile", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withAppCredentials("app-id", "app-secret"); });

  it("calls POST /book/group/profiles with Basic auth", async () => {
    const mock = mockOnce(201, { id: 20, name: "Team Call" });
    global.fetch = mock;
    const result = await client.groupBooking.createProfile({
      name: "Team Call",
      durationMinutes: 45,
    });
    expect(getRequestMethod(mock)).toBe("POST");
    expect(getRequestUrl(mock)).toContain("/book/group/profiles");
    expect(getRequestHeaders(mock)["Authorization"]).toMatch(/^Basic /);
    expect(result.id).toBe(20);
  });
});

describe("GroupBooking — updateProfile", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withAppCredentials("app-id", "app-secret"); });

  it("calls PATCH /book/group/profiles/{id}", async () => {
    const mock = mockOnce(200, { id: 10, name: "Updated Team Call" });
    global.fetch = mock;
    await client.groupBooking.updateProfile(10, { name: "Updated Team Call" });
    expect(getRequestMethod(mock)).toBe("PATCH");
    expect(getRequestUrl(mock)).toContain("/book/group/profiles/10");
  });
});

describe("GroupBooking — deleteProfile", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withAppCredentials("app-id", "app-secret"); });

  it("calls DELETE /book/group/profiles/{id}", async () => {
    const mock = mockOnce(204, null);
    global.fetch = mock;
    await client.groupBooking.deleteProfile(10);
    expect(getRequestMethod(mock)).toBe("DELETE");
    expect(getRequestUrl(mock)).toContain("/book/group/profiles/10");
  });
});

describe("GroupBooking — attachAccounts", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withAppCredentials("app-id", "app-secret"); });

  it("calls POST /book/group/profiles/{id}/attachAccounts", async () => {
    const mock = mockOnce(200, null);
    global.fetch = mock;
    await client.groupBooking.attachAccounts(10, { accountIds: [101, 102, 103] });
    expect(getRequestMethod(mock)).toBe("POST");
    expect(getRequestUrl(mock)).toContain("/book/group/profiles/10/attachAccounts");
  });

  it("sends accountIds array in body", async () => {
    const mock = mockOnce(200, null);
    global.fetch = mock;
    await client.groupBooking.attachAccounts(10, { accountIds: [1, 2, 3] });
    const body = getRequestBody(mock) as Record<string, unknown>;
    expect(body["accountIds"]).toEqual([1, 2, 3]);
  });

  it("uses Basic auth", async () => {
    const mock = mockOnce(200, null);
    global.fetch = mock;
    await client.groupBooking.attachAccounts(10, { accountIds: [1] });
    expect(getRequestHeaders(mock)["Authorization"]).toMatch(/^Basic /);
  });
});

describe("GroupBooking — attachGroups", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withAppCredentials("app-id", "app-secret"); });

  it("calls POST /book/group/profiles/{id}/attachGroups", async () => {
    const mock = mockOnce(200, null);
    global.fetch = mock;
    await client.groupBooking.attachGroups(10, {
      groups: [{ extId: "team-east", accountIds: [101, 102], required: "one" }],
    });
    expect(getRequestMethod(mock)).toBe("POST");
    expect(getRequestUrl(mock)).toContain("/book/group/profiles/10/attachGroups");
  });

  it("sends groups with required=one", async () => {
    const mock = mockOnce(200, null);
    global.fetch = mock;
    await client.groupBooking.attachGroups(10, {
      groups: [{ extId: "team-west", accountIds: [201], required: "one" }],
    });
    const body = getRequestBody(mock) as Record<string, unknown>;
    const groups = body["groups"] as Array<Record<string, unknown>>;
    expect(groups[0]?.required).toBe("one");
  });

  it("sends groups with required=all", async () => {
    const mock = mockOnce(200, null);
    global.fetch = mock;
    await client.groupBooking.attachGroups(10, {
      groups: [{ extId: "must-attend", accountIds: [301, 302], required: "all" }],
    });
    const body = getRequestBody(mock) as Record<string, unknown>;
    const groups = body["groups"] as Array<Record<string, unknown>>;
    expect(groups[0]?.required).toBe("all");
  });

  it("sends multiple groups", async () => {
    const mock = mockOnce(200, null);
    global.fetch = mock;
    await client.groupBooking.attachGroups(10, {
      groups: [
        { extId: "group-a", accountIds: [1, 2], required: "one" },
        { extId: "group-b", accountIds: [3, 4], required: "all" },
      ],
    });
    const body = getRequestBody(mock) as Record<string, unknown>;
    const groups = body["groups"] as unknown[];
    expect(groups).toHaveLength(2);
  });
});

describe("GroupBooking — getAvailability", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withAppCredentials("app-id", "app-secret"); });

  it("calls GET /book/group/profiles/{id}/meeting with required=one", async () => {
    const mock = mockOnce(200, { items: [fixtures.availabilitySlot()] });
    global.fetch = mock;
    const result = await client.groupBooking.getAvailability(10, "one");
    expect(getRequestUrl(mock)).toContain("/book/group/profiles/10/meeting");
    expect(getRequestUrl(mock)).toContain("required=one");
    expect(result.items).toHaveLength(1);
  });

  it("passes required=all", async () => {
    const mock = mockOnce(200, { items: [] });
    global.fetch = mock;
    await client.groupBooking.getAvailability(10, "all");
    expect(getRequestUrl(mock)).toContain("required=all");
  });

  it("defaults to required=one", async () => {
    const mock = mockOnce(200, { items: [] });
    global.fetch = mock;
    await client.groupBooking.getAvailability(10);
    expect(getRequestUrl(mock)).toContain("required=one");
  });

  it("passes offset for large groups", async () => {
    const mock = mockOnce(200, { items: [] });
    global.fetch = mock;
    await client.groupBooking.getAvailability(10, "one", { offset: 10 });
    expect(getRequestUrl(mock)).toContain("offset=10");
  });

  it("uses Basic auth", async () => {
    const mock = mockOnce(200, { items: [] });
    global.fetch = mock;
    await client.groupBooking.getAvailability(10, "one");
    expect(getRequestHeaders(mock)["Authorization"]).toMatch(/^Basic /);
  });
});

describe("GroupBooking — book", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withAppCredentials("app-id", "app-secret"); });

  it("calls POST /book/group/profiles/{id}/meeting", async () => {
    const mock = mockOnce(200, { bookingId: 77, eventId: "group-evt-1" });
    global.fetch = mock;
    const result = await client.groupBooking.book(10, "one", {
      time: { start: "2024-06-01T14:00:00Z", end: "2024-06-01T14:45:00Z" },
      name: "Alice",
      email: "alice@example.com",
    });
    expect(getRequestMethod(mock)).toBe("POST");
    expect(getRequestUrl(mock)).toContain("/book/group/profiles/10/meeting");
    expect(result.bookingId).toBe(77);
  });

  it("sends required as query param", async () => {
    const mock = mockOnce(200, { bookingId: 1, eventId: "e1" });
    global.fetch = mock;
    await client.groupBooking.book(10, "all", {
      time: { start: "2024-06-01T14:00:00Z", end: "2024-06-01T14:30:00Z" },
      name: "Bob",
      email: "bob@example.com",
    });
    expect(getRequestUrl(mock)).toContain("required=all");
  });

  it("sends groupXids in body", async () => {
    const mock = mockOnce(200, { bookingId: 1, eventId: "e1" });
    global.fetch = mock;
    await client.groupBooking.book(10, "one", {
      time: { start: "2024-06-01T14:00:00Z", end: "2024-06-01T14:30:00Z" },
      name: "Bob",
      email: "bob@example.com",
      groupXids: ["team-east"],
      accountIds: [101],
    });
    const body = getRequestBody(mock) as Record<string, unknown>;
    expect(body["groupXids"]).toEqual(["team-east"]);
    expect(body["accountIds"]).toEqual([101]);
  });

  it("defaults required to one", async () => {
    const mock = mockOnce(200, { bookingId: 1, eventId: "e1" });
    global.fetch = mock;
    await client.groupBooking.book(10, undefined as unknown as "one", {
      time: { start: "2024-06-01T14:00:00Z", end: "2024-06-01T14:30:00Z" },
      name: "Test",
      email: "t@t.com",
    });
    expect(getRequestUrl(mock)).toContain("required=one");
  });
});

// ─── App-only client factory ──────────────────────────────────────────────────

describe("Booking — withAppCredentials factory", () => {
  it("client created with only app creds can call booking endpoints", async () => {
    const client = AurinkoClient.withAppCredentials("cid", "csec");
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.booking.listProfiles();
    expect(getRequestHeaders(mock)["Authorization"]).toMatch(/^Basic /);
  });

  it("basic auth header is base64(clientId:clientSecret)", async () => {
    const client = AurinkoClient.withAppCredentials("my-client-id", "my-client-secret");
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.booking.listProfiles();
    const authHeader = getRequestHeaders(mock)["Authorization"];
    const b64 = authHeader.replace("Basic ", "");
    const decoded = Buffer.from(b64, "base64").toString("utf-8");
    expect(decoded).toBe("my-client-id:my-client-secret");
  });
});
