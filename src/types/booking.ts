/**
 * Booking API Types
 */

export type DayOfWeek = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

export type WorkHoursInput = Partial<Record<DayOfWeek, WorkingInterval[]>>;

export interface WorkingInterval {
  start: string; // HH:MM:SS
  end: string;   // HH:MM:SS
}

export interface DaySchedule {
  dayOfWeek: DayOfWeek;
  workingIntervals: WorkingInterval[];
}

export interface WorkHours {
  timezone: string;
  daySchedules: DaySchedule[];
}

 

export interface BookingProfile {
  id: number;
  name: string;
  durationMinutes: number;
  availabilityStep?: number;
  timeAvailableFor?: string;
  subject?: string;
  description?: string;
  location?: string;
  workHours?: WorkHours;
  context?: string;
  startConference?: boolean;
  schedulerLink?: string;
  primaryColor?: string;
  secondaryColor?: string;
  active?: boolean;
  activeFrom?: string;
  activeTo?: string;
}

export interface CreateBookingProfileParams {
  name: string;
  durationMinutes: number;
  availabilityStep?: number;
  timeAvailableFor?: string;
  subject?: string;
  description?: string;
  location?: string;
  workHours?: WorkHours | WorkHoursInput;
  context?: string;
  startConference?: boolean;
  primaryColor?: string;
  secondaryColor?: string;
  activeFrom?: string;
  activeTo?: string;
}

export interface UpdateBookingProfileParams extends Partial<CreateBookingProfileParams> {}

export interface AdditionalField {
  name: string;
  type: "text" | "number" | "boolean";
  default?: string | number | boolean | null;
  required?: boolean;
}

export interface AvailabilitySlot {
  start: string;
  end: string;
}

export interface AvailabilityResponse {
  items: AvailabilitySlot[];
  startTime: string;
  endTime: string;
  durationMinutes: number;
  availabilityStep?: number;
  subject?: string;
  primaryColor?: string;
  secondaryColor?: string;
  additionalFields?: AdditionalField[];
}

export interface BookMeetingParams {
  time: {
    start: string;
    end: string;
  };
  name: string;
  email: string;
  substitutionData?: Record<string, string>;
}

export interface BookMeetingResult {
  eventId?: string;
  calendarId?: string;
  bookingId?: number;
  start?: string;
  end?: string;
}

// ─── Group Booking ────────────────────────────────────────────────────────────

export type GroupRequired = "one" | "all";

export interface GroupDefinition {
  extId: string;
  accountIds: number[];
  required: GroupRequired;
}

export interface GroupBookingProfile extends BookingProfile {
  accountIds?: number[];
  groups?: GroupDefinition[];
}

export interface GroupAvailabilitySlot extends AvailabilitySlot {
  groupXids?: string[];
  accountIds?: number[];
}

export interface GroupAvailabilityResponse extends Omit<AvailabilityResponse, "items"> {
  items: GroupAvailabilitySlot[];
}

export interface BookGroupMeetingParams extends BookMeetingParams {
  groupXids?: string[];
  accountIds?: number[];
}

export interface AttachAccountsParams {
  accountIds: number[];
}

export interface AttachGroupsParams {
  groups: GroupDefinition[];
}

// ─── Auth Types ───────────────────────────────────────────────────────────────

export type OAuthFlowType = "account" | "user" | "serviceAccount";

export interface OAuthInitiateParams {
  serviceType: string;
  scopes: string[];
  returnUrl: string;
  nativeAuth?: boolean;
  loginHint?: string;
  clientOrgId?: string;
  ensureScopes?: boolean;
}

export interface OAuthInitiateResult {
  authorizationUrl: string;
  state?: string;
}

export interface OAuthTokenExchangeParams {
  code: string;
  state?: string;
}

export interface OAuthTokenResult {
  accountId: number;
  accessToken: string;
  tokenType: string;
  expiresIn?: number;
  email?: string;
  name?: string;
  serviceType?: string;
}

export interface ServiceAccountParams {
  serviceType: string;
  serverUrl?: string;
  username?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
}
