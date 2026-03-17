/**
 * Pagination utilities — async iterators for all paged + sync endpoints
 */

import type { PagedResponse } from "../types/index";
import type { HttpClient } from "../http/client";
import type { RequestOptions } from "../config";

export interface PaginateOptions extends RequestOptions {
  limit?: number;
}

/**
 * Generic async iterator over paged API responses.
 * Follows nextPageToken automatically until exhausted.
 *
 * @example
 * for await (const page of paginate(http, '/email/messages', { q: 'from:user' })) {
 *   process(page.records);
 * }
 */
export async function* paginate<T>(
  http: HttpClient,
  path: string,
  query: Record<string, string | number | boolean | undefined> = {},
  options?: PaginateOptions
): AsyncGenerator<PagedResponse<T>> {
  let pageToken: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await http.get<PagedResponse<T>>(
      path,
      { ...query, pageToken, limit: options?.limit },
      options
    );

    yield response;

    if (response.nextPageToken) {
      pageToken = response.nextPageToken;
    } else {
      hasMore = false;
    }
  }
}

/**
 * Collect all items from a paged endpoint into a flat array.
 *
 * @example
 * const allMessages = await collectAll(http, '/email/messages', { q: 'from:user' });
 */
export async function collectAll<T>(
  http: HttpClient,
  path: string,
  query: Record<string, string | number | boolean | undefined> = {},
  options?: PaginateOptions
): Promise<T[]> {
  const results: T[] = [];
  for await (const page of paginate<T>(http, path, query, options)) {
    results.push(...page.records);
  }
  return results;
}

/**
 * Async iterator for delta-sync pages.
 * Follows both nextPageToken AND stops at nextDeltaToken.
 * Returns the final deltaToken when all pages are consumed.
 *
 * @example
 * const { items, nextDeltaToken } = await consumeDeltaSync(http, '/email/sync/updated', deltaToken);
 */
export async function consumeDeltaSync<T>(
  http: HttpClient,
  path: string,
  deltaToken: string,
  query: Record<string, string | number | boolean | undefined> = {},
  options?: PaginateOptions
): Promise<{ items: T[]; nextDeltaToken: string }> {
  const items: T[] = [];
  let nextDeltaToken: string | undefined;
  let pageToken: string | undefined;
  let isFirstPage = true;

  while (true) {
    const queryParams = isFirstPage
      ? { ...query, deltaToken, limit: options?.limit }
      : { ...query, pageToken, limit: options?.limit };

    const response = await http.get<PagedResponse<T>>(path, queryParams, options);

    items.push(...(response.records ?? []));

    if (response.nextDeltaToken) {
      nextDeltaToken = response.nextDeltaToken;
      break;
    }

    if (response.nextPageToken) {
      pageToken = response.nextPageToken;
      isFirstPage = false;
    } else {
      // Should not happen, but prevent infinite loop
      break;
    }
  }

  if (!nextDeltaToken) {
    throw new Error("Delta sync completed without receiving a nextDeltaToken.");
  }

  return { items, nextDeltaToken };
}
