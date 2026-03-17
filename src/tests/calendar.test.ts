/**
 * Calendar API — Full Test Suite
 */

import { AurinkoClient } from "../client";
import { NotFoundError, ValidationError } from "../errors";
import {
  makeFetchMock, mockOnce, getRequestBody, getRequestUrl,
  getRequestMethod, makeDeltaSyncFetch, fixtures,
} from "./helpers";

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

describe("Calendar — list & get calendars", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("token"); });

  it("lists all calendars at GET /calendars", async () => {
    const mock = mockOnce(200, { records: [{ id: "primary", name: "Main" }] });
    global.fetch = mock;
    const result = await client.calendar.list();
    expect(getRequestUrl(mock)).toContain("/calendars");
    expect(result.records[0]?.id).toBe("primary");
  });

  it("gets calendar by ID", async () => {
    const mock = mockOnce(200, { id: "cal-work", name: "Work" });
    global.fetch = mock;
    const result = await client.calendar.get("cal-work");
    expect(getRequestUrl(mock)).toContain("/calendars/cal-work");
    expect(result.id).toBe("cal-work");
  });

  it("gets primary calendar", async () => {
    const mock = mockOnce(200, { id: "primary", isPrimary: true });
    global.fetch = mock;
    const result = await client.calendar.getPrimary();
    expect(getRequestUrl(mock)).toContain("/calendars/primary");
    expect(result.isPrimary).toBe(true);
  });

  it("client.calendar.primary is shorthand for forCalendar('primary')", async () => {
    const mock = mockOnce(201, fixtures.calendarEvent());
    global.fetch = mock;
    await client.calendar.primary.create({
      subject: "Test",
      start: { dateTime: "2024-01-01T09:00:00Z" },
      end: { dateTime: "2024-01-01T10:00:00Z" },
    });
    expect(getRequestUrl(mock)).toContain("/calendars/primary/events");
  });
});

