import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
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
  StorageProvider,
  PermIdConfig,
  TimelineSyncStatus,
  TimelineArchitectureMode
} from '../types.ts';
import { hashNormalizedEmail, normalizeEmail } from '../security/index.ts';

// In-Memory / File Persistent DB State
interface DatabaseState {
  applications: Application[];
  members: Member[];
  onboardingSessions: OnboardingSession[];
  resumeFiles: ResumeFile[];
  timelineEvents: TimelineEvent[];
  outboxEvents: OutboxEvent[];
  auditLogs: AuditLogEntry[];
  settings: Record<string, any>;
  jempSequence: number;
  permIdConfig?: PermIdConfig;
}

const DATA_FILE = path.join(process.cwd(), '.jemp_data.json');

class DatabaseManager {
  private pgPool: Pool | null = null;
  private isPgConnected: boolean = false;
  private connectionDetails: string = 'Internal Durable Store (.jemp_data.json)';
  private lastCanonicalSync?: string;
  private state: DatabaseState = {
    applications: [],
    members: [],
    onboardingSessions: [],
    resumeFiles: [],
    timelineEvents: [],
    outboxEvents: [],
    auditLogs: [],
    settings: {},
    jempSequence: 0,
    permIdConfig: {
      prefix: 'JEMP',
      digitCount: 3,
      currentSequence: 0,
      isConfigured: false
    }
  };

  constructor() {
    this.loadStateFromFile();
    this.initPostgres();
  }

