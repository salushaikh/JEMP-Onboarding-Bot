export interface AppConfig {
  discordToken?: string;
  discordClientId?: string;
  discordGuildId?: string;

  // Database Connection Parameters (PostgreSQL or local system of record)
  databaseUrl?: string;
  dbHost?: string;
  dbPort?: number;
  dbUser?: string;
  dbPassword?: string;
  dbName?: string;
  dbSsl?: boolean;

  verifyMeChannelId: string;
  profileManagerChannelId: string;
  applicationsChannelId: string;
  onboardingLogChannelId?: string;
  adminLogChannelId?: string;

  unverifiedRoleId: string;
  memberRoleId: string;
  suspendedRoleId: string;
  terminatedRoleId: string;
  adminRoleId: string;

  maxEmailVerificationAttempts: number;
  verificationWindowMinutes: number;
  maxResumeSizeMb: number;

  timelineServiceUrl?: string;
  timelineServiceSecret?: string;

  encryptionKey?: string;
}

export function getConfig(): AppConfig {
  return {
    discordToken: process.env.DISCORD_TOKEN || '',
    discordClientId: process.env.DISCORD_CLIENT_ID || '123456789012345678',
    discordGuildId: process.env.DISCORD_GUILD_ID || '987654321098765432',

    databaseUrl: process.env.DATABASE_URL || '',
    dbHost: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
    dbPort: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432', 10),
    dbUser: process.env.DB_USER || process.env.DB_USERNAME || process.env.POSTGRES_USER || '',
    dbPassword: process.env.DB_PASSWORD || process.env.DB_PASS || process.env.POSTGRES_PASSWORD || '',
    dbName: process.env.DB_NAME || process.env.POSTGRES_DB || 'jobless_empire',
    dbSsl: process.env.DB_SSL === 'true',

    verifyMeChannelId: process.env.VERIFY_ME_CHANNEL_ID || 'channel_verify_me',
    profileManagerChannelId: process.env.PROFILE_MANAGER_CHANNEL_ID || 'channel_profile_mgr',
    applicationsChannelId: process.env.APPLICATIONS_CHANNEL_ID || 'channel_applications',
    onboardingLogChannelId: process.env.ONBOARDING_LOG_CHANNEL_ID || 'channel_onboard_log',
    adminLogChannelId: process.env.ADMIN_LOG_CHANNEL_ID || 'channel_admin_log',

    unverifiedRoleId: process.env.UNVERIFIED_ROLE_ID || 'role_unverified',
    memberRoleId: process.env.MEMBER_ROLE_ID || 'role_member',
    suspendedRoleId: process.env.SUSPENDED_ROLE_ID || 'role_suspended',
    terminatedRoleId: process.env.TERMINATED_ROLE_ID || 'role_terminated',
    adminRoleId: process.env.ADMIN_ROLE_ID || 'role_admin',

    maxEmailVerificationAttempts: parseInt(process.env.MAX_EMAIL_VERIFICATION_ATTEMPTS || '5', 10),
    verificationWindowMinutes: parseInt(process.env.VERIFICATION_WINDOW_MINUTES || '15', 10),
    maxResumeSizeMb: parseInt(process.env.MAX_RESUME_SIZE_MB || '10', 10),

    timelineServiceUrl: process.env.TIMELINE_SERVICE_URL || '',
    timelineServiceSecret: process.env.TIMELINE_SERVICE_SECRET || '',

    encryptionKey: process.env.ENCRYPTION_KEY || 'jemp_master_key_default_32_bytes_len'
  };
}
