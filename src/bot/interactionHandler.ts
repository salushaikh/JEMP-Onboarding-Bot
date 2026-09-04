import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder
} from 'discord.js';
import {
  verifyApplicationEmail,
  addApprovedApplication,
  revokeApprovedApplication,
  restoreApprovedApplication,
  getMembership,
  addResume,
  removeResume,
  completeOnboardingStep,
  activateMembership,
  suspendMembership,
  restoreMembership,
  terminateMembership,
  getResumeHistory
} from '../services/sharedServices.ts';
import { runReconciliationScan, executeSafeRepair } from '../services/reconciliationService.ts';
import { dbManager } from '../database/index.ts';
import {
  buildVerifyMeCard,
  buildEmailVerifiedCard,
  buildWelcomeEmpireCard,
  buildProfileManagerCard,
  JEMP_COLORS,
  JEMP_FOOTER
} from './embeds.ts';
import { botService } from './client.ts';
import { maskEmail } from '../security/index.ts';
import { OnboardingStep, MembershipState } from '../types.ts';
import { getConfig } from '../config/index.ts';

// 1. BUTTON INTERACTIONS
export async function handleButtonInteraction(interaction: ButtonInteraction) {
  const customId = interaction.customId;

  if (customId === 'btn_verify_email') {
    // Only users with @unverified role need verification; if already a verified member:
    if (interaction.inGuild() && interaction.member) {
      const config = getConfig();
      const memberRoles = (interaction.member as any).roles?.cache;
      if (memberRoles) {
        const isMember = memberRoles.some(
          (r: any) => r.id === config.memberRoleId || r.name.toLowerCase() === 'member'
        );
        const isUnverified = memberRoles.some(
          (r: any) => r.id === config.unverifiedRoleId || r.name.toLowerCase() === 'unverified'
        );
        if (isMember && !isUnverified) {
          await interaction.reply({
            ephemeral: true,
            content: '✓ You are already a verified **@Member** of Jobless Empire. Your identity is active and your onboarding is complete!'
          });
          return;
        }
      }
    }

    // Open private modal
    const modal = new ModalBuilder()
      .setCustomId('modal_verify_email')
      .setTitle('Jobless Empire Identity Verification');

    const emailInput = new TextInputBuilder()
      .setCustomId('input_application_email')
      .setLabel('Email used for your application')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('name@domain.com')
      .setRequired(true)
      .setMaxLength(255);

    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(emailInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
    return;
  }

  if (customId === 'btn_how_it_works') {
    await interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setTitle('⚔️ HOW JOBLESS EMPIRE ONBOARDING WORKS')
          .setDescription(
            '**1. Website Application**\nSubmit your work history and background at despair.us.\n\n' +
            '**2. Admin Review & Whitelist**\nAdmins review and approve qualified builders.\n\n' +
            '**3. Discord Identity Verification**\nVerify the email submitted with your approved application.\n\n' +
            '**4. Resume Upload & Storage**\nAfter email verification, securely upload your current resume.\n\n' +
            '**5. Rules & Identity**\nAgree to community standards, confirm your timezone, and receive your permanent JEMP# proof-of-work identifier.'
          )
          .setColor(JEMP_COLORS.CANVAS_BLACK)
          .setFooter(JEMP_FOOTER)
      ]
    });
    return;
  }

  if (customId === 'btn_view_profile') {
    const { member, resume } = await getMembership(interaction.user.id);
    if (!member) {
      await interaction.reply({
        ephemeral: true,
        content: 'No Jobless Empire profile found for this Discord account. Please complete verification in #verify-me.'
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ MEMBER PROFILE — ${member.jempId || 'ONBOARDING'}`)
      .addFields(
        { name: 'Member Name', value: member.name, inline: true },
        { name: 'Permanent JEMP#', value: member.jempId ? `\`${member.jempId}\`` : 'Pending Activation', inline: true },
        { name: 'Status', value: `\`${member.membershipStatus}\``, inline: true },
        { name: 'Timezone', value: member.timezone || 'Not set', inline: true },
        { name: 'Current Resume', value: resume ? `v${resume.version} (${resume.filename})` : 'None active', inline: true },
        { name: 'Rules Accepted', value: member.rulesAcceptedAt ? `✓ (${member.rulesVersionAccepted})` : 'Pending', inline: true }
      )
      .setColor(JEMP_COLORS.GOLD_HONOR)
      .setFooter(JEMP_FOOTER);

    await interaction.reply({ ephemeral: true, embeds: [embed] });
    return;
  }

  if (customId === 'btn_resume_history') {
    const { member } = await getMembership(interaction.user.id);
    if (!member) {
      await interaction.reply({ ephemeral: true, content: 'Member profile not found.' });
      return;
    }
    const history = await getResumeHistory(member.id);
    if (history.length === 0) {
      await interaction.reply({ ephemeral: true, content: 'No resume history found on record.' });
      return;
    }

    const description = history
      .map(
        h =>
          `• **v${h.version}** — \`${h.status}\` — ${h.filename} (${Math.round(h.fileSize / 1024)} KB)\n` +
          `  *Uploaded: ${new Date(h.uploadedAt).toLocaleDateString()} | SHA-256: \`${h.sha256Hash.substring(0, 12)}...\`*`
      )
      .join('\n\n');

    const embed = new EmbedBuilder()
      .setTitle('🗂️ RESUME REVISION HISTORY')
      .setDescription(description)
      .setColor(JEMP_COLORS.CANVAS_BLACK)
      .setFooter(JEMP_FOOTER);

    await interaction.reply({ ephemeral: true, embeds: [embed] });
    return;
  }

  if (customId === 'btn_remove_resume') {
    const res = await removeResume(interaction.user.id);
    if (!res.success) {
      await interaction.reply({ ephemeral: true, content: res.error || 'Failed to remove resume.' });
      return;
    }
    await interaction.reply({
      ephemeral: true,
      content: `✓ Current resume (v${res.removedVersion}) has been archived and removed from your active profile. You may upload a new resume at any time.`
    });
    return;
  }

  if (customId === 'btn_upload_resume') {
    await interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setTitle('📄 UPLOAD RESUME — DISCORD INSTRUCTIONS')
          .setDescription(
            'To submit your resume:\n\n' +
            '1. In any command channel or DM, run:\n' +
            '   `/resume add file:<attach your PDF or DOCX file>`\n\n' +
            '2. The bot securely calculates your SHA-256 fingerprint, stores the encrypted file in object storage, and updates your profile record.\n\n' +
            '• Accepted formats: **PDF, DOC, DOCX** (Max 10MB)\n' +
            '• Stored with cryptographic SHA-256 verification\n' +
            '• Remains private to Jobless Empire internal systems'
          )
          .setColor(JEMP_COLORS.CANVAS_BLACK)
          .setFooter(JEMP_FOOTER)
      ]
    });
    return;
  }

  if (customId === 'btn_explore_empire') {
    await interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setTitle('🧭 ENTERING THE JOBLESS EMPIRE')
          .setDescription(
            '**Next Steps & Key Resources:**\n\n' +
            '• **#profile-manager**: View and manage your permanent JEMP# proof-of-work identity, active resume, and timezone settings.\n' +
            '• **Community Channels**: Introduce yourself, share proof-of-work repositories, and collaborate with verified builders.\n' +
            '• **Commands**: Run `/membership status` or `/profile status` anytime to view your record.'
          )
          .setColor(JEMP_COLORS.GOLD_HONOR)
          .setFooter(JEMP_FOOTER)
      ]
    });
    return;
  }
}

