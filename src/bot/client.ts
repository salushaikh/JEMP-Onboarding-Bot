import { Client, GatewayIntentBits, Partials, REST, Routes } from 'discord.js';
import { getConfig } from '../config/index.ts';
import { allCommands } from './commands.ts';
import {
  handleButtonInteraction,
  handleModalSubmission,
  handleChatCommand
} from './interactionHandler.ts';
import { buildVerifyMeCard, buildProfileManagerCard } from './embeds.ts';

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
        partials: [Partials.Channel, Partials.Message]
      });

      this.client.on('ready', async () => {
        this.isConnected = true;
        this.connectionError = null;
        console.log(`[Discord Bot] Logged in as ${this.client?.user?.tag} (ID: ${this.client?.user?.id})`);

        await this.registerSlashCommands();
      });

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
          if (interaction.isRepliable() && !interaction.replied) {
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
