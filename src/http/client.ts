/**
 * Core HTTP client — handles auth, retries, timeouts, error mapping
 */

import {
  AURINKO_BASE_URL,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY_MS,
  DEFAULT_TIMEOUT_MS,
  type AurinkoConfig,
  type RequestOptions,
} from "../config";

import {
  AuthenticationError,
  AuthorizationError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ServerError,
  TimeoutError,
  ValidationError,
} from "../errors";

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface InternalRequestParams {
  method: HttpMethod;
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  options?: RequestOptions;
  responseType?: "json" | "arraybuffer";
}

interface ApiError  {
  message?: string;
  error?: string;
};

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<unknown> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildQueryString(
  params?: Record<string, string | number | boolean | undefined>
): string {
  if (!params) return "";

  const entries = Object.entries(params).filter(([, v]) => v != null);

  if (entries.length === 0) return "";

  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");

  return `?${qs}`;
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly config: AurinkoConfig;

  constructor(config: AurinkoConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl ?? AURINKO_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelayMs = config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  }

  private buildAuthHeader(useAppAuth = false): Record<string, string> {
    if (useAppAuth) {
      if (!this.config.clientId || !this.config.clientSecret) {
        throw new AuthenticationError(
          "clientId and clientSecret are required for app authentication."
        );
      }

      const encoded = Buffer.from(
        `${this.config.clientId}:${this.config.clientSecret}`
      ).toString("base64");

      return { Authorization: `Basic ${encoded}` };
    }

    if (!this.config.accessToken) {
      throw new AuthenticationError(
        "accessToken required for account-level calls."
      );
    }

    return { Authorization: `Bearer ${this.config.accessToken}` };
  }

  private buildRequestInit(
    method: HttpMethod,
    body: unknown,
    headers: Record<string, string>,
    signal: AbortSignal
  ): RequestInit {
    const init: RequestInit = {
      method,
      headers,
      signal,
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    return init;
  }

  private async executeRequest(
    params: InternalRequestParams,
    attempt: number
  ): Promise<unknown> {
    const { method, path, body, query, options, responseType = "json" } = params;

    const url = `${this.baseUrl}${path}${buildQueryString(query)}`;

    const timeoutMs = options?.timeoutMs ?? this.timeoutMs;

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort("timeout");
    }, timeoutMs);

    if (options?.signal) {
      options.signal.addEventListener("abort", () => {
        abortController.abort(options.signal?.reason);
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Aurinko-SDK": "typescript/1.0.0",
      ...this.buildAuthHeader(options?.useAppAuth),
      ...options?.headers,
    };

    this.config.logger?.debug("Aurinko request", { method, url, attempt });

    let response: Response;

    try {
      const init = this.buildRequestInit(
        method,
        body,
        headers,
        abortController.signal
      );

      response = await fetch(url, init);
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      const message = err instanceof Error ? err.message : String(err);

      if (
        message === "timeout" ||
        (err instanceof DOMException && err.name === "AbortError")
      ) {
        throw new TimeoutError(`Request timed out after ${timeoutMs}ms`);
      }

      throw new NetworkError(`Network request failed: ${message}`, err);
    } finally {
      clearTimeout(timeoutId);
    }

    this.config.logger?.debug("Aurinko response", {
      status: response.status,
      url,
    });

    if (response.ok) {
      if (response.status === 204) return null;

      if (responseType === "arraybuffer") {
        return response.arrayBuffer();
      }

      const text = await response.text();
      return text ? JSON.parse(text) : null;
    }

    const rawBody = await response.text().catch(() => "");

    let errorMessage = `${method} ${path} failed with status ${response.status}`;

    try {
      const parsed: unknown = JSON.parse(rawBody);

      if (typeof parsed === "object" && parsed !== null) {
        const errObj = parsed as ApiError;
        errorMessage =
          errObj.message ?? errObj.error ?? errorMessage;
      }
    } catch {
      // ignore JSON parse errors
    }

    if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < this.maxRetries) {
      const retryAfterHeader = response.headers.get("retry-after");

      const retryDelay =
        (retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) * 1000 : 0) ||
        this.retryDelayMs * 2 ** (attempt - 1);

      await sleep(retryDelay);

      return this.executeRequest(params, attempt + 1);
    }

    switch (response.status) {
      case 400:
        throw new ValidationError(errorMessage, rawBody);
      case 401:
        throw new AuthenticationError(errorMessage, rawBody);
      case 403:
        throw new AuthorizationError(errorMessage, rawBody);
      case 404:
        throw new NotFoundError(errorMessage, rawBody);
      case 429:
        throw new RateLimitError(errorMessage, undefined, rawBody);
      default:
        throw new ServerError(errorMessage, response.status, rawBody);
    }
  }

  async request<T = unknown>(params: InternalRequestParams): Promise<T> {
    return this.executeRequest(params, 1) as Promise<T>;
  }

  async get<T = unknown>(
    path: string,
    query?: InternalRequestParams["query"],
    options?: RequestOptions
  ) {
    return this.request<T>({
      method: "GET",
      path,
      ...(query !== undefined && { query }),
      ...(options !== undefined && { options }),
    });
  }

  async post<T = unknown>(
    path: string,
    body?: unknown,
    query?: InternalRequestParams["query"],
    options?: RequestOptions
  ) {
    return this.request<T>({
      method: "POST",
      path,
      ...(body !== undefined && { body }),
      ...(query !== undefined && { query }),
      ...(options !== undefined && { options }),
    });
  }

  async patch<T = unknown>(
    path: string,
    body?: unknown,
    query?: InternalRequestParams["query"],
    options?: RequestOptions
  ) {
    return this.request<T>({
      method: "PATCH",
      path,
      ...(body !== undefined && { body }),
      ...(query !== undefined && { query }),
      ...(options !== undefined && { options }),
    });
  }

  async put<T = unknown>(
    path: string,
    body?: unknown,
    query?: InternalRequestParams["query"],
    options?: RequestOptions
  ) {
    return this.request<T>({
      method: "PUT",
      path,
      ...(body !== undefined && { body }),
      ...(query !== undefined && { query }),
      ...(options !== undefined && { options }),
    });
  }

  async delete<T = unknown>(
    path: string,
    query?: InternalRequestParams["query"],
    options?: RequestOptions
  ) {
    return this.request<T>({
      method: "DELETE",
      path,
      ...(query !== undefined && { query }),
      ...(options !== undefined && { options }),
    });
  }

  async getBuffer(
    path: string,
    query?: InternalRequestParams["query"],
    options?: RequestOptions
  ) {
    return this.request<ArrayBuffer>({
      method: "GET",
      path,
      responseType: "arraybuffer",
      ...(query !== undefined && { query }),
      ...(options !== undefined && { options }),
    });
  }
}