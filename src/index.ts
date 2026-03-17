/**
 * aurinko-sdk
 * Production-grade TypeScript SDK for the Aurinko Unified Mailbox API
 *
 * @see https://docs.aurinko.io
 * @version 1.0.0
 */

// ─── Main Client ──────────────────────────────────────────────────────────────
export { AurinkoClient } from "./client";

// ─── Resource Classes (for extension / testing) ───────────────────────────────
export {
  EmailResource,
  CalendarResource,
  ContactsResource,
  TasksResource,
  WebhooksResource,
  BookingResource,
  GroupBookingResource,
  DirectResource,
  AuthResource,
} from "./resources/index";

// ─── Error Classes ────────────────────────────────────────────────────────────
export {
  AurinkoError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ServerError,
  TimeoutError,
  NetworkError,
  WebhookVerificationError,
  ConfigurationError,
} from "./errors";

// ─── Utilities ────────────────────────────────────────────────────────────────
export { verifyWebhookSignature, isValidWebhookSignature } from "./utils/webhook";
export { paginate, collectAll, consumeDeltaSync } from "./utils/pagination";

// ─── Configuration Types ──────────────────────────────────────────────────────
export type { AurinkoConfig, AurinkoLogger, RequestOptions } from "./config";

// ─── All API Types ────────────────────────────────────────────────────────────
export type {
  // Common
  PagedResponse,
  PaginationParams,
  SyncStartResponse,
  SyncParams,
  EmailAddress,
  DateTimeWithTimezone,
  DateOnly,
  DateTimeOrDate,
  ServiceType,
  Account,

  // Email
  BodyType,
  EmailAttachment,
  EmailBody,
  EmailMessage,
  ListEmailMessagesParams,
  GetEmailMessageParams,
  EmailTrackingOptions,
  TrackingEventType,
  EmailTrackingEvent,
  EmailTracking,
  SendEmailParams,
  CreateDraftParams,
  EmailDraft,
  AttachmentDownloadResult,
  EmailSyncStartParams,
  EmailSyncResponse,

  // Calendar
  Calendar,
  AttendeeType,
  AttendeeStatus,
  EventStatus,
  EventVisibility,
  Attendee,
  OnlineMeeting,
  RecurrencePattern,
  RecurrenceRange,
  Recurrence,
  EventBody,
  CalendarEvent,
  FreeBusyInterval,
  FreeBusyResponse,
  AvailableSlot,
  CreateEventParams,
  UpdateEventParams,
  ListEventsParams,
  CalendarSyncStartParams,
  CalendarSyncResponse,

  // Contacts
  AddressType,
  PhoneType,
  EmailType,
  UrlType,
  ContactName,
  ContactCompany,
  Contact,
  CreateContactParams,
  UpdateContactParams,
  ListContactsParams,
  ContactSyncStartParams,
  ContactSyncResponse,

  // Tasks
  TaskStatus,
  TaskImportance,
  TaskList,
  Task,
  CreateTaskParams,
  UpdateTaskParams,
  CreateTaskListParams,
  ListTasksParams,
  TaskSyncStartParams,
  TaskSyncResponse,

  // Webhooks
  WebhookResource,
  Subscription,
  CreateSubscriptionParams,
  WebhookPayloadItem,
  BookingWebhookPayloadItem,
  TrackingWebhookPayloadItem,
  WebhookNotification,
  WebhookVerificationRequest,

  // Booking
  DayOfWeek,
  WorkingInterval,
  DaySchedule,
  WorkHours,
  BookingProfile,
  CreateBookingProfileParams,
  UpdateBookingProfileParams,
  AdditionalField,
  AvailabilitySlot,
  AvailabilityResponse,
  BookMeetingParams,
  BookMeetingResult,
  GroupRequired,
  GroupDefinition,
  GroupBookingProfile,
  GroupAvailabilitySlot,
  GroupAvailabilityResponse,
  BookGroupMeetingParams,
  AttachAccountsParams,
  AttachGroupsParams,

  // Auth
  OAuthFlowType,
  OAuthInitiateParams,
  OAuthInitiateResult,
  OAuthTokenExchangeParams,
  OAuthTokenResult,
  ServiceAccountParams,
} from "./types/index";
