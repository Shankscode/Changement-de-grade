import './env.js';
import { env } from './env.js';
import { logger } from '../shared/logger.js';
import { createDiscordClient } from '../discord/client.js';
import { db } from '../db/client.js';
import { BrawlerNameService } from '../modules/brawlstars/brawlerName.service.js';
import { BrawlStarsClient } from '../modules/brawlstars/brawlstars.client.js';
import { GradeRepository } from '../modules/grades/grade.repository.js';
import { VerificationRepository } from '../modules/verification/verification.repository.js';
import { RoleAssignmentRepository } from '../modules/discordRoles/roleAssignment.repository.js';
import { RoleAssignmentService } from '../modules/discordRoles/roleAssignment.service.js';
import { VerificationService } from '../modules/verification/verification.service.js';
import { BatchRefreshService } from '../modules/refresh/batchRefresh.service.js';
import { DiscordLogService } from '../discord/logs/discordLog.service.js';
import { registerReadyEvent } from '../discord/events/ready.js';
import { registerInteractionCreateEvent } from '../discord/events/interactionCreate.js';

// Load brawler names before starting
const brawlerNames = new BrawlerNameService();
await brawlerNames.init();

const client = createDiscordClient();

// Repositories
const gradeRepo = new GradeRepository(db);
const verifyRepo = new VerificationRepository(db);
const roleAssignmentRepo = new RoleAssignmentRepository(db);

// Services
const discordLog = new DiscordLogService(client, env.DISCORD_LOG_CHANNEL_ID);
const brawlStars = new BrawlStarsClient(brawlerNames, env.RNT_API_KEY);
const roleService = new RoleAssignmentService(gradeRepo, roleAssignmentRepo, discordLog);
const verificationService = new VerificationService(verifyRepo, brawlStars, roleService, discordLog);
const batchRefresh = new BatchRefreshService(brawlStars, verifyRepo, roleService, gradeRepo, discordLog);

// Events
registerReadyEvent(client, discordLog);
registerInteractionCreateEvent(
  client,
  verificationService,
  gradeRepo,
  verifyRepo,
  roleService,
  brawlStars,
  discordLog,
  batchRefresh,
);

// Auto-refresh
if (env.REFRESH_INTERVAL_HOURS > 0) {
  const intervalMs = env.REFRESH_INTERVAL_HOURS * 3600 * 1000;

  client.once('ready', () => {
    // First run after bot is ready
    setTimeout(async () => {
      await runAutoRefresh();
    }, 60_000); // Wait 1 min after start to let everything settle

    // Then repeat on the configured interval
    setInterval(async () => {
      await runAutoRefresh();
    }, intervalMs);

    logger.info(
      { intervalHours: env.REFRESH_INTERVAL_HOURS },
      'Auto-refresh planifié',
    );
  });
}

async function runAutoRefresh(): Promise<void> {
  const guild = client.guilds.cache.get(env.DISCORD_GUILD_ID);
  if (!guild) {
    logger.warn({ guildId: env.DISCORD_GUILD_ID }, 'Auto-refresh : serveur introuvable');
    return;
  }

  const guildRow = await gradeRepo.getGuildByDiscordId(env.DISCORD_GUILD_ID);
  if (!guildRow) {
    logger.warn('Auto-refresh : aucun serveur en DB, skip');
    return;
  }

  logger.info('Auto-refresh démarré');
  const result = await batchRefresh.run({ dryRun: false, guild, guildDbId: guildRow.id });
  logger.info(result, 'Auto-refresh terminé');
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM reçu — arrêt en cours');
  client.destroy();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT reçu — arrêt en cours');
  client.destroy();
  process.exit(0);
});

logger.info('Connexion à Discord…');
await client.login(env.DISCORD_TOKEN);
