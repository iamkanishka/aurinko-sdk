/**
 * Common/shared types across all Aurinko APIs
 */

// ─── Pagination ─────────────────────────────────────────────────────────────

export interface PagedResponse<T> {
  records: T[];
  nextPageToken?: string;
  nextDeltaToken?: string;
  totalSize?: number;
}

export interface PaginationParams {
  pageToken?: string;
  limit?: number;
}

// ─── Sync ───────────────────────────────────────────────────────────────────

export interface SyncStartResponse {
  syncUpdatedToken: string;
  syncDeletedToken: string;
  ready: boolean;
}

export interface SyncParams {
  deltaToken?: string;
  pageToken?: string;
  limit?: number;
}

// ─── Common Field Types ──────────────────────────────────────────────────────

export interface EmailAddress {
  address: string;
  name?: string;
}

export interface DateTimeWithTimezone {
  dateTime: string; // ISO 8601
  timezone?: string;
}

export interface DateOnly {
  date: string; // YYYY-MM-DD
}

export type DateTimeOrDate = DateTimeWithTimezone | DateOnly;

// ─── Account / User ──────────────────────────────────────────────────────────

export type ServiceType =
  | "Google"
  | "Office365"
  | "EWS"
  | "IMAP"
  | "iCloud"
  | "Zoho"
  | "Salesforce"
  | "HubSpot"
  | "SugarCRM";

export interface Account {
  id: number;
  email: string;
  name?: string;
  serviceType: ServiceType;
  active: boolean;
  createdAt: string;
}
