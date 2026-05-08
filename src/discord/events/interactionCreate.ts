import type { Client } from 'discord.js';
import {
  handleVerifyCommand,
  handleVerifyModal,
  handleVerifyButton,
  handleVerifyOpenButton,
  isVerifyModalSubmit,
} from '../commands/verify.command.js';
import { handleGradeCommand } from '../commands/grade.command.js';
import { handleAdminCommand } from '../commands/admin.command.js';
import {
  isVerifyConfirmButton,
  isVerifyOpenButton,
} from '../interactions/verifyProfile.buttons.js';
import type { VerificationService } from '../../modules/verification/verification.service.js';
import type { GradeRepository } from '../../modules/grades/grade.repository.js';
import type { VerificationRepository } from '../../modules/verification/verification.repository.js';
import type { RoleAssignmentService } from '../../modules/discordRoles/roleAssignment.service.js';
import type { BrawlStarsClient } from '../../modules/brawlstars/brawlstars.client.js';
import type { BatchRefreshService } from '../../modules/refresh/batchRefresh.service.js';
import type { DiscordLogService } from '../logs/discordLog.service.js';
import { logger } from '../../shared/logger.js';

export function registerInteractionCreateEvent(
  client: Client,
  verificationService: VerificationService,
  gradeRepo: GradeRepository,
  verifyRepo: VerificationRepository,
  roleService: RoleAssignmentService,
  brawlStars: BrawlStarsClient,
  discordLog: DiscordLogService,
  batchRefresh: BatchRefreshService,
): void {
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        switch (interaction.commandName) {
          case 'verify':
            await handleVerifyCommand(interaction, verificationService);
            break;
          case 'grade':
            await handleGradeCommand(interaction, verifyRepo, gradeRepo);
            break;
          case 'admin':
            await handleAdminCommand(
              interaction,
              gradeRepo,
              verifyRepo,
              roleService,
              brawlStars,
              discordLog,
              batchRefresh,
            );
            break;
          default:
            logger.warn({ commandName: interaction.commandName }, 'Commande inconnue');
        }
        return;
      }

      if (interaction.isModalSubmit() && isVerifyModalSubmit(interaction.customId)) {
        await handleVerifyModal(interaction, verificationService, gradeRepo, discordLog);
        return;
      }

      if (interaction.isButton()) {
        if (isVerifyOpenButton(interaction.customId)) {
          await handleVerifyOpenButton(interaction);
          return;
        }
        if (isVerifyConfirmButton(interaction.customId)) {
          await handleVerifyButton(interaction, verificationService, gradeRepo, discordLog);
          return;
        }
      }
    } catch (err) {
      logger.error({ err }, 'Erreur interaction non gérée');
      await discordLog.logUnexpectedError('interactionCreate', err);
    }
  });
}
