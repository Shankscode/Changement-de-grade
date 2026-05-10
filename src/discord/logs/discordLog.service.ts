import type { Client, TextChannel } from 'discord.js';
import { logger } from '../../shared/logger.js';

export class DiscordLogService {
  private channel: TextChannel | null = null;

  constructor(
    private readonly client: Client,
    private readonly channelId: string | undefined,
  ) {}

  async init(): Promise<void> {
    if (!this.channelId) return;

    try {
      const ch = await this.client.channels.fetch(this.channelId);
      if (ch?.isTextBased() && 'send' in ch) {
        this.channel = ch as TextChannel;
      }
    } catch (err) {
      logger.warn({ err, channelId: this.channelId }, 'Failed to fetch Discord log channel');
    }
  }

  private async send(content: string): Promise<void> {
    if (!this.channel) return;
    try {
      await this.channel.send(content);
    } catch (err) {
      logger.warn({ err }, 'Failed to send Discord log message');
    }
  }

  async logVerificationSuccess(
    discordUserId: string,
    tag: string,
    name: string,
    trophies: number,
    threshold: number | null,
    wasTransfer: boolean,
  ): Promise<void> {
    const grade = threshold ? `Grade **${threshold.toLocaleString()}**` : 'No grade (under 10 000)';
    const transfer = wasTransfer ? ' *(automatic transfer)*' : '';
    await this.send(
      `✅ **Verified** <@${discordUserId}> → \`${tag}\` (${name}) — ${trophies.toLocaleString()} trophies — ${grade}${transfer}`,
    );
  }

  async logVerificationFailed(discordUserId: string, tag: string): Promise<void> {
    await this.send(
      `❌ **Verification failed** <@${discordUserId}> — tag \`${tag}\` — favourite brawler did not match`,
    );
  }

  async logChallengeCreated(
    discordUserId: string,
    tag: string,
    brawlerName: string,
    expiresAt: Date,
  ): Promise<void> {
    logger.info({ discordUserId, tag, brawlerName }, 'Challenge created');
    // Not sent to Discord to avoid spoiling — only in local logs
  }

  async logChallengeExpired(discordUserId: string): Promise<void> {
    await this.send(`⏰ **Challenge expired** for <@${discordUserId}>`);
  }

  async logAutomaticTransfer(
    oldDiscordUserId: string,
    newDiscordUserId: string,
    tag: string,
  ): Promise<void> {
    await this.send(
      `🔄 **Automatic transfer** \`${tag}\` — from <@${oldDiscordUserId}> to <@${newDiscordUserId}>`,
    );
  }

  async logRoleAdded(discordUserId: string, roleName: string): Promise<void> {
    await this.send(`➕ **Role added** \`${roleName}\` → <@${discordUserId}>`);
  }

  async logRoleRemoved(discordUserId: string, roleName: string): Promise<void> {
    await this.send(`➖ **Role removed** \`${roleName}\` from <@${discordUserId}>`);
  }

  async logRoleNotFound(discordUserId: string, threshold: number): Promise<void> {
    await this.send(
      `⚠️ **Role not found** for threshold \`${threshold.toLocaleString()}\` — could not assign role to <@${discordUserId}>`,
    );
  }

  async logPermissionError(discordUserId: string, roleName: string): Promise<void> {
    await this.send(
      `🔒 **Permission error** — bot cannot manage role \`${roleName}\` for <@${discordUserId}>`,
    );
  }

  async logAdminUnlink(adminId: string, targetUserId: string, tag: string): Promise<void> {
    await this.send(
      `🔗 **Admin unlink** by <@${adminId}> — <@${targetUserId}> unlinked from \`${tag}\``,
    );
  }

  async logUnexpectedError(context: string, err: unknown): Promise<void> {
    const msg = err instanceof Error ? err.message : String(err);
    await this.send(`🆘 **Unexpected error** in \`${context}\`: ${msg}`);
  }

  async logBrawlStarsApiError(context: string, tag: string, err: unknown): Promise<void> {
    const msg = err instanceof Error ? err.message : String(err);
    await this.send(
      `🌐 **Brawl Stars API error** in \`${context}\` for tag \`${tag}\`: ${msg}`,
    );
  }
}
