import type { Guild } from 'discord.js';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { accountLinks } from '../../db/schema.js';
import { getGradeThreshold, applyGradeRuleNeverLose } from '../grades/grade.service.js';
import type { BrawlStarsClient } from '../brawlstars/brawlstars.client.js';
import type { VerificationRepository } from '../verification/verification.repository.js';
import type { RoleAssignmentService } from '../discordRoles/roleAssignment.service.js';
import type { GradeRepository } from '../grades/grade.repository.js';
import type { DiscordLogService } from '../../discord/logs/discordLog.service.js';
import { logger } from '../../shared/logger.js';

const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES_MS = 1200; // ~50 req/min, safe for the API

export interface BatchRefreshOptions {
  dryRun: boolean;
  guild: Guild;
  guildDbId: number;
}

export interface BatchRefreshResult {
  processed: number;
  updated: number;
  skipped: number;
  errors: number;
}

export class BatchRefreshService {
  constructor(
    private readonly brawlStars: BrawlStarsClient,
    private readonly verifyRepo: VerificationRepository,
    private readonly roleService: RoleAssignmentService,
    private readonly gradeRepo: GradeRepository,
    private readonly discordLog: DiscordLogService,
  ) {}

  async run(opts: BatchRefreshOptions): Promise<BatchRefreshResult> {
    const { dryRun, guild, guildDbId } = opts;
    const result: BatchRefreshResult = { processed: 0, updated: 0, skipped: 0, errors: 0 };

    const allLinks = await db.query.accountLinks.findMany({
      where: and(eq(accountLinks.guildId, guildDbId), eq(accountLinks.active, true)),
      with: { player: true, discordAccount: true },
    });

    logger.info(
      { total: allLinks.length, dryRun },
      'Batch refresh démarré',
    );

    for (let i = 0; i < allLinks.length; i += BATCH_SIZE) {
      const batch = allLinks.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (link) => {
          try {
            const freshProfile = await this.brawlStars.fetchPlayerByTag(link.player.brawlTag);
            const updatedTrophies = Math.max(link.player.highestTrophies, freshProfile.highestTrophies);
            const freshThreshold = getGradeThreshold(updatedTrophies);
            const finalThreshold = applyGradeRuleNeverLose(link.currentGradeThreshold, freshThreshold);

            const gradeChanged = finalThreshold !== link.currentGradeThreshold;

            if (!dryRun) {
              await this.verifyRepo.updatePlayerTrophies(link.player.id, freshProfile.highestTrophies);

              if (gradeChanged) {
                const member = await guild.members
                  .fetch(link.discordAccount.discordUserId)
                  .catch(() => null);

                if (member) {
                  await this.roleService.assignGradeRole(member, guildDbId, finalThreshold);
                  await this.verifyRepo.updateLinkGrade(link.id, finalThreshold, link.currentRoleId);
                  result.updated++;
                } else {
                  result.skipped++;
                }
              } else {
                result.skipped++;
              }
            } else {
              if (gradeChanged) result.updated++;
              else result.skipped++;
            }
          } catch (err) {
            logger.error({ err, tag: link.player.brawlTag }, 'Erreur batch refresh');
            result.errors++;
          }
          result.processed++;
        }),
      );

      if (i + BATCH_SIZE < allLinks.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
      }
    }

    logger.info(result, 'Batch refresh terminé');
    return result;
  }
}
