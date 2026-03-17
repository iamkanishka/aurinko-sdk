/**
 * Email API Types
 */
import type { EmailAddress, PagedResponse } from "./common";

// ─── Messages ────────────────────────────────────────────────────────────────

export type BodyType = "html" | "text";

export interface EmailAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  inline?: boolean;
  contentId?: string;
}

export interface EmailBody {
  bodyType: BodyType;
  content: string;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  internetMessageId?: string;
  subject?: string;
  from?: EmailAddress;
  to?: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress[];
  date?: string;
  receivedDate?: string;
  body?: EmailBody;
  snippet?: string;
  unread: boolean;
  flagged: boolean;
  hasAttachments: boolean;
  attachments?: EmailAttachment[];
  labels?: string[];
  folderId?: string;
  folderName?: string;
  headers?: Record<string, string>;
}

export interface ListEmailMessagesParams {
  /**
   * Query filter string supporting operators: from:, to:, cc:, subject:, has:attachment, is:unread, etc.
   */
  q?: string;
  pageToken?: string;
  limit?: number;
  bodyType?: BodyType;
  loadBody?: boolean;
  includeHeaders?: boolean;
}

export interface GetEmailMessageParams {
  bodyType?: BodyType;
  loadBody?: boolean;
  includeHeaders?: boolean;
}

// ─── Tracking ────────────────────────────────────────────────────────────────

export interface EmailTrackingOptions {
  /** Enable open tracking */
  opens?: boolean;
  /** Enable reply/bounce tracking */
  threadReplies?: boolean;
  /** Delay in seconds before enabling open tracking */
  trackOpensAfterSendDelay?: number;
  /** Custom string to correlate with this email */
  context?: string;
  /** Custom domain alias for the tracking pixel URL */
  customDomainAlias?: string;
}

export type TrackingEventType = "initial" | "open" | "reply" | "replyBounce";

export interface EmailTrackingEvent {
  id: number;
  createdAt: string;
  eventType: TrackingEventType;
  threadId?: string;
  messageId?: string;
  internetMessageId?: string;
  trackingId: number;
  trackingCode: string;
  context?: string;
  location?: string;
  userAgent?: string;
  remoteAddr?: string;
}

export interface EmailTracking {
  id: number;
  messageId?: string;
  internetMessageId?: string;
  subject?: string;
  context?: string;
  trackingCode: string;
  createdAt: string;
  events?: EmailTrackingEvent[];
}

// ─── Send / Draft ─────────────────────────────────────────────────────────────

export interface SendEmailParams {
  subject: string;
  body: string;
  bodyType?: BodyType;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  replyTo?: EmailAddress[];
  inReplyTo?: string;
  references?: string;
  tracking?: EmailTrackingOptions;
}

export interface CreateDraftParams extends SendEmailParams {
  // same fields as SendEmailParams
}

export interface SendDraftParams {
  draftId: string;
}

export interface EmailDraft {
  id: string;
  message: EmailMessage;
}

// ─── Attachment ───────────────────────────────────────────────────────────────

export interface AttachmentDownloadResult {
  data: ArrayBuffer;
  mimeType: string;
  name: string;
  size: number;
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export interface EmailSyncStartParams {
  daysWithin?: number;
  awaitReady?: boolean;
}

export type EmailSyncResponse = PagedResponse<EmailMessage> & {
  nextDeltaToken?: string;
};