// 2. MODAL SUBMISSIONS
export async function handleModalSubmission(interaction: ModalSubmitInteraction) {
  if (interaction.customId === 'modal_verify_email') {
    const rawEmail = interaction.fields.getTextInputValue('input_application_email');
    await interaction.deferReply({ ephemeral: true });

    const result = await verifyApplicationEmail(interaction.user.id, rawEmail);
    if (!result.success) {
      await interaction.editReply({ content: result.error });
      return;
    }

    // Role Promotion in Discord: remove @Unverified, assign @Member
    let roleStatusText = '';
    if (interaction.inGuild() && interaction.guild) {
      const roleRes = await botService.promoteMemberFromUnverifiedToMember(interaction.guild, interaction.user.id);
      if (roleRes.success) {
        roleStatusText = '• Server Role: Removed **@Unverified** &rarr; Assigned **@Member**\n';
      }
    }

    // Allocate permanent sequential JEMP# identifier if not yet assigned
    const { member } = await getMembership(interaction.user.id);
    let jempIdText = '';
    if (member) {
      if (!member.jempId) {
        member.jempId = await dbManager.allocateNextJempId();
        member.membershipStatus = MembershipState.ACTIVE;
        member.updatedAt = new Date().toISOString();
        await dbManager.saveMember(member);
      }
      jempIdText = member.jempId;
    }

    // Success! Show Verified card with Resume upload instructions (strictly private & ephemeral)
    const card = buildEmailVerifiedCard();
    await interaction.editReply({
      content:
        `✓ **Identity confirmed against approved application whitelist.**\n` +
        roleStatusText +
        (jempIdText ? `• Your Permanent Identity: **${jempIdText}**\n` : '') +
        `• Next step: Upload your resume below to complete your profile record.`,
      embeds: card.embeds,
      components: card.components
    });
  }
}

