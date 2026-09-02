import { z } from 'zod';

export enum ApplicationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  WAITLISTED = 'WAITLISTED',
  REVOKED = 'REVOKED'
}

export enum MembershipState {
  APPLIED = 'APPLIED',
  APPROVED = 'APPROVED',
  INVITED_ELIGIBLE = 'INVITED / ELIGIBLE',
  JOINED_UNVERIFIED = 'JOINED_UNVERIFIED',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  ONBOARDING = 'ONBOARDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  TERMINATED = 'TERMINATED',
  LEFT = 'LEFT',
  REJOIN_PENDING = 'REJOIN_PENDING'
}

export enum OnboardingStep {
  EMAIL_REQUIRED = 'EMAIL_REQUIRED',
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',
  RESUME_REQUIRED = 'RESUME_REQUIRED',
  RESUME_UPLOADED = 'RESUME_UPLOADED',
  NAME_REQUIRED = 'NAME_REQUIRED',
  TIMEZONE_REQUIRED = 'TIMEZONE_REQUIRED',
  RULES_REQUIRED = 'RULES_REQUIRED',
  SAFETY_REQUIRED = 'SAFETY_REQUIRED',
  JEMP_CONFIRMATION = 'JEMP_CONFIRMATION',
  ACTIVATION_PENDING = 'ACTIVATION_PENDING',
  COMPLETED = 'COMPLETED'
}

export enum ResumeStatus {
  CURRENT = 'CURRENT',
  ARCHIVED = 'ARCHIVED',
  REMOVED = 'REMOVED'
}

export enum StorageProvider {
  DATABASE = 'database',
  LOCAL = 'local'
}

export interface PermIdConfig {
  prefix: string; // e.g. "JEMP", "JOBLESS", "EMPIRE"
  digitCount: number; // 3, 4, or 5 digits (default 3)
  currentSequence: number; // next number to allocate
  isConfigured: boolean; // whether admin has customized/confirmed the one-time setup
}

export interface Application {
  id: string; // e.g. APP#0042
  applicantName: string;
  email: string;
  emailNormalizedHash: string;
  status: ApplicationStatus;
  notes?: string;
  expirationDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  id: string; // UUID
  jempId?: string; // e.g. JEMP#001
  discordUserId?: string;
  applicationId: string;
  name: string;
  emailNormalizedHash: string;
  timezone?: string;
  membershipStatus: MembershipState;
  currentResumeId?: string;
  rulesVersionAccepted?: string;
  rulesAcceptedAt?: string;
  safetyAcknowledgedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingSession {
  id: string;
  discordUserId: string;
  applicationId?: string;
  memberId?: string;
  currentStep: OnboardingStep;
  stagedName?: string;
  stagedTimezone?: string;
  rulesAccepted: boolean;
  safetyAcknowledged: boolean;
  attemptsCount: number;
  lastAttemptAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeFile {
  id: string; // UUID
  memberId: string;
  applicationId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  sha256Hash: string;
  storageProvider: StorageProvider;
  storageKey: string;
  version: number;
  status: ResumeStatus;
  dataBase64?: string; // Stored directly in local DB row (no object storage required)
  uploadedAt: string;
  removedAt?: string;
}

export interface TimelineEvent {
  id: string;
  source: string; // 'onboarding'
  sourceEventId: string; // idempotency key: onboarding:{member_id}:{event_name}
  eventType: string; // e.g. 'MEMBERSHIP_ACTIVATED'
  memberId?: string;
  jempId?: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface OutboxEvent {
  id: string;
  eventType: string; // e.g. 'member.activated'
  aggregateType: 'member' | 'application' | 'resume';
  aggregateId: string;
  payload: Record<string, any>;
  status: 'PENDING' | 'DISPATCHED' | 'FAILED';
  retryCount: number;
  createdAt: string;
  dispatchedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  target: string;
  action: string;
  source: string;
  relevantIds: Record<string, any>;
  safeMetadata: Record<string, any>;
  timestamp: string;
}

export interface RateLimitRecord {
  key: string; // identifier e.g. emailHash or discordId
  attempts: number;
  windowStart: number;
  lockedUntil?: number;
}

export const VerifyEmailInputSchema = z.object({
  email: z.string().email('Invalid email address format').min(5).max(255)
});

export const AddApplicantSchema = z.object({
  applicationId: z.string().min(2),
  applicantName: z.string().min(2),
  email: z.string().email(),
  expiration: z.string().optional(),
  notes: z.string().optional()
});

export const AllowedMimeTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export const AllowedExtensions = ['.pdf', '.doc', '.docx'];
