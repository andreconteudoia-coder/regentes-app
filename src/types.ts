// Minimal type definitions for App.tsx

export interface User {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  isAnonymous?: boolean;
  tenantId?: string;
  providerData?: Array<{
    providerId: string;
    displayName?: string;
    email?: string;
    photoURL?: string;
  }>;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  content: string;
  sections?: any[];
  category?: string;
  conductorNotes?: string;
  links?: any[];
  vocalParts?: string[];
  offlineAudioName?: string | null;
  updatedAt?: number;
  userId?: string;
}

export interface Setlist {
  id: string;
  title: string;
  date?: string;
  songIds?: string[];
  updatedAt?: number;
  userId?: string;
}

export type OperationType = 'GET' | 'WRITE' | 'DELETE';

export interface FirestoreErrorInfo {
  error: string;
  authInfo: any;
  operationType: OperationType;
  path: string | null;
}
