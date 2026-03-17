/**
 * Calendar API Types
 */
import type { DateTimeWithTimezone, EmailAddress, PagedResponse } from "./common";

// ─── Calendar ─────────────────────────────────────────────────────────────────

export interface Calendar {
  id: string;
  name: string;
  description?: string;
  timeZone?: string;
  isPrimary: boolean;
  isReadOnly: boolean;
  color?: string;
  canEdit: boolean;
  canShare: boolean;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export type AttendeeType = "required" | "optional" | "resource";
export type AttendeeStatus = "accepted" | "declined" | "tentative" | "none" | "notResponded";
export type EventStatus = "confirmed" | "tentative" | "cancelled";
export type EventVisibility = "default" | "public" | "private" | "confidential";
export type OnlineMeetingProvider = "teamsForBusiness" | "skypeForBusiness" | "skypeForConsumer" | "googleMeet" | "unknown";

export interface Attendee {
  emailAddress: EmailAddress;
  type?: AttendeeType;
  status?: AttendeeStatus;
  isOrganizer?: boolean;
}

export interface OnlineMeeting {
  joinUrl?: string;
  conferenceId?: string;
  provider?: OnlineMeetingProvider;
}

export interface RecurrencePattern {
  type: "daily" | "weekly" | "absoluteMonthly" | "relativeMonthly" | "absoluteYearly" | "relativeYearly";
  interval: number;
  daysOfWeek?: string[];
  dayOfMonth?: number;
  month?: number;
}

export interface RecurrenceRange {
  type: "endDate" | "noEnd" | "numbered";
  startDate?: string;
  endDate?: string;
  numberOfOccurrences?: number;
  recurrenceTimeZone?: string;
}

export interface Recurrence {
  pattern?: RecurrencePattern;
  range?: RecurrenceRange;
}

export interface EventBody {
  contentType: "html" | "text";
  content: string;
}

export interface CalendarEvent {
  id: string;
  subject?: string;
  body?: EventBody;
  start?: DateTimeWithTimezone;
  end?: DateTimeWithTimezone;
  isAllDay?: boolean;
  location?: string;
  status?: EventStatus;
  visibility?: EventVisibility;
  isCancelled?: boolean;
  isRecurring?: boolean;
  recurrence?: Recurrence;
  seriesMasterId?: string;
  isException?: boolean;
  originalStart?: DateTimeWithTimezone;
  meetingInfo?: {
    attendees?: Attendee[];
    onlineMeeting?: OnlineMeeting;
    isOnlineMeeting?: boolean;
    responseRequested?: boolean;
    allowNewTimeProposals?: boolean;
  };
  organizer?: EmailAddress;
  createdAt?: string;
  updatedAt?: string;
  etag?: string;
  htmlLink?: string;
  iCalUId?: string;
}

// ─── Free/Busy ─────────────────────────────────────────────────────────────

export interface FreeBusyInterval {
  start: string;
  end: string;
  status: "free" | "busy" | "tentative" | "outOfOffice" | "workingElsewhere";
}

export interface FreeBusyResponse {
  timeMin: string;
  timeMax: string;
  intervals: FreeBusyInterval[];
}

export interface AvailableSlot {
  start: string;
  end: string;
}

// ─── Create / Update ──────────────────────────────────────────────────────────

export interface CreateEventParams {
  subject: string;
  body?: EventBody;
  start: DateTimeWithTimezone;
  end: DateTimeWithTimezone;
  isAllDay?: boolean;
  location?: string;
  status?: EventStatus;
  visibility?: EventVisibility;
  recurrence?: Recurrence;
  meetingInfo?: {
    attendees?: Array<{ emailAddress: EmailAddress; type?: AttendeeType }>;
    isOnlineMeeting?: boolean;
    onlineMeetingProvider?: OnlineMeetingProvider;
    responseRequested?: boolean;
  };
}

export interface UpdateEventParams extends Partial<CreateEventParams> {
  notifyAttendees?: boolean;
}

export interface ListEventsParams {
  timeMin?: string;
  timeMax?: string;
  pageToken?: string;
  limit?: number;
  bodyType?: "html" | "text";
  expandRecurring?: boolean;
  q?: string;
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export interface CalendarSyncStartParams {
  timeMin?: string;
  timeMax?: string;
  awaitReady?: boolean;
}

export type CalendarSyncResponse = PagedResponse<CalendarEvent>;

// ─── Booking Profiles (Calendar-level) ────────────────────────────────────────

export interface CalendarBookingProfile {
  id: number;
  calendarId: string;
  name: string;
  schedulerLink?: string;
}
