/**
 * Email API Resource
 */

import type { HttpClient } from "../http/client";
import type { RequestOptions } from "../config";
import type {
  EmailMessage,
  EmailDraft,
  EmailTracking,
  SendEmailParams,
  CreateDraftParams,
  ListEmailMessagesParams,
  GetEmailMessageParams,
  EmailSyncStartParams,
  AttachmentDownloadResult,
  PagedResponse,
  SyncStartResponse,
} from "../types/index";
import { paginate, collectAll, consumeDeltaSync } from "../utils/pagination";
import { defined } from "../utils/defined";

export class EmailResource {
  constructor(private readonly http: HttpClient) {}

  // ─── Messages ──────────────────────────────────────────────────────────────

  /**
   * List email messages with optional search query.
   *
   * Supports query operators: from:, to:, cc:, bcc:, subject:, has:attachment,
   * is:read, is:unread, after:YYYY/MM/DD, before:YYYY/MM/DD, label: (Gmail only)
   *
   * @example
   * const page = await client.email.messages.list({ q: 'from:alice is:unread' });
   */
  readonly messages = {
    list: (
      params: ListEmailMessagesParams = {},
      options?: RequestOptions
    ): Promise<PagedResponse<EmailMessage>> => {
      const { pageToken, limit, bodyType, loadBody, includeHeaders, q } = params;
      return this.http.get<PagedResponse<EmailMessage>>(
        "/email/messages",
        { q, pageToken, limit, bodyType, loadBody, includeHeaders },
        options
      );
    },

    /**
     * Iterate over all pages of messages automatically.
     * @example
     * for await (const page of client.email.messages.iterate({ q: 'is:unread' })) {
     *   console.log(page.records);
     * }
     */
    iterate: (
      params: ListEmailMessagesParams = {},
      options?: RequestOptions
    ) => {
      const { pageToken: _pt, limit, ...rest } = params;
      return paginate<EmailMessage>(
        this.http,
        "/email/messages",
        rest as Record<string, string | number | boolean | undefined>,
        defined({ ...options, limit })
      );
    },

    /**
     * Collect ALL messages matching query into a flat array.
     * Use with care on large mailboxes — prefer iterate() instead.
     */
    listAll: (
      params: ListEmailMessagesParams = {},
      options?: RequestOptions
    ): Promise<EmailMessage[]> => {
      const { limit, ...rest } = params;
      return collectAll<EmailMessage>(
        this.http,
        "/email/messages",
        rest as Record<string, string | number | boolean | undefined>,
        defined({ ...options, limit })
      );
    },

    /**
     * Get a single email message by ID.
     */
    get: (
      id: string,
      params: GetEmailMessageParams = {},
      options?: RequestOptions
    ): Promise<EmailMessage> =>
      this.http.get<EmailMessage>(
        `/email/messages/${encodeURIComponent(id)}`,
        params as Record<string, string | number | boolean | undefined>,
        options
      ),

    /**
     * Send a new email message.
     */
    send: (
      params: SendEmailParams,
      options?: RequestOptions
    ): Promise<EmailMessage> => {
      const { bodyType = "html", ...body } = params;
      return this.http.post<EmailMessage>(
        "/email/messages",
        body,
        { bodyType },
        options
      );
    },

    /**
     * Update message properties (read status, flagged, labels).
     */
    update: (
      id: string,
      updates: Partial<Pick<EmailMessage, "unread" | "flagged" | "labels">>,
      options?: RequestOptions
    ): Promise<EmailMessage> =>
      this.http.patch<EmailMessage>(
        `/email/messages/${encodeURIComponent(id)}`,
        updates,
        undefined,
        options
      ),
  };

  // ─── Attachments ───────────────────────────────────────────────────────────

