import crypto from 'crypto';
import {
  Application,
  ApplicationStatus,
  Member,
  MembershipState,
  OnboardingSession,
  OnboardingStep,
  ResumeFile,
  ResumeStatus,
  TimelineEvent,
  OutboxEvent,
  AuditLogEntry,
  StorageProvider
} from '../types.ts';
import { dbManager } from '../database/index.ts';
import {
  normalizeEmail,
  hashNormalizedEmail,
  checkRateLimit,
  computeSha256
} from '../security/index.ts';
import { storageService } from '../storage/index.ts';
import { getConfig } from '../config/index.ts';

// 1. VERIFY APPLICATION EMAIL
export async function verifyApplicationEmail(
  discordUserId: string,
  rawEmail: string,
  clientIp?: string
): Promise<{ success: boolean; error?: string; session?: OnboardingSession }> {
  const config = getConfig();

  // Rate Limiting check on user identifier
  const rateLimitKey = `email_verify:${discordUserId}`;
  const rateCheck = checkRateLimit(
    rateLimitKey,
    config.maxEmailVerificationAttempts,
    config.verificationWindowMinutes
  );

  if (!rateCheck.allowed) {
    await auditAction(
      'system',
      discordUserId,
      'RATE_LIMIT_EXCEEDED',
      'onboarding_bot',
      { discordUserId },
      { remainingAttempts: 0 }
    );
    return {
      success: false,
      error: 'Too many verification attempts. Please try again later.'
    };
  }

  const normalizedEmail = normalizeEmail(rawEmail);
  const emailHash = hashNormalizedEmail(normalizedEmail);

  // Database lookup in approved application registry
  const app = await dbManager.findApplicationByEmailHash(emailHash);

  // Generic failure message to prevent email and application enumeration
  const genericFailureMsg =
    "We couldn't verify that email for this server.\n\n" +
    "Make sure you're using the same email address submitted with your Jobless Empire application.\n\n" +
    "If you believe this is an error, contact an administrator through your application/acceptance email.";

  if (!app) {
    await auditAction(
      discordUserId,
      'application_registry',
      'EMAIL_VERIFICATION_FAILURE',
      'onboarding_bot',
      { discordUserId },
      { reason: 'Email not found in registry' }
    );
    return { success: false, error: genericFailureMsg };
  }

  // Check application status - ONLY APPROVED applications can onboard
  if (app.status !== ApplicationStatus.APPROVED) {
    await auditAction(
      discordUserId,
      app.id,
      'EMAIL_VERIFICATION_FAILURE',
      'onboarding_bot',
      { applicationId: app.id, status: app.status },
      { reason: `Application status is ${app.status}, not APPROVED.` }
    );
    return { success: false, error: genericFailureMsg };
  }

  // Check expiration if specified
  if (app.expirationDate && new Date(app.expirationDate).getTime() < Date.now()) {
    await auditAction(
      discordUserId,
      app.id,
      'EMAIL_VERIFICATION_FAILURE',
      'onboarding_bot',
      { applicationId: app.id },
      { reason: 'Application whitelist window expired.' }
    );
    return { success: false, error: genericFailureMsg };
  }

  // Check if application is already permanently bound to another Discord account
  const existingMember = await dbManager.findMemberByApplicationId(app.id);
  if (existingMember && existingMember.discordUserId && existingMember.discordUserId !== discordUserId) {
    await auditAction(
      discordUserId,
      app.id,
      'ACCOUNT_BINDING_CONFLICT',
      'onboarding_bot',
      {
        applicationId: app.id,
        boundDiscordUserId: existingMember.discordUserId,
        attemptingDiscordUserId: discordUserId
      },
      { warning: 'Potential account takeover attempt or duplicate bind.' }
    );
    return { success: false, error: genericFailureMsg };
  }

  // Create or retrieve member record
  let member = existingMember;
  const now = new Date().toISOString();

  if (!member) {
    member = {
      id: crypto.randomUUID(),
      applicationId: app.id,
      discordUserId,
      name: app.applicantName,
      emailNormalizedHash: emailHash,
      membershipStatus: MembershipState.EMAIL_VERIFIED,
      createdAt: now,
      updatedAt: now
    };
  } else {
    member.discordUserId = discordUserId;
    member.membershipStatus = MembershipState.EMAIL_VERIFIED;
    member.updatedAt = now;
  }
  await dbManager.saveMember(member);

  // Initialize or update onboarding session
  let session = await dbManager.getOnboardingSession(discordUserId);
  if (!session) {
    session = {
      id: crypto.randomUUID(),
      discordUserId,
      applicationId: app.id,
      memberId: member.id,
      currentStep: OnboardingStep.RESUME_REQUIRED,
      stagedName: app.applicantName,
      rulesAccepted: false,
      safetyAcknowledged: false,
      attemptsCount: 1,
      lastAttemptAt: now,
      createdAt: now,
      updatedAt: now
    };
  } else {
    session.applicationId = app.id;
    session.memberId = member.id;
    session.currentStep = OnboardingStep.RESUME_REQUIRED;
    session.stagedName = app.applicantName;
    session.lastAttemptAt = now;
    session.updatedAt = now;
  }
  await dbManager.saveOnboardingSession(session);

  // Audit Log & Timeline Event
  await auditAction(
    discordUserId,
    app.id,
    'EMAIL_VERIFICATION_SUCCESS',
    'onboarding_bot',
    { applicationId: app.id, memberId: member.id },
    { status: 'VERIFIED' }
  );

  await createOfficialTimelineEvent({
    source: 'onboarding',
    sourceEventId: `onboarding:${member.id}:email_verified`,
    eventType: 'EMAIL_VERIFIED',
    memberId: member.id,
    description: `Email verified against approved registry for application ${app.id}.`
  });

  await publishOutboxEvent('member.email_verified', 'member', member.id, {
    memberId: member.id,
    applicationId: app.id,
    discordUserId
  });

  return { success: true, session };
}

