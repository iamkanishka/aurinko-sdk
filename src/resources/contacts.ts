/**
 * Contacts API Resource
 */

import type { HttpClient } from "../http/client";
import type { RequestOptions } from "../config";
import type {
  Contact,
  ContactSyncStartParams,
  CreateContactParams,
  ListContactsParams,
  PagedResponse,
  SyncStartResponse,
  UpdateContactParams,
} from "../types/index";
import { paginate, collectAll, consumeDeltaSync } from "../utils/pagination";
import { defined } from "../utils/defined";

export class ContactsResource {
  constructor(private readonly http: HttpClient) {}

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * List contacts with optional search query.
   */
  list(
    params: ListContactsParams = {},
    options?: RequestOptions
  ): Promise<PagedResponse<Contact>> {
    return this.http.get<PagedResponse<Contact>>(
      "/contacts",
      params as Record<string, string | number | boolean | undefined>,
      options
    );
  }

  /**
   * Iterate over all contact pages automatically.
   */
  iterate(params: ListContactsParams = {}, options?: RequestOptions) {
    const { limit, pageToken: _pt, ...rest } = params;
    return paginate<Contact>(
      this.http,
      "/contacts",
      rest as Record<string, string | number | boolean | undefined>,
      defined({ ...options, limit })
    );
  }

  /**
   * Collect ALL contacts into a flat array.
   * Use with care on large address books — prefer iterate() instead.
   */
  listAll(params: ListContactsParams = {}, options?: RequestOptions): Promise<Contact[]> {
    const { limit, pageToken: _pt, ...rest } = params;
    return collectAll<Contact>(
      this.http,
      "/contacts",
      rest as Record<string, string | number | boolean | undefined>,
      defined({ ...options, limit })
    );
  }

  /**
   * Get a single contact by ID.
   */
  get(id: string, options?: RequestOptions): Promise<Contact> {
    return this.http.get<Contact>(
      `/contacts/${encodeURIComponent(id)}`,
      undefined,
      options
    );
  }

  /**
   * Create a new contact.
   *
   * @example
   * await client.contacts.create({
   *   name: { givenName: 'Jane', familyName: 'Doe' },
   *   emailAddresses: [{ address: 'jane@example.com', type: 'work' }],
   * });
   */
  create(params: CreateContactParams, options?: RequestOptions): Promise<Contact> {
    return this.http.post<Contact>("/contacts", params, undefined, options);
  }

  /**
   * Update an existing contact.
   * Requires the ETag value received when the contact was last loaded.
   *
   * @example
   * await client.contacts.update('contact-id', 'etag-value', { notes: 'VIP customer' });
   */
  update(
    id: string,
    etag: string,
    params: UpdateContactParams,
    options?: RequestOptions
  ): Promise<Contact> {
    return this.http.patch<Contact>(
      `/contacts/${encodeURIComponent(id)}`,
      params,
      undefined,
      { ...options, headers: { "If-Match": etag, ...options?.headers } }
    );
  }

  /**
   * Delete a contact by ID.
   */
  delete(id: string, options?: RequestOptions): Promise<null> {
    return this.http.delete<null>(
      `/contacts/${encodeURIComponent(id)}`,
      undefined,
      options
    );
  }

  // ─── Sync ──────────────────────────────────────────────────────────────────

  readonly sync = {
    /**
     * Initialize a new contacts sync session.
     *
     * @example
     * const { syncUpdatedToken, syncDeletedToken } = await client.contacts.sync.start();
     */
    start: (
      params: ContactSyncStartParams = {},
      options?: RequestOptions
    ): Promise<SyncStartResponse> =>
      this.http.post<SyncStartResponse>(
        "/contacts/sync",
        undefined,
        params as Record<string, string | number | boolean | undefined>,
        options
      ),

    /**
     * Fetch updated contacts since last sync.
     */
    updated: (
      deltaToken: string,
      params: { limit?: number } = {},
      options?: RequestOptions
    ) =>
      consumeDeltaSync<Contact>(
        this.http,
        "/contacts/sync/updated",
        deltaToken,
        params as Record<string, string | number | boolean | undefined>,
        options
      ),

    /**
     * Fetch deleted contact IDs since last sync.
     */
    deleted: (
      deltaToken: string,
      params: { limit?: number } = {},
      options?: RequestOptions
    ) =>
      consumeDeltaSync<{ id: string }>(
        this.http,
        "/contacts/sync/deleted",
        deltaToken,
        params as Record<string, string | number | boolean | undefined>,
        options
      ),
  };
}
