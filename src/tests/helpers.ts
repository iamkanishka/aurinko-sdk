/**
 * Test helpers — shared mocks, fixtures, and utilities
 */

import { createHmac } from "crypto";
import type { EmailMessage, CalendarEvent, Contact, Task, TaskList, Subscription } from "../types";

// ─── Mock Fetch Factory ───────────────────────────────────────────────────────

export type MockResponse = {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
};

/**
 * Creates a jest fetch mock that returns each response in sequence.
 * After all responses are consumed it repeats the last one.
 */
export function makeFetchMock(responses: MockResponse[]): jest.Mock {
  let callIndex = 0;
  return jest.fn().mockImplementation(() => {
    const resp = responses[callIndex] ?? responses[responses.length - 1]!;
    callIndex++;
    const headersMap = new Map(
      Object.entries({ "content-type": "application/json", ...resp.headers })
    );
    return Promise.resolve({
      ok: resp.status >= 200 && resp.status < 300,
      status: resp.status,
      headers: { get: (k: string) => headersMap.get(k.toLowerCase()) ?? null },
      text: () =>
        Promise.resolve(resp.body !== null ? JSON.stringify(resp.body) : ""),
      arrayBuffer: () =>
        Promise.resolve(new TextEncoder().encode(JSON.stringify(resp.body ?? "")).buffer),
    });
  });
}

/** Creates a single-response fetch mock */
export function mockOnce(status: number, body: unknown, headers?: Record<string, string>) {
 return makeFetchMock([
  {
    status,
    body,
    ...(headers !== undefined && { headers }),
  },
]);
}

/** Helper: get the parsed body sent in a fetch call */
export function getRequestBody(mockFetch: jest.Mock, callIndex = 0): unknown {
  const [, init] = mockFetch.mock.calls[callIndex]!;
  const body = (init as RequestInit).body;
  return body ? JSON.parse(body as string) : undefined;
}

/** Helper: get the URL of a fetch call */
export function getRequestUrl(mockFetch: jest.Mock, callIndex = 0): string {
  return mockFetch.mock.calls[callIndex]![0] as string;
}

/** Helper: get the method of a fetch call */
export function getRequestMethod(mockFetch: jest.Mock, callIndex = 0): string {
  const [, init] = mockFetch.mock.calls[callIndex]!;
  return (init as RequestInit).method ?? "GET";
}

/** Helper: get all headers of a fetch call */
export function getRequestHeaders(mockFetch: jest.Mock, callIndex = 0): Record<string, string> {
  const [, init] = mockFetch.mock.calls[callIndex]!;
  return (init as RequestInit).headers as Record<string, string>;
}

// ─── Webhook Helpers ──────────────────────────────────────────────────────────

export function makeWebhookSignature(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function makeValidWebhookRequest(secret: string, body: unknown) {
  const rawBody = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = makeWebhookSignature(secret, timestamp, rawBody);
  return { rawBody, timestamp, signature };
}

// ─── Delta Sync Fetch Mock ────────────────────────────────────────────────────

/**
 * Creates a mock for multi-page delta sync.
 * First page has pageToken, second has nextDeltaToken.
 */
export function makeDeltaSyncFetch<T>(pages: Array<{
  records: T[];
  nextPageToken?: string;
  nextDeltaToken?: string;
}>): jest.Mock {
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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

export const fixtures = {
  emailMessage: (): EmailMessage => ({
    id: "msg-abc123",
    threadId: "thread-1",
    subject: "Test Email",
    from: { address: "sender@example.com", name: "Sender" },
    to: [{ address: "recipient@example.com" }],
    unread: true,
    flagged: false,
    hasAttachments: false,
    date: "2024-06-01T10:00:00Z",
    body: { bodyType: "html", content: "<p>Hello World</p>" },
    labels: ["INBOX"],
  }),

  calendarEvent: (): CalendarEvent => ({
    id: "evt-abc123",
    subject: "Team Meeting",
    start: { dateTime: "2024-06-10T09:00:00Z", timezone: "UTC" },
    end: { dateTime: "2024-06-10T10:00:00Z", timezone: "UTC" },
    status: "confirmed",
    isAllDay: false,
    isRecurring: false,
    organizer: { address: "organizer@example.com" },
  }),

  contact: (): Contact => ({
    id: "contact-abc123",
    name: { givenName: "John", familyName: "Smith" },
    emailAddresses: [{ address: "john@example.com", type: "work" }],
    phoneNumbers: [{ number: "+1-555-0100", type: "mobile" }],
    etag: '"etag-v1"',
  }),

  task: (): Task => ({
    id: "task-abc123",
    title: "Write unit tests",
    status: "notStarted",
    importance: "high",
    due: "2024-12-31T23:59:00Z",
    etag: '"task-etag-v1"',
  }),

  taskList: (): TaskList => ({
    id: "list-abc123",
    name: "My Tasks",
    isDefault: true,
  }),

  subscription: (): Subscription => ({
    id: 12345,
    resource: "/email/messages",
    notificationUrl: "https://myapp.com/webhooks",
    accountId: 99,
  }),

  syncStartResponse: () => ({
    syncUpdatedToken: "sync-updated-token-abc",
    syncDeletedToken: "sync-deleted-token-xyz",
    ready: true,
  }),

  bookingProfile: () => ({
    id: 42,
    name: "30-min Call",
    durationMinutes: 30,
    availabilityStep: 15,
    subject: "Demo Call",
    active: true,
  }),

  availabilitySlot: () => ({
    start: "2024-06-10T14:00:00Z",
    end: "2024-06-10T14:30:00Z",
  }),
};
