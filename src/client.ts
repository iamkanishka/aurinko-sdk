/**
 * AurinkoClient — main entry point for the Aurinko TypeScript SDK
 */

import { HttpClient } from "./http/client.js";
import {
  EmailResource,
  CalendarResource,
  ContactsResource,
  TasksResource,
  WebhooksResource,
  BookingResource,
  GroupBookingResource,
  DirectResource,
  AuthResource,
} from "./resources/index.js";
import { ConfigurationError } from "./errors.js";
import type { AurinkoConfig } from "./config.js";

export class AurinkoClient {
  private readonly http: HttpClient;

  // ─── Public API Resources ──────────────────────────────────────────────────

  /**
   * Email API — messages, drafts, attachments, tracking, sync
   * @see https://docs.aurinko.io/unified-apis/email-api
   */
  readonly email: EmailResource;

  /**
   * Calendar API — calendars, events, free/busy, sync
   * @see https://docs.aurinko.io/unified-apis/calendar-api
   */
  readonly calendar: CalendarResource;

  /**
   * Contacts API — CRUD and sync for address books
   * @see https://docs.aurinko.io/unified-apis/contacts-api
   */
  readonly contacts: ContactsResource;

  /**
   * Tasks API — task lists, tasks, sync
   * @see https://docs.aurinko.io/unified-apis/tasks-api
   */
  readonly tasks: TasksResource;

  /**
   * Webhooks API — subscriptions and signature verification
   * @see https://docs.aurinko.io/unified-apis/webhooks-api
   */
  readonly webhooks: WebhooksResource;

  /**
   * Booking API — scheduling for a single calendar
   * @see https://docs.aurinko.io/scheduling/booking-api
   */
  readonly booking: BookingResource;

  /**
   * Group Booking API — scheduling across multiple calendars/teams
   * @see https://docs.aurinko.io/scheduling/group-booking-api
   */
  readonly groupBooking: GroupBookingResource;

  /**
   * Direct API — pass-through proxy to native provider APIs
   * @see https://docs.aurinko.io/unified-apis/direct-api
   */
  readonly direct: DirectResource;

  /**
   * Auth API — OAuth flows and account management
   * @see https://docs.aurinko.io/authentication/oauth-flow
   */
  readonly auth: AuthResource;

  // ─── Constructor ───────────────────────────────────────────────────────────

  constructor(config: AurinkoConfig) {
    this.validateConfig(config);

    this.http = new HttpClient(config);

    this.email = new EmailResource(this.http);
    this.calendar = new CalendarResource(this.http);
    this.contacts = new ContactsResource(this.http);
    this.tasks = new TasksResource(this.http);
    this.webhooks = new WebhooksResource(this.http, config.webhookSigningSecret);
    this.booking = new BookingResource(this.http);
    this.groupBooking = new GroupBookingResource(this.http);
    this.direct = new DirectResource(this.http);
    this.auth = new AuthResource(this.http);
  }

  // ─── Factory helpers ───────────────────────────────────────────────────────

  /**
   * Create a client configured for account-level (Bearer token) API calls.
   *
   * @example
   * const client = AurinkoClient.withToken('your-account-access-token');
   */
  static withToken(accessToken: string, config: Omit<AurinkoConfig, "accessToken"> = {}) {
    return new AurinkoClient({ ...config, accessToken });
  }

  /**
   * Create a client configured for app-level (clientId + secret) API calls.
   * Use this for booking availability, group booking, and account management.
   *
   * @example
   * const client = AurinkoClient.withAppCredentials('clientId', 'clientSecret');
   */
  static withAppCredentials(
    clientId: string,
    clientSecret: string,
    config: Omit<AurinkoConfig, "clientId" | "clientSecret"> = {}
  ) {
    return new AurinkoClient({ ...config, clientId, clientSecret });
  }

  /**
   * Create a client with both token and app credentials (most flexible).
   * Allows both account-level and app-level calls from the same instance.
   *
   * @example
   * const client = AurinkoClient.withFullConfig({
   *   accessToken: 'account-token',
   *   clientId: 'your-client-id',
   *   clientSecret: 'your-client-secret',
   *   webhookSigningSecret: 'your-webhook-secret',
   * });
   */
  static withFullConfig(config: AurinkoConfig) {
    return new AurinkoClient(config);
  }

  // ─── Config Validation ─────────────────────────────────────────────────────

  private validateConfig(config: AurinkoConfig): void {
    const hasToken = Boolean(config.accessToken);
    const hasAppCreds = Boolean(config.clientId && config.clientSecret);

    if (!hasToken && !hasAppCreds) {
      throw new ConfigurationError(
        "AurinkoClient requires either an `accessToken` (for account-level calls) " +
          "or both `clientId` and `clientSecret` (for app-level calls). " +
          "Provide at least one."
      );
    }

    if (config.timeoutMs !== undefined && config.timeoutMs <= 0) {
      throw new ConfigurationError("`timeoutMs` must be a positive number.");
    }

    if (config.maxRetries !== undefined && config.maxRetries < 0) {
      throw new ConfigurationError("`maxRetries` must be >= 0.");
    }
  }
}