// 2. ADD APPROVED APPLICATION (ADMIN WHITELIST)
export async function addApprovedApplication(
  adminActor: string,
  params: {
    applicationId: string;
    applicantName: string;
    email: string;
    expiration?: string;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string; application?: Application }> {
  const normalizedEmail = normalizeEmail(params.email);
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return { success: false, error: 'Invalid email address provided.' };
  }

  const emailHash = hashNormalizedEmail(normalizedEmail);

  // Check if email already whitelisted
  const existing = await dbManager.findApplicationByEmailHash(emailHash);
  if (existing) {
    return {
      success: false,
      error: `An application (${existing.id}) with this email already exists with status ${existing.status}.`
    };
  }

  const now = new Date().toISOString();
  const application: Application = {
    id: params.applicationId.trim(),
    applicantName: params.applicantName.trim(),
    email: normalizedEmail,
    emailNormalizedHash: emailHash,
    status: ApplicationStatus.APPROVED,
    notes: params.notes,
    expirationDate: params.expiration,
    createdAt: now,
    updatedAt: now
  };

  await dbManager.saveApplication(application);

  await auditAction(
    adminActor,
    application.id,
    'WHITELIST_CREATED',
    'onboarding_bot',
    { applicationId: application.id },
    { applicantName: application.applicantName, notes: application.notes }
  );

  await createOfficialTimelineEvent({
    source: 'onboarding',
    sourceEventId: `onboarding:${application.id}:application_approved`,
    eventType: 'APPLICATION_APPROVED',
    description: `Application ${application.id} approved for applicant ${application.applicantName}.`
  });

  return { success: true, application };
}

// 3. REVOKE APPROVED APPLICATION
export async function revokeApprovedApplication(
  adminActor: string,
  applicationId: string,
  reason: string
): Promise<{ success: boolean; error?: string; application?: Application }> {
  const app = await dbManager.findApplicationById(applicationId);
  if (!app) {
    return { success: false, error: `Application ${applicationId} not found.` };
  }

  app.status = ApplicationStatus.REVOKED;
  app.updatedAt = new Date().toISOString();
  await dbManager.saveApplication(app);

  // If there's an ongoing onboarding session, reset or halt it
  const member = await dbManager.findMemberByApplicationId(app.id);
  if (member && member.membershipStatus !== MembershipState.ACTIVE) {
    member.membershipStatus = MembershipState.SUSPENDED;
    member.updatedAt = new Date().toISOString();
    await dbManager.saveMember(member);
  }

  await auditAction(
    adminActor,
    app.id,
    'WHITELIST_REVOKED',
    'onboarding_bot',
    { applicationId: app.id },
    { reason }
  );

  return { success: true, application: app };
}

