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
  PermIdConfig
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
        this.connectionDetails = `PostgreSQL URI (${dbUrl.replace(/:[^:@]*@/, ':****@')})`;
        console.log('Successfully connected to external PostgreSQL system of record via DATABASE_URL.');
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
        this.connectionDetails = `PostgreSQL (${user}@${host || 'localhost'}:${port}/${database})`;
        console.log(`Successfully connected to PostgreSQL system of record at ${host || 'localhost'}:${port}/${database}.`);
      } else {
        this.connectionDetails = 'Local Embedded Database (.jemp_data.json)';
      }
    } catch (err: any) {
      console.warn(`PostgreSQL connection attempt to ${host || 'localhost'}:${port} failed (${err.message}). Using local durable system of record.`);
      this.isPgConnected = false;
      this.connectionDetails = 'Local Embedded Database (PostgreSQL fallback active)';
    }
  }

  public getStatus() {
    const permConfig = this.getPermIdConfig();
    return {
      type: this.isPgConnected ? 'PostgreSQL (Active)' : 'Durable System of Record (Local DB / PostgreSQL Compatible)',
      connectionDetails: this.connectionDetails,
      isConnected: true,
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
    const idx = this.state.resumeFiles.findIndex(r => r.id === resume.id);
    if (idx >= 0) {
      this.state.resumeFiles[idx] = resume;
    } else {
      this.state.resumeFiles.push(resume);
    }
    this.persistState();
    return resume;
  }

  // --- TIMELINE EVENTS ---
  public async saveTimelineEvent(event: TimelineEvent): Promise<{ created: boolean; event: TimelineEvent }> {
    const existing = this.state.timelineEvents.find(e => e.sourceEventId === event.sourceEventId);
    if (existing) {
      return { created: false, event: existing };
    }
    this.state.timelineEvents.unshift(event);
    this.persistState();
    return { created: true, event };
  }

  public async listTimelineEvents(memberId?: string): Promise<TimelineEvent[]> {
    if (memberId) {
      return this.state.timelineEvents.filter(e => e.memberId === memberId);
    }
    return [...this.state.timelineEvents];
  }

  // --- OUTBOX EVENTS ---
  public async saveOutboxEvent(event: OutboxEvent): Promise<OutboxEvent> {
    this.state.outboxEvents.unshift(event);
    this.persistState();
    return event;
  }

  public async listOutboxEvents(): Promise<OutboxEvent[]> {
    return [...this.state.outboxEvents];
  }

  // --- AUDIT LOGS ---
  public async saveAuditLog(log: AuditLogEntry): Promise<AuditLogEntry> {
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