describe("Calendar — events CRUD", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("token"); });

  it("lists events for a calendar", async () => {
    const mock = mockOnce(200, { records: [fixtures.calendarEvent()] });
    global.fetch = mock;
    const result = await client.calendar.forCalendar("primary").list();
    expect(getRequestUrl(mock)).toContain("/calendars/primary/events");
    expect(result.records).toHaveLength(1);
  });

  it("lists events with time range filters", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.calendar.primary.list({
      timeMin: "2024-01-01T00:00:00Z",
      timeMax: "2024-01-31T23:59:59Z",
    });
    expect(getRequestUrl(mock)).toContain("timeMin=2024-01-01");
    expect(getRequestUrl(mock)).toContain("timeMax=2024-01-31");
  });

  it("lists events in range via listRange", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.calendar.primary.listRange(
      "2024-06-01T00:00:00Z", "2024-06-30T23:59:59Z"
    );
    expect(getRequestUrl(mock)).toContain("/events/range");
    expect(getRequestUrl(mock)).toContain("timeMin=");
    expect(getRequestUrl(mock)).toContain("timeMax=");
  });

  it("iterates events across pages", async () => {
    global.fetch = makeFetchMock([
      { status: 200, body: { records: [{ id: "e1" }], nextPageToken: "p2" } },
      { status: 200, body: { records: [{ id: "e2" }] } },
    ]);
    const ids: string[] = [];
    for await (const page of client.calendar.primary.iterate()) {
      ids.push(...page.records.map((e) => e.id));
    }
    expect(ids).toEqual(["e1", "e2"]);
  });

  it("listAll collects all events", async () => {
    global.fetch = makeFetchMock([
      { status: 200, body: { records: [{ id: "e1" }], nextPageToken: "p2" } },
      { status: 200, body: { records: [{ id: "e2" }, { id: "e3" }] } },
    ]);
    const all = await client.calendar.primary.listAll();
    expect(all).toHaveLength(3);
  });

  it("gets single event by ID", async () => {
    const evt = fixtures.calendarEvent();
    const mock = mockOnce(200, evt);
    global.fetch = mock;
    const result = await client.calendar.primary.get("evt-abc123");
    expect(getRequestUrl(mock)).toContain("/calendars/primary/events/evt-abc123");
    expect(result.id).toBe("evt-abc123");
  });

  it("gets event with bodyType param", async () => {
    const mock = mockOnce(200, fixtures.calendarEvent());
    global.fetch = mock;
    await client.calendar.primary.get("evt-1", { bodyType: "text" });
    expect(getRequestUrl(mock)).toContain("bodyType=text");
  });

  it("creates event with POST", async () => {
    const mock = mockOnce(201, fixtures.calendarEvent());
    global.fetch = mock;
    const result = await client.calendar.primary.create({
      subject: "Team Meeting",
      start: { dateTime: "2024-06-10T09:00:00Z", timezone: "UTC" },
      end: { dateTime: "2024-06-10T10:00:00Z", timezone: "UTC" },
    });
    expect(getRequestMethod(mock)).toBe("POST");
    expect(getRequestUrl(mock)).toContain("/calendars/primary/events");
    expect(result.id).toBeDefined();
  });

  it("creates event with attendees", async () => {
    const mock = mockOnce(201, fixtures.calendarEvent());
    global.fetch = mock;
    await client.calendar.primary.create(
      {
        subject: "Interview",
        start: { dateTime: "2024-06-01T14:00:00Z" },
        end: { dateTime: "2024-06-01T15:00:00Z" },
        meetingInfo: {
          attendees: [
            { emailAddress: { address: "alice@example.com" }, type: "required" },
            { emailAddress: { address: "bob@example.com" }, type: "optional" },
          ],
        },
      },
      { notifyAttendees: true }
    );
    const body = getRequestBody(mock) as Record<string, unknown>;
    const attendees = ((body["meetingInfo"] as Record<string, unknown>)["attendees"] as unknown[]);
    expect(attendees).toHaveLength(2);
    expect(getRequestUrl(mock)).toContain("notifyAttendees=true");
  });

  it("creates online meeting event", async () => {
    const mock = mockOnce(201, fixtures.calendarEvent());
    global.fetch = mock;
    await client.calendar.primary.create({
      subject: "Video Call",
      start: { dateTime: "2024-06-01T09:00:00Z" },
      end: { dateTime: "2024-06-01T09:30:00Z" },
      meetingInfo: { isOnlineMeeting: true },
    });
    const body = getRequestBody(mock) as Record<string, unknown>;
    expect(
      ((body["meetingInfo"] as Record<string, unknown>)["isOnlineMeeting"])
    ).toBe(true);
  });

  it("creates event with returnRecord=false", async () => {
    const mock = mockOnce(201, { id: "only-id" });
    global.fetch = mock;
    await client.calendar.primary.create(
      { subject: "Quick", start: { dateTime: "2024-01-01T09:00:00Z" }, end: { dateTime: "2024-01-01T10:00:00Z" } },
      { returnRecord: false }
    );
    expect(getRequestUrl(mock)).toContain("returnRecord=false");
  });

  it("updates event with PATCH", async () => {
    const mock = mockOnce(200, { ...fixtures.calendarEvent(), subject: "Rescheduled" });
    global.fetch = mock;
    const result = await client.calendar.primary.update(
      "evt-abc123",
      { subject: "Rescheduled" }
    );
    expect(getRequestMethod(mock)).toBe("PATCH");
    expect(getRequestUrl(mock)).toContain("/calendars/primary/events/evt-abc123");
    expect(result.subject).toBe("Rescheduled");
  });

  it("update sends notifyAttendees param", async () => {
    const mock = mockOnce(200, fixtures.calendarEvent());
    global.fetch = mock;
    await client.calendar.primary.update(
      "evt-1",
      { subject: "Updated" },
      { notifyAttendees: false }
    );
    expect(getRequestUrl(mock)).toContain("notifyAttendees=false");
  });

  it("deletes event with DELETE", async () => {
    const mock = mockOnce(204, null, { "content-length": "0" });
    global.fetch = mock;
    await client.calendar.primary.delete("evt-abc123");
    expect(getRequestMethod(mock)).toBe("DELETE");
    expect(getRequestUrl(mock)).toContain("/calendars/primary/events/evt-abc123");
  });

  it("delete with notifyAttendees=false param", async () => {
    const mock = mockOnce(204, null);
    global.fetch = mock;
    await client.calendar.primary.delete("evt-1", { notifyAttendees: false });
    expect(getRequestUrl(mock)).toContain("notifyAttendees=false");
  });

  it("throws NotFoundError when event not found", async () => {
    global.fetch = mockOnce(404, { message: "Event not found" });
    await expect(client.calendar.primary.get("ghost-event")).rejects.toThrow(NotFoundError);
  });

  it("URL-encodes special chars in event ID", async () => {
    const mock = mockOnce(200, fixtures.calendarEvent());
    global.fetch = mock;
    await client.calendar.primary.get("evt==abc/def");
    expect(getRequestUrl(mock)).toContain("evt%3D%3Dabc%2Fdef");
  });
});

describe("Calendar — non-primary calendar", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("token"); });

  it("uses correct calendarId in path", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.calendar.forCalendar("cal-work-abc").list();
    expect(getRequestUrl(mock)).toContain("/calendars/cal-work-abc/events");
  });

  it("URL-encodes calendarId with special chars", async () => {
    const mock = mockOnce(200, { records: [] });
    global.fetch = mock;
    await client.calendar.forCalendar("my/calendar").list();
    expect(getRequestUrl(mock)).toContain("/calendars/my%2Fcalendar/events");
  });

  it("sync uses correct calendarId", async () => {
    const mock = mockOnce(200, fixtures.syncStartResponse());
    global.fetch = mock;
    await client.calendar.forCalendar("secondary").sync.start();
    expect(getRequestUrl(mock)).toContain("/calendars/secondary/sync");
  });
});

