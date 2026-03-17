# aurinko-sdk

Unofficial TypeScript SDK for  [Aurinko Unified Mailbox APIs](https://docs.aurinko.io).

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green)](https://nodejs.org/)

## Features

- ✅ **Full API coverage** — Email, Calendar, Contacts, Tasks, Webhooks, Booking, Group Booking, Direct, Auth
- 🔄 **Incremental sync** — delta-token pagination with async iterators for all sync endpoints
- 🔁 **Auto-retry** — exponential backoff on 429 / 5xx errors
- ⏱️ **Timeout & cancellation** — per-request `AbortSignal` support
- 🔐 **Webhook verification** — HMAC-SHA256 signature verification with timing-safe comparison
- 🧩 **Dual auth modes** — Bearer token (account-level) and Basic auth (app-level) from the same client
- 📦 **Dual ESM/CJS** — works in Node.js, Next.js, Vite, and bundlers
- 🏷️ **Strict TypeScript** — 100+ exported types, no `any`

---

## Installation

```bash
npm install aurinko-sdk
# or
pnpm add aurinko-sdk
# or
yarn add aurinko-sdk
```

**Requires Node.js >= 18** (uses native `fetch`).

---

## Quick Start

```typescript
import { AurinkoClient } from 'aurinko-sdk';

// Account-level client (for reading email, calendar, contacts, tasks)
const client = AurinkoClient.withToken(process.env.AURINKO_ACCESS_TOKEN!);

// List unread emails
const { records } = await client.email.messages.list({ q: 'is:unread' });

// Get calendar events for this week
const events = await client.calendar.primary.listRange(
  '2024-03-01T00:00:00Z',
  '2024-03-07T23:59:59Z'
);

// Create a task
await client.tasks.default.create({
  title: 'Review PR',
  importance: 'high',
  due: '2024-03-05T17:00:00Z',
});
```

---

## Client Initialization

```typescript
import { AurinkoClient } from 'aurinko-sdk';

// 1. Account-level calls only (email, calendar, contacts, tasks, sync)
const client = AurinkoClient.withToken('account-access-token');

// 2. App-level calls only (booking availability, group booking, account management)
const client = AurinkoClient.withAppCredentials('client-id', 'client-secret');

// 3. Full config — both token and app credentials (recommended for production)
const client = AurinkoClient.withFullConfig({
  accessToken: process.env.AURINKO_ACCESS_TOKEN,
  clientId: process.env.AURINKO_CLIENT_ID,
  clientSecret: process.env.AURINKO_CLIENT_SECRET,
  webhookSigningSecret: process.env.AURINKO_WEBHOOK_SECRET,
  timeoutMs: 15_000,    // default: 30s
  maxRetries: 3,        // default: 3 (exponential backoff)
  retryDelayMs: 1_000,  // default: 1s
  logger: console,      // optional structured logger
});
```

---

## API Reference

### 📧 Email API

```typescript
// List messages with search operators
const page = await client.email.messages.list({
  q: 'from:alice is:unread has:attachment',
  bodyType: 'html',
  limit: 25,
});

// Iterate all pages with async iterator
for await (const page of client.email.messages.iterate({ q: 'subject:invoice' })) {
  for (const msg of page.records) {
    console.log(msg.subject, msg.from?.address);
  }
}

// Get single message
const msg = await client.email.messages.get('message-id', { bodyType: 'text' });

// Send email with tracking
await client.email.messages.send({
  subject: 'Hello!',
  body: '<p>Hi there</p>',
  to: [{ address: 'bob@example.com', name: 'Bob' }],
  tracking: {
    opens: true,
    threadReplies: true,
    context: 'deal-42',
  },
});

// Download attachment
const { data, mimeType } = await client.email.attachments.download('msgId', 'attachId');

// Draft workflow
const draft = await client.email.drafts.create({ subject: 'Draft', body: '...', to: [...] });
await client.email.drafts.update(draft.id, { body: 'Updated body' });
await client.email.drafts.send(draft.id);

// Delta sync
const { syncUpdatedToken, syncDeletedToken } = await client.email.sync.start({ daysWithin: 30 });

// Later — incremental updates
const { items: updated, nextDeltaToken } = await client.email.sync.updated(syncUpdatedToken);
const { items: deleted } = await client.email.sync.deleted(syncDeletedToken);
```

### 📅 Calendar API

```typescript
// List all calendars
const { records: calendars } = await client.calendar.list();

// Work with a specific calendar (or use .primary shortcut)
const cal = client.calendar.forCalendar('primary');

// List events in time range
const events = await cal.listRange('2024-03-01T00:00:00Z', '2024-03-31T23:59:59Z');

// Create event with attendees
const event = await cal.create({
  subject: 'Team Standup',
  start: { dateTime: '2024-03-05T09:00:00Z', timezone: 'America/New_York' },
  end:   { dateTime: '2024-03-05T09:30:00Z', timezone: 'America/New_York' },
  meetingInfo: {
    attendees: [{ emailAddress: { address: 'alice@co.com' }, type: 'required' }],
    isOnlineMeeting: true,
  },
});

// Update event (silently, no notifications)
await cal.update(event.id, { subject: 'Updated Title' }, { notifyAttendees: false });

// Delete event
await cal.delete(event.id, { notifyAttendees: true });

// Check free/busy
const { intervals } = await cal.freeBusy('2024-03-05T00:00:00Z', '2024-03-05T23:59:59Z');

// Calendar delta sync
const { syncUpdatedToken } = await cal.sync.start({ timeMin: '2024-01-01T00:00:00Z' });
const { items, nextDeltaToken } = await cal.sync.updated(syncUpdatedToken);
```

### 👤 Contacts API

```typescript
// List contacts
for await (const page of client.contacts.iterate({ q: 'Jane' })) {
  console.log(page.records);
}

// Create contact
const contact = await client.contacts.create({
  name: { givenName: 'Jane', familyName: 'Doe' },
  emailAddresses: [{ address: 'jane@co.com', type: 'work' }],
  phoneNumbers: [{ number: '+1-555-0100', type: 'mobile' }],
  company: { companyName: 'ACME Corp', jobTitle: 'Engineer' },
});

// Update contact (requires ETag from the loaded contact)
await client.contacts.update(contact.id, contact.etag!, { notes: 'VIP customer' });

// Delta sync
const { syncUpdatedToken, syncDeletedToken } = await client.contacts.sync.start();
const { items } = await client.contacts.sync.updated(syncUpdatedToken);
```

### ✅ Tasks API

```typescript
// List task lists
const { records: lists } = await client.tasks.lists.list();

// Use default list or a specific one
const myTasks = client.tasks.forList('default');  // or client.tasks.default

// Create task
await myTasks.create({
  title: 'Prepare quarterly report',
  importance: 'high',
  due: '2024-03-31T23:59:00Z',
  notes: 'Include Q1 numbers',
});

// Mark complete
await myTasks.update('task-id', { status: 'completed' });

// Collect all incomplete tasks
const tasks = await myTasks.listAll({ status: 'notStarted' });

// Sync
const { syncUpdatedToken } = await myTasks.sync.start();
const { items } = await myTasks.sync.updated(syncUpdatedToken);
```

### 🔔 Webhooks API

```typescript
// Subscribe to resources
await client.webhooks.subscribeToEmail('https://myapp.com/hooks/aurinko');
await client.webhooks.subscribeToCalendar('https://myapp.com/hooks/aurinko', 'primary');
await client.webhooks.subscribeToContacts('https://myapp.com/hooks/aurinko');
await client.webhooks.subscribeToTasks('https://myapp.com/hooks/aurinko');
await client.webhooks.subscribeToBooking(935, 'https://myapp.com/hooks/aurinko');

// Express.js webhook handler
import express from 'express';
const app = express();

app.post(
  '/hooks/aurinko',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const notification = client.webhooks.parseAndVerify(
      req.body.toString(),
      req.headers['x-aurinko-signature'] as string,
      req.headers['x-aurinko-timestamp'] as string,
    );
    console.log('Event:', notification.resource, notification.payloads);
    res.sendStatus(200);
  }
);
```

### 📆 Booking API

```typescript
// Create a booking profile
const profile = await client.booking.createProfile({
  name: 'Product Demo',
  durationMinutes: 30,
  availabilityStep: 15,
  subject: 'Aurinko Product Demo',
  description: 'Hi {{name}}, see you soon! Notes: {{comments}}',
  workHours: {
    timezone: 'America/New_York',
    daySchedules: [
      { dayOfWeek: 'monday',    workingIntervals: [{ start: '09:00:00', end: '17:00:00' }] },
      { dayOfWeek: 'tuesday',   workingIntervals: [{ start: '09:00:00', end: '17:00:00' }] },
      { dayOfWeek: 'wednesday', workingIntervals: [{ start: '09:00:00', end: '17:00:00' }] },
    ],
  },
});

// Query available slots (requires app-level auth)
const availability = await client.booking.getAvailability(profile.id);
console.log(availability.items); // [{ start, end }, ...]

// Book a meeting
await client.booking.book(profile.id, {
  time: availability.items[0]!,
  name: 'Jane Smith',
  email: 'jane@client.com',
  substitutionData: { comments: 'Excited to learn more!' },
});
```

### 👥 Group Booking API

```typescript
// App-level client required
const appClient = AurinkoClient.withAppCredentials(
  process.env.AURINKO_CLIENT_ID!,
  process.env.AURINKO_CLIENT_SECRET!
);

// Create group profile
const profile = await appClient.groupBooking.createProfile({
  name: 'Sales Team Intro',
  durationMinutes: 45,
  subject: 'Sales Introduction Call',
});

// Attach accounts individually
await appClient.groupBooking.attachAccounts(profile.id, { accountIds: [101, 102] });

// OR attach as groups with availability rules
await appClient.groupBooking.attachGroups(profile.id, {
  groups: [
    { extId: 'us-team',  accountIds: [101, 102], required: 'one' }, // any US rep
    { extId: 'manager',  accountIds: [200],       required: 'all' }, // manager must attend
  ],
});

// Get group availability
const slots = await appClient.groupBooking.getAvailability(profile.id, 'one');

// Book with specific accounts/groups
await appClient.groupBooking.book(profile.id, 'one', {
  time: slots.items[0]!,
  accountIds: slots.items[0]!.accountIds,
  groupXids: slots.items[0]!.groupXids,
  name: 'Prospective Customer',
  email: 'prospect@company.com',
});
```

### ⚡ Direct API

```typescript
// Gmail native API pass-through
const messages = await client.direct.gmail<{ messages: unknown[] }>(
  'GET', '/users/me/messages', undefined, { maxResults: 10 }
);

// Microsoft Graph pass-through
const graphMessages = await client.direct.graph('GET', '/me/messages');

// Salesforce pass-through
const sfData = await client.direct.salesforce('GET', '/sobjects/Contact/describe/');

// Generic pass-through
const result = await client.direct.request('POST', '/some/provider/path', { key: 'value' });
```

### 🔑 Auth API

```typescript
// Initiate OAuth flow (redirects user to provider)
const { authorizationUrl } = await client.auth.initiateOAuth({
  serviceType: 'Google',
  scopes: ['Mail.Read', 'Calendars.ReadWrite', 'Contacts.ReadWrite'],
  returnUrl: 'https://myapp.com/oauth/callback',
});

// In your callback handler — exchange code for token
const tokenResult = await client.auth.exchangeCode({ code: req.query.code as string });
// Store tokenResult.accessToken securely

// Manage connected accounts
const { records: accounts } = await client.auth.listAccounts();
await client.auth.deleteAccount(accounts[0]!.id);
```

---

## Error Handling

All errors extend `AurinkoError` and carry a typed `code`:

```typescript
import {
  AurinkoError,
  AuthenticationError,
  RateLimitError,
  NotFoundError,
  ValidationError,
  WebhookVerificationError,
} from 'aurinko-sdk';

try {
  await client.email.messages.get('non-existent-id');
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log('Message not found');
  } else if (err instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${err.retryAfter}s`);
  } else if (err instanceof AuthenticationError) {
    console.log('Token expired — refresh it');
  } else if (err instanceof AurinkoError) {
    console.log(err.code, err.statusCode, err.message);
  }
}
```

| Error Class | HTTP Status | Code |
|---|---|---|
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `AuthenticationError` | 401 | `AUTHENTICATION_ERROR` |
| `AuthorizationError` | 403 | `AUTHORIZATION_ERROR` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `RateLimitError` | 429 | `RATE_LIMIT_ERROR` |
| `ServerError` | 5xx | `SERVER_ERROR` |
| `TimeoutError` | — | `TIMEOUT_ERROR` |
| `NetworkError` | — | `NETWORK_ERROR` |
| `WebhookVerificationError` | — | `WEBHOOK_VERIFICATION_FAILED` |
| `ConfigurationError` | — | `CONFIGURATION_ERROR` |

---

## Build & Test

```bash
# Install dependencies
npm install

# Build all outputs (ESM + CJS + types)
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type-check without emitting
npm run typecheck

# Lint
npm run lint
```

---

## License

MIT
