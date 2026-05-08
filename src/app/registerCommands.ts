import './env.js';
import { REST, Routes } from 'discord.js';
import { env } from './env.js';
import { verifyCommandData } from '../discord/commands/verify.command.js';
import { gradeCommandData } from '../discord/commands/grade.command.js';
import { adminCommandData } from '../discord/commands/admin.command.js';
import { logger } from '../shared/logger.js';

const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

const commands = [
  verifyCommandData.toJSON(),
  gradeCommandData.toJSON(),
  adminCommandData.toJSON(),
];

logger.info({ count: commands.length }, 'Deploying slash commands…');

await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID), {
  body: commands,
});

logger.info('Slash commands deployed successfully');
