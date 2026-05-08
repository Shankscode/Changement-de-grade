import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { getNextThreshold } from '../../modules/grades/grade.service.js';
import { MAX_THRESHOLD } from '../../modules/grades/grade.constants.js';
import type { VerificationRepository } from '../../modules/verification/verification.repository.js';
import type { GradeRepository } from '../../modules/grades/grade.repository.js';
import { env } from '../../app/env.js';
import { logger } from '../../shared/logger.js';

export const gradeCommandData = new SlashCommandBuilder()
  .setName('grade')
  .setDescription('Afficher ton grade Brawl Stars');

export async function handleGradeCommand(
  interaction: ChatInputCommandInteraction,
  verifyRepo: VerificationRepository,
  gradeRepo: GradeRepository,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guildId) {
    await interaction.reply({ content: 'Cette commande ne peut être utilisée que sur un serveur.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const guildRow = await gradeRepo.getGuildByDiscordId(interaction.guildId);
    if (!guildRow) {
      await interaction.editReply({
        content: `Aucune donnée pour ce serveur. Utilise \`/verify\` dans <#${env.VERIFY_CHANNEL_ID}> pour commencer.`,
      });
      return;
    }

    const discordAccount = await verifyRepo.getDiscordAccountByUserId(interaction.user.id);
    if (!discordAccount) {
      await interaction.editReply({
        content: `Tu n'as pas de compte lié. Lance \`/verify\` dans <#${env.VERIFY_CHANNEL_ID}> ou clique sur le bouton de vérification.`,
      });
      return;
    }

    const link = await verifyRepo.getActiveLinkWithDetails(discordAccount.id, guildRow.id);
    if (!link) {
      await interaction.editReply({
        content: `Tu n'as pas de compte actif lié. Lance \`/verify\` dans <#${env.VERIFY_CHANNEL_ID}> ou clique sur le bouton de vérification.`,
      });
      return;
    }

    const { player, currentGradeThreshold } = link;
    const trophies = player.highestTrophies;
    const threshold = currentGradeThreshold;

    let gradeRoleMention = 'Aucun';
    if (threshold !== null) {
      const gradeRoleRow = await gradeRepo.getGradeRoleByThreshold(guildRow.id, threshold);
      if (gradeRoleRow) {
        gradeRoleMention = `<@&${gradeRoleRow.discordRoleId}>`;
      }
    }

    const lines: string[] = [
      `**Compte Brawl Stars :** \`${player.brawlTag}\` (${player.brawlName ?? 'inconnu'})`,
      `**Record de trophées :** ${trophies.toLocaleString('fr-FR')}`,
    ];

    if (threshold === null) {
      lines.push(
        `**Grade :** Aucun (moins de 10 000 trophées)`,
        `**Prochain palier :** 10 000 trophées`,
        `**Rôle :** Aucun`,
      );
    } else if (threshold >= MAX_THRESHOLD) {
      lines.push(
        `**Grade :** ${threshold.toLocaleString('fr-FR')} (palier maximum)`,
        `**Rôle :** ${gradeRoleMention}`,
      );
    } else {
      const next = getNextThreshold(threshold);
      lines.push(
        `**Grade :** ${threshold.toLocaleString('fr-FR')}`,
        `**Prochain palier :** ${next?.toLocaleString('fr-FR') ?? '—'}`,
        `**Rôle :** ${gradeRoleMention}`,
      );
    }

    await interaction.editReply({ content: lines.join('\n') });
  } catch (err) {
    logger.error({ err, userId: interaction.user.id }, 'Erreur commande grade');
    await interaction.editReply({ content: 'Une erreur inattendue est survenue. Réessaie plus tard.' });
  }
}
