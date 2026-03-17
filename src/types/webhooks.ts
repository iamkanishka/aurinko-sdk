/**
 * Webhooks API Types
 */

export type WebhookResource =
  | "/email/messages"
  | "/email/tracking"
  | "/calendars/primary/events"
  | `/calendars/${string}/events`
  | "/contacts"
  | "/tasklists/default/tasks"
  | `/tasklists/${string}/tasks`
  | `/booking/${string}`;

export interface Subscription {
  id: string | number;
  resource: string;
  notificationUrl: string;
  accountId?: number;
  active?: boolean;
  expiresAt?: string;
  createdAt?: string;
}

export interface CreateSubscriptionParams {
  resource: string;
  notificationUrl: string;
}

export interface WebhookPayloadItem {
  id: string;
  changeType: "created" | "updated" | "deleted";
}

export interface BookingWebhookPayloadItem {
  bookingId: number;
  calendarId: string;
  eventId: string;
}

export interface TrackingWebhookPayloadItem {
  id: number;
  createdAt: string;
  eventType: "initial" | "open" | "reply" | "replyBounce";
  threadId?: string;
  messageId?: string;
  internetMessageId?: string;
  trackingId: number;
  context?: string;
  trackingCode: string;
  location?: string;
  userAgent?: string;
  remoteAddr?: string;
}

export type WebhookPayloadItems =
  | WebhookPayloadItem[]
  | BookingWebhookPayloadItem[]
  | TrackingWebhookPayloadItem[];

export interface WebhookNotification {
  subscription: number;
  resource: string;
  accountId: number;
  payloads?: WebhookPayloadItems;
  lifecycleEvent?: "error" | "active";
  error?: string;
}

export interface WebhookVerificationRequest {
  /** The raw request body as a string */
  rawBody: string;
  /** The X-Aurinko-Signature header value */
  signature: string;
  /** The X-Aurinko-Timestamp header value */
  timestamp: string;
}
