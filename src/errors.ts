/**
 * Aurinko SDK Error Classes
 */

export type AurinkoErrorCode =
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMIT_ERROR"
  | "SERVER_ERROR"
  | "TIMEOUT_ERROR"
  | "NETWORK_ERROR"
  | "WEBHOOK_VERIFICATION_FAILED"
  | "CONFIGURATION_ERROR"
  | "UNKNOWN_ERROR";

export interface AurinkoErrorDetails {
  code: AurinkoErrorCode;
  message: string;
  statusCode?: number;
  requestId?: string;
  retryAfter?: number;
  raw?: unknown;
}

/**
 * Base class for all Aurinko SDK errors
 */
export class AurinkoError extends Error {
  public readonly code: AurinkoErrorCode;
  public readonly statusCode: number | undefined;
  public readonly requestId: string | undefined;
  public readonly retryAfter: number | undefined;
  public readonly raw: unknown;

  constructor(details: AurinkoErrorDetails) {
    super(details.message);
    this.name = "AurinkoError";
    this.code = details.code;
    this.statusCode = details.statusCode;
    this.requestId = details.requestId;
    this.retryAfter = details.retryAfter;
    this.raw = details.raw;
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): AurinkoErrorDetails & { name: string } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.statusCode !== undefined && { statusCode: this.statusCode }),
      ...(this.requestId !== undefined && { requestId: this.requestId }),
      ...(this.retryAfter !== undefined && { retryAfter: this.retryAfter }),
      ...(this.raw !== undefined && { raw: this.raw }),
    };
  }
}

export class AuthenticationError extends AurinkoError {
  constructor(message: string, raw?: unknown) {
    super({
      code: "AUTHENTICATION_ERROR",
      message,
      statusCode: 401,
      raw,
    });
    this.name = "AuthenticationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthorizationError extends AurinkoError {
  constructor(message: string, raw?: unknown) {
    super({
      code: "AUTHORIZATION_ERROR",
      message,
      statusCode: 403,
      raw,
    });
    this.name = "AuthorizationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AurinkoError {
  constructor(message: string, raw?: unknown) {
    super({
      code: "NOT_FOUND",
      message,
      statusCode: 404,
      raw,
    });
    this.name = "NotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AurinkoError {
  constructor(message: string, raw?: unknown) {
    super({
      code: "VALIDATION_ERROR",
      message,
      statusCode: 400,
      raw,
    });
    this.name = "ValidationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RateLimitError extends AurinkoError {
  constructor(message: string, retryAfter?: number, raw?: unknown) {
    super({
      code: "RATE_LIMIT_ERROR",
      message,
      statusCode: 429,
      ...(retryAfter !== undefined && { retryAfter }),
      ...(raw !== undefined && { raw }),
    });

    this.name = "RateLimitError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ServerError extends AurinkoError {
  constructor(message: string, statusCode: number, raw?: unknown) {
    super({
      code: "SERVER_ERROR",
      message,
      statusCode,
      raw,
    });
    this.name = "ServerError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TimeoutError extends AurinkoError {
  constructor(message: string) {
    super({ code: "TIMEOUT_ERROR", message });
    this.name = "TimeoutError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NetworkError extends AurinkoError {
  constructor(message: string, cause?: unknown) {
    super({ code: "NETWORK_ERROR", message, raw: cause });
    this.name = "NetworkError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class WebhookVerificationError extends AurinkoError {
  constructor(message: string) {
    super({ code: "WEBHOOK_VERIFICATION_FAILED", message });
    this.name = "WebhookVerificationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConfigurationError extends AurinkoError {
  constructor(message: string) {
    super({ code: "CONFIGURATION_ERROR", message });
    this.name = "ConfigurationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
