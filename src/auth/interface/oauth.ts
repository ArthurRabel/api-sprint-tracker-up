export interface MicrosoftProfile {
  id: string;
  displayName: string;
  emails: Array<{ value: string }>;
}

export interface GoogleProfile {
  id: string;
  displayName: string;
  name: { familyName: string; givenName: string };
  emails: Array<{ value: string; verified: boolean }>;
}

export interface ProviderUser {
  providerId: string;
  email: string;
  name: string;
  accessToken: string;
}