describe("Calendar — free/busy", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("token"); });

  it("calls GET /calendars/{id}/freeBusy with time params", async () => {
    const mock = mockOnce(200, {
      timeMin: "2024-06-10T00:00:00Z",
      timeMax: "2024-06-10T23:59:59Z",
      intervals: [
        { start: "2024-06-10T09:00:00Z", end: "2024-06-10T10:00:00Z", status: "busy" },
      ],
    });
    global.fetch = mock;
    const result = await client.calendar.primary.freeBusy(
      "2024-06-10T00:00:00Z",
      "2024-06-10T23:59:59Z"
    );
    expect(getRequestUrl(mock)).toContain("/calendars/primary/freeBusy");
    expect(getRequestUrl(mock)).toContain("timeMin=");
    expect(result.intervals).toHaveLength(1);
    expect(result.intervals[0]?.status).toBe("busy");
  });
});

describe("Calendar — sync", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("token"); });

  it("starts sync with timeMin/timeMax", async () => {
    const mock = mockOnce(200, fixtures.syncStartResponse());
    global.fetch = mock;
    const result = await client.calendar.primary.sync.start({
      timeMin: "2024-01-01T00:00:00Z",
      timeMax: "2024-12-31T23:59:59Z",
    });
    expect(getRequestMethod(mock)).toBe("POST");
    expect(getRequestUrl(mock)).toContain("/calendars/primary/sync");
    expect(getRequestUrl(mock)).toContain("timeMin=2024-01-01");
    expect(result.syncUpdatedToken).toBe("sync-updated-token-abc");
  });

  it("starts sync with awaitReady=false", async () => {
    const mock = mockOnce(200, { ...fixtures.syncStartResponse(), ready: false });
    global.fetch = mock;
    const result = await client.calendar.primary.sync.start({ awaitReady: false });
    expect(result.ready).toBe(false);
  });

  it("fetches updated events following pages", async () => {
    global.fetch = makeDeltaSyncFetch([
      { records: [fixtures.calendarEvent()], nextPageToken: "p2" },
      { records: [{ ...fixtures.calendarEvent(), id: "evt-2" }], nextDeltaToken: "cal-new-delta" },
    ]);
    const { items, nextDeltaToken } = await client.calendar.primary.sync.updated("delta-token");
    expect(items).toHaveLength(2);
    expect(nextDeltaToken).toBe("cal-new-delta");
  });

  it("fetches deleted event IDs", async () => {
    global.fetch = makeDeltaSyncFetch([
      { records: [{ id: "dead-evt-1" }, { id: "dead-evt-2" }], nextDeltaToken: "del-delta" },
    ]);
    const { items, nextDeltaToken } = await client.calendar.primary.sync.deleted("del-token");
    expect(items).toHaveLength(2);
    expect(nextDeltaToken).toBe("del-delta");
  });

  it("sync.updated passes deltaToken on first call", async () => {
    const mock = makeDeltaSyncFetch([
      { records: [], nextDeltaToken: "new-token" },
    ]);
    global.fetch = mock;
    await client.calendar.primary.sync.updated("my-delta");
    expect(getRequestUrl(mock)).toContain("deltaToken=my-delta");
  });
});

describe("Calendar — recurring event fields", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("token"); });

  it("creates recurring event with recurrence pattern", async () => {
    const mock = mockOnce(201, fixtures.calendarEvent());
    global.fetch = mock;
    await client.calendar.primary.create({
      subject: "Weekly Standup",
      start: { dateTime: "2024-06-10T09:00:00Z" },
      end: { dateTime: "2024-06-10T09:30:00Z" },
      recurrence: {
        pattern: { type: "weekly", interval: 1, daysOfWeek: ["monday"] },
        range: { type: "noEnd" },
      },
    });
    const body = getRequestBody(mock) as Record<string, unknown>;
    expect(body["recurrence"]).toBeDefined();
  });
});

describe("Calendar — validation errors", () => {
  let client: AurinkoClient;
  beforeEach(() => { client = AurinkoClient.withToken("token"); });

  it("throws ValidationError on 400 when creating event", async () => {
    global.fetch = mockOnce(400, { message: "Invalid date format" });
    await expect(
      client.calendar.primary.create({
        subject: "Bad Event",
        start: { dateTime: "not-a-date" },
        end: { dateTime: "not-a-date" },
      })
    ).rejects.toThrow(ValidationError);
  });
});