  readonly attachments = {
    /**
     * Download an email attachment as a binary buffer.
     */
    download: async (
      messageId: string,
      attachmentId: string,
      options?: RequestOptions
    ): Promise<AttachmentDownloadResult> => {
      const data = await this.http.getBuffer(
        `/email/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
        undefined,
        options
      );
      return {
        data,
        mimeType: "application/octet-stream",
        name: attachmentId,
        size: data.byteLength,
      };
    },
  };

  // ─── Drafts ────────────────────────────────────────────────────────────────

  readonly drafts = {
    /**
     * List all drafts.
     */
    list: (options?: RequestOptions): Promise<PagedResponse<EmailDraft>> =>
      this.http.get<PagedResponse<EmailDraft>>("/email/drafts", undefined, options),

    /**
     * Get a single draft by ID.
     */
    get: (id: string, options?: RequestOptions): Promise<EmailDraft> =>
      this.http.get<EmailDraft>(
        `/email/drafts/${encodeURIComponent(id)}`,
        undefined,
        options
      ),

    /**
     * Create a new draft.
     */
    create: (
      params: CreateDraftParams,
      options?: RequestOptions
    ): Promise<EmailDraft> => {
      const { bodyType = "html", ...body } = params;
      return this.http.post<EmailDraft>(
        "/email/drafts",
        body,
        { bodyType },
        options
      );
    },

    /**
     * Update an existing draft.
     */
    update: (
      id: string,
      params: Partial<CreateDraftParams>,
      options?: RequestOptions
    ): Promise<EmailDraft> =>
      this.http.patch<EmailDraft>(
        `/email/drafts/${encodeURIComponent(id)}`,
        params,
        undefined,
        options
      ),

    /**
     * Delete a draft.
     */
    delete: (id: string, options?: RequestOptions): Promise<null> =>
      this.http.delete<null>(
        `/email/drafts/${encodeURIComponent(id)}`,
        undefined,
        options
      ),

    /**
     * Send an existing draft.
     */
    send: (id: string, options?: RequestOptions): Promise<EmailMessage> =>
      this.http.post<EmailMessage>(
        `/email/drafts/${encodeURIComponent(id)}/send`,
        undefined,
        undefined,
        options
      ),
  };

  // ─── Tracking ──────────────────────────────────────────────────────────────

  readonly tracking = {
    /**
     * List email tracking records.
     */
    list: (
      params: { pageToken?: string; limit?: number } = {},
      options?: RequestOptions
    ): Promise<PagedResponse<EmailTracking>> =>
      this.http.get<PagedResponse<EmailTracking>>(
        "/email/tracking",
        params as Record<string, string | number | boolean | undefined>,
        options
      ),

    /**
     * Get a single tracking record.
     */
    get: (id: number, options?: RequestOptions): Promise<EmailTracking> =>
      this.http.get<EmailTracking>(`/email/tracking/${id}`, undefined, options),
  };

  // ─── Sync ──────────────────────────────────────────────────────────────────

  readonly sync = {
    /**
     * Initialize a new email sync session.
     * Returns syncUpdatedToken and syncDeletedToken once ready === true.
     *
     * @example
     * const { syncUpdatedToken, syncDeletedToken } = await client.email.sync.start({ daysWithin: 30 });
     */
    start: (
      params: EmailSyncStartParams = {},
      options?: RequestOptions
    ): Promise<SyncStartResponse> =>
      this.http.post<SyncStartResponse>(
        "/email/sync",
        undefined,
        params as Record<string, string | number | boolean | undefined>,
        options
      ),

    /**
     * Fetch updated messages since last sync using deltaToken.
     * Automatically follows pageTokens and returns the next deltaToken.
     *
     * @example
     * const { items, nextDeltaToken } = await client.email.sync.updated(token);
     */
    updated: (
      deltaToken: string,
      params: { limit?: number } = {},
      options?: RequestOptions
    ) =>
      consumeDeltaSync<EmailMessage>(
        this.http,
        "/email/sync/updated",
        deltaToken,
        params as Record<string, string | number | boolean | undefined>,
        options
      ),

    /**
     * Fetch deleted message IDs since last sync using deltaToken.
     */
    deleted: (
      deltaToken: string,
      params: { limit?: number } = {},
      options?: RequestOptions
    ) =>
      consumeDeltaSync<{ id: string }>(
        this.http,
        "/email/sync/deleted",
        deltaToken,
        params as Record<string, string | number | boolean | undefined>,
        options
      ),
  };
}