// 4. RESTORE APPLICATION
export async function restoreApprovedApplication(
  adminActor: string,
  applicationId: string
): Promise<{ success: boolean; error?: string; application?: Application }> {
  const app = await dbManager.findApplicationById(applicationId);
  if (!app) {
    return { success: false, error: `Application ${applicationId} not found.` };
  }

  app.status = ApplicationStatus.APPROVED;
  app.updatedAt = new Date().toISOString();
  await dbManager.saveApplication(app);

  await auditAction(
    adminActor,
    app.id,
    'WHITELIST_UPDATED',
    'onboarding_bot',
    { applicationId: app.id },
    { action: 'RESTORED' }
  );

  return { success: true, application: app };
}

// 5. GET MEMBERSHIP
export async function getMembership(
  discordUserIdOrMemberId: string
): Promise<{ member: Member | null; resume: ResumeFile | null; application: Application | null }> {
  let member = await dbManager.findMemberByDiscordId(discordUserIdOrMemberId);
  if (!member) {
    member = await dbManager.findMemberById(discordUserIdOrMemberId);
  }
  if (!member && discordUserIdOrMemberId.startsWith('JEMP#')) {
    member = await dbManager.findMemberByJempId(discordUserIdOrMemberId);
  }

  if (!member) {
    return { member: null, resume: null, application: null };
  }

  const application = await dbManager.findApplicationById(member.applicationId);
  const resume = await dbManager.getCurrentResumeForMember(member.id);

  return { member, resume, application };
}

// 6. RESUME ONBOARDING SESSION
export async function resumeOnboarding(
  discordUserId: string
): Promise<{ session: OnboardingSession | null; member: Member | null }> {
  const session = await dbManager.getOnboardingSession(discordUserId);
  const member = session?.memberId ? await dbManager.findMemberById(session.memberId) : null;
  return { session, member };
}

// 7. ADD RESUME (AFTER EMAIL VERIFICATION ONLY)
export async function addResume(
  discordUserId: string,
  filename: string,
  mimeType: string,
  buffer: Buffer
): Promise<{ success: boolean; error?: string; resume?: ResumeFile }> {
  let member = await dbManager.findMemberByDiscordId(discordUserId);
  let session = await dbManager.getOnboardingSession(discordUserId);

  // CRITICAL RULE: Email verification must be completed before submitting a resume!
  if (!member || !member.emailNormalizedHash) {
    return {
      success: false,
      error: 'Unauthorized: Email verification must be completed in #verify-me before submitting a resume.'
    };
  }

  if (!session) {
    const now = new Date().toISOString();
    session = {
      id: crypto.randomUUID(),
      discordUserId,
      applicationId: member.applicationId,
      memberId: member.id,
      currentStep: OnboardingStep.RESUME_REQUIRED,
      stagedName: member.name,
      rulesAccepted: true,
      safetyAcknowledged: true,
      attemptsCount: 1,
      lastAttemptAt: now,
      createdAt: now,
      updatedAt: now
    };
    await dbManager.saveOnboardingSession(session);
  }

  // Validate File
  const validation = storageService.validateFile(filename, mimeType, buffer);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Get current resumes to increment version
  const existingResumes = await dbManager.listResumesForMember(member.id);
  const nextVersion = existingResumes.length > 0 ? Math.max(...existingResumes.map(r => r.version)) + 1 : 1;

  // Mark previous current resumes as ARCHIVED
  for (const r of existingResumes) {
    if (r.status === ResumeStatus.CURRENT) {
      r.status = ResumeStatus.ARCHIVED;
      await dbManager.saveResumeFile(r);
    }
  }

  // Store directly into local database representation
  const { storageKey, storageProvider, dataBase64 } = await storageService.storeResume(
    member.id,
    nextVersion,
    validation.sanitizedFilename,
    buffer
  );

  const now = new Date().toISOString();
  const resumeRecord: ResumeFile = {
    id: crypto.randomUUID(),
    memberId: member.id,
    applicationId: member.applicationId,
    filename: validation.sanitizedFilename,
    mimeType: validation.mimeType,
    fileSize: validation.fileSize,
    sha256Hash: validation.sha256Hash,
    storageProvider,
    storageKey,
    version: nextVersion,
    status: ResumeStatus.CURRENT,
    dataBase64,
    uploadedAt: now
  };

  await dbManager.saveResumeFile(resumeRecord);

  // Link to member
  member.currentResumeId = resumeRecord.id;
  member.updatedAt = now;
  await dbManager.saveMember(member);

  // Advance onboarding session if still in onboarding
  if (
    session.currentStep === OnboardingStep.RESUME_REQUIRED ||
    session.currentStep === OnboardingStep.EMAIL_VERIFIED
  ) {
    session.currentStep = OnboardingStep.NAME_REQUIRED;
    session.updatedAt = now;
    await dbManager.saveOnboardingSession(session);
  }

  // Audit & Timeline
  await auditAction(
    discordUserId,
    resumeRecord.id,
    'RESUME_UPLOADED',
    'onboarding_bot',
    { memberId: member.id, version: nextVersion, sha256: validation.sha256Hash },
    { filename: validation.sanitizedFilename }
  );

  await createOfficialTimelineEvent({
    source: 'onboarding',
    sourceEventId: `onboarding:${member.id}:resume_v${nextVersion}`,
    eventType: 'RESUME_ADDED',
    memberId: member.id,
    description: `Resume v${nextVersion} uploaded and verified (${validation.sanitizedFilename}).`
  });

  await publishOutboxEvent('member.resume_added', 'resume', resumeRecord.id, {
    memberId: member.id,
    version: nextVersion,
    resumeId: resumeRecord.id
  });

  return { success: true, resume: resumeRecord };
}

