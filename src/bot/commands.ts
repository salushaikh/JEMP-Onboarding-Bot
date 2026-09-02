import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

// 1. /onboard (Admin Master Command)
export const onboardCommand = new SlashCommandBuilder()
  .setName('onboard')
  .setDescription('Jobless Empire Administrative Onboarding & Whitelist Management')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub =>
    sub
      .setName('add')
      .setDescription('Approve an applicant email for Discord onboarding')
      .addStringOption(opt => opt.setName('email').setDescription('Applicant email address').setRequired(true))
      .addStringOption(opt => opt.setName('applicant_name').setDescription('Full legal/preferred name').setRequired(true))
      .addStringOption(opt => opt.setName('application_id').setDescription('Application ID (e.g. APP#0042)').setRequired(true))
      .addStringOption(opt => opt.setName('expiration').setDescription('Optional ISO expiration date'))
      .addStringOption(opt => opt.setName('notes').setDescription('Internal vetting notes'))
  )
  .addSubcommand(sub =>
    sub
      .setName('view')
      .setDescription('View an application record')
      .addStringOption(opt => opt.setName('application_id').setDescription('Application ID').setRequired(true))
  )
  .addSubcommand(sub =>
    sub
      .setName('search')
      .setDescription('Search applications by name or ID')
      .addStringOption(opt => opt.setName('query').setDescription('Search term').setRequired(true))
  )
  .addSubcommand(sub =>
    sub
      .setName('revoke')
      .setDescription('Revoke an approved application')
      .addStringOption(opt => opt.setName('application_id').setDescription('Application ID').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Reason for revocation').setRequired(true))
  )
  .addSubcommand(sub =>
    sub
      .setName('restore')
      .setDescription('Restore a revoked application')
      .addStringOption(opt => opt.setName('application_id').setDescription('Application ID').setRequired(true))
  )
  .addSubcommand(sub =>
    sub
      .setName('status')
      .setDescription('Check status of application or member')
      .addStringOption(opt => opt.setName('identifier').setDescription('Email, App ID, or Discord user ID').setRequired(true))
  )
  .addSubcommand(sub =>
    sub
      .setName('member')
      .setDescription('View detailed member identity & profile')
      .addUserOption(opt => opt.setName('user').setDescription('Target Discord member').setRequired(true))
  )
  .addSubcommand(sub =>
    sub
      .setName('suspend')
      .setDescription('Suspend a member across Empire systems')
      .addUserOption(opt => opt.setName('user').setDescription('Target Discord user').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Reason for suspension').setRequired(true))
  )
  .addSubcommand(sub =>
    sub
      .setName('restore-member')
      .setDescription('Restore a suspended member to active status')
      .addUserOption(opt => opt.setName('user').setDescription('Target Discord user').setRequired(true))
  )
  .addSubcommand(sub =>
    sub
      .setName('terminate')
      .setDescription('Permanently terminate membership')
      .addUserOption(opt => opt.setName('user').setDescription('Target Discord user').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Reason for termination').setRequired(true))
  )
  .addSubcommand(sub =>
    sub
      .setName('reset')
      .setDescription('Reset onboarding session for a user')
      .addUserOption(opt => opt.setName('user').setDescription('Target Discord user').setRequired(true))
  )
  .addSubcommand(sub =>
    sub
      .setName('reconcile')
      .setDescription('Reconcile Database, Discord roles, and Timeline Proof-of-Work')
  )
  .addSubcommand(sub =>
    sub
      .setName('audit')
      .setDescription('View recent audit log entries')
      .addIntegerOption(opt => opt.setName('limit').setDescription('Number of entries (max 50)'))
  )
  .addSubcommand(sub =>
    sub
      .setName('dashboard')
      .setDescription('Show complete administrative metrics dashboard')
  )
  .addSubcommand(sub =>
    sub
      .setName('health')
      .setDescription('Check system health, database, and storage status')
  )
  .addSubcommand(sub =>
    sub
      .setName('seed-demo')
      .setDescription('Seed demo applications and active member for testing')
  )
  .addSubcommand(sub =>
    sub
      .setName('clear-demo')
      .setDescription('Clear all demo data from the system')
  );

// 2. /membership (Member Command)
export const membershipCommand = new SlashCommandBuilder()
  .setName('membership')
  .setDescription('View and manage your Jobless Empire membership')
  .addSubcommand(sub =>
    sub.setName('status').setDescription('View your current membership state and JEMP# identity')
  )
  .addSubcommand(sub =>
    sub
      .setName('timezone')
      .setDescription('Update your primary IANA timezone')
      .addStringOption(opt => opt.setName('iana_timezone').setDescription('e.g. America/New_York, Europe/London').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('help').setDescription('Information on onboarding, verification, and rules')
  );

// 3. /profile (Member Profile Command)
export const profileCommand = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('Jobless Empire Member Profile & Proof-of-Work references')
  .addSubcommand(sub => sub.setName('status').setDescription('View your member identity card'))
  .addSubcommand(sub => sub.setName('resume').setDescription('View your current resume metadata'));

// 4. /resume (Member Resume Management)
export const resumeCommand = new SlashCommandBuilder()
  .setName('resume')
  .setDescription('Manage your private Jobless Empire resume metadata')
  .addSubcommand(sub =>
    sub
      .setName('add')
      .setDescription('Upload or update your current resume (PDF, DOC, DOCX)')
      .addAttachmentOption(opt => opt.setName('file').setDescription('Resume file (Max 10MB)').setRequired(true))
  )
  .addSubcommand(sub =>
    sub
      .setName('update')
      .setDescription('Upload a new version of your resume')
      .addAttachmentOption(opt => opt.setName('file').setDescription('Updated resume file').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('view').setDescription('View current resume version and checksum')
  )
  .addSubcommand(sub =>
    sub.setName('history').setDescription('View all historical resume versions')
  )
  .addSubcommand(sub =>
    sub.setName('remove').setDescription('Remove your current active resume')
  );

export const allCommands = [
  onboardCommand,
  membershipCommand,
  profileCommand,
  resumeCommand
];
