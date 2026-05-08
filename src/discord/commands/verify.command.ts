import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
  type ButtonInteraction,
  type GuildMember,
} from 'discord.js';
import { env } from '../../app/env.js';
import { buildVerifyModal, VERIFY_MODAL_ID, VERIFY_TAG_INPUT_ID } from '../interactions/verifyProfile.modal.js';
import {
  buildVerifyConfirmButton,
  isVerifyConfirmButton,
  extractChallengeId,
  isVerifyOpenButton,
} from '../interactions/verifyProfile.buttons.js';
import type { VerificationService } from '../../modules/verification/verification.service.js';
import type { GradeRepository } from '../../modules/grades/grade.repository.js';
import { logger } from '../../shared/logger.js';
import type { DiscordLogService } from '../logs/discordLog.service.js';
import { BrawlStarsApiError } from '../../shared/errors.js';

export const verifyCommandData = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('Lier et vérifier ton compte Brawl Stars');

export async function handleVerifyCommand(
  interaction: ChatInputCommandInteraction,
  _verificationService: VerificationService,
): Promise<void> {
  if (interaction.channelId !== env.VERIFY_CHANNEL_ID) {
    await interaction.reply({
      content: `Cette commande est uniquement disponible dans <#${env.VERIFY_CHANNEL_ID}>.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.showModal(buildVerifyModal());
}

export async function handleVerifyModal(
  interaction: ModalSubmitInteraction,
  verificationService: VerificationService,
  gradeRepo: GradeRepository,
  discordLog: DiscordLogService,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guildId) {
    await interaction.reply({ content: 'Cette commande ne peut être utilisée que sur un serveur.', ephemeral: true });
    return;
  }

  if (interaction.channelId !== env.VERIFY_CHANNEL_ID) {
    await interaction.reply({
      content: `Cette commande est uniquement disponible dans <#${env.VERIFY_CHANNEL_ID}>.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const rawTag = interaction.fields.getTextInputValue(VERIFY_TAG_INPUT_ID);
  const guildRow = await gradeRepo.getOrCreateGuild(interaction.guildId, interaction.guild?.name);

  try {
    const result = await verificationService.initiateVerification(
      interaction.user.id,
      guildRow.id,
      rawTag,
    );

    await interaction.editReply({
      content:
        `**Mets \`${result.brawlerName}\` en brawler favori** dans Brawl Stars, puis clique sur le bouton ci-dessous.\n` +
        `Tu as jusqu'à <t:${Math.floor(result.expiresAt.getTime() / 1000)}:T> pour confirmer.`,
      components: [buildVerifyConfirmButton(result.challengeId)],
    });
  } catch (err) {
    logger.error({ err, userId: interaction.user.id }, 'Erreur modal verify');
    if (err instanceof BrawlStarsApiError && err.statusCode === 404) {
      await interaction.editReply({ content: `Tag introuvable. Vérifie ton tag et réessaie.` });
    } else if (err instanceof Error && err.message.includes('Invalid tag')) {
      await interaction.editReply({ content: `Format de tag invalide. Il doit commencer par \`#\`.` });
    } else {
      await discordLog.logUnexpectedError('verify modal', err);
      await interaction.editReply({ content: 'Une erreur inattendue est survenue. Réessaie plus tard.' });
    }
  }
}

export function isVerifyModalSubmit(customId: string): boolean {
  return customId === VERIFY_MODAL_ID;
}

export async function handleVerifyButton(
  interaction: ButtonInteraction,
  verificationService: VerificationService,
  gradeRepo: GradeRepository,
  discordLog: DiscordLogService,
): Promise<void> {
  if (!isVerifyConfirmButton(interaction.customId)) return;
  if (!interaction.inGuild() || !interaction.guildId) return;

  const challengeId = extractChallengeId(interaction.customId);
  if (challengeId === null) {
    await interaction.reply({ content: 'Challenge invalide. Relance `/verify` ou clique à nouveau sur le bouton.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const member = interaction.member as GuildMember;
  const guildRow = await gradeRepo.getOrCreateGuild(interaction.guildId, interaction.guild?.name);

  try {
    const result = await verificationService.verifyChallenge(
      interaction.user.id,
      guildRow.id,
      challengeId,
      member,
    );

    switch (result.status) {
      case 'success': {
        const { data } = result;
        if (data.gradeThreshold === null) {
          await interaction.editReply({
            content:
              `✅ Compte \`${data.brawlTag}\` (${data.brawlName}) vérifié !\n` +
              `Ton record de trophées est **${data.highestTrophies.toLocaleString('fr-FR')}**.\n` +
              `Aucun rôle n'est attribué sous 10 000 trophées.`,
          });
        } else {
          const transfer = data.wasTransfer
            ? '\n> Ce tag était lié à un autre compte — le transfert a été effectué automatiquement.'
            : '';
          await interaction.editReply({
            content:
              `✅ Compte \`${data.brawlTag}\` (${data.brawlName}) vérifié !\n` +
              `Record de trophées : **${data.highestTrophies.toLocaleString('fr-FR')}** — Grade : **${data.gradeThreshold.toLocaleString('fr-FR')}**${transfer}`,
          });
        }
        break;
      }
      case 'wrong_brawler':
        await interaction.editReply({
          content:
            "Ton brawler favori ne correspond pas encore. Assure-toi d'avoir **sauvegardé** le changement dans Brawl Stars et réessaie.",
        });
        break;
      case 'expired':
        await interaction.editReply({
          content: 'Ce challenge a expiré. Clique à nouveau sur le bouton **Vérifier mon compte** pour recommencer.',
        });
        break;
      case 'not_found':
        await interaction.editReply({
          content: 'Challenge introuvable. Clique à nouveau sur le bouton **Vérifier mon compte** pour recommencer.',
        });
        break;
      default:
        await interaction.editReply({ content: 'État inattendu. Réessaie.' });
    }
  } catch (err) {
    logger.error({ err, userId: interaction.user.id, challengeId }, 'Erreur bouton verify');
    await discordLog.logUnexpectedError('verify button', err);
    await interaction.editReply({ content: 'Une erreur inattendue est survenue. Réessaie plus tard.' });
  }
}

// Ouvre le modal depuis le bouton persistant du panel
export async function handleVerifyOpenButton(interaction: ButtonInteraction): Promise<void> {
  if (!isVerifyOpenButton(interaction.customId)) return;
  await interaction.showModal(buildVerifyModal());
}
