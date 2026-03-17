/**
 * Contacts API Types
 */
import type { PagedResponse } from "./common";

export type AddressType = "home" | "work" | "other";
export type PhoneType = "home" | "work" | "mobile" | "fax" | "other";
export type EmailType = "home" | "work" | "other";
export type UrlType = "home" | "work" | "blog" | "other";

export interface ContactName {
  givenName?: string;
  middleName?: string;
  familyName?: string;
  nickname?: string;
  displayName?: string;
}

export interface ContactCompany {
  companyName?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
}

export interface ContactEmailAddress {
  address: string;
  type?: EmailType;
}

export interface ContactPhoneNumber {
  number: string;
  type?: PhoneType;
}

export interface ContactAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  type?: AddressType;
}

export interface ContactUrl {
  value: string;
  type?: UrlType;
}

export interface Contact {
  id: string;
  name?: ContactName;
  company?: ContactCompany;
  emailAddresses?: ContactEmailAddress[];
  phoneNumbers?: ContactPhoneNumber[];
  addresses?: ContactAddress[];
  urls?: ContactUrl[];
  notes?: string;
  birthday?: string;
  keywords?: string[];
  photo?: string;
  etag?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateContactParams {
  name?: ContactName;
  company?: ContactCompany;
  emailAddresses?: ContactEmailAddress[];
  phoneNumbers?: ContactPhoneNumber[];
  addresses?: ContactAddress[];
  urls?: ContactUrl[];
  notes?: string;
  birthday?: string;
  keywords?: string[];
}

export interface UpdateContactParams extends Partial<CreateContactParams> {}

export interface ListContactsParams {
  q?: string;
  pageToken?: string;
  limit?: number;
}

export interface ContactSyncStartParams {
  awaitReady?: boolean;
}

export type ContactSyncResponse = PagedResponse<Contact>;