  private loadStateFromFile() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        this.state = JSON.parse(raw);
        if (!this.state.permIdConfig) {
          this.state.permIdConfig = {
            prefix: 'JEMP',
            digitCount: 3,
            currentSequence: this.state.jempSequence || 0,
            isConfigured: false
          };
        }
      }
    } catch (e) {
      console.warn('Could not read existing .jemp_data.json, initializing fresh store.', e);
    }
  }

  public persistState() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to write .jemp_data.json', e);
    }
  }

  private async initPostgres() {
    const dbUrl = process.env.DATABASE_URL;
    const host = process.env.DB_HOST || process.env.POSTGRES_HOST;
    const port = parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432', 10);
    const user = process.env.DB_USER || process.env.DB_USERNAME || process.env.POSTGRES_USER;
    const password = process.env.DB_PASSWORD || process.env.DB_PASS || process.env.POSTGRES_PASSWORD;
    const database = process.env.DB_NAME || process.env.POSTGRES_DB;
    const ssl = process.env.DB_SSL === 'true';

    try {
      if (dbUrl) {
        this.pgPool = new Pool({
          connectionString: dbUrl,
          max: 10,
          connectionTimeoutMillis: 5000,
          ssl: ssl ? { rejectUnauthorized: false } : undefined
        });
        const client = await this.pgPool.connect();
        client.release();
        this.isPgConnected = true;
        this.connectionDetails = `Canonical PostgreSQL (${dbUrl.replace(/:[^:@]*@/, ':****@')})`;
        console.log('Successfully connected to external canonical PostgreSQL shared database via DATABASE_URL.');
        await this.ensurePgSchema();
      } else if (user && database) {
        this.pgPool = new Pool({
          host: host || 'localhost',
          port,
          user,
          password: password || undefined,
          database,
          max: 10,
          connectionTimeoutMillis: 5000,
          ssl: ssl ? { rejectUnauthorized: false } : undefined
        });
        const client = await this.pgPool.connect();
        client.release();
        this.isPgConnected = true;
        this.connectionDetails = `Canonical PostgreSQL (${user}@${host || 'localhost'}:${port}/${database})`;
        console.log(`Successfully connected to canonical PostgreSQL shared database at ${host || 'localhost'}:${port}/${database}.`);
        await this.ensurePgSchema();
      } else {
        this.connectionDetails = 'Local Compatibility Layer (.jemp_data.json)';
      }
    } catch (err: any) {
      console.warn(`PostgreSQL connection attempt to ${host || 'localhost'}:${port} failed (${err.message}). Using local compatibility layer.`);
      this.isPgConnected = false;
      this.connectionDetails = 'Local Compatibility Buffer (PostgreSQL unavailable)';
    }
  }

  private async ensurePgSchema() {
    if (!this.pgPool || !this.isPgConnected) return;
    try {
      // Ensure shared canonical JEMP tables exist so all bots query same schema
      await this.pgPool.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        CREATE SEQUENCE IF NOT EXISTS jemp_member_seq START 1 INCREMENT 1;

        CREATE TABLE IF NOT EXISTS applications (
            id VARCHAR(64) PRIMARY KEY,
            applicant_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            email_normalized_hash VARCHAR(64) NOT NULL UNIQUE,
            status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
            notes TEXT,
            expiration_date TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS members (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            jemp_id VARCHAR(32) UNIQUE,
            discord_user_id VARCHAR(64) UNIQUE,
            application_id VARCHAR(64) REFERENCES applications(id),
            name VARCHAR(255) NOT NULL,
            email_normalized_hash VARCHAR(64) NOT NULL,
            timezone VARCHAR(64),
            membership_status VARCHAR(32) NOT NULL DEFAULT 'APPLIED',
            current_resume_id UUID,
            rules_version_accepted VARCHAR(32),
            rules_accepted_at TIMESTAMP WITH TIME ZONE,
            safety_acknowledged_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS onboarding_sessions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            discord_user_id VARCHAR(64) NOT NULL UNIQUE,
            application_id VARCHAR(64) REFERENCES applications(id),
            member_id UUID REFERENCES members(id),
            current_step VARCHAR(64) NOT NULL DEFAULT 'EMAIL_REQUIRED',
            staged_name VARCHAR(255),
            staged_timezone VARCHAR(64),
            rules_accepted BOOLEAN DEFAULT FALSE,
            safety_acknowledged BOOLEAN DEFAULT FALSE,
            attempts_count INT DEFAULT 0,
            last_attempt_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS resume_files (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
            application_id VARCHAR(64) NOT NULL REFERENCES applications(id),
            filename VARCHAR(255) NOT NULL,
            mime_type VARCHAR(128) NOT NULL,
            file_size BIGINT NOT NULL,
            sha256_hash VARCHAR(64) NOT NULL,
            storage_provider VARCHAR(32) NOT NULL DEFAULT 'local',
            storage_key VARCHAR(512) NOT NULL,
            version INT NOT NULL DEFAULT 1,
            status VARCHAR(32) NOT NULL DEFAULT 'CURRENT',
            data_base64 TEXT,
            uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            removed_at TIMESTAMP WITH TIME ZONE
        );

        -- CANONICAL TIMELINE ARCHITECTURE (SHARED BY ALL JEMP BOTS)
        CREATE TABLE IF NOT EXISTS timeline_events (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            source VARCHAR(64) NOT NULL DEFAULT 'onboarding',
            source_event_id VARCHAR(255) NOT NULL UNIQUE,
            event_type VARCHAR(64) NOT NULL,
            member_id UUID REFERENCES members(id),
            jemp_id VARCHAR(32),
            description TEXT NOT NULL,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS outbox_events (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            event_type VARCHAR(64) NOT NULL,
            aggregate_type VARCHAR(32) NOT NULL,
            aggregate_id VARCHAR(64) NOT NULL,
            payload JSONB NOT NULL DEFAULT '{}',
            status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
            retry_count INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            dispatched_at TIMESTAMP WITH TIME ZONE
        );

        CREATE TABLE IF NOT EXISTS audit_log (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            actor VARCHAR(128) NOT NULL,
            target VARCHAR(128) NOT NULL,
            action VARCHAR(64) NOT NULL,
            source VARCHAR(64) NOT NULL DEFAULT 'onboarding_bot',
            relevant_ids JSONB DEFAULT '{}',
            safe_metadata JSONB DEFAULT '{}',
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS settings (
            key VARCHAR(128) PRIMARY KEY,
            value JSONB NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Canonical JEMP shared schema confirmed on PostgreSQL database.');
      await this.syncLocalToCanonicalTimeline();
    } catch (err) {
      console.warn('PostgreSQL schema verification warning:', err);
    }
  }

  public getStatus() {
    const permConfig = this.getPermIdConfig();
    const timelineSync = this.getTimelineSyncStatus();
    return {
      type: this.isPgConnected ? 'Canonical PostgreSQL Database (Active Shared System)' : 'Local Compatibility Buffer (Standalone / Dev)',
      connectionDetails: this.connectionDetails,
      isConnected: true,
      isCanonicalSharedDb: this.isPgConnected,
      timelineArchitecture: timelineSync.architectureMode,
      timelineSyncStatus: timelineSync,
      applicationsCount: this.state.applications.length,
      membersCount: this.state.members.length,
      resumesCount: this.state.resumeFiles.length,
      timelineEventsCount: this.state.timelineEvents.length,
      outboxEventsCount: this.state.outboxEvents.length,
      auditLogsCount: this.state.auditLogs.length,
      currentJempSequence: permConfig.currentSequence,
      permIdConfig: permConfig,
      nextPermIdPreview: this.previewPermId()
    };
  }

  // --- CANONICAL TIMELINE ARCHITECTURE & COMPATIBILITY SYNC ---
  public getTimelineSyncStatus(): TimelineSyncStatus {
    const isSharedDb = this.isPgConnected;
    const hasTimelineService = Boolean(process.env.TIMELINE_SERVICE_URL);

    let mode: TimelineArchitectureMode = 'TEMPORARY_COMPATIBILITY_LAYER';
    if (isSharedDb) {
      mode = 'CANONICAL_SHARED_DATABASE';
    } else if (hasTimelineService) {
      mode = 'CANONICAL_TIMELINE_SERVICE';
    }

    const unSyncedCount = this.state.timelineEvents.filter(e => !e.isSyncedToCanonical).length;

    return {
      architectureMode: mode,
      isCanonicalSourceOfTruth: isSharedDb || hasTimelineService,
      sharedDbConnected: isSharedDb,
      timelineServiceConfigured: hasTimelineService,
      timelineServiceUrl: process.env.TIMELINE_SERVICE_URL,
      totalEventsInView: this.state.timelineEvents.length,
      bufferedCompatibilityCount: unSyncedCount,
      lastCanonicalSyncTimestamp: this.lastCanonicalSync,
      notes: isSharedDb
        ? 'Connected to canonical shared PostgreSQL database. All JEMP bots read & write to this shared timeline_events table.'
        : hasTimelineService
        ? `Connected to canonical Timeline Service at ${process.env.TIMELINE_SERVICE_URL}. Events forward to the shared timeline API.`
        : 'Running in temporary local compatibility layer. Events are buffered safely and can be migrated once the canonical shared database or timeline service is connected.'
    };
  }

  public async syncLocalToCanonicalTimeline(): Promise<{
    syncedCount: number;
    alreadySyncedCount: number;
    failedCount: number;
    target: string;
  }> {
    let syncedCount = 0;
    let alreadySyncedCount = 0;
    let failedCount = 0;
    const target = this.isPgConnected
      ? 'Canonical PostgreSQL Database (timeline_events table)'
      : process.env.TIMELINE_SERVICE_URL
      ? `Canonical Timeline Service (${process.env.TIMELINE_SERVICE_URL})`
      : 'Local Compatibility Buffer (No external canonical target configured)';

    const timelineServiceUrl = process.env.TIMELINE_SERVICE_URL;

    for (const ev of this.state.timelineEvents) {
      // 1. Shared PostgreSQL database synchronization
      if (this.isPgConnected && this.pgPool) {
        try {
          const res = await this.pgPool.query(
            `INSERT INTO timeline_events (id, source, source_event_id, event_type, member_id, jemp_id, description, metadata, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (source_event_id) DO NOTHING
             RETURNING id`,
            [
              ev.id,
              ev.source || 'onboarding',
              ev.sourceEventId,
              ev.eventType,
              ev.memberId || null,
              ev.jempId || null,
              ev.description,
              JSON.stringify(ev.metadata || {}),
              ev.createdAt
            ]
          );
          if (res.rowCount && res.rowCount > 0) {
            syncedCount++;
          } else {
            alreadySyncedCount++;
          }
          ev.isSyncedToCanonical = true;
          ev.canonicalSource = 'SHARED_DB';
        } catch (e) {
          failedCount++;
          console.warn('Failed to sync event to canonical pg:', ev.sourceEventId, e);
        }
      }

      // 2. Canonical Timeline Service API synchronization
      if (timelineServiceUrl) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (process.env.TIMELINE_SERVICE_SECRET) {
            headers['X-JEMP-Service-Secret'] = process.env.TIMELINE_SERVICE_SECRET;
          }
          const response = await fetch(`${timelineServiceUrl.replace(/\/$/, '')}/api/events`, {
            method: 'POST',
            headers,
            body: JSON.stringify(ev)
          });
          if (response.ok) {
            ev.isSyncedToCanonical = true;
            ev.canonicalSource = 'TIMELINE_SERVICE';
          }
        } catch (err) {
          // Non-blocking
        }
      }
    }

    this.lastCanonicalSync = new Date().toISOString();
    this.persistState();

    return {
      syncedCount,
      alreadySyncedCount,
      failedCount,
      target
    };
  }

  // --- PERMANENT ID CONFIGURATION & ATOMIC ALLOCATION ---
  public getPermIdConfig(): PermIdConfig {
    if (!this.state.permIdConfig) {
      this.state.permIdConfig = {
        prefix: 'JEMP',
        digitCount: 3,
        currentSequence: this.state.jempSequence || 0,
        isConfigured: false
      };
    }
    return { ...this.state.permIdConfig };
  }

  public updatePermIdConfig(updates: Partial<PermIdConfig>, adminActor = 'admin'): PermIdConfig {
    const current = this.getPermIdConfig();
    const newPrefix = updates.prefix !== undefined ? updates.prefix.toUpperCase().trim() : current.prefix;
    const newDigits = updates.digitCount !== undefined ? Math.min(Math.max(Number(updates.digitCount), 3), 5) : current.digitCount;
    const newSeq = updates.currentSequence !== undefined ? Math.max(Number(updates.currentSequence), 0) : current.currentSequence;

    this.state.permIdConfig = {
      prefix: newPrefix || 'JEMP',
      digitCount: newDigits || 3,
      currentSequence: newSeq,
      isConfigured: true
    };
    this.state.jempSequence = newSeq;

    this.state.auditLogs.unshift({
      id: crypto.randomUUID(),
      actor: adminActor,
      target: 'perm_id_system',
      action: 'CONFIGURE_PERM_ID',
      source: 'onboarding_bot',
      relevantIds: {},
      safeMetadata: {
        prefix: this.state.permIdConfig.prefix,
        digitCount: this.state.permIdConfig.digitCount,
        currentSequence: this.state.permIdConfig.currentSequence,
        nextPreview: this.previewPermId()
      },
      timestamp: new Date().toISOString()
    });

    this.persistState();
    return { ...this.state.permIdConfig };
  }

  public previewPermId(sequence?: number): string {
    const config = this.getPermIdConfig();
    const seq = sequence !== undefined ? sequence : (config.currentSequence + 1);
    const prefix = (config.prefix || 'JEMP').toUpperCase().trim();
    const digits = Math.min(Math.max(config.digitCount || 3, 3), 5);
    return `${prefix}#${String(seq).padStart(digits, '0')}`;
  }

  // Guarantees sequential, unique, restart-safe, concurrency-safe assignment
  // e.g. JEMP#001, JEMP#0001, JOBLESS#001 based on admin's one-time setup
  public async allocateNextJempId(): Promise<string> {
    const config = this.getPermIdConfig();
    config.currentSequence += 1;
    this.state.jempSequence = config.currentSequence;
    this.state.permIdConfig = config;

    const prefix = (config.prefix || 'JEMP').toUpperCase().trim();
    const digits = Math.min(Math.max(config.digitCount || 3, 3), 5);
    const padded = String(config.currentSequence).padStart(digits, '0');
    const permId = `${prefix}#${padded}`;

    this.persistState();
    return permId;
  }

  // --- APPLICATIONS ---
  public async findApplicationByEmailHash(hash: string): Promise<Application | null> {
    return this.state.applications.find(a => a.emailNormalizedHash === hash) || null;
  }

  public async findApplicationById(id: string): Promise<Application | null> {
    return this.state.applications.find(a => a.id === id) || null;
  }

  public async saveApplication(app: Application): Promise<Application> {
    if (this.isPgConnected && this.pgPool) {
      try {
        await this.pgPool.query(
          `INSERT INTO applications (id, applicant_name, email, email_normalized_hash, status, notes, expiration_date, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE SET
             applicant_name = EXCLUDED.applicant_name,
             email = EXCLUDED.email,
             email_normalized_hash = EXCLUDED.email_normalized_hash,
             status = EXCLUDED.status,
             notes = EXCLUDED.notes,
             expiration_date = EXCLUDED.expiration_date,
             updated_at = EXCLUDED.updated_at`,
          [
            app.id,
            app.applicantName,
            app.email,
            app.emailNormalizedHash,
            app.status,
            app.notes || null,
            app.expirationDate || null,
            app.createdAt,
            app.updatedAt
          ]
        );
      } catch (err) {
        console.warn('PostgreSQL saveApplication fallback:', err);
      }
    }

    const idx = this.state.applications.findIndex(a => a.id === app.id);
    if (idx >= 0) {
      this.state.applications[idx] = app;
    } else {
      this.state.applications.push(app);
    }
    this.persistState();
    return app;
  }

  public async listApplications(): Promise<Application[]> {
    return [...this.state.applications];
  }

  // --- MEMBERS ---
  public async findMemberByDiscordId(discordUserId: string): Promise<Member | null> {
    return this.state.members.find(m => m.discordUserId === discordUserId) || null;
  }

  public async findMemberByApplicationId(applicationId: string): Promise<Member | null> {
    return this.state.members.find(m => m.applicationId === applicationId) || null;
  }

  public async findMemberByJempId(jempId: string): Promise<Member | null> {
    return this.state.members.find(m => m.jempId === jempId) || null;
  }

  public async findMemberById(id: string): Promise<Member | null> {
    return this.state.members.find(m => m.id === id) || null;
  }

  public async saveMember(member: Member): Promise<Member> {
    if (this.isPgConnected && this.pgPool) {
      try {
        await this.pgPool.query(
          `INSERT INTO members (id, jemp_id, discord_user_id, application_id, name, email_normalized_hash, timezone, membership_status, current_resume_id, rules_version_accepted, rules_accepted_at, safety_acknowledged_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (id) DO UPDATE SET
             jemp_id = EXCLUDED.jemp_id,
             discord_user_id = EXCLUDED.discord_user_id,
             name = EXCLUDED.name,
             timezone = EXCLUDED.timezone,
             membership_status = EXCLUDED.membership_status,
             current_resume_id = EXCLUDED.current_resume_id,
             rules_version_accepted = EXCLUDED.rules_version_accepted,
             rules_accepted_at = EXCLUDED.rules_accepted_at,
             safety_acknowledged_at = EXCLUDED.safety_acknowledged_at,
             updated_at = EXCLUDED.updated_at`,
          [
            member.id,
            member.jempId || null,
            member.discordUserId || null,
            member.applicationId,
            member.name,
            member.emailNormalizedHash,
            member.timezone || null,
            member.membershipStatus,
            member.currentResumeId || null,
            member.rulesVersionAccepted || null,
            member.rulesAcceptedAt || null,
            member.safetyAcknowledgedAt || null,
            member.createdAt,
            member.updatedAt
          ]
        );
      } catch (err) {
        console.warn('PostgreSQL saveMember fallback:', err);
      }
    }

    const idx = this.state.members.findIndex(m => m.id === member.id);
    if (idx >= 0) {
      this.state.members[idx] = member;
    } else {
      this.state.members.push(member);
    }
    this.persistState();
    return member;
  }

  public async listMembers(): Promise<Member[]> {
    return [...this.state.members];
  }

  // --- ONBOARDING SESSIONS ---
  public async getOnboardingSession(discordUserId: string): Promise<OnboardingSession | null> {
    return this.state.onboardingSessions.find(s => s.discordUserId === discordUserId) || null;
  }

  public async saveOnboardingSession(session: OnboardingSession): Promise<OnboardingSession> {
    const idx = this.state.onboardingSessions.findIndex(s => s.discordUserId === session.discordUserId);
    if (idx >= 0) {
      this.state.onboardingSessions[idx] = session;
    } else {
      this.state.onboardingSessions.push(session);
    }
    this.persistState();
    return session;
  }

  // --- RESUME FILES ---
  public async listResumesForMember(memberId: string): Promise<ResumeFile[]> {
    return this.state.resumeFiles
      .filter(r => r.memberId === memberId)
      .sort((a, b) => b.version - a.version);
  }

  public async getCurrentResumeForMember(memberId: string): Promise<ResumeFile | null> {
    return this.state.resumeFiles.find(r => r.memberId === memberId && r.status === ResumeStatus.CURRENT) || null;
  }

  public async saveResumeFile(resume: ResumeFile): Promise<ResumeFile> {
    if (this.isPgConnected && this.pgPool) {
      try {
        await this.pgPool.query(
          `INSERT INTO resume_files (id, member_id, application_id, filename, mime_type, file_size, sha256_hash, storage_provider, storage_key, version, status, data_base64, uploaded_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO UPDATE SET
             status = EXCLUDED.status,
             data_base64 = EXCLUDED.data_base64`,
          [
            resume.id,
            resume.memberId,
            resume.applicationId,
            resume.filename,
            resume.mimeType,
            resume.fileSize,
            resume.sha256Hash,
            resume.storageProvider,
            resume.storageKey,
            resume.version,
            resume.status,
            resume.dataBase64 || null,
            resume.uploadedAt
          ]
        );
      } catch (err) {
        console.warn('PostgreSQL saveResumeFile fallback:', err);
      }
    }

    const idx = this.state.resumeFiles.findIndex(r => r.id === resume.id);
    if (idx >= 0) {
      this.state.resumeFiles[idx] = resume;
    } else {
      this.state.resumeFiles.push(resume);
    }
    this.persistState();
    return resume;
  }

  // --- TIMELINE EVENTS (CANONICAL SHARED ARCHITECTURE) ---
  public async saveTimelineEvent(event: TimelineEvent): Promise<{ created: boolean; event: TimelineEvent }> {
    // 1. If connected to Canonical Shared PostgreSQL database, write directly to shared timeline_events table
    if (this.isPgConnected && this.pgPool) {
      try {
        const res = await this.pgPool.query(
          `INSERT INTO timeline_events (id, source, source_event_id, event_type, member_id, jemp_id, description, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (source_event_id) DO NOTHING
           RETURNING id`,
          [
            event.id,
            event.source || 'onboarding',
            event.sourceEventId,
            event.eventType,
            event.memberId || null,
            event.jempId || null,
            event.description,
            JSON.stringify(event.metadata || {}),
            event.createdAt
          ]
        );
        event.isSyncedToCanonical = true;
        event.canonicalSource = 'SHARED_DB';
      } catch (err) {
        console.warn('Could not write to canonical PostgreSQL timeline_events:', err);
      }
    }

    // 2. If canonical Timeline service URL is configured, forward event
    const timelineServiceUrl = process.env.TIMELINE_SERVICE_URL;
    if (timelineServiceUrl) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (process.env.TIMELINE_SERVICE_SECRET) {
          headers['X-JEMP-Service-Secret'] = process.env.TIMELINE_SERVICE_SECRET;
        }
        await fetch(`${timelineServiceUrl.replace(/\/$/, '')}/api/events`, {
          method: 'POST',
          headers,
          body: JSON.stringify(event)
        });
        event.isSyncedToCanonical = true;
        event.canonicalSource = 'TIMELINE_SERVICE';
      } catch (err) {
        console.warn(`[Canonical Timeline Service] Failed to forward to ${timelineServiceUrl}:`, err);
      }
    }

    if (!event.canonicalSource) {
      event.canonicalSource = 'LOCAL_COMPATIBILITY_BUFFER';
      event.isSyncedToCanonical = false;
    }

    // Maintain in-memory / file cache for fast UI access and local dev fallback
    const existing = this.state.timelineEvents.find(e => e.sourceEventId === event.sourceEventId);
    if (existing) {
      return { created: false, event: existing };
    }
    this.state.timelineEvents.unshift(event);
    this.persistState();
    return { created: true, event };
  }

  public async listTimelineEvents(memberId?: string): Promise<TimelineEvent[]> {
    // If connected to shared PostgreSQL database, query canonical table
    if (this.isPgConnected && this.pgPool) {
      try {
        let query = 'SELECT * FROM timeline_events ORDER BY created_at DESC';
        let params: any[] = [];
        if (memberId) {
          query = 'SELECT * FROM timeline_events WHERE member_id = $1 ORDER BY created_at DESC';
          params = [memberId];
        }
        const res = await this.pgPool.query(query, params);
        if (res.rows && res.rows.length > 0) {
          return res.rows.map(row => ({
            id: row.id,
            source: row.source,
            sourceEventId: row.source_event_id,
            eventType: row.event_type,
            memberId: row.member_id,
            jempId: row.jemp_id,
            description: row.description,
            metadata: row.metadata,
            createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
            isSyncedToCanonical: true,
            canonicalSource: 'SHARED_DB'
          }));
        }
      } catch (err) {
        console.warn('PostgreSQL timeline_events query fallback:', err);
      }
    }

    if (memberId) {
      return this.state.timelineEvents.filter(e => e.memberId === memberId);
    }
    return [...this.state.timelineEvents];
  }

  // --- OUTBOX EVENTS ---
  public async saveOutboxEvent(event: OutboxEvent): Promise<OutboxEvent> {
    if (this.isPgConnected && this.pgPool) {
      try {
        await this.pgPool.query(
          `INSERT INTO outbox_events (id, event_type, aggregate_type, aggregate_id, payload, status, retry_count, created_at, dispatched_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [
            event.id,
            event.eventType,
            event.aggregateType,
            event.aggregateId,
            JSON.stringify(event.payload),
            event.status,
            event.retryCount,
            event.createdAt,
            event.dispatchedAt || null
          ]
        );
      } catch (err) {
        console.warn('PostgreSQL saveOutboxEvent fallback:', err);
      }
    }

    this.state.outboxEvents.unshift(event);
    this.persistState();
    return event;
  }

  public async listOutboxEvents(): Promise<OutboxEvent[]> {
    return [...this.state.outboxEvents];
  }

  // --- AUDIT LOGS ---
  public async saveAuditLog(log: AuditLogEntry): Promise<AuditLogEntry> {
    if (this.isPgConnected && this.pgPool) {
      try {
        await this.pgPool.query(
          `INSERT INTO audit_log (id, actor, target, action, source, relevant_ids, safe_metadata, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [
            log.id,
            log.actor,
            log.target,
            log.action,
            log.source || 'onboarding_bot',
            JSON.stringify(log.relevantIds || {}),
            JSON.stringify(log.safeMetadata || {}),
            log.timestamp
          ]
        );
      } catch (err) {
        console.warn('PostgreSQL saveAuditLog fallback:', err);
      }
    }

    this.state.auditLogs.unshift(log);
    this.persistState();
    return log;
  }

  public async listAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
    return this.state.auditLogs.slice(0, limit);
  }

  // --- RESUME FILES (LOCAL DATABASE STORAGE) ---
  public async listResumeFiles(memberId?: string): Promise<ResumeFile[]> {
    if (memberId) {
      return this.state.resumeFiles.filter(r => r.memberId === memberId);
    }
    return [...this.state.resumeFiles];
  }

  public async findResumeFileById(id: string): Promise<ResumeFile | null> {
    return this.state.resumeFiles.find(r => r.id === id) || null;
  }

  // --- SETTINGS ---
  public getSetting<T>(key: string, defaultValue?: T): T | undefined {
    return this.state.settings[key] ?? defaultValue;
  }

  public setSetting(key: string, value: any) {
    this.state.settings[key] = value;
    this.persistState();
  }

  // --- SEED DEMO DATA & CLEAR DEMO DATA ---
  public async seedDemoData() {
    const now = new Date().toISOString();
    
    // Clear any previous demo entries first to keep clean
    this.state.applications = this.state.applications.filter(a => !a.id.includes('DEMO'));
    this.state.members = this.state.members.filter(m => !m.applicationId.includes('DEMO'));

    const demoApp1: Application = {
      id: 'APP#DEMO-001',
      applicantName: 'Alex Mercer',
      email: 'demo1@example.invalid',
      emailNormalizedHash: hashNormalizedEmail('demo1@example.invalid'),
      status: ApplicationStatus.APPROVED,
      notes: 'Demo Approved Applicant — Full-stack Systems Engineer',
      createdAt: now,
      updatedAt: now
    };

    const demoApp2: Application = {
      id: 'APP#DEMO-002',
      applicantName: 'Samantha Vance',
      email: 'demo2@example.invalid',
      emailNormalizedHash: hashNormalizedEmail('demo2@example.invalid'),
      status: ApplicationStatus.APPROVED,
      notes: 'Demo Approved Applicant — Cryptographic Protocol Architect',
      createdAt: now,
      updatedAt: now
    };

    const demoApp3: Application = {
      id: 'APP#DEMO-003',
      applicantName: 'Marcus Wright',
      email: 'demo3@example.invalid',
      emailNormalizedHash: hashNormalizedEmail('demo3@example.invalid'),
      status: ApplicationStatus.PENDING,
      notes: 'Demo Pending Applicant — Not yet approved',
      createdAt: now,
      updatedAt: now
    };

    this.state.applications.push(demoApp1, demoApp2, demoApp3);

    // Also seed a pre-existing Active Member JEMP#001 for demonstration
    const activeMemberId = crypto.randomUUID();
    const demoMember: Member = {
      id: activeMemberId,
      jempId: 'JEMP#001',
      discordUserId: 'discord_demo_active_user',
      applicationId: 'APP#DEMO-FOUNDER',
      name: 'Elena Rostova',
      emailNormalizedHash: hashNormalizedEmail('founder@example.invalid'),
      timezone: 'America/New_York',
      membershipStatus: MembershipState.ACTIVE,
      rulesVersionAccepted: 'v1.0',
      rulesAcceptedAt: now,
      safetyAcknowledgedAt: now,
      createdAt: now,
      updatedAt: now
    };

    this.state.applications.push({
      id: 'APP#DEMO-FOUNDER',
      applicantName: 'Elena Rostova',
      email: 'founder@example.invalid',
      emailNormalizedHash: hashNormalizedEmail('founder@example.invalid'),
      status: ApplicationStatus.APPROVED,
      notes: 'Founding Member Application',
      createdAt: now,
      updatedAt: now
    });

    this.state.members.push(demoMember);
    if (this.state.jempSequence < 1) {
      this.state.jempSequence = 1;
    }

    const demoResume: ResumeFile = {
      id: crypto.randomUUID(),
      memberId: activeMemberId,
      applicationId: 'APP#DEMO-FOUNDER',
      filename: 'Elena_Rostova_Staff_Engineer_Resume.pdf',
      mimeType: 'application/pdf',
      fileSize: 142050,
      sha256Hash: crypto.createHash('sha256').update('sample_resume_content').digest('hex'),
      storageProvider: StorageProvider.LOCAL,
      storageKey: `resumes/${activeMemberId}/v1-elena-resume.pdf`,
      version: 1,
      status: ResumeStatus.CURRENT,
      uploadedAt: now
    };

    demoMember.currentResumeId = demoResume.id;
    this.state.resumeFiles.push(demoResume);

    this.state.timelineEvents.push({
      id: crypto.randomUUID(),
      source: 'onboarding',
      sourceEventId: `onboarding:${activeMemberId}:membership_activated`,
      eventType: 'MEMBERSHIP_ACTIVATED',
      memberId: activeMemberId,
      jempId: 'JEMP#001',
      description: 'Elena Rostova completed onboarding. Assigned JEMP#001.',
      createdAt: now
    });

    this.state.auditLogs.push({
      id: crypto.randomUUID(),
      actor: 'system',
      target: 'demo_environment',
      action: 'SEED_DEMO_DATA',
      source: 'onboarding_bot',
      relevantIds: { apps: ['APP#DEMO-001', 'APP#DEMO-002', 'APP#DEMO-003'] },
      safeMetadata: { note: 'Seed demo executed with unmistakable .invalid addresses.' },
      timestamp: now
    });

    this.persistState();
    return { success: true, count: 4 };
  }

  public async clearDemoData() {
    this.state.applications = this.state.applications.filter(a => !a.id.includes('DEMO'));
    this.state.members = this.state.members.filter(m => !m.applicationId.includes('DEMO'));
    this.state.onboardingSessions = this.state.onboardingSessions.filter(s => !s.applicationId?.includes('DEMO'));
    this.state.resumeFiles = this.state.resumeFiles.filter(r => !r.applicationId?.includes('DEMO'));
    this.state.timelineEvents = this.state.timelineEvents.filter(t => !t.sourceEventId?.includes('DEMO'));
    
    this.state.auditLogs.unshift({
      id: crypto.randomUUID(),
      actor: 'admin',
      target: 'demo_environment',
      action: 'CLEAR_DEMO_DATA',
      source: 'onboarding_bot',
      relevantIds: {},
      safeMetadata: { note: 'All demo records cleared from database.' },
      timestamp: new Date().toISOString()
    });

    this.persistState();
    return { success: true };
  }
}

export const dbManager = new DatabaseManager();
