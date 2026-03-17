/**
 * Booking & Group Booking API Resources
 */

import type { HttpClient } from "../http/client";
import type { RequestOptions } from "../config";
import type {
  BookingProfile,
  CreateBookingProfileParams,
  UpdateBookingProfileParams,
  AvailabilityResponse,
  BookMeetingParams,
  BookMeetingResult,
  GroupBookingProfile,
  GroupAvailabilityResponse,
  BookGroupMeetingParams,
  AttachAccountsParams,
  AttachGroupsParams,
  GroupRequired,
  PagedResponse,
  DayOfWeek,
  DaySchedule,
  WorkHours,
  WorkHoursInput,
  WorkingInterval,
} from "../types/index";

// ─── Single Calendar Booking ──────────────────────────────────────────────────

export class BookingResource {
  constructor(private readonly http: HttpClient) {}

  // ─── Profiles ──────────────────────────────────────────────────────────────

  /**
   * List all booking profiles for the authenticated account.
   */
  listProfiles(
    params: { pageToken?: string; limit?: number } = {},
    options?: RequestOptions
  ): Promise<PagedResponse<BookingProfile>> {
    return this.http.get<PagedResponse<BookingProfile>>(
      "/book/account/profiles",
      params as Record<string, string | number | boolean | undefined>,
      { ...options, useAppAuth: false }
    );
  }

  /**
   * Get a single booking profile by ID.
   */
  getProfile(id: number, options?: RequestOptions): Promise<BookingProfile> {
    return this.http.get<BookingProfile>(`/book/account/profiles/${id}`, undefined, options);
  }

  /**
   * Create a new booking profile.
   * Requires account-level Bearer token.
   *
   * @example
   * const profile = await client.booking.createProfile({
   *   name: 'Demo Call',
   *   durationMinutes: 30,
   *   availabilityStep: 15,
   *   subject: 'Aurinko Demo',
   *   workHours: {
   *     timezone: 'America/New_York',
   *     daySchedules: [
   *       { dayOfWeek: 'monday', workingIntervals: [{ start: '09:00:00', end: '17:00:00' }] },
   *     ],
   *   },
   * });
   */
  createProfile(params: CreateBookingProfileParams, options?: RequestOptions) {
    return this.http.post<BookingProfile>(
      "/book/account/profiles",
      {
        ...params,
        workHours: this.normalizeWorkHours(params.workHours),
      },
      undefined,
      options
    );
  }

  normalizeWorkHours(workHours?: WorkHours | WorkHoursInput): WorkHours | undefined {
    if (!workHours) return undefined;

    if ("daySchedules" in workHours) return workHours; // already normalized

    const daySchedules: DaySchedule[] = Object.entries(workHours).map(([day, intervals]) => ({
      dayOfWeek: day as DayOfWeek,
      workingIntervals: intervals as  WorkingInterval[]  ?? [],
    }));

    return {
      timezone: "UTC", // or make configurable
      daySchedules,
    };
  }

  /**
   * Update an existing booking profile.
   */
  updateProfile(
    id: number,
    params: UpdateBookingProfileParams,
    options?: RequestOptions
  ): Promise<BookingProfile> {
    return this.http.patch<BookingProfile>(
      `/book/account/profiles/${id}`,
      params,
      undefined,
      options
    );
  }

  /**
   * Delete a booking profile.
   */
  deleteProfile(id: number, options?: RequestOptions): Promise<null> {
    return this.http.delete<null>(`/book/account/profiles/${id}`, undefined, options);
  }

  // ─── Availability ──────────────────────────────────────────────────────────

  /**
   * Query available meeting time slots for a booking profile.
   * Requires app-level authentication (clientId + clientSecret).
   *
   * @example
   * const slots = await client.booking.getAvailability(profileId, { useAppAuth: true });
   * console.log(slots.items); // Array of { start, end } slots
   */
  getAvailability(profileId: number, options?: RequestOptions): Promise<AvailabilityResponse> {
    return this.http.get<AvailabilityResponse>(
      `/book/account/profiles/${profileId}/meeting`,
      undefined,
      { ...options, useAppAuth: true }
    );
  }

  // ─── Scheduling ────────────────────────────────────────────────────────────

  /**
   * Book a meeting using a booking profile.
   * Creates a calendar event and invites the specified person.
   *
   * @example
   * await client.booking.book(profileId, {
   *   time: { start: '2024-03-01T14:00:00Z', end: '2024-03-01T14:30:00Z' },
   *   name: 'Jane Doe',
   *   email: 'jane@example.com',
   *   substitutionData: { comments: 'Looking forward to it!' },
   * });
   */
  book(
    profileId: number,
    params: BookMeetingParams,
    options?: RequestOptions
  ): Promise<BookMeetingResult> {
    return this.http.post<BookMeetingResult>(
      `/book/account/profiles/${profileId}/meeting`,
      params,
      undefined,
      options
    );
  }
}

// ─── Group Booking ────────────────────────────────────────────────────────────

