/**
 * Direct API Resource — pass-through to native provider APIs
 */

import type { HttpClient } from "../http/client";
import type { RequestOptions } from "../config";

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export class DirectResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Make a raw pass-through request to the underlying provider API.
   * Aurinko handles authentication transparently.
   *
   * @param method - HTTP method
   * @param providerPath - The provider-specific path (e.g. "/gmail/v1/users/me/messages")
   * @param body - Optional request body
   * @param query - Optional query parameters
   *
   * @example
   * // Gmail
   * const messages = await client.direct.request('GET', '/gmail/v1/users/me/messages', undefined, { maxResults: 10 });
   *
   * @example
   * // Microsoft Graph
   * const messages = await client.direct.request('GET', '/me/messages');
   *
   * @example
   * // Salesforce
   * const contacts = await client.direct.request('GET', '/services/data/v51.0/sobjects/Contact/describe/');
   */
  request<T = unknown>(
    method: HttpMethod,
    providerPath: string,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined>,
    options?: RequestOptions
  ): Promise<T> {
    const path = `/direct${providerPath.startsWith("/") ? providerPath : `/${providerPath}`}`;
    return this.http.request<T>({
      method,
      path,
      ...(body !== undefined && { body }),
      ...(query !== undefined && { query }),
      ...(options !== undefined && { options }),
    });
  }

  /** Shorthand for GET */
  get<T = unknown>(
    providerPath: string,
    query?: Record<string, string | number | boolean | undefined>,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>("GET", providerPath, undefined, query, options);
  }

  /** Shorthand for POST */
  post<T = unknown>(
    providerPath: string,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined>,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>("POST", providerPath, body, query, options);
  }

  /** Shorthand for PATCH */
  patch<T = unknown>(
    providerPath: string,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined>,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>("PATCH", providerPath, body, query, options);
  }

  /** Shorthand for PUT */
  put<T = unknown>(
    providerPath: string,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined>,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>("PUT", providerPath, body, query, options);
  }

  /** Shorthand for DELETE */
  delete<T = unknown>(
    providerPath: string,
    query?: Record<string, string | number | boolean | undefined>,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>("DELETE", providerPath, undefined, query, options);
  }

  // ─── Provider-specific helpers ─────────────────────────────────────────────

  /**
   * Proxy a Gmail API call.
   * @see https://developers.google.com/gmail/api/reference/rest
   *
   * @example
   * const result = await client.direct.gmail('GET', '/users/me/messages', undefined, { maxResults: 10 });
   */
  gmail<T = unknown>(
    method: HttpMethod,
    gmailPath: string,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined>,
    options?: RequestOptions
  ): Promise<T> {
    const normalizedPath = gmailPath.startsWith("/") ? gmailPath : `/${gmailPath}`;
    return this.request<T>(method, `/gmail/v1${normalizedPath}`, body, query, options);
  }

  /**
   * Proxy a Microsoft Graph API call.
   * @see https://learn.microsoft.com/en-us/graph/api/overview
   *
   * @example
   * const result = await client.direct.graph('GET', '/me/messages');
   */
  graph<T = unknown>(
    method: HttpMethod,
    graphPath: string,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined>,
    options?: RequestOptions
  ): Promise<T> {
    const normalizedPath = graphPath.startsWith("/") ? graphPath : `/${graphPath}`;
    return this.request<T>(method, normalizedPath, body, query, options);
  }

  /**
   * Proxy a Salesforce REST API call.
   * @see https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest
   *
   * @example
   * const result = await client.direct.salesforce('GET', '/sobjects/Contact/describe/');
   */
  salesforce<T = unknown>(
    method: HttpMethod,
    sfPath: string,
    body?: unknown,
    apiVersion = "v51.0",
    options?: RequestOptions
  ): Promise<T> {
    const normalizedPath = sfPath.startsWith("/") ? sfPath : `/${sfPath}`;
    return this.request<T>(
      method,
      `/services/data/${apiVersion}${normalizedPath}`,
      body,
      undefined,
      options
    );
  }
}

// ─── Auth Resource ────────────────────────────────────────────────────────────

import type {
  OAuthInitiateParams,
  OAuthInitiateResult,
  OAuthTokenExchangeParams,
  OAuthTokenResult,
  Account,
  PagedResponse,
} from "../types/index";

export class AuthResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Initiate an OAuth flow for a new account connection.
   * Returns an authorization URL to redirect the user to.
   *
   * @example
   * const { authorizationUrl } = await client.auth.initiateOAuth({
   *   serviceType: 'Google',
   *   scopes: ['Mail.Read', 'Calendars.ReadWrite'],
   *   returnUrl: 'https://myapp.com/oauth/callback',
   * });
   * // Redirect user to authorizationUrl
   */
  initiateOAuth(
    params: OAuthInitiateParams,
    options?: RequestOptions
  ): Promise<OAuthInitiateResult> {
    return this.http.get<OAuthInitiateResult>(
      "/auth/authorize",
      params as unknown as Record<string, string | number | boolean | undefined>,
      { ...options, useAppAuth: true }
    );
  }

  /**
   * Exchange an OAuth code for an Aurinko access token.
   * Call this in your OAuth callback handler.
   *
   * @example
   * const token = await client.auth.exchangeCode({ code: req.query.code as string });
   * // Store token.accessToken securely for future API calls
   */
  exchangeCode(
    params: OAuthTokenExchangeParams,
    options?: RequestOptions
  ): Promise<OAuthTokenResult> {
    return this.http.post<OAuthTokenResult>("/auth/token", params, undefined, {
      ...options,
      useAppAuth: true,
    });
  }

  /**
   * List all connected accounts for this application.
   */
  listAccounts(
    params: { pageToken?: string; limit?: number } = {},
    options?: RequestOptions
  ): Promise<PagedResponse<Account>> {
    return this.http.get<PagedResponse<Account>>(
      "/accounts",
      params as Record<string, string | number | boolean | undefined>,
      { ...options, useAppAuth: true }
    );
  }

  /**
   * Get a specific connected account by ID.
   */
  getAccount(accountId: number, options?: RequestOptions): Promise<Account> {
    return this.http.get<Account>(`/accounts/${accountId}`, undefined, {
      ...options,
      useAppAuth: true,
    });
  }

  /**
   * Revoke and delete a connected account.
   */
  deleteAccount(accountId: number, options?: RequestOptions): Promise<null> {
    return this.http.delete<null>(`/accounts/${accountId}`, undefined, {
      ...options,
      useAppAuth: true,
    });
  }
}