// 8. REMOVE CURRENT RESUME (ARCHIVES CURRENT, RETAINS HISTORICAL RECORD)
export async function removeResume(
  discordUserId: string
): Promise<{ success: boolean; error?: string; removedVersion?: number }> {
  const member = await dbManager.findMemberByDiscordId(discordUserId);
  if (!member) return { success: false, error: 'Member not found.' };

  const current = await dbManager.getCurrentResumeForMember(member.id);
  if (!current) {
    return { success: false, error: 'No active resume found to remove.' };
  }

  current.status = ResumeStatus.REMOVED;
  current.removedAt = new Date().toISOString();
  await dbManager.saveResumeFile(current);

  member.currentResumeId = undefined;
  member.updatedAt = new Date().toISOString();
  await dbManager.saveMember(member);

  await auditAction(
    discordUserId,
    current.id,
    'RESUME_REMOVED',
    'onboarding_bot',
    { memberId: member.id, version: current.version },
    { action: 'REMOVED_TO_ARCHIVE' }
  );

  return { success: true, removedVersion: current.version };
}

// 9. COMPLETE FORMAL ONBOARDING STEP
export async function completeOnboardingStep(
  discordUserId: string,
  step: OnboardingStep,
  data: {
    name?: string;
    timezone?: string;
    rulesAccepted?: boolean;
    safetyAcknowledged?: boolean;
  }
): Promise<{ success: boolean; error?: string; nextStep?: OnboardingStep; session?: OnboardingSession }> {
  const session = await dbManager.getOnboardingSession(discordUserId);
  const member = await dbManager.findMemberByDiscordId(discordUserId);

  if (!session || !member) {
    return { success: false, error: 'No active onboarding session found.' };
  }

  const now = new Date().toISOString();

  switch (step) {
    case OnboardingStep.NAME_REQUIRED:
      if (!data.name || data.name.trim().length < 2) {
        return { success: false, error: 'Name must be at least 2 characters.' };
      }
      session.stagedName = data.name.trim();
      member.name = data.name.trim();
      session.currentStep = OnboardingStep.TIMEZONE_REQUIRED;
      break;

    case OnboardingStep.TIMEZONE_REQUIRED:
      if (!data.timezone) {
        return { success: false, error: 'Please select a valid IANA timezone.' };
      }
      session.stagedTimezone = data.timezone;
      member.timezone = data.timezone;
      session.currentStep = OnboardingStep.RULES_REQUIRED;
      break;

    case OnboardingStep.RULES_REQUIRED:
      if (!data.rulesAccepted) {
        return { success: false, error: 'You must agree to the community rules to proceed.' };
      }
      session.rulesAccepted = true;
      member.rulesVersionAccepted = 'v1.0';
      member.rulesAcceptedAt = now;
      session.currentStep = OnboardingStep.SAFETY_REQUIRED;

      await createOfficialTimelineEvent({
        source: 'onboarding',
        sourceEventId: `onboarding:${member.id}:rules_accepted`,
        eventType: 'RULES_ACCEPTED',
        memberId: member.id,
        description: 'Acknowledged and agreed to Jobless Empire Community Rules v1.0.'
      });
      break;

    case OnboardingStep.SAFETY_REQUIRED:
      if (!data.safetyAcknowledged) {
        return { success: false, error: 'Safety acknowledgment is required to proceed.' };
      }
      session.safetyAcknowledged = true;
      member.safetyAcknowledgedAt = now;
      session.currentStep = OnboardingStep.JEMP_CONFIRMATION;

      await createOfficialTimelineEvent({
        source: 'onboarding',
        sourceEventId: `onboarding:${member.id}:safety_acknowledged`,
        eventType: 'SAFETY_ACKNOWLEDGED',
        memberId: member.id,
        description: 'Safety policies, non-disclosure, and truth-in-work acknowledged.'
      });
      break;

    case OnboardingStep.JEMP_CONFIRMATION:
      session.currentStep = OnboardingStep.ACTIVATION_PENDING;
      break;

    default:
      break;
  }

  session.updatedAt = now;
  member.updatedAt = now;
  await dbManager.saveOnboardingSession(session);
  await dbManager.saveMember(member);

  return { success: true, nextStep: session.currentStep, session };
}