export class GroupBookingResource {
  constructor(private readonly http: HttpClient) {}

  // ─── Profiles ──────────────────────────────────────────────────────────────

  /**
   * List all group booking profiles.
   * Requires app-level authentication.
   */
  listProfiles(
    params: { pageToken?: string; limit?: number } = {},
    options?: RequestOptions
  ): Promise<PagedResponse<GroupBookingProfile>> {
    return this.http.get<PagedResponse<GroupBookingProfile>>(
      "/book/group/profiles",
      params as Record<string, string | number | boolean | undefined>,
      { ...options, useAppAuth: true }
    );
  }

  /**
   * Get a single group booking profile by ID.
   */
  getProfile(id: number, options?: RequestOptions): Promise<GroupBookingProfile> {
    return this.http.get<GroupBookingProfile>(`/book/group/profiles/${id}`, undefined, {
      ...options,
      useAppAuth: true,
    });
  }

  /**
   * Create a new group booking profile.
   * Requires app-level authentication (clientId + clientSecret).
   *
   * @example
   * const profile = await client.groupBooking.createProfile({
   *   name: 'Sales Team Call',
   *   durationMinutes: 45,
   *   subject: 'Sales Demo',
   *   workHours: { ... },
   * });
   */
  createProfile(
    params: CreateBookingProfileParams,
    options?: RequestOptions
  ): Promise<GroupBookingProfile> {
    return this.http.post<GroupBookingProfile>("/book/group/profiles", params, undefined, {
      ...options,
      useAppAuth: true,
    });
  }

  /**
   * Update an existing group booking profile.
   */
  updateProfile(
    id: number,
    params: UpdateBookingProfileParams,
    options?: RequestOptions
  ): Promise<GroupBookingProfile> {
    return this.http.patch<GroupBookingProfile>(`/book/group/profiles/${id}`, params, undefined, {
      ...options,
      useAppAuth: true,
    });
  }

  /**
   * Delete a group booking profile.
   */
  deleteProfile(id: number, options?: RequestOptions): Promise<null> {
    return this.http.delete<null>(`/book/group/profiles/${id}`, undefined, {
      ...options,
      useAppAuth: true,
    });
  }

  // ─── Account & Group Attachment ────────────────────────────────────────────

  /**
   * Attach specific accounts to a group booking profile.
   *
   * @example
   * await client.groupBooking.attachAccounts(profileId, { accountIds: [101, 102, 103] });
   */
  attachAccounts(
    profileId: number,
    params: AttachAccountsParams,
    options?: RequestOptions
  ): Promise<unknown> {
    return this.http.post<unknown>(
      `/book/group/profiles/${profileId}/attachAccounts`,
      params,
      undefined,
      { ...options, useAppAuth: true }
    );
  }

  /**
   * Attach groups of accounts to a booking profile with availability requirements.
   *
   * @example
   * await client.groupBooking.attachGroups(profileId, {
   *   groups: [
   *     { extId: 'team-east', accountIds: [101, 102], required: 'one' },
   *     { extId: 'team-west', accountIds: [103, 104], required: 'all' },
   *   ],
   * });
   */
  attachGroups(
    profileId: number,
    params: AttachGroupsParams,
    options?: RequestOptions
  ): Promise<unknown> {
    return this.http.post<unknown>(
      `/book/group/profiles/${profileId}/attachGroups`,
      params,
      undefined,
      { ...options, useAppAuth: true }
    );
  }

  // ─── Availability ──────────────────────────────────────────────────────────

  /**
   * Query group availability for a booking profile.
   *
   * @param required - "one" = at least one member available, "all" = all members available
   * @param offset - For large groups (>10 users), paginate with this offset
   *
   * @example
   * const slots = await client.groupBooking.getAvailability(profileId, 'one');
   */
  getAvailability(
    profileId: number,
    required: GroupRequired = "one",
    params: { offset?: number } = {},
    options?: RequestOptions
  ): Promise<GroupAvailabilityResponse> {
    return this.http.get<GroupAvailabilityResponse>(
      `/book/group/profiles/${profileId}/meeting`,
      { required, ...params } as Record<string, string | number | boolean | undefined>,
      { ...options, useAppAuth: true }
    );
  }

  // ─── Scheduling ────────────────────────────────────────────────────────────

  /**
   * Book a group meeting. Specify groupXids and/or accountIds from the availability response.
   *
   * @example
   * await client.groupBooking.book(profileId, 'one', {
   *   time: { start: '2024-03-01T14:00:00Z', end: '2024-03-01T14:45:00Z' },
   *   groupXids: ['team-east'],
   *   accountIds: [101],
   *   name: 'Jane Doe',
   *   email: 'jane@example.com',
   * });
   */
  book(
    profileId: number,
    required: GroupRequired = "one",
    params: BookGroupMeetingParams,
    options?: RequestOptions
  ): Promise<BookMeetingResult> {
    return this.http.post<BookMeetingResult>(
      `/book/group/profiles/${profileId}/meeting`,
      params,
      { required },
      options
    );
  }
}
