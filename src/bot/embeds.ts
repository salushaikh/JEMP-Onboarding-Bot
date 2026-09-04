import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { maskEmail } from '../security/index.ts';

// Jobless Empire Color Palette (Dark, restrained, monochrome with metallic accents)
export const JEMP_COLORS = {
  CANVAS_BLACK: 0x09090b, // #09090b
  STEEL_DARK: 0x18181b,   // #18181b
  SILVER_ACCENT: 0x71717a,// #71717a
  EMPIRE_WHITE: 0xf4f4f5, // #f4f4f5
  GOLD_HONOR: 0xd4af37,   // muted gold for JEMP#
  CRIMSON_ALERT: 0x991b1b // subtle dark crimson for suspensions/errors
};

export const JEMP_FOOTER = {
  text: 'No job. Still building. • despair.us',
  iconURL: 'https://despair.us/favicon.ico'
};

// 1. #VERIFY-ME Persistent Embed Card
export function buildVerifyMeCard() {
  const embed = new EmbedBuilder()
    .setTitle('⚔️ JOBLESS EMPIRE')
    .setDescription(
      '**VERIFY YOUR IDENTITY**\n\n' +
      'Before entering the Empire, verify the email address used during your application.\n\n' +
      'Your email will be securely verified against the approved applicant registry.\n\n' +
      '• Private & ephemeral verification\n' +
      '• No unsolicited resume collection\n' +
      '• Permanent proof-of-work identity'
    )
    .setColor(JEMP_COLORS.CANVAS_BLACK)
    .setFooter(JEMP_FOOTER);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_verify_email')
      .setLabel('🔐 VERIFY EMAIL')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_how_it_works')
      .setLabel('ℹ️ HOW IT WORKS')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

// 1b. #VERIFY-ME New Member Welcome Prompt Card (posted automatically upon member join)
export function buildNewMemberVerifyPromptCard(memberId: string, memberName: string) {
  const embed = new EmbedBuilder()
    .setTitle('⚔️ WELCOME TO JOBLESS EMPIRE')
    .setDescription(
      `Welcome <@${memberId}> (**${memberName}**)!\n\n` +
      `Before entering the Empire, verify the email address used during your application.\n\n` +
      `Your email will be securely matched against our approved whitelist.\n\n` +
      `• Private modal verification\n` +
      `• Automatic role assignment\n` +
      `• Permanent JEMP# sequence allocation\n\n` +
      `*Click the button below to verify immediately.*`
    )
    .setColor(JEMP_COLORS.GOLD_HONOR)
    .setFooter(JEMP_FOOTER);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_verify_email')
      .setLabel('🔐 VERIFY EMAIL')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_how_it_works')
      .setLabel('ℹ️ HOW IT WORKS')
      .setStyle(ButtonStyle.Secondary)
  );

  return { content: `<@${memberId}>`, embeds: [embed], components: [row] };
}

// 2. Email Verified Embed Card (Step 2: Resume Upload unlocked)
export function buildEmailVerifiedCard() {
  const embed = new EmbedBuilder()
    .setTitle('⚔️ IDENTITY VERIFIED')
    .setDescription(
      '✓ **EMAIL VERIFIED**\n\n' +
      'Your application has been verified against the registry.\n\n' +
      '**Next step:**\n' +
      'Upload your current resume to complete your Jobless Empire profile.\n\n' +
      '• Accepted formats: **PDF, DOC, DOCX** (Max 10MB)\n' +
      '• Stored in secure object storage with SHA-256 verification\n' +
      '• Your resume remains strictly private to Empire operations.'
    )
    .setColor(JEMP_COLORS.CANVAS_BLACK)
    .setFooter(JEMP_FOOTER);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_upload_resume')
      .setLabel('📄 UPLOAD RESUME')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

// 3. Final Welcome to the Empire Embed Card
export function buildWelcomeEmpireCard(jempId: string, memberName: string) {
  const embed = new EmbedBuilder()
    .setTitle('⚔️ WELCOME TO THE EMPIRE')
    .setDescription(
      `**IDENTITY VERIFIED**\n\n` +
      `**ID:** \`${jempId}\`\n` +
      `**NAME:** ${memberName}\n` +
      `**STATUS:** \`ACTIVE\`\n\n` +
      `Your profile is ready.\n\n` +
      `Your work starts here. Leave your trail.`
    )
    .setColor(JEMP_COLORS.GOLD_HONOR)
    .setFooter(JEMP_FOOTER);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_view_profile')
      .setLabel('🪪 VIEW PROFILE')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_explore_empire')
      .setLabel('🧭 EXPLORE THE EMPIRE')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

// 4. #profile-manager Member Profile Card
export function buildProfileManagerCard(
  jempId: string,
  status: string,
  resumeVersionText: string,
  timezone?: string
) {
  const embed = new EmbedBuilder()
    .setTitle('⚔️ YOUR JOBLESS EMPIRE PROFILE')
    .setDescription(
      `**IDENTITY:** \`${jempId}\`\n` +
      `**STATUS:** \`${status}\`\n` +
      `**TIMEZONE:** ${timezone || 'Not specified'}\n` +
      `**RESUME:** ${resumeVersionText}\n\n` +
      `*Your proof-of-work trail and ecosystem permissions are synchronized with this record.*`
    )
    .setColor(JEMP_COLORS.CANVAS_BLACK)
    .setFooter(JEMP_FOOTER);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_view_profile')
      .setLabel('🪪 VIEW PROFILE')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_update_resume')
      .setLabel('📄 UPDATE RESUME')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_resume_history')
      .setLabel('🗂️ RESUME HISTORY')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_remove_resume')
      .setLabel('🗑️ REMOVE RESUME')
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row] };
}

// 5. Application Card for #applications channel
export function buildApplicationAdminCard(
  applicationId: string,
  applicantName: string,
  email: string,
  status: string,
  boundDiscordUser?: string
) {
  const embed = new EmbedBuilder()
    .setTitle(`APPLICATION ${applicationId}`)
    .addFields(
      { name: 'Applicant', value: applicantName, inline: true },
      { name: 'Email', value: maskEmail(email), inline: true },
      { name: 'Status', value: `\`${status}\``, inline: true },
      { name: 'Discord Binding', value: boundDiscordUser ? `<@${boundDiscordUser}>` : 'Not linked', inline: false }
    )
    .setColor(status === 'APPROVED' ? JEMP_COLORS.GOLD_HONOR : JEMP_COLORS.SILVER_ACCENT)
    .setFooter(JEMP_FOOTER);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_app_view_${applicationId}`)
      .setLabel('VIEW')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`btn_app_revoke_${applicationId}`)
      .setLabel('REVOKE')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`btn_app_restore_${applicationId}`)
      .setLabel('RESTORE')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}
