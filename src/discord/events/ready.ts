import type { Client } from 'discord.js';
import { logger } from '../../shared/logger.js';
import type { DiscordLogService } from '../logs/discordLog.service.js';

export function registerReadyEvent(client: Client, discordLog: DiscordLogService): void {
  client.once('ready', async (c) => {
    logger.info({ tag: c.user.tag }, 'Bot ready');
    await discordLog.init();
    logger.info('Discord log service initialized');
  });
}