// 10. FINAL ACTIVATION TRANSACTION
export async function activateMembership(
  discordUserId: string
): Promise<{ success: boolean; error?: string; member?: Member; jempId?: string }> {
  const member = await dbManager.findMemberByDiscordId(discordUserId);
  const session = await dbManager.getOnboardingSession(discordUserId);

  if (!member || !session) {
    return { success: false, error: 'Onboarding records missing for activation.' };
  }

  // Guard: Must have passed rules and safety
  if (!session.rulesAccepted || !session.safetyAcknowledged) {
    return {
      success: false,
      error: 'Incomplete onboarding: Rules and safety acknowledgment are required before activation.'
    };
  }

  // Guard: Must have a verified resume
  const resume = await dbManager.getCurrentResumeForMember(member.id);
  if (!resume) {
    return {
      success: false,
      error: 'Incomplete onboarding: Verified resume upload is required before activation.'
    };
  }

  // Idempotency: If already active and has JEMP#, return existing
  if (member.membershipStatus === MembershipState.ACTIVE && member.jempId) {
    return { success: true, member, jempId: member.jempId };
  }

  // JEMP# Assignment (Atomic sequence, concurrency-safe, restart-safe)
  // Check if member already had a JEMP# assigned previously (e.g. approved rejoining member)
  let jempId = member.jempId;
  if (!jempId) {
    jempId = await dbManager.allocateNextJempId();
    member.jempId = jempId;
  }

  const now = new Date().toISOString();
  member.membershipStatus = MembershipState.ACTIVE;
  member.updatedAt = now;
  await dbManager.saveMember(member);

  session.currentStep = OnboardingStep.COMPLETED;
  session.updatedAt = now;
  await dbManager.saveOnboardingSession(session);

  // Timeline Events
  await createOfficialTimelineEvent({
    source: 'onboarding',
    sourceEventId: `onboarding:${member.id}:jemp_assigned`,
    eventType: 'JEMP_ASSIGNED',
    memberId: member.id,
    jempId,
    description: `Permanent member identity ${jempId} allocated.`
  });

  await createOfficialTimelineEvent({
    source: 'onboarding',
    sourceEventId: `onboarding:${member.id}:membership_activated`,
    eventType: 'MEMBERSHIP_ACTIVATED',
    memberId: member.id,
    jempId,
    description: `Membership activated. Welcome to Jobless Empire, ${member.name}.`
  });

  // Cross-Bot Outbox Events
  await publishOutboxEvent('member.jemp_assigned', 'member', member.id, {
    memberId: member.id,
    jempId,
    discordUserId
  });

  await publishOutboxEvent('member.activated', 'member', member.id, {
    memberId: member.id,
    jempId,
    discordUserId,
    name: member.name,
    timezone: member.timezone
  });

  // Audit
  await auditAction(
    'system',
    member.id,
    'MEMBERSHIP_ACTIVATED',
    'onboarding_bot',
    { memberId: member.id, jempId },
    { name: member.name, status: 'ACTIVE' }
  );

  return { success: true, member, jempId };
}

