/**
 * Aurinko SDK Configuration
 */

export const AURINKO_BASE_URL = "https://api.aurinko.io/v1" as const;
export const DEFAULT_TIMEOUT_MS = 30_000 as const;
export const DEFAULT_MAX_RETRIES = 3 as const;
export const DEFAULT_RETRY_DELAY_MS = 1_000 as const;

export type AuthType = "bearer" | "basic";

export interface AurinkoConfig {
  /**
   * Your Aurinko Client ID (required for app-level calls)
   */
  clientId?: string;

  /**
   * Your Aurinko Client Secret (required for app-level calls)
   */
  clientSecret?: string;

  /**
   * Account-level Bearer token (required for account-level calls)
   */
  accessToken?: string;

  /**
   * Override the default Aurinko API base URL
   * @default "https://api.aurinko.io/v1"
   */
  baseUrl?: string;

  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeoutMs?: number;

  /**
   * Maximum number of automatic retries on 429/5xx errors
   * @default 3
   */
  maxRetries?: number;

  /**
   * Initial retry delay in milliseconds (exponential backoff applied)
   * @default 1000
   */
  retryDelayMs?: number;

  /**
   * Webhook signing secret for payload verification
   */
  webhookSigningSecret?: string;

  /**
   * Optional logger for debugging
   */
  logger?: AurinkoLogger;
}

export interface AurinkoLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface RequestOptions {
  /**
   * Per-request timeout override
   */
  timeoutMs?: number;

  /**
   * Additional headers for this request
   */
  headers?: Record<string, string>;

  /**
   * Use app-level auth (clientId:secret) instead of bearer token
   */
  useAppAuth?: boolean;

  /**
   * Abort signal for cancellation
   */
  signal?: AbortSignal;
}
