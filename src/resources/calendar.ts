/**
 * Calendar API Resource
 */

import type { HttpClient } from "../http/client";
import type { RequestOptions } from "../config";
import type {
  Calendar,
  CalendarEvent,
  CalendarSyncStartParams,
  CreateEventParams,
  FreeBusyResponse,
  ListEventsParams,
  PagedResponse,
  SyncStartResponse,
  UpdateEventParams,
} from "../types/index";
import { paginate, collectAll, consumeDeltaSync } from "../utils/pagination";
import { defined } from "../utils/defined";

export class CalendarResource {
  constructor(private readonly http: HttpClient) {}

  // ─── Calendars ─────────────────────────────────────────────────────────────

  /**
   * List all calendars accessible to the authenticated account.
   */
  list(options?: RequestOptions): Promise<PagedResponse<Calendar>> {
    return this.http.get<PagedResponse<Calendar>>("/calendars", undefined, options);
  }

  /**
   * Get a single calendar. Use "primary" as the ID for the primary calendar.
   */
  get(calendarId: string, options?: RequestOptions): Promise<Calendar> {
    return this.http.get<Calendar>(
      `/calendars/${encodeURIComponent(calendarId)}`,
      undefined,
      options
    );
  }

  /**
   * Get the primary calendar shortcut.
   */
  getPrimary(options?: RequestOptions): Promise<Calendar> {
    return this.get("primary", options);
  }

  // ─── Events ────────────────────────────────────────────────────────────────

  /**
   * Access event operations for a specific calendar.
   *
   * @example
   * const events = client.calendar.forCalendar('primary');
   * await events.list({ timeMin: '2024-01-01T00:00:00Z' });
   */
  forCalendar(calendarId: string) {
    const encodedId = encodeURIComponent(calendarId);
    const http = this.http;

    return {
      /**
       * List events in this calendar.
       */
      list: (
        params: ListEventsParams = {},
        options?: RequestOptions
      ): Promise<PagedResponse<CalendarEvent>> => {
        const { pageToken, limit, ...rest } = params;
        return http.get<PagedResponse<CalendarEvent>>(
          `/calendars/${encodedId}/events`,
          { ...rest, pageToken, limit } as Record<string, string | number | boolean | undefined>,
          options
        );
      },

      /**
       * List events in a time range.
       */
      listRange: (
        timeMin: string,
        timeMax: string,
        params: Omit<ListEventsParams, "timeMin" | "timeMax"> = {},
        options?: RequestOptions
      ): Promise<PagedResponse<CalendarEvent>> => {
        const { pageToken, limit, ...rest } = params;
        return http.get<PagedResponse<CalendarEvent>>(
          `/calendars/${encodedId}/events/range`,
          { timeMin, timeMax, ...rest, pageToken, limit } as Record<
            string,
            string | number | boolean | undefined
          >,
          options
        );
      },

      /**
       * Iterate over all event pages automatically.
       */
      iterate: (
        params: ListEventsParams = {},
        options?: RequestOptions
      ) => {
        const { limit, pageToken: _pt, ...rest } = params;
        return paginate<CalendarEvent>(
          http,
          `/calendars/${encodedId}/events`,
          rest as Record<string, string | number | boolean | undefined>,
          defined({ ...options, limit })
        );
      },

      /**
       * Collect ALL events into a flat array.
       */
      listAll: (
        params: ListEventsParams = {},
        options?: RequestOptions
      ): Promise<CalendarEvent[]> => {
        const { limit, pageToken: _pt, ...rest } = params;
        return collectAll<CalendarEvent>(
          http,
          `/calendars/${encodedId}/events`,
          rest as Record<string, string | number | boolean | undefined>,
          defined({ ...options, limit })
        );
      },

      /**
       * Get a single event by ID.
       */
      get: (
        eventId: string,
        params: { bodyType?: "html" | "text" } = {},
        options?: RequestOptions
      ): Promise<CalendarEvent> =>
        http.get<CalendarEvent>(
          `/calendars/${encodedId}/events/${encodeURIComponent(eventId)}`,
          params as Record<string, string | number | boolean | undefined>,
          options
        ),

      /**
       * Create a new event.
       */
      create: (
        params: CreateEventParams,
        query: { notifyAttendees?: boolean; bodyType?: "html" | "text"; returnRecord?: boolean } = {},
        options?: RequestOptions
      ): Promise<CalendarEvent> =>
        http.post<CalendarEvent>(
          `/calendars/${encodedId}/events`,
          params,
          query as Record<string, string | number | boolean | undefined>,
          options
        ),

      /**
       * Update an existing event.
       */
      update: (
        eventId: string,
        params: UpdateEventParams,
        query: { notifyAttendees?: boolean; bodyType?: "html" | "text" } = {},
        options?: RequestOptions
      ): Promise<CalendarEvent> =>
        http.patch<CalendarEvent>(
          `/calendars/${encodedId}/events/${encodeURIComponent(eventId)}`,
          params,
          query as Record<string, string | number | boolean | undefined>,
          options
        ),

      /**
       * Delete an event.
       */
      delete: (
        eventId: string,
        query: { notifyAttendees?: boolean } = {},
        options?: RequestOptions
      ): Promise<null> =>
        http.delete<null>(
          `/calendars/${encodedId}/events/${encodeURIComponent(eventId)}`,
          query as Record<string, string | number | boolean | undefined>,
          options
        ),

      // ─── Free/Busy ──────────────────────────────────────────────────────

      /**
       * Get free/busy intervals for a time range.
       */
      freeBusy: (
        timeMin: string,
        timeMax: string,
        options?: RequestOptions
      ): Promise<FreeBusyResponse> =>
        http.get<FreeBusyResponse>(
          `/calendars/${encodedId}/freeBusy`,
          { timeMin, timeMax },
          options
        ),

      // ─── Sync ───────────────────────────────────────────────────────────

      /**
       * Start a new calendar sync session for this calendar.
       *
       * @example
       * const { syncUpdatedToken } = await events.sync.start({ timeMin: '2024-01-01T00:00:00Z' });
       */
      sync: {
        start: (
          params: CalendarSyncStartParams = {},
          options?: RequestOptions
        ): Promise<SyncStartResponse> =>
          http.post<SyncStartResponse>(
            `/calendars/${encodedId}/sync`,
            undefined,
            params as Record<string, string | number | boolean | undefined>,
            options
          ),

        updated: (
          deltaToken: string,
          params: { limit?: number } = {},
          options?: RequestOptions
        ) =>
          consumeDeltaSync<CalendarEvent>(
            http,
            `/calendars/${encodedId}/sync/updated`,
            deltaToken,
            params as Record<string, string | number | boolean | undefined>,
            options
          ),

        deleted: (
          deltaToken: string,
          params: { limit?: number } = {},
          options?: RequestOptions
        ) =>
          consumeDeltaSync<{ id: string }>(
            http,
            `/calendars/${encodedId}/sync/deleted`,
            deltaToken,
            params as Record<string, string | number | boolean | undefined>,
            options
          ),
      },
    };
  }

  /**
   * Convenience: access operations for the primary calendar.
   */
  get primary() {
    return this.forCalendar("primary");
  }
}