// 11. SUSPEND MEMBERSHIP
export async function suspendMembership(
  adminActor: string,
  targetId: string,
  reason: string
): Promise<{ success: boolean; error?: string; member?: Member }> {
  const member = (await dbManager.findMemberByDiscordId(targetId)) ||
    (await dbManager.findMemberByJempId(targetId)) ||
    (await dbManager.findMemberById(targetId));

  if (!member) return { success: false, error: 'Member not found.' };

  member.membershipStatus = MembershipState.SUSPENDED;
  member.updatedAt = new Date().toISOString();
  await dbManager.saveMember(member);

  await auditAction(
    adminActor,
    member.id,
    'MEMBERSHIP_SUSPENDED',
    'onboarding_bot',
    { memberId: member.id, jempId: member.jempId },
    { reason }
  );

  await publishOutboxEvent('member.suspended', 'member', member.id, {
    memberId: member.id,
    jempId: member.jempId,
    reason
  });

  return { success: true, member };
}

// 12. RESTORE MEMBERSHIP
export async function restoreMembership(
  adminActor: string,
  targetId: string
): Promise<{ success: boolean; error?: string; member?: Member }> {
  const member = (await dbManager.findMemberByDiscordId(targetId)) ||
    (await dbManager.findMemberByJempId(targetId)) ||
    (await dbManager.findMemberById(targetId));

  if (!member) return { success: false, error: 'Member not found.' };

  member.membershipStatus = MembershipState.ACTIVE;
  member.updatedAt = new Date().toISOString();
  await dbManager.saveMember(member);

  await auditAction(
    adminActor,
    member.id,
    'MEMBERSHIP_RESTORED',
    'onboarding_bot',
    { memberId: member.id, jempId: member.jempId },
    { status: 'ACTIVE' }
  );

  await publishOutboxEvent('member.restored', 'member', member.id, {
    memberId: member.id,
    jempId: member.jempId
  });

  return { success: true, member };
}

// 13. TERMINATE MEMBERSHIP
export async function terminateMembership(
  adminActor: string,
  targetId: string,
  reason: string
): Promise<{ success: boolean; error?: string; member?: Member }> {
  const member = (await dbManager.findMemberByDiscordId(targetId)) ||
    (await dbManager.findMemberByJempId(targetId)) ||
    (await dbManager.findMemberById(targetId));

  if (!member) return { success: false, error: 'Member not found.' };

  member.membershipStatus = MembershipState.TERMINATED;
  member.updatedAt = new Date().toISOString();
  await dbManager.saveMember(member);

  await auditAction(
    adminActor,
    member.id,
    'MEMBERSHIP_TERMINATED',
    'onboarding_bot',
    { memberId: member.id, jempId: member.jempId },
    { reason }
  );

  await publishOutboxEvent('member.terminated', 'member', member.id, {
    memberId: member.id,
    jempId: member.jempId,
    reason
  });

  return { success: true, member };
}

// 14. TIMELINE EVENT CREATION (IDEMPOTENT)
export async function createOfficialTimelineEvent(params: {
  source: string;
  sourceEventId: string;
  eventType: string;
  memberId?: string;
  jempId?: string;
  description: string;
  metadata?: Record<string, any>;
}): Promise<TimelineEvent> {
  const event: TimelineEvent = {
    id: crypto.randomUUID(),
    source: params.source,
    sourceEventId: params.sourceEventId,
    eventType: params.eventType,
    memberId: params.memberId,
    jempId: params.jempId,
    description: params.description,
    metadata: params.metadata || {},
    createdAt: new Date().toISOString()
  };

  const res = await dbManager.saveTimelineEvent(event);
  return res.event;
}

// 15. AUDIT LOGGING
export async function auditAction(
  actor: string,
  target: string,
  action: string,
  source = 'onboarding_bot',
  relevantIds: Record<string, any> = {},
  safeMetadata: Record<string, any> = {}
): Promise<AuditLogEntry> {
  const log: AuditLogEntry = {
    id: crypto.randomUUID(),
    actor,
    target,
    action,
    source,
    relevantIds,
    safeMetadata,
    timestamp: new Date().toISOString()
  };

  return dbManager.saveAuditLog(log);
}

// 16. OUTBOX EVENT PUBLISHER
export async function publishOutboxEvent(
  eventType: string,
  aggregateType: 'member' | 'application' | 'resume',
  aggregateId: string,
  payload: Record<string, any>
): Promise<OutboxEvent> {
  const event: OutboxEvent = {
    id: crypto.randomUUID(),
    eventType,
    aggregateType,
    aggregateId,
    payload,
    status: 'PENDING',
    retryCount: 0,
    createdAt: new Date().toISOString()
  };

  return dbManager.saveOutboxEvent(event);
}

// 17. GET RESUME HISTORY
export async function getResumeHistory(memberId: string): Promise<ResumeFile[]> {
  return dbManager.listResumesForMember(memberId);
}
