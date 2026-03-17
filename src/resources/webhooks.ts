/**
 * Webhooks API Resource
 */

import type { HttpClient } from "../http/client";
import type { RequestOptions } from "../config";
import type {
  Subscription,
  CreateSubscriptionParams,
  PagedResponse,
  WebhookNotification,
} from "../types/index";
import { verifyWebhookSignature, isValidWebhookSignature } from "../utils/webhook";
import type { WebhookVerificationRequest } from "../types/index";

export class WebhooksResource {
  constructor(
    private readonly http: HttpClient,
    private readonly signingSecret?: string
  ) {}

  // ─── Subscription Management ───────────────────────────────────────────────

  /**
   * List all active webhook subscriptions.
   */
  list(options?: RequestOptions): Promise<PagedResponse<Subscription>> {
    return this.http.get<PagedResponse<Subscription>>(
      "/subscriptions",
      undefined,
      options
    );
  }

  /**
   * Get a single webhook subscription by ID.
   */
  get(id: string | number, options?: RequestOptions): Promise<Subscription> {
    return this.http.get<Subscription>(
      `/subscriptions/${id}`,
      undefined,
      options
    );
  }

  /**
   * Create a new webhook subscription.
   *
   * @example
   * // Subscribe to email changes
   * await client.webhooks.create({
   *   resource: '/email/messages',
   *   notificationUrl: 'https://myapp.com/webhooks/aurinko',
   * });
   *
   * @example
   * // Subscribe to calendar changes for primary calendar
   * await client.webhooks.create({
   *   resource: '/calendars/primary/events',
   *   notificationUrl: 'https://myapp.com/webhooks/aurinko',
   * });
   *
   * @example
   * // Subscribe to booking events
   * await client.webhooks.create({
   *   resource: '/booking/935',
   *   notificationUrl: 'https://myapp.com/webhooks/aurinko',
   * });
   */
  create(
    params: CreateSubscriptionParams,
    options?: RequestOptions
  ): Promise<Subscription> {
    return this.http.post<Subscription>(
      "/subscriptions",
      params,
      undefined,
      options
    );
  }

  /**
   * Delete a webhook subscription.
   */
  delete(id: string | number, options?: RequestOptions): Promise<null> {
    return this.http.delete<null>(
      `/subscriptions/${id}`,
      undefined,
      options
    );
  }

  // ─── Convenience subscription factories ───────────────────────────────────

  /**
   * Subscribe to email message changes.
   */
  subscribeToEmail(
    notificationUrl: string,
    options?: RequestOptions
  ): Promise<Subscription> {
    return this.create({ resource: "/email/messages", notificationUrl }, options);
  }

  /**
   * Subscribe to email tracking events.
   */
  subscribeToEmailTracking(
    notificationUrl: string,
    options?: RequestOptions
  ): Promise<Subscription> {
    return this.create({ resource: "/email/tracking", notificationUrl }, options);
  }

  /**
   * Subscribe to calendar event changes.
   * @param calendarId - Calendar ID or "primary"
   */
  subscribeToCalendar(
    notificationUrl: string,
    calendarId = "primary",
    options?: RequestOptions
  ): Promise<Subscription> {
    return this.create(
      { resource: `/calendars/${calendarId}/events`, notificationUrl },
      options
    );
  }

  /**
   * Subscribe to contact changes.
   */
  subscribeToContacts(
    notificationUrl: string,
    options?: RequestOptions
  ): Promise<Subscription> {
    return this.create({ resource: "/contacts", notificationUrl }, options);
  }

  /**
   * Subscribe to task changes.
   * @param taskListId - Task list ID or "default"
   */
  subscribeToTasks(
    notificationUrl: string,
    taskListId = "default",
    options?: RequestOptions
  ): Promise<Subscription> {
    return this.create(
      { resource: `/tasklists/${taskListId}/tasks`, notificationUrl },
      options
    );
  }

  /**
   * Subscribe to booking lifecycle events.
   */
  subscribeToBooking(
    bookingId: number | string,
    notificationUrl: string,
    options?: RequestOptions
  ): Promise<Subscription> {
    return this.create(
      { resource: `/booking/${bookingId}`, notificationUrl },
      options
    );
  }

  // ─── Signature Verification ────────────────────────────────────────────────

  /**
   * Verify a webhook request signature. Throws WebhookVerificationError if invalid.
   *
   * @example
   * // Express with raw body parser
   * app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
   *   client.webhooks.verify({
   *     rawBody: req.body.toString(),
   *     signature: req.headers['x-aurinko-signature'] as string,
   *     timestamp: req.headers['x-aurinko-timestamp'] as string,
   *   });
   *   const notification = JSON.parse(req.body.toString()) as WebhookNotification;
   *   handleNotification(notification);
   *   res.sendStatus(200);
   * });
   */
  verify(request: WebhookVerificationRequest, maxAgeSeconds = 300): void {
    const secret = this.signingSecret;
    if (!secret) {
      throw new Error(
        "webhookSigningSecret is required in AurinkoConfig to verify webhook signatures."
      );
    }
    verifyWebhookSignature(request, secret, maxAgeSeconds);
  }

  /**
   * Safe version of verify() — returns boolean instead of throwing.
   */
  isValid(
    request: WebhookVerificationRequest,
    maxAgeSeconds = 300
  ): boolean {
    if (!this.signingSecret) return false;
    return isValidWebhookSignature(request, this.signingSecret, maxAgeSeconds);
  }

  /**
   * Parse and verify a webhook notification in one step.
   * Returns the typed notification payload.
   *
   * @throws WebhookVerificationError if signature is invalid
   */
  parseAndVerify(
    rawBody: string,
    signature: string,
    timestamp: string
  ): WebhookNotification {
    this.verify({ rawBody, signature, timestamp });
    return JSON.parse(rawBody) as WebhookNotification;
  }
}
