import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  Guild,
  GuildMember,
  PartialGuildMember,
  TextChannel,
  NewsChannel
} from 'discord.js';
import { getConfig } from '../config/index.ts';
import { allCommands } from './commands.ts';
import {
  handleButtonInteraction,
  handleModalSubmission,
  handleChatCommand
} from './interactionHandler.ts';
import {
  buildVerifyMeCard,
  buildProfileManagerCard,
  buildNewMemberVerifyPromptCard
} from './embeds.ts';

class BotService {
  private client: Client | null = null;
  private isConnected = false;
  private connectionError: string | null = null;

  constructor() {
    this.initBot();
  }

  public getStatus() {
    return {
      connected: this.isConnected,
      botTag: this.client?.user?.tag || null,
      botId: this.client?.user?.id || null,
      guildsCount: this.client?.guilds.cache.size || 0,
      error: this.connectionError,
      mode: this.isConnected ? 'LIVE_DISCORD_GATEWAY' : 'WEB_SIMULATOR_AND_API'
    };
  }

  public getClient(): Client | null {
    return this.client;
  }

  public async initBot() {
    const config = getConfig();
    if (!config.discordToken) {
      console.log('[Discord Bot] DISCORD_TOKEN not supplied. Running in high-fidelity Web Simulator & Shared Services API mode.');
      this.connectionError = 'DISCORD_TOKEN is not configured in environment variables.';
      return;
    }

    try {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.GuildMessages
        ],
        partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User]
      });

      this.client.on('ready', async () => {
        this.isConnected = true;
        this.connectionError = null;
        console.log(`[Discord Bot] Logged in as ${this.client?.user?.tag} (ID: ${this.client?.user?.id})`);

        await this.registerSlashCommands();

        // Automatically ensure the persistent Verification Card is posted in #verify-me across all guilds
        await this.ensureVerifyMeCardsAcrossGuilds();
      });

      // -------------------------------------------------------------
      // AUTOMATIC ONBOARDING: EVENT WHEN A NEW MEMBER JOINS
      // -------------------------------------------------------------
      this.client.on('guildMemberAdd', async (member: GuildMember) => {
        console.log(`[Discord Bot] Member joined: ${member.user.tag} (${member.id}) in guild "${member.guild.name}"`);
        await this.handleMemberJoined(member);
      });

      // -------------------------------------------------------------
      // EVENT: WHEN AN EXISTING MEMBER IS ASSIGNED UNVERIFIED ROLE
      // -------------------------------------------------------------
      this.client.on('guildMemberUpdate', async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
        await this.handleMemberUpdated(oldMember, newMember);
      });

      // -------------------------------------------------------------
      // INTERACTION DISPATCHER
      // -------------------------------------------------------------
      this.client.on('interactionCreate', async interaction => {
        try {
          if (interaction.isButton()) {
            await handleButtonInteraction(interaction);
          } else if (interaction.isModalSubmit()) {
            await handleModalSubmission(interaction);
          } else if (interaction.isChatInputCommand()) {
            await handleChatCommand(interaction);
          }
        } catch (err) {
          console.error('[Discord Bot] Interaction handling error:', err);
          if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({
              ephemeral: true,
              content: 'Something went wrong processing your request. Your progress has been preserved.'
            });
          }
        }
      });

      await this.client.login(config.discordToken);
    } catch (err: any) {
      this.isConnected = false;
      this.connectionError = err.message || 'Failed to authenticate with Discord Gateway';
      console.warn('[Discord Bot] Gateway login error:', this.connectionError);
    }
  }

  // -------------------------------------------------------------
  // AUTOMATIC WELCOME & VERIFICATION PROMPT LOGIC
  // -------------------------------------------------------------
  public async handleMemberJoined(member: GuildMember) {
    const config = getConfig();

    // 1. Auto-assign the @unverified role
    try {
      let unverifiedRole = config.unverifiedRoleId
        ? member.guild.roles.cache.get(config.unverifiedRoleId)
        : null;

      if (!unverifiedRole) {
        // Fallback: search role by name (case-insensitive)
        unverifiedRole =
          member.guild.roles.cache.find(
            r => r.name.toLowerCase() === 'unverified' || r.name.toLowerCase().includes('unverified')
          ) || null;
      }

      if (unverifiedRole && !member.roles.cache.has(unverifiedRole.id)) {
        await member.roles.add(unverifiedRole);
        console.log(`[Discord Bot] Auto-assigned role "${unverifiedRole.name}" to new member ${member.user.tag}`);
      }
    } catch (roleErr: any) {
      console.warn(`[Discord Bot] Role assignment warning for ${member.user.tag}:`, roleErr.message);
    }

    // 2. Locate #verify-me text channel in this guild
    const verifyChannel = await this.findVerifyChannel(member.guild);
    if (!verifyChannel) {
      console.warn(`[Discord Bot] Could not locate #verify-me channel in guild "${member.guild.name}". Ensure channel name is "verify-me" or set VERIFY_ME_CHANNEL_ID.`);
      return;
    }

    // 3. Make sure the persistent verification card is already posted
    await this.ensureVerifyMeCard(member.guild, verifyChannel.id);

    // 4. Send direct verification welcome prompt card for the new member
    try {
      const prompt = buildNewMemberVerifyPromptCard(member.id, member.user.username);
      await verifyChannel.send(prompt);
      console.log(`[Discord Bot] Successfully sent personalized verification prompt card for @${member.user.tag} in #${verifyChannel.name}`);
    } catch (sendErr: any) {
      console.error(`[Discord Bot] Failed to send verification card in #${verifyChannel.name}:`, sendErr);
    }
  }

  private async handleMemberUpdated(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember
  ) {
    const config = getConfig();
    const unverifiedRoleId = config.unverifiedRoleId;

    const hadRole = oldMember.roles.cache.some(
      r => r.id === unverifiedRoleId || r.name.toLowerCase() === 'unverified'
    );
    const hasRoleNow = newMember.roles.cache.some(
      r => r.id === unverifiedRoleId || r.name.toLowerCase() === 'unverified'
    );

    // If member just received the @unverified role
    if (!hadRole && hasRoleNow) {
      console.log(`[Discord Bot] Member ${newMember.user.tag} was given @unverified role. Triggering verification card prompt.`);
      const verifyChannel = await this.findVerifyChannel(newMember.guild);
      if (verifyChannel) {
        const prompt = buildNewMemberVerifyPromptCard(newMember.id, newMember.user.username);
        await verifyChannel.send(prompt);
      }
    }
  }

  // -------------------------------------------------------------
  // VERIFICATION CARD MAINTENANCE & POSTING
  // -------------------------------------------------------------
  public async ensureVerifyMeCardsAcrossGuilds() {
    if (!this.client) return;
    for (const [, guild] of this.client.guilds.cache) {
      try {
        await this.ensureVerifyMeCard(guild);
      } catch (e: any) {
        console.warn(`[Discord Bot] Could not auto-maintain verify card in guild "${guild.name}":`, e.message);
      }
    }
  }

  public async findVerifyChannel(guild: Guild, preferredId?: string): Promise<TextChannel | NewsChannel | null> {
    const config = getConfig();
    const targetId = preferredId || config.verifyMeChannelId;

    if (targetId) {
      const ch = guild.channels.cache.get(targetId);
      if (ch && (ch instanceof TextChannel || ch instanceof NewsChannel)) {
        return ch;
      }
    }

    // Search by channel name (fuzzy)
    const matched = guild.channels.cache.find(
      ch =>
        (ch instanceof TextChannel || ch instanceof NewsChannel) &&
        (ch.name.toLowerCase() === 'verify-me' ||
          ch.name.toLowerCase() === 'verify' ||
          ch.name.toLowerCase().includes('verify'))
    );

    return (matched as TextChannel | NewsChannel) || null;
  }

  public async ensureVerifyMeCard(
    guild?: Guild,
    targetChannelId?: string
  ): Promise<{ success: boolean; message: string; channelId?: string; channelName?: string }> {
    if (!this.client || !this.isConnected) {
      return { success: false, message: 'Discord bot gateway is not connected.' };
    }

    const targetGuild = guild || this.client.guilds.cache.first();
    if (!targetGuild) {
      return { success: false, message: 'No Discord guild found. Bot must be in at least one server.' };
    }

    const channel = await this.findVerifyChannel(targetGuild, targetChannelId);
    if (!channel) {
      return {
        success: false,
        message: `No #verify-me channel found in "${targetGuild.name}". Create a text channel named "verify-me" or set VERIFY_ME_CHANNEL_ID in .env.`
      };
    }

    try {
      // Check last 20 messages to see if bot's interactive card is already posted
      const messages = await channel.messages.fetch({ limit: 20 });
      const existingCard = messages.find(
        m =>
          m.author.id === this.client?.user?.id &&
          m.components.some((row: any) =>
            Array.isArray(row.components) &&
            row.components.some((btn: any) => btn.customId === 'btn_verify_email')
          )
      );

      if (existingCard) {
        return {
          success: true,
          message: `Active Email Verification Card already present in #${channel.name}`,
          channelId: channel.id,
          channelName: channel.name
        };
      }

      // Card is not present: Post fresh persistent card!
      const card = buildVerifyMeCard();
      const sent = await channel.send(card);

      try {
        await sent.pin();
      } catch {
        // Pinning might be missing MANAGE_MESSAGES permission, safely ignore
      }

      console.log(`[Discord Bot] Auto-posted persistent Email Verification Card to #${channel.name} (${channel.id})`);
      return {
        success: true,
        message: `Successfully posted permanent Email Verification Card to #${channel.name}!`,
        channelId: channel.id,
        channelName: channel.name
      };
    } catch (err: any) {
      console.error(`[Discord Bot] Error ensuring verify card in #${channel.name}:`, err);
      return { success: false, message: err.message || 'Failed to post verification card.' };
    }
  }

  public async postVerifyCardToChannel(
    channelId?: string
  ): Promise<{ success: boolean; message: string; channelId?: string; channelName?: string }> {
    if (!this.client || !this.isConnected) {
      return { success: false, message: 'Discord bot gateway is not connected.' };
    }

    let channel: TextChannel | NewsChannel | null = null;

    if (channelId) {
      const fetched = await this.client.channels.fetch(channelId).catch(() => null);
      if (fetched && (fetched instanceof TextChannel || fetched instanceof NewsChannel)) {
        channel = fetched;
      }
    }

    if (!channel) {
      const guild = this.client.guilds.cache.first();
      if (!guild) {
        return { success: false, message: 'Bot is not in any server.' };
      }
      channel = await this.findVerifyChannel(guild);
    }

    if (!channel) {
      return {
        success: false,
        message: 'Could not find target channel. Please provide a valid channel ID or create #verify-me.'
      };
    }

    try {
      const card = buildVerifyMeCard();
      const sent = await channel.send(card);
      try {
        await sent.pin();
      } catch {
        // Pinning optional
      }
      return {
        success: true,
        message: `Successfully posted Email Verification Card to #${channel.name} (${channel.id})`,
        channelId: channel.id,
        channelName: channel.name
      };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to send message.' };
    }
  }

  public async postProfileCardToChannel(
    channelId?: string
  ): Promise<{ success: boolean; message: string }> {
    if (!this.client || !this.isConnected) {
      return { success: false, message: 'Discord bot gateway is not connected.' };
    }

    let channel: TextChannel | NewsChannel | null = null;
    if (channelId) {
      const fetched = await this.client.channels.fetch(channelId).catch(() => null);
      if (fetched && (fetched instanceof TextChannel || fetched instanceof NewsChannel)) {
        channel = fetched;
      }
    }

    if (!channel) {
      const guild = this.client.guilds.cache.first();
      if (!guild) return { success: false, message: 'Bot is not in any server.' };
      const matched = guild.channels.cache.find(
        ch =>
          (ch instanceof TextChannel || ch instanceof NewsChannel) &&
          (ch.name.toLowerCase() === 'profile-manager' || ch.name.toLowerCase().includes('profile'))
      );
      channel = (matched as TextChannel | NewsChannel) || null;
    }

    if (!channel) {
      return { success: false, message: 'Could not locate #profile-manager channel.' };
    }

    const card = buildProfileManagerCard('JEMP#SAMPLE', 'ACTIVE', 'v1 (active)', 'America/New_York');
    await channel.send(card);
    return { success: true, message: `Posted Profile Card to #${channel.name}` };
  }

  private async registerSlashCommands() {
    const config = getConfig();
    if (!config.discordToken || !config.discordClientId) return;

    try {
      const rest = new REST({ version: '10' }).setToken(config.discordToken);
      const body = allCommands.map(c => c.toJSON());

      if (config.discordGuildId) {
        console.log(`[Discord Bot] Registering guild slash commands to guild ${config.discordGuildId}...`);
        await rest.put(
          Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId),
          { body }
        );
      } else {
        console.log('[Discord Bot] Registering global slash commands...');
        await rest.put(
          Routes.applicationCommands(config.discordClientId),
          { body }
        );
      }
      console.log('[Discord Bot] Slash commands registered successfully.');
    } catch (err) {
      console.error('[Discord Bot] Failed to register slash commands:', err);
    }
  }
}

export const botService = new BotService();