// 3. SLASH COMMANDS
export async function handleChatCommand(interaction: ChatInputCommandInteraction) {
  const { commandName } = interaction;

  if (commandName === 'onboard') {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'add') {
      const email = interaction.options.getString('email', true);
      const name = interaction.options.getString('applicant_name', true);
      const appId = interaction.options.getString('application_id', true);
      const notes = interaction.options.getString('notes') || undefined;
      const expiration = interaction.options.getString('expiration') || undefined;

      const res = await addApprovedApplication(interaction.user.tag, {
        applicationId: appId,
        applicantName: name,
        email,
        notes,
        expiration
      });

      if (!res.success) {
        await interaction.reply({ ephemeral: true, content: `Error: ${res.error}` });
        return;
      }

      await interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setTitle('✓ APPLICANT WHITELISTED')
            .setDescription(
              `Application **${appId}** for **${name}** has been approved for Discord onboarding.\n\n` +
              `• Email: \`${maskEmail(email)}\`\n` +
              `• Status: \`APPROVED\`\n` +
              `• Whitelisted By: ${interaction.user.tag}`
            )
            .setColor(JEMP_COLORS.GOLD_HONOR)
            .setFooter(JEMP_FOOTER)
        ]
      });
      return;
    }

    if (subcommand === 'reconcile') {
      await interaction.deferReply({ ephemeral: true });
      const report = await runReconciliationScan();

      const embed = new EmbedBuilder()
        .setTitle('⚔️ RECONCILIATION SCAN REPORT')
        .setDescription(
          `**Members Scanned:** ${report.totalMembersChecked}\n` +
          `**Anomalies Found:** ${report.anomaliesFound}\n\n` +
          (report.anomalies.length > 0
            ? report.anomalies.map(a => `• **[${a.severity}]** ${a.description}\n  *Suggested Fix: ${a.suggestedFix}*`).join('\n')
            : '✓ All records synchronized. Database, JEMP# sequences, and Timeline events are fully consistent.')
        )
        .setColor(report.anomaliesFound > 0 ? JEMP_COLORS.CRIMSON_ALERT : JEMP_COLORS.GOLD_HONOR)
        .setFooter(JEMP_FOOTER);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'dashboard') {
      const status = dbManager.getStatus();
      const apps = await dbManager.listApplications();
      const approvedCount = apps.filter(a => a.status === 'APPROVED').length;
      const pendingCount = apps.filter(a => a.status === 'PENDING').length;

      const embed = new EmbedBuilder()
        .setTitle('⚔️ JOBLESS EMPIRE ONBOARDING DASHBOARD')
        .addFields(
          { name: 'System of Record', value: status.type, inline: true },
          { name: 'Total Members', value: String(status.membersCount), inline: true },
          { name: 'Last Allocated JEMP#', value: `JEMP#${String(status.currentJempSequence).padStart(3, '0')}`, inline: true },
          { name: 'Approved Whitelist', value: String(approvedCount), inline: true },
          { name: 'Pending Applications', value: String(pendingCount), inline: true },
          { name: 'Resumes Stored', value: String(status.resumesCount), inline: true },
          { name: 'Timeline Events', value: String(status.timelineEventsCount), inline: true },
          { name: 'Audit Entries', value: String(status.auditLogsCount), inline: true }
        )
        .setColor(JEMP_COLORS.CANVAS_BLACK)
        .setFooter(JEMP_FOOTER);

      await interaction.reply({ ephemeral: true, embeds: [embed] });
      return;
    }

    if (subcommand === 'seed-demo') {
      await dbManager.seedDemoData();
      await interaction.reply({
        ephemeral: true,
        content: '✓ Demo data seeded: APP#DEMO-001 (alex), APP#DEMO-002 (samantha), APP#DEMO-003 (marcus), and JEMP#001 (elena).'
      });
      return;
    }

    if (subcommand === 'clear-demo') {
      await dbManager.clearDemoData();
      await interaction.reply({
        ephemeral: true,
        content: '✓ All demo records successfully cleared from the database.'
      });
      return;
    }

    if (subcommand === 'post-verify-card') {
      const targetChannel = interaction.options.getChannel('channel');
      await interaction.deferReply({ ephemeral: true });
      const res = await botService.postVerifyCardToChannel(targetChannel ? targetChannel.id : undefined);
      await interaction.editReply({
        content: res.success ? `✓ ${res.message}` : `⚠️ ${res.message}`
      });
      return;
    }

    if (subcommand === 'post-profile-card') {
      const targetChannel = interaction.options.getChannel('channel');
      await interaction.deferReply({ ephemeral: true });
      const res = await botService.postProfileCardToChannel(targetChannel ? targetChannel.id : undefined);
      await interaction.editReply({
        content: res.success ? `✓ ${res.message}` : `⚠️ ${res.message}`
      });
      return;
    }
  }

  if (commandName === 'verify') {
    // Only users with @unverified role need verification; if already a member:
    if (interaction.inGuild() && interaction.member) {
      const config = getConfig();
      const memberRoles = (interaction.member as any).roles?.cache;
      if (memberRoles) {
        const isMember = memberRoles.some(
          (r: any) => r.id === config.memberRoleId || r.name.toLowerCase() === 'member'
        );
        const isUnverified = memberRoles.some(
          (r: any) => r.id === config.unverifiedRoleId || r.name.toLowerCase() === 'unverified'
        );
        if (isMember && !isUnverified) {
          await interaction.reply({
            ephemeral: true,
            content: '✓ You are already a verified **@Member** of Jobless Empire. Your identity is active and your onboarding is complete!'
          });
          return;
        }
      }
    }

    const card = buildVerifyMeCard();
    await interaction.reply({
      ephemeral: true,
      embeds: card.embeds,
      components: card.components
    });
    return;
  }

  // /resume (Manage member resume metadata & file storage)
  if (commandName === 'resume') {
    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: true });

    if (subcommand === 'add' || subcommand === 'update') {
      const attachment = interaction.options.getAttachment('file', true);

      // Verify file extension
      const filename = attachment.name.toLowerCase();
      const allowedExtensions = ['.pdf', '.doc', '.docx'];
      const isAllowed = allowedExtensions.some(ext => filename.endsWith(ext));
      if (!isAllowed) {
        await interaction.editReply({
          content: '⚠️ Invalid file type. Please attach a valid **PDF**, **DOC**, or **DOCX** file.'
        });
        return;
      }

      // Verify file size limit (10MB)
      if (attachment.size > 10 * 1024 * 1024) {
        await interaction.editReply({
          content: '⚠️ File size exceeds the 10MB limit. Please upload a smaller file.'
        });
        return;
      }

      // Download file buffer from Discord CDN
      let buffer: Buffer;
      try {
        const resp = await fetch(attachment.url);
        if (!resp.ok) {
          throw new Error(`Discord CDN returned status ${resp.status} ${resp.statusText}`);
        }
        const arrayBuf = await resp.arrayBuffer();
        buffer = Buffer.from(arrayBuf);
      } catch (fetchErr: any) {
        console.error('[Discord Bot] Error downloading resume attachment:', fetchErr);
        await interaction.editReply({
          content: '⚠️ Could not retrieve the attached file from Discord. Please try running `/resume add` again.'
        });
        return;
      }

      // Process and store resume
      const res = await addResume(
        interaction.user.id,
        attachment.name,
        attachment.contentType || 'application/pdf',
        buffer
      );

      if (!res.success) {
        await interaction.editReply({
          content: `⚠️ Resume upload failed: ${res.error}`
        });
        return;
      }

      const resume = res.resume!;
      const embed = new EmbedBuilder()
        .setTitle('✓ RESUME UPLOADED & SECURED')
        .setDescription(
          `Your resume has been cryptographically hashed and linked to your private member identity.\n\n` +
          `• **Filename**: \`${resume.filename}\`\n` +
          `• **Version**: \`v${resume.version}\` (Active)\n` +
          `• **File Size**: \`${(resume.fileSize / 1024).toFixed(1)} KB\`\n` +
          `• **SHA-256 Fingerprint**: \`${resume.sha256Hash}\`\n` +
          `• **Storage Provider**: \`${resume.storageProvider}\`\n` +
          `• **Privacy**: Encrypted; accessible solely to internal Jobless Empire systems.`
        )
        .setColor(JEMP_COLORS.GOLD_HONOR)
        .setFooter(JEMP_FOOTER);

      await interaction.editReply({
        embeds: [embed]
      });
      return;
    }

    if (subcommand === 'view') {
      const { member, resume } = await getMembership(interaction.user.id);
      if (!member || !resume) {
        await interaction.editReply({
          content: 'No active resume found. Submit one using `/resume add file:<attach your PDF or DOCX file>`.'
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('📄 YOUR ACTIVE RESUME')
        .setDescription(
          `**Member Identifier**: \`${member.jempId || 'Onboarding'}\`\n\n` +
          `• **Filename**: \`${resume.filename}\`\n` +
          `• **Version**: \`v${resume.version}\` (Current)\n` +
          `• **Uploaded**: \`${new Date(resume.uploadedAt).toLocaleDateString()}\`\n` +
          `• **Size**: \`${(resume.fileSize / 1024).toFixed(1)} KB\`\n` +
          `• **SHA-256 Fingerprint**: \`${resume.sha256Hash}\``
        )
        .setColor(JEMP_COLORS.CANVAS_BLACK)
        .setFooter(JEMP_FOOTER);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'history') {
      const { member } = await getMembership(interaction.user.id);
      if (!member) {
        await interaction.editReply({ content: 'No membership profile found.' });
        return;
      }

      const history = await getResumeHistory(interaction.user.id);
      if (history.length === 0) {
        await interaction.editReply({ content: 'No resume history recorded.' });
        return;
      }

      const lines = history.map(
        r => `• **v${r.version}** — \`${r.filename}\` (${r.status}) [${new Date(r.uploadedAt).toLocaleDateString()}]`
      );

      const embed = new EmbedBuilder()
        .setTitle('📜 RESUME VERSION HISTORY')
        .setDescription(lines.join('\n'))
        .setColor(JEMP_COLORS.CANVAS_BLACK)
        .setFooter(JEMP_FOOTER);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (subcommand === 'remove') {
      const res = await removeResume(interaction.user.id);
      if (!res.success) {
        await interaction.editReply({ content: res.error || 'Failed to remove resume.' });
        return;
      }
      await interaction.editReply({
        content: `✓ Current resume (v${res.removedVersion}) has been archived and removed from your active profile.`
      });
      return;
    }
  }

  // /profile (View private member profile & identity)
  if (commandName === 'profile') {
    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: true });

    const { member, resume } = await getMembership(interaction.user.id);
    if (!member) {
      await interaction.editReply({
        content: 'No membership profile found. Please complete email verification in #verify-me.'
      });
      return;
    }

    if (subcommand === 'status') {
      const card = buildProfileManagerCard(
        member.jempId || 'JEMP#PENDING',
        member.membershipStatus,
        resume ? `v${resume.version} (${resume.filename})` : 'None uploaded',
        member.timezone || 'Not set'
      );
      await interaction.editReply({
        embeds: card.embeds,
        components: card.components
      });
      return;
    }

    if (subcommand === 'resume') {
      if (!resume) {
        await interaction.editReply({
          content: 'No resume currently attached to your profile. Use `/resume add file:<attach>` to upload.'
        });
        return;
      }
      await interaction.editReply({
        content: `📄 **Active Resume**: \`${resume.filename}\` (v${resume.version}) | SHA-256: \`${resume.sha256Hash.substring(0, 16)}...\``
      });
      return;
    }
  }

  // /membership (Status, timezone, and onboarding help)
  if (commandName === 'membership') {
    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: true });

    const { member, resume } = await getMembership(interaction.user.id);
    if (!member) {
      await interaction.editReply({
        content: 'No membership record found. Visit #verify-me to begin onboarding.'
      });
      return;
    }

    if (subcommand === 'status') {
      const card = buildProfileManagerCard(
        member.jempId || 'JEMP#PENDING',
        member.membershipStatus,
        resume ? `v${resume.version} (${resume.filename})` : 'None uploaded',
        member.timezone || 'Not set'
      );
      await interaction.editReply({
        embeds: card.embeds,
        components: card.components
      });
      return;
    }

    if (subcommand === 'timezone') {
      const tz = interaction.options.getString('iana_timezone', true);
      member.timezone = tz;
      member.updatedAt = new Date().toISOString();
      await dbManager.saveMember(member);

      await interaction.editReply({
        content: `✓ Timezone updated to \`${tz}\`.`
      });
      return;
    }

    if (subcommand === 'help') {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('⚔️ JOBLESS EMPIRE MEMBER HELP')
            .setDescription(
              '• **/resume add file:<attach>**: Upload or update your resume (PDF/DOC/DOCX).\n' +
              '• **/profile status**: View your private member card and proof-of-work status.\n' +
              '• **/membership timezone**: Set your primary timezone.\n' +
              '• **#verify-me**: Identity verification gateway for incoming applicants.'
            )
            .setColor(JEMP_COLORS.GOLD_HONOR)
            .setFooter(JEMP_FOOTER)
        ]
      });
      return;
    }
  }
}
